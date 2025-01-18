import { NS } from '@ns';
import { distribute, weakenThreadsNeeded } from 'code/batchSingle/util';
import { BATCH_STEP, distributeResults } from './constants';
import { attackType, getScript } from '../util/util';

// does not require formulas but will only perform one saturated batch attack at a time
// TODO: for simplicity we assume home does not have any cores
export async function main(ns: NS) {
    const flags = ns.flags([
        ['p', 0.5], // percent to hack
        ['h', false], // can use home server (will leave HOME_RESERVED untouched)
    ]);

    const target = (flags['_'] as string[])[0];
    if (!ns.serverExists(target)) {
        ns.tprint(`ERROR: Invalid server ${target}`);
        ns.exit();
    }

    const percent = flags['p'] as number;
    const includeHome = flags['h'] as boolean;

    await prep(ns, target, includeHome);

    while (true) {
        // TODO: batch saturation
        const hackAmt = ns.getServerMoneyAvailable(target) * percent;
        const hack = Math.floor(ns.hackAnalyzeThreads(target, hackAmt));
        const weakOne = weakenThreadsNeeded(ns, ns.hackAnalyzeSecurity(hack));
        const grow = Math.ceil(ns.growthAnalyze(target, ns.getServerMaxMoney(target) / hackAmt));
        const weakTwo = weakenThreadsNeeded(ns, ns.growthAnalyzeSecurity(grow));

        const dist = distribute(ns, hack, weakOne, grow, weakTwo, includeHome);
        if (!dist) {
            ns.tprintf("ERROR: Unable to run batch step.");
            ns.exit();
        }

        const t = deploy(ns, dist, target);
        ns.tprintf(`Started batch attack t=${ns.tFormat(t)}`);
        await ns.sleep(t);

        break;
    }
}

async function prep(ns: NS, target: string, includeHome: boolean) {
    const minSec = ns.getServerMinSecurityLevel(target);
    const curSec = ns.getServerSecurityLevel(target);
    const maxMon = ns.getServerMaxMoney(target);
    const curMon = ns.getServerMoneyAvailable(target);

    if (minSec == curSec && maxMon == curMon) return;

    // need to fix both money and security
    const weakOne = weakenThreadsNeeded(ns, curSec - minSec);
    let grow = 0;
    let weakTwo = 0;

    // check if we need to increase money as well
    if (maxMon != curMon) {
        grow = Math.ceil(ns.growthAnalyze(target, ns.getServerMaxMoney(target) / ns.getServerMoneyAvailable(target)));
        weakTwo = weakenThreadsNeeded(ns, ns.growthAnalyzeSecurity(grow, target));
    }

    const toDeploy = distribute(ns, 0, weakOne, grow, weakTwo, includeHome);
    if (!toDeploy) {
        ns.tprintf("ERROR: Unable to prepare server!");
        ns.exit();
    }

    const n = deploy(ns, toDeploy, target);
    ns.tprintf(`Preparing ${target} in ${ns.tFormat(n)}`);
    await ns.sleep(n + 100);
}

// returns length of attack
function deploy(ns: NS, res: distributeResults, target: string): number {
    function execute(attack: attackType, data: [string, number][], offset: number) {
        const script = getScript(attack);
        data.forEach(([server, threads]) => {
            if (threads == 0) return;
            ns.scp(script, server);
            // the first script should output when it finishes to allow for debugging
            ns.exec(script, server, threads, target, offset);
        });
    }

    const tHack = ns.getHackTime(target);
    const tGrow = ns.getGrowTime(target);
    const tWeak = ns.getWeakenTime(target);

    const hackOffset = tWeak - tHack - BATCH_STEP;
    const growOffset = tWeak - tGrow + BATCH_STEP;
    const weakTwoOffset = 2 * BATCH_STEP;

    execute('h', res.hack, hackOffset);
    execute('w', res.weakOne, 0);
    execute('g', [res.grow], growOffset);
    execute('w', res.weakTwo, weakTwoOffset)

    return tWeak + BATCH_STEP * 2;
}

import { NS } from '@ns';
import { batchThreads, distribute, runnable, weakenThreadsNeeded } from '/code/batch/util';
import { BATCH_INTERVAL, BATCH_STEP, HOME_RESERVED, distributeResults } from '/code/batch/constants';
import { allDeployableServers, attackType, getRam, getScript, msToTime } from '/code/util/util';

function help(ns: NS) {
    const msg = `\n
Repeatedly performs a batch (HWGW) against a target server. See also batch/stats.ts (batch-stats).
Requires Formulas.exe.

Usage: batch target [-p] [-h] [-s]
Flags:
    Name        Type        Default         Description
    target      string                      Name of target server.
    -p          float       0.5             Percentage to hack, 0 to 1.
    -h          bool        false           Allow home server to host HGW scripts (see also HOME_RESERVED).
    -s          int         -1              Maximum number of concurrent batches. -1 indicates no limit.
`;
    ns.tprint(msg);
}

// does not require formulas but will only perform one saturated batch attack at a time
// TODO: for simplicity we assume home does not have any cores
export async function main(ns: NS) {
    ns.disableLog('ALL');

    const flags = ns.flags([
        ['p', 0.5], // percent to hack
        ['h', false], // can use home server (will leave HOME_RESERVED untouched)
        ['s', -1], // max batch saturation
        ['help', false],
    ]);

    if (flags['help']) {
        help(ns);
        return;
    }

    const target = (flags['_'] as string[])[0];
    if (!ns.serverExists(target)) {
        ns.tprint(`ERROR: Invalid server ${target}`);
        ns.exit();
    }

    const percent = flags['p'] as number;
    const includeHome = flags['h'] as boolean;
    const saturation = flags['s'] as number;

    ns.ui.setTailTitle(`Batch - ${target} (p=${percent} s=${saturation})`);
    ns.ui.openTail();

    await prep(ns, target, includeHome);

    while (true) {
        // TODO: implement formulas
        const length = ns.getWeakenTime(target); // under count (no BATCH_SIZE * 2) for safety
        const baseSat = Math.floor(length / BATCH_INTERVAL);
        const sat = saturation == -1 ? baseSat : Math.min(baseSat, saturation);

        ns.print(`Starting cycle with a saturation of ${sat}`);

        let runTime = 0;
        for (let i = 0; i < sat; i++) {
            const [hack, weakOne, grow, weakTwo] = batchThreads(ns, target, percent);
            const [ret, dist] = distribute(ns, hack, weakOne, grow, weakTwo, includeHome);
            if (ret == -1) {
                ns.tprint(`ERROR: Unable to run batch step (${i} batches are active)`);
                ns.exit();
            }

            const [t, _] = deploy(ns, dist, target);
            runTime = t;

            if (false) {
                // TODO: figure out better way for desync detection
                await ns.sleep(BATCH_STEP / 2);
                await reset(ns, target, includeHome);
                await ns.sleep(BATCH_INTERVAL - BATCH_STEP / 2);
            } else await ns.sleep(BATCH_INTERVAL);
        }

        // wait remaining time
        if (saturation != -1) await ns.sleep((baseSat - sat) * BATCH_INTERVAL);
        // else await ns.sleep(BATCH_STEP / 2);

        ns.print(`Completed cycle r=${ns.tFormat(runTime)}`);

        // await ns.sleep(BATCH_STEP / 2);
    }
}

// set server to min security and max money, allowing for it to happen over multiple cycles
export async function prep(ns: NS, target: string, includeHome: boolean) {
    // first check if we can do this in a batch call
    const weakOne = weakenThreadsNeeded(ns, ns.getServerSecurityLevel(target) - ns.getServerMinSecurityLevel(target));
    const grow = ns.getServerMaxMoney(target) == ns.getServerMoneyAvailable(target)
        ? 0 : Math.ceil(ns.growthAnalyze(target, ns.getServerMaxMoney(target) / Math.max(ns.getServerMoneyAvailable(target), 1)));
    const weakTwo = weakenThreadsNeeded(ns, ns.growthAnalyzeSecurity(grow, target));

    const [ret, initialDist] = distribute(ns, 0, weakOne, grow, weakTwo, includeHome, false);
    if (ret != -1 && weakOne != 0 && weakTwo != 0 && grow != 0) {
        const [t, _] = deploy(ns, initialDist, target);
        ns.print(`INFO: Prepping server in one cycle (${msToTime(t)})`);
        await ns.sleep(t + 100);
    } else {
        // wg cycle, letting grow run across multiple servers
        // note that this isnt strictly optimal - we only run one cycle at a time
        // additionally we assume that all weak can be fit onto servers
        while (true) {
            const w = weakenThreadsNeeded(ns, ns.getServerSecurityLevel(target) - ns.getServerMinSecurityLevel(target));
            const [ret, dist] = distribute(ns, 0, w, 0, 0, includeHome);

            if (ret != 0 && ret != 1) {
                ns.tprintf('ERROR: Unable to distribute weaken threads for initial server preparation');
                ns.exit();
            }

            // now go over servers to see how many grow threads we can run
            let growNeeded = Math.ceil(ns.growthAnalyze(target, ns.getServerMaxMoney(target) / Math.max(ns.getServerMoneyAvailable(target), 1)));
            const servers = allDeployableServers(ns, includeHome) // sort by largest ram first
                .sort((a, b) => (ns.getServerMaxRam(b) - ns.getServerUsedRam(b)) - (ns.getServerMaxRam(a) - ns.getServerUsedRam(a)));
            
            const growStart = growNeeded;
            ns.print(`INFO: Starting initial server preparation cycle. Requires ${w} weak threads and ${growStart} grow threads.`);
            if (growNeeded == 0 && w == 0) break;

            servers.forEach(x => {
                if (growNeeded == 0) return;

                let ava = ns.getServerMaxRam(x) - ns.getServerUsedRam(x);
                // not necessarily optimal either, as we sort above by max ram not accounting for weak distribution
                if (x in dist.modifiedServers) ava = dist.modifiedServers[x];
                ava = Math.max(0, ava - (x == 'home' ? HOME_RESERVED : 0));

                const threads = Math.min(Math.floor(ava / getRam(ns, 'g')), growNeeded);
                if (threads > 0) {
                    dist.grow.push([x, threads]);
                    growNeeded -= threads;   
                }
            });

            const [t, _] = deploy(ns, dist, target);

            ns.print(`INFO: Distributed ${growStart - growNeeded} grow threads across ${dist.grow.length} servers. Next cycle in ${msToTime(t)}.`);

            await ns.sleep(t + 100);
        }
    }

    const s = ns.getServerSecurityLevel(target); const ss = ns.getServerMinSecurityLevel(target);
    const g = ns.getServerMoneyAvailable(target); const gg = ns.getServerMaxMoney(target);
    ns.print(`Finished preparation. Server is at ${s}/${ss} security and has ${ns.formatNumber(g)}/${ns.formatNumber(gg)} money`);
}

// note that this assumes 
export async function reset(ns: NS, target: string, includeHome: boolean) {
    const minSec = ns.getServerMinSecurityLevel(target);
    const curSec = ns.getServerSecurityLevel(target);
    const maxMon = ns.getServerMaxMoney(target);
    const curMon = ns.getServerMoneyAvailable(target);

    if (curSec == minSec && maxMon == curMon) {
        ns.print("SUCCESS: Server is already prepared, skipping");
        return;
    }

    if (curSec - minSec < 0.05 && maxMon - curMon <= 0.05 * maxMon) {
        ns.printf("WARN: Server was close enough to prepped, skipping");
        return;
    }

    // need to fix both money and security
    const weakOne = weakenThreadsNeeded(ns, curSec - minSec);
    let grow = 0;
    let weakTwo = 0;

    // check if we need to increase money as well
    if (maxMon != curMon) {
        grow = Math.ceil(ns.growthAnalyze(target, ns.getServerMaxMoney(target) / Math.max(ns.getServerMoneyAvailable(target), 1)));
        weakTwo = weakenThreadsNeeded(ns, ns.growthAnalyzeSecurity(grow, target));
    }

    const [ret, toDeploy] = distribute(ns, 0, weakOne, grow, weakTwo, includeHome);
    if (ret != 0 && ret != 1) {
        ns.tprint("ERROR: Unable to prepare server!");
        ns.exit();
    }

    const [n, _] = deploy(ns, toDeploy, target);
    ns.print(`ERROR: Server destabilized, resetting in ${msToTime(n)}`);
    await ns.sleep(n + 100);

    if (ns.getServerMaxMoney(target) == ns.getServerMoneyAvailable(target) &&
        ns.getServerMinSecurityLevel(target) == ns.getServerSecurityLevel(target))
        ns.print("Successfully prepared server");
    else {
        ns.tprint("ERROR: Unable to prepare server");
        ns.exit();
    }
}

// returns length of attack, pids to watch
function deploy(ns: NS, res: distributeResults, target: string): [number, number[]] {
    function execute(attack: attackType, data: [string, number][], offset: number) {
        const script = getScript(attack);
        let pid = -1;
        data.forEach(([server, threads]) => {
            if (threads <= 0) return; // threads might be 0 or -1
            ns.scp(script, server);
            // TODO: add in case to catch when we arent able to execute script (pid = 0)
            pid = ns.exec(script, server, threads, target, offset);

            if (pid == 0) {
                ns.tprint(`ERROR: Unable to execute script on ${server}`);
                ns.exit();
            }
        });

        return pid;
    }

    const tHack = ns.getHackTime(target);
    const tGrow = ns.getGrowTime(target);
    const tWeak = ns.getWeakenTime(target);

    const hackOffset = tWeak - tHack - BATCH_STEP;
    const growOffset = tWeak - tGrow + BATCH_STEP;
    const weakTwoOffset = 2 * BATCH_STEP;

    return [tWeak + BATCH_STEP * 2, [
        execute('h', res.hack, hackOffset),
        execute('w', res.weakOne, 0),
        execute('g', res.grow, growOffset),
        execute('w', res.weakTwo, weakTwoOffset)
    ]];
}

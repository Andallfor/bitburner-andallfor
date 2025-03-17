import { HackingFormulas, NS, Server } from "@ns";
import { allDeployableServers, attackType, getRam, getScript } from "code/util/util";
import { HOME_RESERVED, distributeResults } from "/code/batch/constants";

export const CHILDREN = {
    hack: '/code/batch/deployable/hack.js',
    grow: '/code/batch/deployable/grow.js',
    weak: '/code/batch/deployable/weak.js',
}

/** Find the best servers to run each action on
 * 1 -> hack over multiple
 * 0 -> success
 * -1 -> impossible
 */
export function distribute(ns: NS, hack: number, weakOne: number, grow: number, weakTwo: number, includeHome: boolean, err = true, startServerState: Record<string, number> = {}): [number, distributeResults] {
    if (hack < 0 || weakOne < 0 || grow < 0 || weakTwo < 0) {
        ns.tprint(`ERROR: Distribute was called with requested threads < 0 (h: ${hack}, g: ${grow}, w1: ${weakOne}, w2: ${weakTwo})`);
        hack = Math.max(hack, 0);
        grow = Math.max(grow, 0);
        weakOne = Math.max(weakOne, 0);
        weakTwo = Math.max(weakTwo, 0);
    }

    // filter out all servers that are already full (min cost fora hack/grow/weak script is 1.7 gb)
    const servers = allDeployableServers(ns, includeHome).filter(x => getUsableRam(ns, x, startServerState) > 1.7);
    // lowest ram first
    servers.sort((a, b) => getUsableRam(ns, a, startServerState) - getUsableRam(ns, b, startServerState));

    const output: distributeResults = {
        hack: [],
        grow: [],
        weakOne: [],
        weakTwo: [],
        modifiedServers: startServerState,
    };

    // note that we need all grows to occur from the same script
    // and prefer hacks to be the same
    // but only grow is necessary since multi grows will reduce effectiveness and therefore eventually cause server to run out of money
    // while hack's reduced effectiveness just means we dont make as much money as possible

    // allocate grow - fill up the smallest server
    if (grow != 0) {
        const needed = grow * getRam(ns, 'g');

        for (let i = 0; i < servers.length; i++) {
            const s = servers[i];
            let ava = getUsableRam(ns, s, output.modifiedServers);
    
            if (ava >= needed) {
                output.grow.push([s, grow]);
                output.modifiedServers[s] = ava - needed;
                grow = 0;
    
                break;
            }
        }

        if (output.grow.length == 0) {
            if (err) ns.tprint(`ERROR: Cannot distribute ${grow} grow threads (max=${runnable(ns, servers[servers.length - 1], 'g')})`);
            return [-1, output];
        }
    }

    // distribute hack
    let hackOverMultiple = false;
    if (hack != 0) {
        // first check for the smallest server that can hold hack
        for (let i = 0; i < servers.length; i++) {
            const s = servers[i];
            const ava = getUsableRam(ns, s, output.modifiedServers);

            if (Math.floor(ava / getRam(ns, 'h')) >= hack) {
                output.hack.push([s, hack]);
                output.modifiedServers[s] = ava - hack * getRam(ns, 'h');
                hack = 0;

                break;
            }
        }

        // werent able to put hack into one server, so distribute over the rest
        if (hack != 0) {
            for (let i = 0; i < servers.length; i++) {
                const s = servers[i];
                const ava = getUsableRam(ns, s, output.modifiedServers);

                const n = Math.min(Math.floor(ava / getRam(ns, 'h')), hack);
                if (n != 0) {
                    hack -= n;
                    output.hack.push([s, n]);
                    output.modifiedServers[s] = ava - n * getRam(ns, 'h');
                }

                if (hack == 0) break;
            }

            // TODO: it seems like we dont check if hack is fully allocated?
            if (err) ns.tprint(`WARNING: Hacking will occur over ${output.hack.length} attacks`);
            hackOverMultiple = true;
        }
    }

    // now distribute weaks
    for (let i = 0; i < servers.length; i++) {
        const s = servers[i];

        let ava = getUsableRam(ns, s, output.modifiedServers);

        // TODO: remove code duplication
        let t = Math.floor(ava / getRam(ns, 'w'));
        if (weakOne != 0) {
            const n = Math.min(t, weakOne);
            if (n != 0) {
                t -= n;
                weakOne -= n;
                ava -= n * getRam(ns, 'w');

                output.weakOne.push([s, n]);
            }
        }

        if (weakTwo != 0) {
            const n = Math.min(t, weakTwo);
            if (n != 0) {
                t -= n;
                weakTwo -= n;
                ava -= n * getRam(ns, 'w');

                output.weakTwo.push([s, n]);
            }
        }

        output.modifiedServers[s] = ava;
        if (weakOne == 0 && weakTwo == 0) break;
    }

    if (weakOne != 0 || weakTwo != 0) {
        if (err) ns.tprint(`ERROR: Unable to fully allocate weak threads! (Overflow: 1=${weakOne} 2=${weakTwo})`);
        return [-1, output];
    }

    return [hackOverMultiple ? 1 : 0, output];
}

function getUsableRam(ns: NS, server: string, modifiedServers: Record<string, number>) {
    if (server in modifiedServers) return modifiedServers[server];
    const max = ns.getServerMaxRam(server) - (server == 'home' ? HOME_RESERVED : 0);
    const cur = ns.getServerUsedRam(server);

    return max - cur;
}

export function runnable(ns: NS, server: string, attack: attackType) {
    const cur = ns.getServerUsedRam(server);
    let max = ns.getServerMaxRam(server);
    if (server == 'home') max -= HOME_RESERVED;

    return Math.floor((max - cur) / getRam(ns, attack));
}

// note that this is guaranteed to never underestimate threads needed
export function weakenThreadsNeeded(ns: NS, amt: number, thres = 0.05) { // 0.05 is base impact of a thread
    let ceil = 100_000;
    let floor = 1;

    if (ns.weakenAnalyze(ceil) < amt) {
        ns.tprint(`ERROR: Attempting to calculate threads needed for a weaken by ${amt} (req threads > 100k)`);
        ns.exit();
    }

    if (amt == 0) return 0;

    // TODO: generic-ize this
    let ind = 0;
    while (floor < ceil) {
        const m = (ceil + floor) / 2;
        const w = ns.weakenAnalyze(m);

        // ensure do not undershoot
        if (w - amt >= 0 && w - amt < thres) return Math.ceil(m);
        else if (amt < w) ceil = m;
        else floor = m;

        ind++;
        if (ind > 20) break;
    }

    return Math.ceil((ceil + floor) / 2);
}

export function batchThreads(ns: NS, target: string, percent: number) {
    const server = ns.getServer(target);
    server.hackDifficulty = server.minDifficulty!;
    server.moneyAvailable = server.moneyMax!;

    const hackPerThread = ns.formulas.hacking.hackPercent(server, ns.getPlayer());
    const hack = Math.floor(percent / hackPerThread);
    const weakOne = weakenThreadsNeeded(ns, ns.hackAnalyzeSecurity(hack));
    // over count as buffer
    server.moneyAvailable -= server.moneyMax! * percent;
    const grow = Math.ceil(1.1 * ns.formulas.hacking.growThreads(server, ns.getPlayer(), server.moneyMax!));
    const weakTwo = weakenThreadsNeeded(ns, ns.growthAnalyzeSecurity(grow));

    return [hack, weakOne, grow, weakTwo];
}

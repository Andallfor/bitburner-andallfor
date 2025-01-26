import { HackingFormulas, NS, Server } from "@ns";
import { allDeployableServers, attackType, getRam, getScript } from "code/util/util";
import { HOME_RESERVED, distributeResults } from "/code/batch/constants";

/** Find the best servers to run each action on */
export function distribute(ns: NS, hack: number, weakOne: number, grow: number, weakTwo: number, includeHome: boolean): distributeResults | undefined {
    const servers = allDeployableServers(ns, includeHome);
    // lowest ram first
    servers.sort((a, b) => 
        (ns.getServerMaxRam(a) - ns.getServerUsedRam(a)) -
        (ns.getServerMaxRam(b) - ns.getServerUsedRam(b))
        
    );

    const output: distributeResults = {
        hack: [],
        grow: ['', 0],
        weakOne: [],
        weakTwo: [],
        modifiedServers: {},
    };

    // note that we need all grows to occur from the same script
    // and prefer hacks to be the same
    // but only grow is necessary since multi grows will reduce effectiveness and therefore eventually cause server to run out of money
    // while hack's reduced effectiveness just means we dont make as much money as possible

    // allocate grow - fill up the smallest server
    if (grow != 0) {
        for (let i = 0; i < servers.length; i++) {
            const s = servers[i];
            let ava = getUsableRam(ns, s, output.modifiedServers);
            const needed = grow * getRam(ns, 'g');
    
            if (ava >= needed) {
                output.grow = [s, grow];
                output.modifiedServers[s] = ava - needed;
                grow = 0;
    
                break;
            }
        }

        if (output.grow[0].length == 0) {
            ns.tprint(`ERROR: Cannot distribute ${grow} grow threads (max=${runnable(ns, servers[0], 'g')})`);
            return undefined;
        }
    }

    // distribute hack
    if (hack != 0) {
        // first check for the smallest server that can hold hack
        for (let i = 0; i < servers.length; i++) {
            const s = servers[i];
            let ava = getUsableRam(ns, s, output.modifiedServers);
            let t = Math.floor(ava / getRam(ns, 'h'));

            if (t >= hack) {
                output.hack.push([s, hack]);
                output.modifiedServers[s] = ava - hack * getRam(ns, 'h');
                hack = 0;
            }
        }

        // werent able to put hack into one server, so distribute over the rest
        if (hack != 0) {
            for (let i = 0; i < servers.length; i++) {
                const s = servers[i];
                let ava = getUsableRam(ns, s, output.modifiedServers);
                let t = Math.floor(ava / getRam(ns, 'h'));

                const n = Math.min(t, hack);
                if (n != 0) {
                    t -= n;
                    hack -= n;
                    output.hack.push([s, n]);

                    output.modifiedServers[s] = ava - n * getRam(ns, 'h');
                }
            }

            ns.tprint(`WARNING: Hacking will occur over ${output.hack.length} attacks`);
        }
    }

    // now distribute weaks
    servers.forEach(s => {
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
    });

    if (weakOne != 0 || weakTwo != 0) {
        ns.tprint(`ERROR: Unable to fully allocate weak threads! (Overflow: 1=${weakOne} 2=${weakTwo})`);
        return undefined;
    }

    return output;
}

function getUsableRam(ns: NS, server: string, modifiedServers: Record<string, number>) {
    if (server in modifiedServers) return modifiedServers[server];
    
    const max = ns.getServerMaxRam(server) * (server == 'home' ? HOME_RESERVED : 1);
    const cur = ns.getServerUsedRam(server);

    return max - cur;
}

export function runnable(ns: NS, server: string, attack: attackType) {
    const cur = ns.getServerUsedRam(server);
    let max = ns.getServerMaxRam(server);
    if (server == 'home') max *= HOME_RESERVED;

    return Math.floor((max - cur) / getRam(ns, attack));
}

// note that this is guaranteed to never underestimate threads needed
export function weakenThreadsNeeded(ns: NS, amt: number, thres = 0.05) { // 0.05 is base impact of a thread
    let ceil = 100_000;
    let floor = 1;

    if (ns.weakenAnalyze(ceil) < amt) {
        ns.tprint(`ERROR: Attempting to calculate threads needed for a weaken by ${amt} (req threads > 10k)`);
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
    const hackAmt = ns.getServerMaxMoney(target) * percent;
    const hack = Math.floor(ns.hackAnalyzeThreads(target, hackAmt));
    const weakOne = weakenThreadsNeeded(ns, ns.hackAnalyzeSecurity(hack));
    // over count as buffer
    const grow = Math.ceil(1.1 * ns.growthAnalyze(target, ns.getServerMaxMoney(target) / Math.max(ns.getServerMaxMoney(target) - hackAmt, 1)));
    const weakTwo = weakenThreadsNeeded(ns, ns.growthAnalyzeSecurity(grow));

    return [hack, weakOne, grow, weakTwo];
}

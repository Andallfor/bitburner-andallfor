import { NS } from "@ns";
import { allDeployableServers, attackType, getRam } from "code/util/util";
import { HOME_RESERVED } from "code/batchSingle/main";

interface distributeResults {
    hack: [string, number][], // where number is number of threads
    grow: [string, number],
    weakOne: [string, number][],
    weakTwo: [string, number][],
    // tracks what servers have been affected by hack/grow and their remaining ram
    // TODO: this allows chaining distributes together
    modifiedServers: Record<string, number>,
}

/** Find the best servers to run each action on */
export function distribute(ns: NS, hack: number, weakOne: number, grow: number, weakTwo: number, includeHome: boolean): distributeResults {
    const servers = allDeployableServers(ns, includeHome);
    // highest ram first
    servers.sort((a, b) => 
        (ns.getServerMaxRam(b) - ns.getServerUsedRam(b)) -
        (ns.getServerMaxRam(a) - ns.getServerUsedRam(a))
    );

    const output: distributeResults = {
        hack: [],
        grow: ['', 0],
        weakOne: [],
        weakTwo: [],
        modifiedServers: {},
    };

    // first try and allocate hack and grow
    let growValid = false, hackValid = false;
    for (let i = 0; i < servers.length; i++) {
        // prioritize grow first since it will take more threads than hack
        const s = servers[i];
        let ava = ns.getServerMaxRam(s) * (s == 'home' ? HOME_RESERVED : 1) - ns.getServerUsedRam(s);
        if (!growValid) {
            const growRamRemaining = grow * getRam(ns, 'g');
            if (growRamRemaining <= ava) {
                growValid = true;
                output.grow = [s, grow];
                ava -= growRamRemaining;
            } else {
                // since grow must be done in one iteration we know this is impossible
                // since we are past the first element (the highest ram value) and so all servers will have less ram
                // and also be impossible
                ns.tprintf(`ERROR: Cannot distribute ${grow} grow threads (max = ${runnable(ns, servers[0], 'g')})`);
                ns.exit();
            }
        }

        // now distribute hack
        if (hack * getRam(ns, 'h') <= ava) {
            // the rest of our hack threads fits
            output.hack.push([s, hack]);
            ava -= hack * getRam(ns, 'h');
            hack = 0;
            hackValid = true;
        } else {
            // on first iteration the server may be filled by grow but the next server might have enough space - so check ahead
            // to see if it can - if it cant then fill up current server, otherwise wait
            if (i == 0 && runnable(ns, servers[1], 'h') >= hack) continue

            // fit as many hacks as possible into the server
            const num = runnable(ns, s, 'h');
            output.hack.push([s, num]);
            hack -= num;
            ava -= num * getRam(ns, 'h');
        }

        output.modifiedServers[s] = ava;

        if (growValid && hackValid) break;
    }

    if (!growValid || !hackValid) {
        ns.tprintf(`ERROR: Unable to fully allocate hack/grow thread! (Overflow: g=${grow} h=${hack}`);
        ns.exit();
    }

    // now distribute weaks
    // sort modifiedServers by lowest ram, then fill until we run out of weakOne/weakTwo threads
    // TODO:

    let weak = weakOne + weakTwo;

    return output;
}

export function deploy(res: distributeResults) {
    // TODO: remember to account for 0 threads
}

export function runnable(ns: NS, server: string, attack: attackType) {
    const cur = ns.getServerUsedRam(server);
    let max = ns.getServerMaxRam(server);
    if (server == 'home') max *= HOME_RESERVED;

    return Math.floor((max - cur) / getRam(ns, attack));
}

// note that this is guaranteed to never underestimate threads needed
export function weakenThreadsNeeded(ns: NS, amt: number, thres = 0.01) {
    let ceil = 10_000;
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

        if (ind++ > 20) break;
    }

    return -1;
}

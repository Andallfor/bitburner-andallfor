import { NS } from "@ns";
import { run } from "../util/util";

// only uses purchased servers
export async function main(ns: NS) {
    const flags = ns.flags([
        ['b', []], // servers blacklist
        ['w', []], // servers whitelist - higher precedence than blacklist
        ['h', -1], // amt of gibs to not touch on home
    ]);

    const h = flags['h'] as number;
    const share = '/code/util/share.js';
    const cost = ns.getScriptRam(share);

    const toRun: [string, number][] = [];

    if (h != -1) toRun.push(['home', Math.floor((unused(ns, 'home') - h) / cost)]);

    const whitelist = flags['w'] as string[];
    const blacklist = flags['b'] as string[];
    ns.getPurchasedServers().forEach(x => {
        if (whitelist.length != 0 && !whitelist.includes(x)) return;
        else if (blacklist.includes(x)) return;

        toRun.push([x, Math.floor(unused(ns, x) / cost)])
    });

    const [n, pids] = run(ns, toRun, share);

    // getSharePower takes a frame to update
    await ns.sleep(100);
    // cant use settimeout; getSharePower errors out
    ns.tprintf(`Running share with ${n} threads for a ${ns.formatNumber(ns.getSharePower() * 100 - 100, undefined, undefined, true)}%% increase`)

    ns.atExit(() => pids.forEach(p => ns.kill(p)));
    while (true) {
        await ns.sleep(1_000);
    }
}

function unused(ns: NS, server: string) {
    return ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
}
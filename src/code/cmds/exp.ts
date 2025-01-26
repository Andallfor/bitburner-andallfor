import { NS } from "@ns";
import { prep } from "/code/batch/main";
import { run } from "/code/util/util";

export async function main(ns: NS) {
    const flags = ns.flags([
        ['b', []], // blacklist
        ['w', []], // whitelist
        ['h', -1], // amt of gibs to not touch on home (-1 do not use home)
    ]);

    const file = '/code/util/perpetualGrow.js';
    const cost = ns.getScriptRam(file);
    const target = 'joesguns';

    await prep(ns, target, false);

    const toRun: [string, number][] = [];
    const whitelist = flags['w'] as string[];
    const blacklist = flags['b'] as string[];
    const h = flags['h'] as number;
    ns.getPurchasedServers().forEach(x => {
        if (whitelist.length != 0 && !whitelist.includes(x)) return;
        else if (blacklist.includes(x)) return;

        toRun.push([x, Math.floor(unused(ns, x) / cost)])
    });

    if (h != -1) toRun.push(['home', Math.floor((unused(ns, 'home') - h) / cost)]);

    const [n, pids] = run(ns, toRun, file, [target]);

    ns.atExit(() => pids.forEach(p => ns.kill(p)));
    while (true) {
        await ns.sleep(1_000);
    }
}

function unused(ns: NS, server: string) {
    return ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
}
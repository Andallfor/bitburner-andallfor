import { NS } from "@ns";
import { prep } from "/code/batch/main";

export async function main(ns: NS) {
    const flags = ns.flags([
        ['b', []], // blacklist
        ['w', []] // whitelist
    ]);

    const file = '/code/exp/perpetualGrow.js';
    const cost = ns.getScriptRam(file);
    const target = 'joesguns';

    await prep(ns, target, false);

    const toRun: [string, number][] = [];
    const whitelist = flags['w'] as string[];
    const blacklist = flags['b'] as string[];
    ns.getPurchasedServers().forEach(x => {
        if (whitelist.length != 0 && !whitelist.includes(x)) return;
        else if (blacklist.includes(x)) return;

        toRun.push([x, Math.floor((ns.getServerMaxRam(x) - ns.getServerUsedRam(x)) / cost)])
    });

    // TODO: generic-ize (see cmds/share)
    const pids: number[] = [];
    let n = 0;
    toRun.forEach(([server, threads]) => {
        if (threads == 0) return;

        ns.scp(file, server);
        const pid = ns.exec(file, server, threads, target);
        if (pid != 0) {
            pids.push(pid);
            n += threads;
        }
    });

    ns.atExit(() => pids.forEach(p => ns.kill(p)));
    while (true) {
        await ns.sleep(1_000);
    }
}
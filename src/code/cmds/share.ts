import { NS } from "@ns";

// only uses purchased servers
export async function main(ns: NS) {
    const flags = ns.flags([
        ['h', 1], // home ram reserved (1 = dont touch home)
        ['b', []], // servers blacklist
        ['w', []], // servers whitelist - higher precedence than blacklist
    ]);

    const homeReserved = flags['h'] as number;
    const share = '/code/util/share.js';
    const cost = ns.getScriptRam(share);

    const toRun: [string, number][] = [];

    if (homeReserved < 1) {
        toRun.push([
            'home', 
            Math.floor((ns.getServerMaxRam('home') * homeReserved - ns.getServerUsedRam('home')) / cost)
        ]);
    }

    const whitelist = flags['w'] as string[];
    const blacklist = flags['b'] as string[];
    ns.getPurchasedServers().forEach(x => {
        if (whitelist.length != 0 && !whitelist.includes(x)) return;
        else if (blacklist.includes(x)) return;

        toRun.push([x, Math.floor((ns.getServerMaxRam(x) - ns.getServerUsedRam(x)) / cost)])
    });

    const pids: number[] = [];
    let n = 0;
    toRun.forEach(([server, threads]) => {
        ns.scp(share, server);
        const pid = ns.exec(share, server, threads);
        if (pid != 0) {
            pids.push(pid);
            n += threads;
        }
    });

    // getSharePower takes a frame to update
    await ns.sleep(100);
    // cant use settimeout; getSharePower errors out
    ns.tprintf(`Running share with ${n} threads for a ${ns.formatNumber((1 - ns.getSharePower()) * 100, undefined, undefined, true)}%% increase`)

    ns.atExit(() => pids.forEach(p => ns.kill(p)));
    while (true) {
        await ns.sleep(1_000);
    }
}

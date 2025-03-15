import { NS } from "@ns";
import { allDeployableServers, allHackableServers, getRam, msToTime } from "../util/util";
import { BATCH_INTERVAL, BATCH_STEP, HOME_RESERVED } from "./constants";
import { batchThreads, weakenThreadsNeeded } from "./util";

type _bi = 'server' | 'prep' | 'cycleTime' | 'saturation' | 'totalRam' | 'profitPerSec' | 'profitPerRam' | 'maxContiguousRam';

interface batchInfo {
    server: string,
    prep: number,
    cycleTime: number,
    saturation: number,
    totalRam: number,
    profitPerSec: number,
    profitPerRam: number,
    maxContiguousRam: number,
}

const BATCH_HEADER: Record<_bi, string> = {
    server: 'Server',
    prep: 'Preparation',
    cycleTime: 'Cycle Length',
    saturation: 'Saturation',
    totalRam: 'RAM Needed',
    maxContiguousRam: 'Max Contiguous RAM',
    profitPerSec: 'Profit/Sec',
    profitPerRam: 'Profit/RAM'
}

function help(ns: NS) {
    const msg = `\n
Displays batch related information for all accessible servers. See also batch/main.ts (batch).
By default sorts by profit per second and hides servers that require more RAM than is available.
Requires Formulas.exe!

Usage batch-info [-p] [-h] [-r] [-n] [-i] [-s]
Flags:
    Name        Type        Default         Description
    -p          float       0.5             Percentage of each server's money to hack.
    -n          int         10              Number of displayed entries.
    -s          int         -1              Max allowed saturation amount. -1 indicates unlimited.
    -r          bool        false           Sort by profit per unit RAM.
    -i          bool        false           Include servers that would require too much RAM.
    -h          bool        false           Include home server in RAM calculations.
`;
    ns.tprint(msg);
}

export async function main(ns: NS) {
    const flags = ns.flags([
        ['p', 0.5],
        ['r', false], // sort by profit per ram (whereas default is per sec)
        ['n', 10], // number of entries to show
        ['s', -1], // saturation
        ['i', false], // show invalid servers (not enough ram)
        ['h', false], // include home server in ram calculations
        ['help', false],
    ]);

    if (flags['help']) {
        help(ns);
        return;
    }

    if (!ns.fileExists('Formulas.exe')) {
        ns.tprintf("ERROR: Script requires formulas api");
        ns.exit();
    }

    ns.tprintf('\n');

    const fh = ns.formulas.hacking;
    const p = ns.getPlayer();
    const percent = flags['p'] as number;
    const numEntries = flags['n'] as number;
    const invalidAllowed = flags['i'] as boolean;
    const useHome = flags['h'] as boolean;
    const allowedSaturation = flags['s'] as number;

    const totalCost = allDeployableServers(ns, useHome).reduce((prev, s) => {
        const r = prev + ns.getServerMaxRam(s);
        return r - (s == 'home' ? HOME_RESERVED : 0)
    }, 0);
        

    const _data: batchInfo[] = [];

    allHackableServers(ns).forEach((s) => {
        const server = ns.getServer(s);

        // prep
        const prepTime = ns.getWeakenTime(s);

        // batches
        server.hackDifficulty = server.minDifficulty!;
        server.moneyAvailable = server.moneyMax!;

        const batchLength = fh.weakenTime(server, p); // same as batch/main.ts
        const maxSaturation = Math.floor(batchLength / BATCH_INTERVAL);
        const saturation = allowedSaturation != -1 ? Math.min(maxSaturation, allowedSaturation) : maxSaturation;
    
        const profit = server.moneyAvailable * percent;
        const hackThreads = percent / fh.hackPercent(server, p);
        const weakOneThreads = weakenThreadsNeeded(ns, ns.hackAnalyzeSecurity(hackThreads));
        server.moneyAvailable -= server.moneyAvailable * percent;
        const growThreads = Math.ceil(fh.growThreads(server, p, server.moneyMax!) * 1.1);
        const weakTwoThreads = weakenThreadsNeeded(ns, ns.growthAnalyzeSecurity(growThreads));

        const htr = hackThreads * getRam(ns, 'h');
        const gtr = growThreads * getRam(ns, 'g');
        const w1tr = weakOneThreads * getRam(ns, 'w');
        const w2tr = weakTwoThreads * getRam(ns, 'w');
        const ram = htr + gtr + w1tr + w2tr;
        const maxConRam = Math.max(htr, gtr, w1tr, w2tr);

        const profitPerSec = fh.hackChance(server, p) * (saturation / maxSaturation) * (profit / BATCH_INTERVAL) * 1000; // interval is ms
        const profitPerRam = profit / ram;

        const ramPerCycle = saturation * ram;

        if (!invalidAllowed && ramPerCycle > totalCost) return;

        _data.push({
            server: s,
            prep: prepTime,
            cycleTime: batchLength,
            saturation: saturation,
            totalRam: ramPerCycle,
            profitPerRam: profitPerRam,
            profitPerSec: profitPerSec,
            maxContiguousRam: maxConRam
        });
    });

    _data.sort((a, b) => flags['r'] as boolean ? b.profitPerRam - a.profitPerRam : b.profitPerSec - a.profitPerSec);
    const data: Record<_bi, string>[] = _data.map(x => format(ns, x));

    // is there a better way to do this?
    const widthKey: Record<string, number> = {};
    for (const [key, header] of Object.entries(BATCH_HEADER)) {
        let length = header.length;
        data.forEach((info) => length = Math.max(info[key as _bi].length, length));

        widthKey[key] = length + 2;
    }

    let formatted = '';
    let i = 0;
    for (const info of Object.values(data)) {
        if (i == 0) {
            let header = '│';
            let barrier = '├';

            let j = 0;
            for (const key of Object.keys(info)) {
                header += pad(BATCH_HEADER[key as _bi], widthKey[key]);
                barrier += '─'.repeat(widthKey[key]) + (j == Object.keys(info).length - 1 ? '┤' : '┼');

                j++;
            }

            formatted += `${header}\n${barrier}\n`;
        }

        let line = '│';
        for (const [key, value] of Object.entries(info)) line += pad(value, widthKey[key]);
        formatted += line + '\n';

        i++;

        if (i == numEntries) break;
    }

    ns.tprintf(formatted);
    ns.tprintf("\nMax available RAM: " + ns.formatRam(totalCost));

    const serverRams: Record<number, number> = {};
    allDeployableServers(ns, useHome).forEach(x => {
        let ram = ns.getServerMaxRam(x);
        if (x == 'home') ram -= HOME_RESERVED;

        if (ram in serverRams) serverRams[ram]++;
        else serverRams[ram] = 1;
    });

    ns.tprintf('Current server availabilities:');
    Object.entries(serverRams)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .forEach((entry) => ns.tprintf(`${ns.formatRam(Number(entry[0]))}: ${entry[1]}`));
}

function format(ns: NS, data: batchInfo): Record<_bi, string> {
    // note that the order of elements here determines the print order on screen
    return {
        server: data.server,
        prep: msToTime(data.prep),
        cycleTime: msToTime(data.cycleTime),
        saturation: '' + data.saturation,
        totalRam: ns.formatRam(data.totalRam),
        profitPerSec: ns.formatNumber(data.profitPerSec),
        profitPerRam: ns.formatNumber(data.profitPerRam),
        maxContiguousRam: ns.formatRam(data.maxContiguousRam),
    };
}

function pad(str: string, length: number) {
    return (' ' + str).padEnd(length, ' ') + '│';
}
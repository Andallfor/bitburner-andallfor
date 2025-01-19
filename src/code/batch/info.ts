import { NS } from "@ns";
import { allDeployableServers, allHackableServers, getRam, msToTime } from "../util/util";
import { BATCH_INTERVAL, BATCH_STEP } from "./constants";
import { weakenThreadsNeeded } from "./util";

type _bi = 'server' | 'prep' | 'cycleTime' | 'saturation' | 'totalRam' | 'profitPerSec' | 'profitPerRam';

interface batchInfo {
    server: string,
    prep: number,
    cycleTime: number,
    saturation: number,
    totalRam: number,
    profitPerSec: number,
    profitPerRam: number
}

const BATCH_HEADER: Record<_bi, string> = {
    server: 'Server',
    prep: 'Preparation',
    cycleTime: 'Cycle Length',
    saturation: 'Saturation',
    totalRam: 'RAM Needed',
    profitPerSec: 'Profit/Sec',
    profitPerRam: 'Profit/RAM'
}

export async function main(ns: NS) {
    if (!ns.fileExists('Formulas.exe')) {
        ns.tprintf("ERROR: Script requires formulas api");
        ns.exit();
    }

    const flags = ns.flags([
        ['p', 0.5],
        ['v', false], // only show valid servers TODO:
        ['r', false], // sort by profit per ram (whereas default is per sec)
        ['n', 10], // number of entries to show
        ['i', false], // show invalid servers (not enough ram)
        ['m', false], // only use servers max ram when calculating if it is invalid or not
    ]);

    const fh = ns.formulas.hacking;
    const p = ns.getPlayer();
    const percent = flags['p'] as number;
    const n = flags['n'] as number;
    const invalidAllowed = flags['i'] as boolean;
    const m = flags['m'] as boolean;

    const totalCost = allDeployableServers(ns, false).reduce((prev, acc) =>
        prev + (m ? ns.getServerMaxRam(acc) : ns.getServerMaxRam(acc) - ns.getServerUsedRam(acc)), 0);

    const _data: batchInfo[] = [];

    allHackableServers(ns).forEach((s) => {
        const server = ns.getServer(s);

        // prep
        const prepTime = ns.getWeakenTime(s);

        // batches
        server.hackDifficulty = server.minDifficulty!;
        server.moneyAvailable = server.moneyMax!;

        const batchLength = fh.weakenTime(server, p); // same as batch/main.ts
        const saturation = Math.floor(batchLength / BATCH_INTERVAL);
    
        const profit = server.moneyAvailable * percent;
        const hackThreads = percent / fh.hackPercent(server, p);
        const weakOneThreads = weakenThreadsNeeded(ns, ns.hackAnalyzeSecurity(hackThreads));
        server.moneyAvailable -= server.moneyAvailable * percent;
        const growThreads = fh.growThreads(server, p, server.moneyMax!);
        const weakTwoThreads = weakenThreadsNeeded(ns, ns.growthAnalyzeSecurity(growThreads));

        const ram = hackThreads * getRam(ns, 'h') + (weakOneThreads + weakTwoThreads) * getRam(ns, 'w') + growThreads * getRam(ns, 'g');

        const profitPerSec = profit / BATCH_INTERVAL * 1000 * fh.hackChance(server, p); // interval is ms
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

        if (i == n) break;
    }

    ns.tprintf(formatted);
    ns.tprintf("Available RAM: " + ns.formatRam(totalCost));
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
    };
}

function pad(str: string, length: number) {
    return (' ' + str).padEnd(length, ' ') + '│';
}
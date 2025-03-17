import { NS } from "@ns";
import { allDeployableServers, allHackableServers, getRam, msToTime, pad } from "../util/util";
import { BATCH_INTERVAL, BATCH_STEP, HOME_RESERVED } from "./constants";
import { batchThreads, distribute, weakenThreadsNeeded } from "./util";
import { colorValid, strLenWithoutColors, toCyan, toWhite, toGreen, toRed, toPink } from "../util/colors";

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
    valid: number,
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
Displays batch related information for all accessible servers. See also batch/main.ts (batch). By default sorts by profit per second.
Requires Formulas.exe!

Usage batch-stats [-p] [-h] [-r] [-n] [-v] [-s]
Flags:
    Name        Type        Default         Description
    -p          float       0.5             Percentage of each server's money to hack.
    -n          int         25              Number of displayed entries.
    -s          int         -1              Max allowed saturation amount. -1 indicates unlimited.
    -r          bool        false           Sort by profit per unit RAM.
    -v          bool        false           Disable batch simulation to determine whether or not a batch can run.
    -h          bool        false           Include home server in RAM calculations.
    -m          bool        false           Batch simulation will only consider server max RAM.

Notes: Server name indicates whether or not a batch is able to be run (${toRed('invalid')}, ${toPink('valid but hack occurs over multiple threads')}, ${toGreen('valid')}, ${toWhite('unknown')}).
`;
    ns.tprint(msg);
}

export async function main(ns: NS) {
    const flags = ns.flags([
        ['p', 0.5],
        ['r', false], // sort by profit per ram (whereas default is per sec)
        ['n', 25], // number of entries to show
        ['s', -1], // saturation
        ['v', false], // should disable batch simulation
        ['h', false], // include home server in ram calculations
        ['m', false],
        ['help', false],
    ]);

    if (flags['help']) {
        help(ns);
        return;
    }

    ns.disableLog('ALL');

    if (!ns.fileExists('Formulas.exe')) {
        ns.tprintf("ERROR: Script requires formulas api");
        ns.exit();
    }

    const fh = ns.formulas.hacking;
    const p = ns.getPlayer();
    const percent = flags['p'] as number;
    const numEntries = flags['n'] as number;
    const disableBatchSim = flags['v'] as boolean;
    const useHome = flags['h'] as boolean;
    const allowedSaturation = flags['s'] as number;

    const totalCost = allDeployableServers(ns, useHome).reduce((prev, s) => {
        const r = prev + ns.getServerMaxRam(s);
        return r - (s == 'home' ? HOME_RESERVED : 0)
    }, 0);
        

    let _data: batchInfo[] = [];

    allHackableServers(ns).forEach((s) => {
        const server = ns.getServer(s);

        // prep
        const prepTime = ns.getWeakenTime(s);

        // batches
        server.hackDifficulty = server.minDifficulty!;
        server.moneyAvailable = server.moneyMax!;

        const batchLength = fh.weakenTime(server, p) + BATCH_STEP * 2;
        const maxSaturation = Math.floor(batchLength / BATCH_INTERVAL);
        const saturation = allowedSaturation != -1 ? Math.min(maxSaturation, allowedSaturation) : maxSaturation;

        const profit = server.moneyAvailable * percent;
        const [hackThreads, weakOneThreads, growThreads, weakTwoThreads] = batchThreads(ns, s, percent);

        const htr = hackThreads * getRam(ns, 'h');
        const gtr = growThreads * getRam(ns, 'g');
        const w1tr = weakOneThreads * getRam(ns, 'w');
        const w2tr = weakTwoThreads * getRam(ns, 'w');
        const ram = htr + gtr + w1tr + w2tr;
        const maxConRam = Math.max(htr, gtr, w1tr, w2tr);

        const profitPerSec = fh.hackChance(server, p) * (saturation / maxSaturation) * (profit / BATCH_INTERVAL) * 1000; // interval is ms
        const profitPerRam = profit / ram;

        const ramPerCycle = saturation * ram;

        _data.push({
            server: s,
            prep: prepTime,
            cycleTime: batchLength,
            saturation: saturation,
            totalRam: ramPerCycle,
            profitPerRam: profitPerRam,
            profitPerSec: profitPerSec,
            maxContiguousRam: maxConRam,
            valid: -2,
        });
    });

    _data = _data.sort((a, b) => flags['r'] as boolean ? b.profitPerRam - a.profitPerRam : b.profitPerSec - a.profitPerSec).slice(0, numEntries);

    const totalSimulations = disableBatchSim ? 0 : _data.reduce((acc, x) => x.totalRam <= totalCost && x.totalRam * 1.25 >= totalCost ? acc + x.saturation : acc, 0);
    if (!disableBatchSim) ns.tprintf(`Please wait, currently simulating batch cycles... (n=${totalSimulations})`);
    for (let i = 0; i < _data.length; i++) {
        const x = _data[i];
        // simulate batch to see if we can run or not
        // TODO: this is very expensive!
        let state = -2;
        if (x.totalRam > totalCost) state = -1;
        else if (x.totalRam * 1.25 < totalCost) state = 2; // we probably can run
        else if (!disableBatchSim) {
            const [hackThreads, weakOneThreads, growThreads, weakTwoThreads] = batchThreads(ns, x.server, percent);

            state = 0;

            let serverState: Record<string, number> = {};
            if (flags['m']) allDeployableServers(ns, useHome).forEach(x => serverState[x] = ns.getServerMaxRam(x) - (x == 'home' ? HOME_RESERVED : 0));

            // TODO: for some reason, saturation is not being calculated correctly (under estimate) and so this doesn't correctly simulate
            for (let i = 0; i < x.saturation; i++) {
                const [ret, dist] = distribute(ns, hackThreads, weakOneThreads, growThreads, weakTwoThreads, useHome, false, serverState);

                serverState = dist.modifiedServers;
                if (ret == -1) {
                    state = -1;
                    break;
                } else if (ret == 1) state = 1;

                if (i % 1000 == 0) await ns.sleep(1);
            }
        }

        _data[i].valid = state;
    }

    const data: Record<_bi, string>[] = _data.map(x => format(ns, x));

    // is there a better way to do this?
    const widthKey: Record<string, number> = {};
    for (const [key, header] of Object.entries(BATCH_HEADER)) {
        let length = header.length;
        data.forEach((info) => length = Math.max(strLenWithoutColors(info[key as _bi]), length));

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
                header += ' ' + pad(BATCH_HEADER[key as _bi], widthKey[key]) + '│';
                barrier += '─'.repeat(widthKey[key]) + (j == Object.keys(info).length - 1 ? '┤' : '┼');

                j++;
            }

            formatted += `${header}\n${barrier}\n`;
        }

        let line = '│';
        for (const [key, value] of Object.entries(info)) line += ' ' + pad(value, widthKey[key]) + '│';
        formatted += line + '\n';

        i++;
    }

    ns.tprintf(formatted);
    ns.tprintf("Max available RAM: " + ns.formatRam(totalCost));
    /*
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
    */
}

function format(ns: NS, data: batchInfo): Record<_bi, string> {
    // note that the order of elements here determines the print order on screen
    const s = data.valid == -2 ? toWhite(data.server)
            : data.valid == -1 ? toRed(data.server)
            : data.valid == 1 ? toPink(data.server)
            : data.valid == 2 ? toCyan(data.server)
            : toGreen(data.server);

    return {
        server: s,
        prep: msToTime(data.prep),
        cycleTime: msToTime(data.cycleTime),
        saturation: '' + data.saturation,
        totalRam: ns.formatRam(data.totalRam),
        profitPerSec: ns.formatNumber(data.profitPerSec),
        profitPerRam: ns.formatNumber(data.profitPerRam),
        maxContiguousRam: ns.formatRam(data.maxContiguousRam),
    };
}

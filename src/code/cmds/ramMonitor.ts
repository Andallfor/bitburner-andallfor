import { NS } from "@ns"
import { allDeployableServers, pad } from "../util/util";

export async function main(ns: NS) {
    ns.disableLog('ALL');
    ns.ui.openTail();

    while (true) {
        ns.clearLog();

        const table: [string, number, number][] = [];
        let maxNameLength = 0;
        let totalRam = 0;
        let totalUsedRam = 0;
        allDeployableServers(ns, true).forEach(x => {
            if (ns.getServerMaxRam(x) == 0) return;

            totalRam += ns.getServerMaxRam(x);
            totalUsedRam += ns.getServerUsedRam(x);

            maxNameLength = Math.max(maxNameLength, x.length);
            table.push([x, ns.getServerUsedRam(x) / ns.getServerMaxRam(x), ns.getServerMaxRam(x)]);
        });
        table.sort((a, b) => b[2] - a[2]);

        const msg = `${pad('Utilized RAM', maxNameLength + 4)}${bar(totalUsedRam / totalRam)} ${asPercent(totalUsedRam / totalRam)} (${ns.formatRam(totalUsedRam)} / ${ns.formatRam(totalRam)})
${table.map(x => `${pad(x[0], maxNameLength + 4)}${bar(x[1])} ${asPercent(x[1])} (${ns.formatRam(ns.getServerUsedRam(x[0]), 0)} / ${ns.formatRam(x[2], 0)})`).join('\n')}
`;
        ns.print(msg);

        await ns.sleep(1000);
    }
}

function bar(percent: number, length = 40) {
    const n = Math.ceil(percent * length);
    return `[${'■'.repeat(n)}${'-'.repeat(length - n)}]`;
}

function asPercent(percent: number) {
    const n = Math.round(percent * 100);
    const color = n == 0 ? '\x1b[38;5;46m'
                : n < 20 ? '\x1b[38;5;148m'
                : n < 40 ? '\x1b[38;5;142m'
                : n < 60 ? '\x1b[38;5;220m'
                : n < 80 ? '\x1b[38;5;208m'
                : n < 100 ? '\x1b[38;5;202m'
                : '\x1b[38;5;196m'

    return color + ('' + n).padStart(3, ' ') + '%\x1b[m';
}
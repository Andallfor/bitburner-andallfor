import { NS } from "@ns";

export async function main(ns: NS) {
    const flags = ns.flags([
        ['l', false], // list all servers
        ['s', ''], // server to be used
        ['b', 0], // buy/upgrade (1 -> 20)
        ['q', 0], // print cost of doing buy action (1 -> 20)
        // TODO: renaming servers
    ]);

    const servers = ns.getPurchasedServers();
    if (flags['l']) {
        ns.tprintf("Max RAM is " + ns.formatRam(ns.getPurchasedServerMaxRam()));
        ns.tprintf(`Servers: (${servers.length}/${ns.getPurchasedServerLimit()}):`)
        ns.tprintf(servers.map(x => `${x} (${Math.log2(ns.getServerMaxRam(x))}|${ns.formatRam(ns.getServerMaxRam(x))})`).join('\n'));
    } else {
        let target = flags['s'] as string;
        if (target.length == 0) target = (flags['_'] as string[])[0];

        if (flags['b']) {
            if (!target) {
                ns.tprintf("ERROR: Please enter a targeted server (either with -t flag or as first argument)");
                ns.exit();
            }

            const b = flags['b'] as number;

            if (servers.includes(target)) {
                const cost = ns.getPurchasedServerUpgradeCost(target, 2 ** b);
                if (cost > ns.getPlayer().money) {
                    ns.tprintf(`ERROR: You do not have enough money ($${ns.formatNumber(cost)})`);
                    ns.exit();
                }

                ns.upgradePurchasedServer(target, 2 ** b);
                ns.tprintf(`Successfully upgraded ${target} to ${ns.formatRam(2 ** b)}`);
            } else {
                const cost = ns.getPurchasedServerCost(2 ** b);
                if (cost > ns.getPlayer().money) {
                    ns.tprintf(`ERROR: You do not have enough money ($${ns.formatNumber(cost)})`);
                    ns.exit();
                }

                ns.purchaseServer(target, 2 ** b);
                ns.tprintf(`Successfully purchased ${target} with ${ns.formatRam(2 ** b)}`);
            }
        } else if (flags['q'] != 0) {
            const q = flags['q'] as number;
            if (validateServer(ns, target)) {
                ns.tprintf(`Going from ${ns.formatRam(ns.getServerMaxRam(target))} -> ${ns.formatRam(2 ** q)}`);
                ns.tprintf('Cost to upgrade is $' + ns.formatNumber(ns.getPurchasedServerUpgradeCost(target, 2** q)));
            } else {
                ns.tprintf("Going from 0 -> " + ns.formatRam(2 ** q));
                ns.tprintf('Cost to buy is $' + ns.formatNumber(ns.getPurchasedServerCost(2 ** q)));
            }
        }
    }
}

function validateServer(ns: NS, server: string | undefined) {
    if (server) {
        if (!ns.getPurchasedServers().includes(server)) {
            ns.tprintf(`ERROR: Unable to find server "${server}"`);
            ns.exit();
        }

        return true;
    }

    return false;
}
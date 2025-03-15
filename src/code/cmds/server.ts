import { NS } from "@ns";

function help(ns: NS) {
    const msg = `\n
Utility function for managing personal servers.

Usage: server -l
       server target [-s target] -b int
       server [target] [-s target] -q int
       server -a -b int
       server -a -q int
Flags:
    Name        Type        Default         Description
    -l          bool        false           List all personal servers.
    -s          string                      Set focused server. Can also be specified by setting target as the first argument.
    -b          int                         Upgrades (if target/-s exists) or buys (if it does not exist) personal server to the target level.
    -q          int                         Displays the required cost to upgrade/buy a personal server at the input level.
    -a          bool        false           Mass purchase/upgrade servers. Will prioritize buying new servers rather than upgrading.
`;
    ns.tprint(msg);
}

export async function main(ns: NS) {
    const flags = ns.flags([
        ['l', false], // list all servers
        ['s', ''], // server to be used
        ['b', 0], // buy/upgrade (1 -> 20)
        ['q', 0], // print cost of doing buy action (1 -> 20)
        ['a', false],
        ['help', false],
        // TODO: renaming servers
    ]);

    if (flags['help']) {
        help(ns);
        return;
    }

    const servers = ns.getPurchasedServers();

    if (flags['l']) { // display all servers
        ns.tprintf("Max RAM is " + ns.formatRam(ns.getPurchasedServerMaxRam()));
        ns.tprintf(`Servers: (${servers.length}/${ns.getPurchasedServerLimit()}):`)
        ns.tprintf(servers.map(x => `${x} (${Math.log2(ns.getServerMaxRam(x))} -> ${ns.formatRam(ns.getServerMaxRam(x))})`).join('\n'));

        return;
    }

    if (flags['a']) {
        const c = flags['b'] ? flags['b'] as number : flags['q'] as number;

        const base = ns.getPurchasedServerCost(2 ** c);
        let money = ns.getPlayer().money;

        const avaNewServers = ns.getPurchasedServerLimit() - servers.length;
        const newServers = Math.min(avaNewServers, Math.floor(money / base));
        money -= newServers * base;

        let inc = newServers * (2 ** c);

        const upgradedServers: string[] = [];
        servers
            .sort((a, b) => ns.getServerMaxRam(a) - ns.getServerMaxRam(b))
            .filter(x => ns.getServerMaxRam(x) < (2 ** c))
            .forEach(x => { // sort by min bc upgrading them will give the most ram
            const cost = ns.getPurchasedServerUpgradeCost(x, 2 ** c);
            if (cost <= money) {
                upgradedServers.push(x);
                money -= cost;
                inc += 2 ** c - ns.getServerMaxRam(x);
            }
        });

        if (flags['b']) {
            upgradedServers.forEach(x => ns.upgradePurchasedServer(x, 2 ** c));
            for (let i = 0; i < newServers; i++) ns.purchaseServer(`s${servers.length + i + 1}`, 2 ** c);

            ns.tprintf(`Successfully purchased ${newServers} servers and upgraded ${upgradedServers.length} servers`);
            ns.tprintf(`Increased RAM by ${ns.formatRam(inc)}`);
        } else if (flags['q'] != 0) {
            ns.tprintf(`Querying upgrade/purchase of all servers to ${ns.formatRam(2 ** c)} (base cost of ${ns.formatNumber(base)})`);
            ns.tprintf(`Will be able to purchase ${newServers} new servers and upgrade ${upgradedServers.length} servers for ${ns.formatNumber(ns.getPlayer().money - money)}`);
            ns.tprintf(`Will increase RAM by ${ns.formatRam(inc)}`);
        } else {
            ns.tprintf("Unknown argument set. Please see below for how to use this command.");
            help(ns);
        }

        return;
    }

    let target = flags['s'] as string;
    if (target.length == 0) target = (flags['_'] as string[])[0];

    if (flags['b']) {
        if (!target && !flags['s']) {
            ns.tprintf("ERROR: Please enter a targeted server (either with -t flag or as first argument)");
            ns.exit();
        }

        const b = flags['b'] as number;

        if (servers.includes(target)) { // upgrade server
            const cost = ns.getPurchasedServerUpgradeCost(target, 2 ** b);
            if (cost > ns.getPlayer().money) {
                ns.tprintf(`ERROR: You do not have enough money ($${ns.formatNumber(cost)})`);
                ns.exit();
            }

            ns.upgradePurchasedServer(target, 2 ** b);
            ns.tprintf(`Successfully upgraded ${target} to ${ns.formatRam(2 ** b)}`);
        } else { // purchase server
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
    } else {
        ns.tprintf("Unknown argument set. Please see below for how to use this command.");
            help(ns);
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
import { NS } from "@ns";

export async function main(ns: NS) {
    const p = ns.getPlayer();
    ns.tprintf(`Karma: ${ns.formatNumber(p.karma)}`);
    ns.tprintf(`Killed: ${p.numPeopleKilled}`);
}
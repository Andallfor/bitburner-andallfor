import { NS } from '@ns';
import { weakenThreadsNeeded } from 'code/batchSingle/util';

export const HOME_RESERVED = 64;
export const BATCH_STEP = 50; // time between h/g/w
export const BATCH_INTERVAL = 4 * BATCH_STEP; // length of single batch

// does not require formulas but will only perform one saturated batch attack at a time
// TODO: for simplicity we assume home does not have any cores
export async function main(ns: NS) {
    const flags = ns.flags([
        ['p', 0.5], // percent to hack
        ['h', false], // can use home server (will leave HOME_RESERVED untouched)
    ]);

    const target = (flags['_'] as string[])[0];
    if (!ns.serverExists(target)) {
        ns.tprint(`ERROR: Invalid server ${target}`);
        ns.exit();
    }

    // first, prep the server

    // note that we need all grows to occur from the same script
    // and prefer hacks to be the same
    // but only grow is necessary since multi grows will reduce effectiveness and therefore eventually cause server to run out of money
    // while hack's reduced effectiveness just means we dont make as much money as possible
}

async function prep(ns: NS, server: string) {
    const minSec = ns.getServerMinSecurityLevel(server);
    const curSec = ns.getServerSecurityLevel(server);
    const maxMon = ns.getServerMaxMoney(server);
    const curMon = ns.getServerMoneyAvailable(server);

    if (minSec == curSec && maxMon == curMon) return;

    // need to fix both money and security
    if (maxMon != curMon) {

    } else if (minSec != curSec) { // we only need to fix security
        const n = weakenThreadsNeeded(ns, curSec - minSec);
    }
}

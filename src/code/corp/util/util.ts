import { CorpStateName, NS } from "@ns";

export async function waitUntilNext(ns: NS, state: CorpStateName) {
    let next = false;
    while (true) {
        if (!next) next = ns.corporation.getCorporation().nextState == state;
        else if (ns.corporation.getCorporation().prevState == state) break;

        // TODO:
        // at base each cycle takes 10 seconds - 5 states, so 2 seconds each. however with bonus time a cycle goes down to 1 second, i.e. each state takes 0.2 seconds
        await ns.sleep(200);
    }
}
import { NS } from "@ns";

// target additionalMs port (-1 for no port)
export async function main(ns: NS) {
    await ns.hack(ns.args[0] as string, {additionalMsec: ns.args[1] as number});
    const port = ns.args[2] as number;
    if (port != -1) ns.writePort(port, 0);
}
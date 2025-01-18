import { NS } from "@ns";

export async function main(ns: NS) {
  await ns.hack(ns.args[0] as string, {additionalMsec: (ns.args[1] ?? 0) as number});
}
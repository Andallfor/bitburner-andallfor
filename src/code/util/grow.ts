import { NS } from "@ns";

export async function main(ns: NS) {
  await ns.grow(ns.args[0] as string, {additionalMsec: (ns.args[1] ?? 0) as number});
  ns.tprintf("\u001b[32mGrow\u001b[0m");
}
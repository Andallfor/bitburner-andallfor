import { NS } from "@ns";

export async function main(ns: NS) {
    await ns.grow(ns.args[0] as string);
  }
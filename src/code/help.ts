import { NS } from "@ns";

export async function main(ns: NS) {
    const message = `
    __    _               _          _   _    __                 __
   / /   /_\\    _ _    __| |  __ _  | | | |  / _|  ___   _ _    / /
  / /   / _ \\  | ' \\  / _\` | / _\` | | | | | |  _| / _ \\ | '_|  / / 
 /_/   /_/ \\_\\ |_||_| \\__,_| \\__,_| |_| |_| |_|   \\___/ |_|   /_/  

Last updated: 3/14/25

=== TODO ===
Have batch account for increasing player levels
Improve/clean up singleAttack - maybe just remove?
Better server/batch monitor.

=== Meta Information ===
- Connect VSCode via 'npm run watch'
- Remember to check aliases! (alias cmd)
- This file only contains information about user interactable scripts/commands (e.g. will not describe code/util)
- More specific information, such as arguments, can be found by calling the below scripts with the --help flag.

=== Scripts ===
Commands (/cmds)
- crime.ts          crime           Information on karma and people killed.
- exp.ts            exp             Farm hacking experience.
- gainAccess.ts     gain-access     Unlock all accessible servers.
- server.ts         server          Utility for controlling personal servers.
- share.ts          share           Faction experience share.
- stats.ts          stats           Various server statistics.

Batching (/batch)
- stats.ts          batch-stats      Relevant batch info for each server. Requires Formulas.exe.
- main.ts           batch           Execute a batch command.  

Simple Attacks (/singleAttack)
- main.ts           single-attack   Attack a single server.

Contracts (/contract)
- main.ts           cct             Look for and complete contracts.

=== Misc. ===
- You need ~158k total reputation to get 100 favor and at least 470k for 150 favor.
`;
    ns.tprint(message);
}


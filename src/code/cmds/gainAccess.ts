import { NS } from "@ns";
import { allServersString } from "code/util/util";

/* Gain access to all avaliable servers */
export async function main(ns: NS) {
  const servers = allServersString(ns);
  const changes: string[] = [];

  let attackablePorts = 0;
  if (ns.fileExists("FTPCrack.exe")) attackablePorts++;
  if (ns.fileExists("BruteSSH.exe")) attackablePorts++;
  if (ns.fileExists("HTTPWorm.exe")) attackablePorts++;
  if (ns.fileExists("SQLInject.exe")) attackablePorts++;
  if (ns.fileExists("relaySMTP.exe")) attackablePorts++;

  servers.forEach((server: string) => {
    if (ns.hasRootAccess(server) || ns.getServerNumPortsRequired(server) > attackablePorts) return;

    if (ns.fileExists("FTPCrack.exe")) ns.ftpcrack(server);
    if (ns.fileExists("BruteSSH.exe")) ns.brutessh(server);
    if (ns.fileExists("HTTPWorm.exe")) ns.httpworm(server);
    if (ns.fileExists("SQLInject.exe")) ns.sqlinject(server);
    if (ns.fileExists("relaySMTP.exe")) ns.relaysmtp(server);

    ns.nuke(server);

    changes.push(server);
  });

  if (changes.length > 0) ns.tprintf(`Successfully gained access to ${changes.length} servers:\n` + changes.join(', '));
  else ns.tprintf("No servers were affected");

  getInfo(ns, "CSEC", "CyberSec");
  getInfo(ns, "avmnite-02h", "NiteSec");
  getInfo(ns, "I.I.I.I", "The Black Hand");
  getInfo(ns, "run4theh111z", "BitRunners");
}

function getInfo(ns: NS, server: string, faction: string) {
  ns.tprintf(`${server} (${faction}) is backdoored: ${ns.getServer(server).backdoorInstalled} (req: ${ns.getServerRequiredHackingLevel(server)})`);
}
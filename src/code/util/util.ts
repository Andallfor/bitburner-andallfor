import { NS, Server } from "@ns";
import { strLenWithoutColors } from "./colors";

/** Get all servers on map (as Server object) */
export function allServers(ns: NS): Server[] {
  return allServersString(ns).map((s) => ns.getServer(s));
}

/** Get all servers that can be hacked */
export function allHackableServers(ns: NS): string[] {
  const servers = allServersString(ns);

  return servers.filter((server: string) => 
    ns.hasRootAccess(server) &&
    ns.getServerRequiredHackingLevel(server) <= ns.getHackingLevel() &&
    ns.getServerMaxMoney(server) != 0);
}

/** Get all servers that we can run code on (excluding home) */
export function allDeployableServers(ns: NS, includeHome = false): string[] {
  return allServersString(ns).filter((server: string) => 
    ns.hasRootAccess(server) &&
    (includeHome ? true : server != 'home') &&
    ns.getServerMaxRam(server) > 0);
}

/** Get all servers on map */
export function allServersString(ns: NS): string[] {
  const visited: string[] = [];
  const frontier: string[] = ['home'];

  while (frontier.length > 0) {
    const s = frontier.pop()!;
    const next: string[] = ns.scan(s);

    visited.push(s);

    next.forEach((server) => {
      if (visited.includes(server)) return;
      frontier.push(server);
    })
  }

  return visited;
}

export type attackType = 'h' | 'w' | 'g';
export function getScript(attack: attackType) {
  switch (attack) {
    case 'h': return '/code/util/hack.js';
    case 'w': return '/code/util/weak.js';
    case 'g': return '/code/util/grow.js';
  }
}

export function getRam(ns: NS, attack: attackType) {
  return ns.getScriptRam(getScript(attack));
}

// https://stackoverflow.com/questions/19700283/how-to-convert-time-in-milliseconds-to-hours-min-sec-format-in-javascript
export function msToTime(ms: number) {
  let seconds = Number((ms / 1000).toFixed(1));
  let minutes = Number((ms / (1000 * 60)).toFixed(1));
  let hours = Number((ms / (1000 * 60 * 60)).toFixed(1));
  let days = (ms / (1000 * 60 * 60 * 24)).toFixed(1);
  if (seconds < 60) return seconds + " Sec";
  else if (minutes < 60) return minutes + " Min";
  else if (hours < 24) return hours + " Hrs";
  else return days + " Days"
}

/** [server, threads] -> [number of threads, script pids[]] */
export function run(ns: NS, data: [string, number][], file: string, args: string[] = []): [number, number[]] {
  const pids: number[] = [];
  let n = 0;

  data.forEach(([server, threads]) => {
    if (threads <= 0) return;

    ns.scp(file, server);
    const pid = ns.exec(file, server, threads, ...args);
    if (pid != 0) {
        pids.push(pid);
        n += threads;
    }
  });

  return [n, pids];
}

export function pad(str: string, length: number) {
  const baseLen = strLenWithoutColors(str);
  for (let i = 1; i < length - baseLen; i++) str += ' ';
  return str;
}

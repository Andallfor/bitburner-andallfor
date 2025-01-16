import { NS } from "@ns";
import { allServersString } from "code/util/util";

interface serverData {
  'Name': string,
  'RAM': string,
  'Max Money': string,
  'Current Money': string,
  'Growth Factor': string,
  'Min Security': string,
  'Current Security': string,
  'Difficulty': string,
  'Hack Chance': string,
  'Hack Time': string,
  'Grow Time': string,
  'Weak Time': string,
}

interface _serverData {
  'Name': string,
  'RAM': number,
  'Max Money': number,
  'Current Money': number,
  'Growth Factor': number,
  'Min Security': number,
  'Current Security': number,
  'Difficulty': number,
  'Hack Chance': number,
  'Hack Time': number,
  'Grow Time': number,
  'Weak Time': number,
}

export async function main(ns: NS) {
  const data: Record<string, serverData> = {};
  const servers: string[] = [];

  const query: ((ns: NS, x: _serverData) => boolean)[] = [];

  const flags = ns.flags([
    ['target', 'all'],
    ['single', false], // filter for only servers that are worth single attack
    ['hack', false], // filter for only servers that can be hacked
  ])

  // if argument is provided, only examine that server
  if (flags['target'] != 'all') {
    if (ns.serverExists(flags['target'] as string)) servers.push(flags['target'] as string);
    else {
      ns.tprintf("ERROR: Server does not exist.");
      return;
    }
  } else servers.push(...allServersString(ns));

  if (flags['single']) query.push(filterSingle);
  if (flags['hack']) query.push(filterHack);

  servers.forEach(x => {
    const s = analyze(ns, x);

    let valid = true;
    query.forEach((req) => {
      if (!valid) return;
      if (!req(ns, s)) valid = false;
    });

    if (!valid) return;

    data[x] = toFormatted(ns, s);
  });

  // get the widest element's length
  const widthKey: Record<string, number> = {};
	for (const server of Object.values(data)) {
		for (const [key, value] of Object.entries(server)) {
			let length = Math.max(value.length, key.length) + 2;

      if (!(key in widthKey)) widthKey[key] = length;
      else widthKey[key] = Math.max(length, widthKey[key]);
		}
	}

	// format data
	let formatted = '';
	let index = 0;
	for (const server of Object.values(data)) {
		if (index == 0) {
			let header = '│';
			let barrier = '├';
			let jndex = 0;

			for (const key of Object.keys(server)) {
				header += format(key, widthKey[key]);
				barrier += '─'.repeat(widthKey[key]) + (jndex == Object.keys(server).length - 1 ? '┤' : '┼'); // js moment

				jndex++;
			}

			formatted += header + '\n' + barrier + '\n';	
		}

		let line = '│';
		for (const [key, value] of Object.entries(server)) line += format(value, widthKey[key]);
		formatted += line + '\n';

		index++;
	}

  // for some reason tprintf errors
	ns.tprint('\n' + formatted);
}

function analyze(ns: NS, server: string): _serverData {
  const s = ns.getServer(server);

  return {
    'Name': server,
    'RAM': s.maxRam,
    'Max Money': s.moneyMax ?? 0,
    'Current Money': s.moneyAvailable ?? 0,
    'Growth Factor': s.serverGrowth ?? 0,
    'Min Security': s.minDifficulty ?? 0,
    'Current Security': s.hackDifficulty ?? 0,
    'Difficulty': s.requiredHackingSkill ?? 0,
    'Hack Chance': ns.hackAnalyzeChance(server),
    'Hack Time': ns.getHackTime(server),
    'Grow Time': ns.getGrowTime(server),
    'Weak Time': ns.getWeakenTime(server),
  }
}

function toFormatted(ns: NS, inp: _serverData): serverData {
  const s = ns.getServer(inp['Name']);

  return {
    'Name': inp['Name'],
    'RAM': ns.formatRam(inp['RAM']),
    'Max Money': ns.formatNumber(inp['Max Money']),
    'Current Money': ns.formatNumber(inp['Current Money']),
    'Growth Factor': ns.formatNumber(inp['Growth Factor']),
    'Min Security': ns.formatNumber(inp['Min Security']),
    'Current Security': ns.formatNumber(inp['Current Security']), 
    'Difficulty': ns.formatNumber(inp['Difficulty']),
    'Hack Chance': ns.formatPercent(inp['Hack Chance']),
    'Hack Time': msToTime(inp['Hack Time']),
    'Grow Time': msToTime(inp['Grow Time']),
    'Weak Time': msToTime(inp['Weak Time']),
  }
}

function format(str: string, length: number) {
	return (' ' + str).padEnd(length, ' ') + '│';
}

// https://stackoverflow.com/questions/19700283/how-to-convert-time-in-milliseconds-to-hours-min-sec-format-in-javascript
function msToTime(ms: number) {
  let seconds = Number((ms / 1000).toFixed(1));
  let minutes = Number((ms / (1000 * 60)).toFixed(1));
  let hours = Number((ms / (1000 * 60 * 60)).toFixed(1));
  let days = (ms / (1000 * 60 * 60 * 24)).toFixed(1);
  if (seconds < 60) return seconds + " Sec";
  else if (minutes < 60) return minutes + " Min";
  else if (hours < 24) return hours + " Hrs";
  else return days + " Days"
}

function filterSingle(ns: NS, inp: _serverData): boolean {
  return filterHack(ns, inp) && inp['Hack Chance'] > 0.75;
}

function filterHack(ns: NS, inp: _serverData): boolean {
  return inp['Max Money'] > 0 && ns.getHackingLevel() >= inp['Difficulty'] && ns.hasRootAccess(inp['Name']);
}
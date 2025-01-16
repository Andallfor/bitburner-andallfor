import { NS } from '@ns';
import { allDeployableServers, allHackableServers } from 'code/util/util';

const GROW_MIN_THRES = 0.25;
const HACK_PERCENT = 0.5;

export async function main(ns: NS) {
  const hack = '/code/singleAttack/hack.js';
  const weak = '/code/singleAttack/weak.js';
  const grow = '/code/singleAttack/grow.js';

  if (ns.args[0] == 'help') {
    help(ns);
    return;
  }

  // get the total number of hack/grow/weaken scripts we can run at once
  const deployable = allDeployableServers(ns);
  const nHack = deployable.reduce((acc: number, cur: string) => acc + runnable(ns, cur, hack), 0);
  const nGrow = deployable.reduce((acc: number, cur: string) => acc + runnable(ns, cur, grow), 0);
  const nWeak = deployable.reduce((acc: number, cur: string) => acc + runnable(ns, cur, weak), 0);

  const maxWeak = ns.weakenAnalyze(nWeak);

  const target = ns.args[0]
    ? ns.args[0] as string
    // workaround to prevent TS compiler from yelling
    : (allHackableServers(ns) as any).toSorted((a: string, b: string) => ns.getServerGrowth(b) - ns.getServerGrowth(a))[0];
  ns.toast("Single Attack has decided to attack " + target, "info", 5000);

  // prep
  await weaken(ns, target, nWeak, weak);
  while (expectedGrowth(ns, target, nGrow) > 1 + GROW_MIN_THRES) {
    deployAll(ns, grow, target);
    await ns.sleep(ns.getGrowTime(target) + 500)
    await weaken(ns, target, nWeak, weak);
  }

  // TODO: implement actual proper hack
  while (true) {
    const moneyStart = ns.getServerMoneyAvailable(target);

    ns.tprintf("Starting Attack");

    // note that this will not be perfectly accurate as hacks do not finish at the same time (distributed)
    const hackReq = Math.floor(ns.hackAnalyzeThreads(target, ns.getServerMoneyAvailable(target) * HACK_PERCENT));
    const hackSec = ns.hackAnalyzeSecurity(hackReq, target);
    ns.tprintf((hackSec > maxWeak ? 'ERROR: ' : '') + `Hack Increase: ${hackSec} (${maxWeak})`)
    ns.tprintf((hackReq > nHack ? 'ERROR: ' : '') + `Hack Needed: ${hackReq} (${nHack})`)
    deployAll(ns, hack, target, hackReq); await ns.sleep(ns.getHackTime(target) + 500);
    ns.tprintf(`Hacked $${ns.formatNumber(moneyStart - ns.getServerMoneyAvailable(target))}`);

    await weaken(ns, target, nWeak, weak);

    // regrow
    const growReq = Math.ceil(ns.growthAnalyze(target, moneyStart / ns.getServerMoneyAvailable(target)))
    const growSec = ns.growthAnalyzeSecurity(growReq, target);
    ns.tprintf((growSec > maxWeak ? 'ERROR: ' : '') + `Grow Increase: ${growSec} (${maxWeak})`)
    ns.tprintf((growReq > nGrow ? 'ERROR: ' : '') + `Grow Needed: ${growReq} (${nGrow})`)
    deployAll(ns, grow, target, growReq); await ns.sleep(ns.getGrowTime(target) + 500);

    await weaken(ns, target, nWeak, weak);
  }
}

function expectedGrowth(ns: NS, server: string, threads: number): number {
  let ceil = ns.getServerMaxMoney(server) / ns.getServerMoneyAvailable(server);
  let floor = 1;

  // if we would grow to max
  if (ns.growthAnalyze(server, ceil) < threads) return ceil;

  let ind = 0;
  while (floor < ceil) {
    const mult = (ceil + floor) / 2;
    const req = Math.ceil(ns.growthAnalyze(server, mult));

    if (req == threads) return mult;
    else if (threads < req) ceil = mult;
    else floor = mult;

    ind++;
    if (ind > 20) break;
  }

  return 0;
}

/** Weakens to the provided server to min */
async function weaken(ns: NS, server: string, nWeak: number, weakFile: string) {
  const weakIterations = Math.ceil((ns.getServerSecurityLevel(server) - ns.getServerMinSecurityLevel(server)) / ns.weakenAnalyze(nWeak));
  for (let i = 0; i < weakIterations; i++) {
    deployAll(ns, weakFile, server);
    await ns.sleep(ns.getWeakenTime(server) + 500);
  }
}

function runnable(ns: NS, server: string, file: string) {
  return Math.floor(ns.getServerMaxRam(server) / ns.getScriptRam(file));
}

function deployAll(ns: NS, script: string, target: string, quota = -1) {
  allDeployableServers(ns).forEach((server: string) => {
    if (quota == 0) return;
    let num = runnable(ns, server, script);

    if (quota > -1) {
      num = Math.min(quota, num);
      quota -= num;
    }

    ns.scp(script, server);
    ns.exec(script, server, num, target);
  });
}

function help(ns: NS) {
  ns.tprintf("This script targets one server at a time to hack/grow/weaken using all avaliable resources across accessible servers (except host).");
  ns.tprintf("The script assumes that all deployable servers are empty and solely for its own use.");
  ns.tprintf("It will attempt a rough calculation of estimated profit/min.");
}
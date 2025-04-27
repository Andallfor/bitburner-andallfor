import { CityName, CorpIndustryName, CorpMaterialName, NS } from "@ns";
import { P_Office } from "../classes/office/office";
import { P_Research } from "../classes/research";

/**  (Assuming material)
 * Given a main division and permitted support divisions,
 * 1. maximize main division production and quality
 * 2. maximize support division production to match intake of main division
 *    - excess will be sold TODO: this then requires us to ensure we can sell enough or have some method of trashing
*/
export async function main(ns: NS) {
    await test(ns);
}

async function test(ns: NS) {
    const div = 'agr-1';
    const city = 'Sector-12';
    
    const office = new P_Office(ns, div, city as CityName);
    const res = new P_Research(ns, div);
    // const [x, y, z, w] = office.calc.opt_boost(550);

    // const [a, b, c] = await office.calc.opt_materialProductionJobs();
    // ns.tprintf(`op ${a}`);
    // ns.tprintf(`sys ${b}`);
    // ns.tprintf(`man ${c}`);

    const jobs = office.calc.formatJobs(3, 1, 3, 0, 0, 2);
    const [x, y, z, w] = await office.calc.opt_boostSize(res);
    ns.tprintf(`real estate ${x}`);
    ns.tprintf(`hardware ${y}`);
    ns.tprintf(`robots ${z}`);
    ns.tprintf(`ai cores ${w}`);
    const size = x * 0.005 + y * 0.06 + z * 0.5 + w * 0.1;
    const b = office.calc.get_boost(x, y, z, w);
    ns.tprintf(`expected boost ${b}`);
    const p = await office.calc.get_materialProduction(res, jobs, b);
    ns.tprintf(`expected production: ${p}`);
    ns.tprintf(`production size: ${office.getExports().reduce((acc, x) => acc + ns.corporation.getMaterialData(x.name).size * p, 0)}`)
    ns.tprintf(`${size}\n\n`);

    const [xx, yy, zz, ww] = office.calc.opt_boost(size);
    ns.tprintf(`real estate ${xx}`);
    ns.tprintf(`hardware ${yy}`);
    ns.tprintf(`robots ${zz}`);
    ns.tprintf(`ai cores ${ww}`);
    const size2 = xx * 0.005 + yy * 0.06 + zz * 0.5 + ww * 0.1;
    const b2 = office.calc.get_boost(xx, yy, zz, ww);
    ns.tprintf(`expected boost ${b2}`);
    const p2 = await office.calc.get_materialProduction(res, jobs, b2);
    ns.tprintf(`expected production: ${p2}`);
    ns.tprintf(`production size: ${office.getExports().reduce((acc, x) => acc + ns.corporation.getMaterialData(x.name).size * p2, 0)}`)
    ns.tprintf(`${size2}\n\n`);

}
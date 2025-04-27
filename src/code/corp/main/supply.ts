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
    const c = ns.corporation;
    const d = c.getIndustryData(c.getDivision(div).type);
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
    ns.tprintf(`${size}\n\n`);

    const b = office.calc.get_boostTotal(x, y, z, w);
    ns.tprintf(`expected boost ${b}`);

    const p = await office.calc.get_materialProduction(res, jobs, b);
    ns.tprintf(`expected production: ${p}`);

    const m = Math.max(
        Object.entries(d.requiredMaterials).reduce((acc, x) => acc + c.getMaterialData(x[0] as CorpMaterialName).size * x[1], 0),
        d.producedMaterials!.reduce((acc, x) => acc + c.getMaterialData(x).size, 0)
    );
    const ss = m * p;
    ns.tprintf(`prod size ${ss}`);
    ns.tprintf(`total size ${ss + size}`)
}

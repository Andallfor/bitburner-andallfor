import { CityName, CorpIndustryName, CorpMaterialName, NS } from "@ns";
import { toColor, toGreen, toPink, toRed, toWhite } from "/code/util/colors";
import { P_Office } from "../classes/office";
import { Cities } from "../util/data";
import { table } from "/code/util/table";
import { P_Research } from "../classes/research";
import { toPercent } from "/code/util/util";

function help(ns: NS) {
    const msg = `
Corporation division monitor.

Usage: corp-div-monitor -d
Flags:
    Name        Type        Default         Description
    -d          string                      Division name. If specified, will only show that division. If empty, will list current divisions.

Table Information:
│ City │ Maximum warehouse usage │ Maximum material production    Material production (%%) → Sold (%%) @ Quality ... | Buy and import amount (%% imported) @ quality → Minimum stored |
`;
    ns.tprintf(msg);
}

export async function main(ns: NS) {
    const c = ns.corporation;
    ns.disableLog('ALL');

    if (!c.hasCorporation()) {
        ns.tprintf("ERROR: No registered corporation, unable to perform operation.");
        return;
    }

    const flags = ns.flags([
        ['d', 'l'],
        ['help', false],
    ]);

    if (flags['help']) {
        help(ns);
        return;
    }

    const div_s = flags['d'] as string;
    const corp = c.getCorporation();

    if (div_s == 'l' || !corp.divisions.includes(div_s)) {
        if (div_s != 'l') ns.tprintf(`ERROR: division "${div_s}" not found.`);
        ns.tprintf("Current divisions:")
        ns.tprintf(corp.divisions.sort().join('\n'));
        return;
    }

    if (!c.getIndustryData(c.getDivision(div_s).type).makesMaterials) {
        ns.tprintf("ERROR: Support for non-material divisions is not currently unimplemented");
        return;
    }

    const offices: P_Office[] = Cities.map(c => new P_Office(ns, div_s, c as CityName));
    const research: P_Research = new P_Research(ns, div_s);

    ns.ui.openTail();
    ns.ui.setTailTitle('Division Monitor: ' + div_s)
    while (true) {
        ns.clearLog();
        const div = c.getDivision(div_s);
        const ind = c.getIndustryData(div.type);
        const imp = Object.keys(ind.requiredMaterials) as CorpMaterialName[];
        const exp = ind.producedMaterials!;

        ns.print(`+-----+ ${div_s.toUpperCase()} (${div.type}) +-----+`);
        ns.print(`${imp.map(x => `${ind.requiredMaterials[x]} ${x}`).join(', ')} --> 1 of each ${exp.join(', ')}\n\n`);

        const t = new table(['City', 'Capacity', 'Production', ...exp, ...imp]);
        for (let i = 0; i < offices.length; i++) {
            const office = offices[i];
            office.update();

            const warnings = {
                'warehouse': 1,
                'production': 1,
                'exportWaste': 1,
                'importWaste': 0,
            };

            const maxMatProd = office.getMaxMatProd(research);
            const [_, max, total] = office.getWarehouseUsage();
            const warehouse = max / total;

            if (warehouse > 0.975) warnings['warehouse'] = 3;
            else if (warehouse > 0.9) warnings['warehouse'] = 2;

            const exports = office.getExports().map(x => {
                const prod = x.productionAmount;
                const prodRatio = prod / maxMatProd;
                const sold = x.actualSellAmount;
                const soldRatio = sold / x.productionAmount;
                const qual = x.quality;

                if (prodRatio > 0.95) warnings['production'] = 3;
                else if (prodRatio > 0.9) warnings['production'] = 2;

                // sold of 0 means we are exporting (probably)
                let exportWasteWarn = 1;
                if (soldRatio != 0) {
                    if (soldRatio < 0.75) exportWasteWarn = 3;
                    else if (soldRatio < 0.9) exportWasteWarn = 2;
                }

                warnings['exportWaste'] = Math.max(exportWasteWarn, warnings['exportWaste']);

                const a = `${prod.toFixed()} (${color(toPercent(prodRatio), warnings['production'])})`;
                return `${a} → ${sold.toFixed()} (${color(toPercent(soldRatio), exportWasteWarn)}) @ ${qual.toFixed()}`
            });
            const importWaste = office.getImpWaste();
            const imports = office.getImports().map(x => {
                const total = x.buyAmount + x.importAmount;
                const ratio = x.importAmount / total;
                const qual = x.quality;
                const waste = importWaste[x.name];

                return `${total.toFixed()} (${toPercent(ratio)}) @ ${qual.toFixed()} → ${waste.toFixed()}`
            });

            t.body.push([
                color(office.city, Object.values(warnings).reduce((acc, x) => Math.max(acc, x))),
                color(toPercent(warehouse), warnings['warehouse']),
                maxMatProd.toFixed(),
                ...exports,
                ...imports
            ]);
        }

        for (let i = 0; i < exp.length; i++) t.settings[i + 2].divider = false;
        for (let i = 0; i < imp.length - 1; i++) t.settings[i + 3 + exp.length].divider = false;

        ns.print(t.print());

        await ns.sleep(200);
    }
}

function color(s: string | number, n: number) {
    s = s.toString();
    return s;

    /*
    switch (n) {
        case 3:
            return toRed(s);
        case 2:
            return toColor(s, '38;5;208');
        case 1:
            return toGreen(s);
        default:
            return s;
    }*/
}

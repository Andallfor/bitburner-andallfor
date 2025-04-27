import { AutocompleteData, CityName, CorpMaterialName, NS } from "@ns";
import { Cities, Materials, Materials_s } from "../util/data";
import { waitUntilNext } from "../util/util";

export function autocomplete(data: AutocompleteData, args: string[]) {
    const cities = [...Cities, 'ALL'];
    let materials = [...Materials_s];
    materials = materials.map(x => x.replace(' ', '-')); // no spaces

    const last = args.length == 0 ? '' : args[args.length - 1];
    if (last == '-c') return cities;
    else if (last == '-m') return materials;
    return [...cities, ...materials];
}

function help(ns: NS) {
    const msg = `
Utility function to manually buy (boost) materials for a division/office.
Autocomplete is supported!

Usage: corp-buy -d -m -n [-s] [-c]
Flags:
    Name        Type        Default         Description
    -d          string                      Division name.
    -c          string      ALL             The city/office to target. ALL will buy materials in all cities for the provided division.
    -m          string                      Material to buy. Note that materials with spaces (AI Cores, Real Estate) should be substituted with dashes instead (AI-Cores, Real-Estate).
    -n          number      0               Amount to buy.
    -s          boolean     false           If true, buys materials as a purchase per second trade. Otherwise performs a bulk buy. Used in cases where there is not enough money to perform a bulk buy.

Examples:
    corp-buy -d agr-1 -m Hardware -n 720
        Buys 720 units of Hardware in all offices in the agr-1 division.
`;
    ns.tprintf(msg);
}

export async function main( ns: NS ) {
    if (!ns.corporation.hasCorporation()) {
        ns.tprintf("ERROR: No registered corporation, unable to perform operation.");
        return;
    }

    const flags = ns.flags([
        ['d', ''], // division name
        ['c', 'ALL'], // city
        ['m', ''], // material
        ['n', 0], // amt
        ['s', false], // use purchase per second (in case you do not have enough money for bulk buy)
        ['help', false]
    ]);

    if (flags['help']) {
        help(ns);
        return;
    }

    const division = flags['d'] as string;
    const city = flags['c'] as string;
    const material = (flags['m'] as string).replaceAll('-', ' ');
    const amt = flags['n'] as number;

    let cities: string[] = [];
    if (city == 'ALL') cities = cities.concat(Cities);
    else {
        if (!Cities.includes(city)) {
            ns.tprintf(`ERROR: City "${city}" is unrecognized`);
            return;
        }
        cities.push(city);
    }

    if (!Materials_s.includes(material)) {
        ns.tprintf(`ERROR: Material ${material} is unrecognized`);
        return;
    }

    for (let i = 0; i < cities.length; i++) {
        if (!flags['s']) ns.corporation.bulkPurchase(division, cities[i] as CityName, material, amt);
        else ns.corporation.buyMaterial(division, cities[i] as CityName, material, amt / 10);
    }

    if (flags['s']) {
        ns.tprintf('Waiting for next cycle...');
        await waitUntilNext(ns, 'PURCHASE');

        // now cancel our purchases
        for (let i = 0; i < cities.length; i++) ns.corporation.buyMaterial(division, cities[i] as CityName, material, 0);
    }

    for (let i = 0; i < cities.length; i++) {
        const mat = ns.corporation.getMaterial(division, cities[i] as CityName, material);
        const warehouse = ns.corporation.getWarehouse(division, cities[i] as CityName)
        ns.tprintf(`${cities[i]}: ${mat.name} = ${mat.stored} (${Math.round(warehouse.sizeUsed)} / ${Math.round(warehouse.size)})`);
    }
}

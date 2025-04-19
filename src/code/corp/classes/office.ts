import { CityName, CorpMaterialName, Corporation, Material, NS, Office, Warehouse } from "@ns";
import { P_Research } from "./research";

// TODO: assumes material
export class P_Office {
    private ns: NS;
    public readonly div: string;
    public readonly city: CityName;
    private c: Corporation;

    public constructor(ns: NS, div: string, city: CityName) {
        this.ns = ns;
        this.div = div;
        this.city = city;
        this.c = ns.corporation;

        this.getImports().forEach(x => this.importBuffer[x.name] = []);
    }

    public getMaxMatProd(res: P_Research) {
        // https://github.com/bitburner-official/bitburner-src/blob/stable/src/Documentation/doc/advanced/corporation/division-raw-production.md
        // https://github.com/bitburner-official/bitburner-src/blob/43c3a257de42ccf533ef1c0d80a328c1bc3bb927/src/Corporation/ui/DivisionOffice.tsx#L107
        const o = this.get();
        const jobs = o.employeeProductionByJob;
        const off_mult = 
            0.05 * 
            (Math.pow(jobs.Operations, 0.4) + Math.pow(jobs.Engineer, 0.3)) * 
            (1 + jobs.Management / (1.2 * (jobs.Operations + jobs.Engineer + jobs.Management)));
        const div_mult = this.c.getDivision(this.div).productionMult;
        const upg_mult = 1 + this.c.getUpgradeLevel('Smart Factories') * 0.03;
        const res_mult = res.getMatProd();

        return off_mult * div_mult * upg_mult * res_mult;
    }

    private warehouseBuffer: number[] = [];
    private static readonly warehouseBufferLength = 10;

    /** Returns [min, max, size] usage of warehouse 
     * Note that this recalculates every time! */
    public getWarehouseUsage(): [number, number, number] {
        const total = this.getWarehouse().size;
        let min = total;
        let max = 0;

        for (let i = 0; i < this.warehouseBuffer.length; i++) {
            const x = this.warehouseBuffer[i];
            if (x > max) max = x;
            if (x < min) min = x;
        }

        return [min, max, total];
    }

    private importBuffer: Record<string, number[]> = {};
    private static readonly importBufferLength = 10;

    /** Returns the minimum material stored value for each imported material */
    public getImpWaste(): Record<string, number> {
        const out: Record<string, number> = {};
        Object.keys(this.importBuffer).forEach(x => {
            const buffer = this.importBuffer[x];
            let min = -1;
            for (let i = 0; i < buffer.length; i++) {
                if (min == -1 || buffer[i] < min) min = buffer[i];
            }

            out[x] = min;
        });

        return out;
    }

    public update() {
        // warehouse buffer
        const warehouse = this.getWarehouse();
        if (this.warehouseBuffer.length > P_Office.warehouseBufferLength) this.warehouseBuffer.shift();
        this.warehouseBuffer.push(warehouse.sizeUsed);

        // import buffer
        this.getImports().forEach(x => {
            if (this.importBuffer[x.name].length > P_Office.importBufferLength) this.importBuffer[x.name].shift();
            this.importBuffer[x.name].push(x.stored);
        })
    }

    public get(): Office { return this.c.getOffice(this.div, this.city); }
    public getWarehouse(): Warehouse { return this.c.getWarehouse(this.div, this.city); }
    public getExports(): Material[] {
        return this.c.getIndustryData(this.c.getDivision(this.div).type)
            .producedMaterials!
            .map(m => this.c.getMaterial(this.div, this.city, m));
    }
    public getImports(): Material[] {
        return Object.keys(this.c.getIndustryData(this.c.getDivision(this.div).type)
            .requiredMaterials as CorpMaterialName[])
            .map(m => this.c.getMaterial(this.div, this.city, m));
    }
}
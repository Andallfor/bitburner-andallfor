import { CityName, CorpEmployeePosition, CorpMaterialName, Corporation, Material, NS, Office, Warehouse } from "@ns";
import { _Office_Calculations } from "./office_c";

// TODO: assumes material
export class P_Office {
    private c: Corporation;
    public readonly calc: _Office_Calculations;

    public constructor(private ns: NS, public readonly div: string, public readonly city: CityName) {
        this.c = ns.corporation;
        this.calc = new _Office_Calculations(ns, div, city, this);

        this.getImports().forEach(x => this.importBuffer[x.name] = []);
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

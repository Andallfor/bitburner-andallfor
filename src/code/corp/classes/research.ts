import { Corporation, NS } from "@ns";

export enum _res {
    Lab = "Hi-Tech R&D Laboratory",
    AutoBrew = "AutoBrew",
    AutoParty = "AutoPartyManager",
    DrugAdmin = "Automatic Drug Administration",
    CPH4 = "CPH4 Injections",
    Drones = "Drones",
    DronesAssem = "Drones - Assembly",
    DronesTrans = "Drones - Transport",
    Juice = "Go-Juice",
    HrRecur = "HRBuddy-Recruitment",
    HrTrain = "HRBuddy-Training",
    TA1 = "Market-TA.I",
    TA2 = "Market-TA.II",
    Overclock = "Overclock",
    SelfAssem = "Self-Correcting Assemblers",
    Sti = "Sti.mu",
    uCap1 = "uPgrade: Capacity.I",
    uCap2 = "uPgrade: Capacity.II",
    uDash = "uPgrade: Dashboard",
    uFulcrum = "uPgrade: Fulcrum",
}

// https://github.com/bitburner-official/bitburner-src/blob/dev/src/Corporation/Research.ts#L19
export interface _resVal {
    advertisingMult?: number;
    employeeChaMult?: number;
    employeeCreMult?: number;
    employeeEffMult?: number;
    employeeIntMult?: number;
    productionMult?: number;
    productProductionMult?: number;
    salesMult?: number;
    sciResearchMult?: number;
    storageMult?: number;
}

export class P_Research {
    private ns: NS;
    private div: string;
    private c: Corporation;

    public constructor(ns: NS, div: string) {
        this.ns = ns;
        this.div = div;
        this.c = ns.corporation;
    }

    public getMatProd() {
        return 1 *
            (this.has(_res.DronesAssem) ? this.DATA[_res.DronesAssem].productionMult! : 1) * 
            (this.has(_res.SelfAssem) ? this.DATA[_res.SelfAssem].productionMult! : 1);
    }

    public has(r: _res) { return this.c.hasResearched(this.div, r as string); }

    // https://github.com/bitburner-official/bitburner-src/blob/dev/src/Corporation/ResearchMap.ts#L6
    // https://github.com/bitburner-official/bitburner-src/blob/stable/markdown/bitburner.corpresearchname.md
    private readonly DATA: {[id in _res]: _resVal} = {
        [_res.AutoBrew]: {},
        [_res.AutoParty]: {},
        [_res.DrugAdmin]: {},
        [_res.CPH4]: {
            employeeCreMult: 1.1,
            employeeChaMult: 1.1,
            employeeEffMult: 1.1,
            employeeIntMult: 1.1,
        },
        [_res.Drones]: {},
        [_res.DronesAssem]: {
            productionMult: 1.2,
        },
        [_res.DronesTrans]: {
            storageMult: 1.5,
        },
        [_res.Juice]: {},
        [_res.HrRecur]: {},
        [_res.HrTrain]: {},
        [_res.Lab]: {
            sciResearchMult: 1.1,
        },
        [_res.TA1]: {},
        [_res.TA2]: {},
        [_res.Overclock]: {
            employeeEffMult: 1.25,
            employeeIntMult: 1.25,
        },
        [_res.SelfAssem]: {
            productionMult: 1.1,
        },
        [_res.Sti]: {},
        [_res.uCap1]: {},
        [_res.uCap2]: {},
        [_res.uDash]: {},
        [_res.uFulcrum]: {
            productProductionMult: 1.05,
        },
    }
}
import { CityName, CorpEmployeePosition, CorpMaterialName, Corporation, NS } from "@ns";
import { round } from "/code/util/math";
import { P_Office } from "./office";
import { Ceres } from "/code/lib/ceres";
import { P_Research } from "../research";
import { Cities } from "../../util/data";
import { waitUntilNext } from "../../util/util";

export class _Office_Calculations {
    private c: Corporation;

    private boostData: number[][];

    public constructor(private ns: NS, private readonly div: string, private readonly city: CityName, private readonly parent: P_Office) {
        this.c = ns.corporation;

        const d = this.c.getIndustryData(this.c.getDivision(this.div).type);
        const [c1, s1] = [d.realEstateFactor!, this.c.getMaterialData('Real Estate').size];
        const [c2, s2] = [d.hardwareFactor!, this.c.getMaterialData('Hardware').size];
        const [c3, s3] = [d.robotFactor!, this.c.getMaterialData('Robots').size];
        const [c4, s4] = [d.aiCoreFactor!, this.c.getMaterialData('AI Cores').size];

        this.boostData = [[c1, s1], [c2, s2], [c3, s3], [c4, s4]];
    }

    /**
     * Calculate the optimal office job distribution (operations, engineer, management) to maximize material production.  
     * The params offset the number of employees the algorithm can use.  
     * If a param is not defined it will default to the current office job distribution
     * @param n_res Number of desired researchers
     * @param n_bus Number of desired business
     * @param n_int Number of desired interns
     * @returns [num operations, num engineers, num management]
     */
    public async opt_materialProductionJobs(n_res?: number, n_bus?: number, n_int?: number) {
        let off = this.parent.get();

        const nr = n_res ?? off.employeeJobs["Research & Development"];
        const nb = n_bus ?? off.employeeJobs.Business;
        const ni = n_int ?? off.employeeJobs.Intern;
        const num = off.numEmployees - nr - nb - ni;

        // we need to make sure there is at least one person in each of operations, engineer, management
        // since we need employee production by job != 0 to find production multiplier (as each job is inherently weighted differently)
        const [change, xn, yn, zn] = await this.fmtProdJobs('INFO: (opt_materialProductionJobs) waiting for job reassignment');
        off = this.parent.get();

        // https://github.com/bitburner-official/bitburner-src/blob/stable/src/Documentation/doc/advanced/corporation/office.md#employee-production-by-job
        const xo = off.employeeProductionByJob.Operations / off.employeeJobs.Operations;
        const yo = off.employeeProductionByJob.Engineer / off.employeeJobs.Engineer;
        const zo = off.employeeProductionByJob.Management / off.employeeJobs.Management;

        // https://github.com/bitburner-official/bitburner-src/blob/stable/src/Documentation/doc/advanced/corporation/division-raw-production.md
        // maximize office multiplier via lagrange multipliers
        // x = num operations
        // y = num engineer
        // z = num management
        function dx(n: number[]) {
            const [_x, _y, _z, w] = n;
            const [x, y, z] = [_x * xo, _y * yo, _z * zo];
            const s1 = z * (Math.pow(x, 0.4) + Math.pow(y, 0.3)) / ((x + y + z) * (x + y + z));
            const s2 = 2 * (1 + z / (x + y + z)) / (5 * Math.pow(x, 0.6));

            return w - s1 + s2;
        }

        function dy(n: number[]) {
            const [_x, _y, _z, w] = n;
            const [x, y, z] = [_x * xo, _y * yo, _z * zo];
            const s1 = z * (Math.pow(x, 0.4) + Math.pow(y, 0.3)) / ((x + y + z) * (x + y + z));
            const s2 = 3 * (1 + z / (x + y + z)) / (10 * Math.pow(y, 0.7));

            return w - s1 + s2;
        }

        function dz(n: number[]) {
            const [_x, _y, _z, w] = n;
            const [x, y, z] = [_x * xo, _y * yo, _z * zo];
            const s1 = (Math.pow(x, 0.4) + Math.pow(y, 0.3)) * (x + y) / ((x + y + z) * (x + y + z));
            return w + s1;
        }

        function dw(n: number[]) {
            const [x, y, z, w] = n;
            return x + y + z - num;
        }

        const solver = new Ceres();
        solver.addFunction(dx);
        solver.addFunction(dy);
        solver.addFunction(dz);
        solver.addFunction(dw);

        solver.addLowerbound(0, 0);
        solver.addLowerbound(1, 0);
        solver.addLowerbound(2, 0);

        solver.addUpperbound(0, num);
        solver.addUpperbound(1, num);
        solver.addUpperbound(2, num);

        const max_iter = 20;
        const parameter_tol = 1e-10;
        const func_tol = 1e-16;
        const grad_tol = 1e-16;
        const max_time = 1; // sec
        const sol = await solver.solve([num / 3, num / 3, num / 3, 0], max_iter, parameter_tol, func_tol, grad_tol, max_time);
        sol.x.length = 3; // dont care about lambda (w)
        const [nx, ny, nz] = round(sol.x, num);

        solver.remove();

        // reset jobs
        if (change) { // TODO: move into own function
            this.c.setAutoJobAssignment(this.div, this.city, 'Operations', 0);
            this.c.setAutoJobAssignment(this.div, this.city, 'Engineer', 0);
            this.c.setAutoJobAssignment(this.div, this.city, 'Management', 0);

            this.c.setAutoJobAssignment(this.div, this.city, 'Operations', xn as number);
            this.c.setAutoJobAssignment(this.div, this.city, 'Engineer', yn as number);
            this.c.setAutoJobAssignment(this.div, this.city, 'Management', zn as number);

            await waitUntilNext(this.ns, 'START');
        }

        return [nx, ny, nz];
    }

    /**
     * Find the optimal distribution of boost materials to maximize production
     * @param maxSize Storage size. Defaults to 1/4 of max storage size
     * @returns Integer number of [real estate, hardware, robots, ai cores]
     */
    public opt_boost(maxSize?: number) {
        // https://github.com/bitburner-official/bitburner-src/blob/dev/src/Documentation/doc/advanced/corporation/boost-material.md#solution
        const S = maxSize ?? (this.c.getWarehouse(this.div, this.city).size * 0.25);
        const [[c1, s1], [c2, s2], [c3, s3], [c4, s4]] = this.boostData;

        let c = [c1, c2, c3, c4];
        let s = [s1, s2, s3, s4];
        let out = [0, 0, 0, 0];

        for (let i = 0; i < 4; i++) {
            if (c[i] == 0 || s[i] == 0) out[i] = 0
            else {
                const cc = c[0] + c[1] + c[2] + c[3];
                const n = S - 500 * (s[i] / c[i] * (cc - c[i]) - (s[0] + s[1] + s[2] + s[3] - s[i]));
                const d = cc / c[i] * s[i];
                const m = n / d;

                // invalid, reset and remove effect of invalid vars
                if (m < 0) {
                    c[i] = 0;
                    s[i] = 0
                    i = -1;
                } else out[i] = m;
            }
            
        }

        return out.map(x => Math.floor(x));
    }

    // assume material
    // assumes all cities have been expanded to
    public async opt_boostSize(res: P_Research, buffer = 0.1, step = 20) {
        /*
         * Two realizations:
         * 1. opt_boost for a given size is a (basically) constant time function
         * 2. boost multiplier is an increasing function with respect to storage size
         * 
         * this means that we can perform binary search!
         * that is, for any given x, where x is the permitted storage space for opt_boost, we can calculate the material production and subsequent required storage space in constant time
         * and x + 1 will always take up more space
         * thus we can search for the greatest x such that the space taken up by it is equal to storage space
         */

        const [[cx, sx], [cy, sy], [cz, sz], [cw, sw]] = this.boostData;
        const baseBoost = this.c.getDivision(this.div).productionMult - this.get_boost(
            this.c.getMaterial(this.div, this.city, "Real Estate").stored,
            this.c.getMaterial(this.div, this.city, "Hardware").stored,
            this.c.getMaterial(this.div, this.city, "Robots").stored,
            this.c.getMaterial(this.div, this.city, "AI Cores").stored);

        const [jchange, jx, jy, jz] = await this.fmtProdJobs("INFO: (opt_boostSize) formatting jobs");
        const jobs = this.parent.get().employeeJobs;
        const [jo, js, jm] = await this.opt_materialProductionJobs(jobs["Research & Development"], jobs.Business, jobs.Intern);

        const d = this.c.getIndustryData(this.c.getDivision(this.div).type);
        // size of import and produced should not occur at the same time, so we can consider them separate and just take the max
        const m = Math.max( // m * amt material production = size of material (max of imp materials or prod materials)
            // (size_1 * coeff_1 * amt) + (size_2 * coeff_2 * amt) + ... = (size_1 * coeff_1 + size_2 * coeff_2 + ...) * amt
            Object.entries(d.requiredMaterials).reduce((acc, x) => acc + this.c.getMaterialData(x[0] as CorpMaterialName).size * x[1], 0),
            d.producedMaterials!.reduce((acc, x) => acc + this.c.getMaterialData(x).size, 0)
        );

        let out = [0, 0, 0, 0];
        const max = this.c.getWarehouse(this.div, this.city).size * (1 - buffer);
        let left = 0; let right = Math.floor(max / step);
        while (left <= right) {
            const size = step * Math.floor((left + right) / 2);

            const [x, y, z, w] = this.opt_boost(size);
            const b = baseBoost + this.get_boost(x, y, z, w);
            const p = await this.get_materialProduction(res, this.formatJobs(jo, js, jm), b);

            const sb = sx * x + sy * y + sz * z + sw * w;
            const sp = m * p;
            const s = sb + sp; // total size taken up

            if (s > max) right = size / 20 - 1;
            else left = size / 20 + 1;

            out = [x, y, z, w];
        }

        if (jchange) { // TODO: move into own function
            this.c.setAutoJobAssignment(this.div, this.city, 'Operations', 0);
            this.c.setAutoJobAssignment(this.div, this.city, 'Engineer', 0);
            this.c.setAutoJobAssignment(this.div, this.city, 'Management', 0);

            this.c.setAutoJobAssignment(this.div, this.city, 'Operations', jx as number);
            this.c.setAutoJobAssignment(this.div, this.city, 'Engineer', jy as number);
            this.c.setAutoJobAssignment(this.div, this.city, 'Management', jz as number);

            await waitUntilNext(this.ns, 'START');
        }

        return out;
    }

    /**
     * Get the city mult factor from boost materials
     */
    public get_boost(realEstate: number, hardware: number, robots: number, aiCores: number) {
        // https://github.com/bitburner-official/bitburner-src/blob/dev/src/Documentation/doc/advanced/corporation/boost-material.md#solution
        const d = this.c.getIndustryData(this.c.getDivision(this.div).type);
        const m =
            Math.pow(0.002 * realEstate + 1, d.realEstateFactor!) * 
            Math.pow(0.002 * hardware + 1, d.hardwareFactor!) * 
            Math.pow(0.002 * robots + 1, d.robotFactor!) * 
            Math.pow(0.002 * aiCores + 1, d.aiCoreFactor!);
        
        return Math.pow(m, 0.73);
    }

    /**
     * Get the boost mult, accounting for all other cities (defaulting to what they currently have stored) but with this city's boost materials changed
     */
    public get_boostTotal(realEstate: number, hardware: number, robots: number, aiCores: number) {
        const base = this.c.getDivision(this.div).productionMult - this.get_boost(
            this.c.getMaterial(this.div, this.city, "Real Estate").stored,
            this.c.getMaterial(this.div, this.city, "Hardware").stored,
            this.c.getMaterial(this.div, this.city, "Robots").stored,
            this.c.getMaterial(this.div, this.city, "AI Cores").stored);
        
        return base + this.get_boost(realEstate, hardware, robots, aiCores);
    }

    /**
     * Determine the material production for a given job set.
     * @param res The current division research
     * @param jobs Job set to use (number of employees). If not provided, will automatically use the current office's job set
     * @param prodMult Production multiplier from boost materials
     * @returns Expected production amount
     */
    public async get_materialProduction(res: P_Research, jobs?: Record<CorpEmployeePosition, number>, prodMult?: number) {
        let off = this.parent.get();
        const j = off.employeeProductionByJob;

        if (jobs) { // we need to convert number of jobs to employee production
            const [change, nx, ny, nz] = await this.fmtProdJobs('INFO: (get_materialProduction) updating jobs');
            if (change) {
                off = this.parent.get();
                j.Operations = jobs.Operations * off.employeeProductionByJob.Operations;
                j.Engineer = jobs.Engineer * off.employeeProductionByJob.Engineer;
                j.Management = jobs.Management * off.employeeProductionByJob.Management;

                this.c.setAutoJobAssignment(this.div, this.city, 'Operations', 0);
                this.c.setAutoJobAssignment(this.div, this.city, 'Engineer', 0);
                this.c.setAutoJobAssignment(this.div, this.city, 'Management', 0);

                this.c.setAutoJobAssignment(this.div, this.city, 'Operations', nx as number);
                this.c.setAutoJobAssignment(this.div, this.city, 'Engineer', ny as number);
                this.c.setAutoJobAssignment(this.div, this.city, 'Management', nz as number);

                await waitUntilNext(this.ns, 'START');
            } else {
                j.Operations = j.Operations / off.employeeJobs.Operations * jobs.Operations;
                j.Engineer = j.Engineer / off.employeeJobs.Engineer * jobs.Engineer;
                j.Management = j.Management / off.employeeJobs.Management * jobs.Management;
            }
        }

        // https://github.com/bitburner-official/bitburner-src/blob/stable/src/Documentation/doc/advanced/corporation/division-raw-production.md
        // https://github.com/bitburner-official/bitburner-src/blob/43c3a257de42ccf533ef1c0d80a328c1bc3bb927/src/Corporation/ui/DivisionOffice.tsx#L107

        const off_mult = 
            0.05 * 
            (Math.pow(j.Operations, 0.4) + Math.pow(j.Engineer, 0.3)) * 
            (1 + j.Management / (1.2 * (j.Operations + j.Engineer + j.Management)));
        // https://github.com/bitburner-official/bitburner-src/blob/dev/src/Documentation/doc/advanced/corporation/boost-material.md
        const div_mult = prodMult ?? this.c.getDivision(this.div).productionMult;
        const upg_mult = 1 + this.c.getUpgradeLevel('Smart Factories') * 0.03;
        const res_mult = res.getMatProd();

        return off_mult * div_mult * upg_mult * res_mult * 10;
    }

    public formatJobs(op = 0, eng = 0, man = 0, res = 0, bus = 0, int = 0): Record<CorpEmployeePosition, number> {
        return {
            'Operations': op,
            'Engineer': eng,
            'Management': man,
            'Research & Development': res,
            'Business': bus,
            'Intern': int,
            'Unassigned': 0
        };
    }

    /** Set all production jobs to 1 if needed
     * @returns [did change, xn, yn, zn]
     */
    private async fmtProdJobs(debug?: string) {
        const off = this.parent.get();
        const xn = off.employeeJobs.Operations;
        const yn = off.employeeJobs.Engineer;
        const zn = off.employeeJobs.Management;
        if (xn == 0 || yn == 0 || zn == 0) {
            this.c.setAutoJobAssignment(this.div, this.city, 'Operations', 1);
            this.c.setAutoJobAssignment(this.div, this.city, 'Engineer', 1);
            this.c.setAutoJobAssignment(this.div, this.city, 'Management', 1);

            if (debug) this.ns.printf(debug);
            await waitUntilNext(this.ns, 'START');

            return [true, xn, yn, zn];
        }

        return [false, xn, yn, zn];
    }
}
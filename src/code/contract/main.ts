import { NS } from "@ns";
import { allServers, allServersString } from "../util/util";

const solutions: Record<string, (ns: NS, file: string, server: string) => string> = {
    'Array Jumping Game': arrayJumpingGameI,
    'Square Root': squareRoot,
    'Compression II: LZ Decompression': compressionII,
    'Encryption II: Vigenère Cipher': vigenereCipher,
    'Array Jumping Game II': arrayJumpingGameII,
    'Spiralize Matrix': spiralizeMatrix,
    'Generate IP Addresses': generateIpAddress,
};

function help(ns: NS) {
    const msg = `\n
Automatically finds and completes contracts.
Currently provides solutions for:
${Object.keys(solutions).map(x => `- ${x}\n`).join('')}
Usage: cct [-u] [-c]
Flags:
    Name        Type        Default         Description
    -u          string      ''              If defined, script will only test the provided contract name (assuming that it has a solution defined). If defined as value 'all', script will test all defined contracts.
    -c          bool        false           Clears all contracts on home.
`;
    ns.tprint(msg);
}

export async function main(ns: NS) {
    const cct = ns.codingcontract;
    const flags = ns.flags([
        ['u', ''], // unit test
        ['c', false], // clear all contracts on home
        ['help', false],
    ]);

    if (flags['help']) {
        help(ns);
        return;
    }
    
    const u = flags['u'] as string;

    if (flags['c']) {
        const contracts = ns.ls('home', '.cct');
        contracts.forEach(x => ns.rm(x));
    } else if (u.length != 0) {
        for (const [name, func] of Object.entries(solutions)) {
            if (u != 'all' && !name.toLowerCase().includes(u.toLowerCase())) continue;

            let success = true;
            for (let i = 0; i < 50; i++) {
                const contract = cct.createDummyContract(name);
                const result = cct.attempt(func(ns, 'home', contract), contract);

                if (result.length == 0) {
                    success = false;
                    break;
                }
            }

            ns.tprintf(`${name}: ${success ? '\u001b[32mSUCCESS' : '\u001b[31mFAILURE'}\u001b[0m`);
        }
    } else {
        // server, file
        let contracts: [string, string][] = [];
        allServersString(ns).forEach(x => {
            const c = ns.ls(x, '.cct');
            if (c.length > 0) contracts = contracts.concat(c.map(y => [x, y]));
        });

        contracts.forEach(([server, file]) => {
            const ct = cct.getContractType(file, server);
            if (ct in solutions) {
                const reward = cct.attempt(solutions[ct](ns, server, file), file, server);
                if (reward.length == 0) ns.tprintf(`ERROR: Failed contract "${ct}"`);
                else ns.tprintf(`(${ct}) ` + reward);
            } else ns.tprintf(`INFO: No solution exists for ${ct} (${server})`);
        });
    }
}

function arrayJumpingGameI(ns: NS, server: string, file: string): string {
    const cct = ns.codingcontract;
    const data = cct.getData(file, server) as number[];

    let dist = data[0];
    for (let i = 0; i < data.length; i++) {
        if (i > dist) return '0';

        dist = Math.max(i + data[i], dist);
        if (dist > data.length) break;
    }

    return '1';
}

function arrayJumpingGameII(ns: NS, server: string, file: string): string {
    const cct = ns.codingcontract;
    const data = cct.getData(file, server) as number[];

    let steps = 1;
    for (let i = 0; i < data.length;) {
        const currentDist = i + data[i];

        if (currentDist >= data.length - 1) break;

        let bestDist = 0;
        let bestInd = 0;
        for (let j = i + 1; j < currentDist + 1; j++) {
            const nextDist = j + data[j];
            if (nextDist > bestDist && nextDist > currentDist) {
                bestDist = nextDist;
                bestInd = j;
            }
        }

        if (bestInd == 0) return '0';
        steps++;
        i = bestInd;
    }

    return '' + steps;
}

function squareRoot(ns: NS, server: string, file: string): string {
    const cct = ns.codingcontract;
    const S = cct.getData(file, server) as bigint;

    const abs = (x: bigint) => x < 0 ? x * -1n : x;

    let x = S / 2n;
    for (let i = 0; i < 350; i++) {
         x = (x + S / x) / 2n;
    }

    const xx = abs(S - x * x);
    const x1 = abs(S - (x + 1n) * (x + 1n));

    return '' + (xx < x1 ? x : (x + 1n));
}

function compressionII(ns: NS, server: string, file: string): string {
    const cct = ns.codingcontract;
    const str = cct.getData(file, server) as string;

    let out = '';
    let isTypeOne = true;
    for (let i = 0; i < str.length;) {
        const L = Number(str[i++]);
        if (L == 0) {
            isTypeOne = !isTypeOne
            continue;
        }

        const cur = i;
        if (!isTypeOne) {
            const offset = Number(str[i]);
            const len = out.length;
            for (let j = 0; j < L; j++) out += out[len - offset + j];
            i++;
        } else {
            for (; i < cur + L; i++) out += str[i];
        }

        isTypeOne = !isTypeOne;
    }

    return out;
}

function vigenereCipher(ns: NS, server: string, file: string): string {
    const cct = ns.codingcontract;
    let [plain, key] = cct.getData(file, server) as [string, string];

    for (let i = 0; i < Math.ceil(plain.length / key.length); i++) key += key;

    let out = '';
    for (let i = 0; i < plain.length; i++) {
        const row = plain.charCodeAt(i) - 65;
        const col = key.charCodeAt(i) - 65;

        let ind = (col + row) % 26;

        out += String.fromCharCode(65 + ind);
    }

    return out;
}

function spiralizeMatrix(ns: NS, server: string, file: string): string {
    const cct = ns.codingcontract;
    const mtx = cct.getData(file, server) as number[][];

    const dirs = [[1, 0], [0, -1], [-1, 0], [0, 1]]; // x, y
    const visited: number[] = [];

    const out: number[] = [];

    function inBounds(x: number, y: number) { return x >= 0 && y >= 0 && x < mtx[0].length && y < mtx.length; }
    function hash(x: number, y: number) { return x * mtx.length + y; }
    function move(x: number, y: number, dirInd: number) { return [x + dirs[dirInd][0], y + dirs[dirInd][1]]; }

    let x = 0;
    let y = 0;
    let dirInd = 0;
    while (true) {
        out.push(mtx[y][x]);
        visited.push(hash(x, y));

        let [nx, ny] = move(x, y, dirInd);

        // check if we can move
        if (visited.includes(hash(nx, ny)) || !inBounds(nx, ny)) {
            let blocked = true;
            // get open direction
            for (let i = 0; i < dirs.length; i++) {
                let [fx, fy] = move(x, y, i);
                if (!visited.includes(hash(fx, fy)) && inBounds(fx, fy)) {
                    blocked = false;
                    dirInd = i;

                    x = fx;
                    y = fy;

                    break;
                }
            }

            // we are blocked, which means weve fully spiraled so quit
            if (blocked) break;
        } else {
            x = nx;
            y = ny;
        }
    }

    return out.join(', ');
}

function generateIpAddress(ns: NS, server: string, file: string): string {
    const cct = ns.codingcontract;
    const str = cct.getData(file, server) as string;

    // each octet can only be of length 1-3
    // since each IP address must have 4 components,
    // there are a total of 81 unique block length combinations (3^4)
    // this is a small enough set that we can just check every single one

    // the component lengths
    const inds = [1, 1, 1, 1];

    const out: string[] = [];
    while (true) {
        // get the next component lengths we should look at
        // [1, 1, 1, 3]++ -> [1, 1, 2, 1] (we increment each block until we reach the end)
        let atEnd = false;
        inds[inds.length - 1]++;
        for (let i = inds.length - 1; i >= 0; i--) {
            if (inds[i] == 4) {
                inds[i] = 1;
                if (i - 1 >= 0) inds[i - 1]++;
                else atEnd = true;
            }
        }

        if (atEnd) break;
        const sum = inds[0] + inds[1] + inds[2] + inds[3];
        if (sum != str.length) continue;

        // now check if the generate blocks are valid
        let isValid = true;
        let j = 0;
        let fmt: number[] = [];
        for (let i = 0; i < 4 && isValid; i++) {
            const s = str.substring(j, j + inds[i]);
            const n = Number(s);
            if (s.charAt(0) == '0' && n != 0) isValid = false;
            if (n > 255) isValid = false;

            j += inds[i];
            fmt.push(n);
        }

        if (isValid) out.push(fmt.join('.'));
    }

    return out.join(', ');
}

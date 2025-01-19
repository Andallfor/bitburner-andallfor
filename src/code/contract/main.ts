import { NS } from "@ns";
import { allServers, allServersString } from "../util/util";

export async function main(ns: NS) {
    const solutions: Record<string, (ns: NS, file: string, server: string) => string> = {
        'Array Jumping Game': arrayJumpingGame,
        'Square Root': squareRoot,
        'Compression II: LZ Decompression': compressionII,
        'Encryption II: Vigenère Cipher': vigenereCipher
    };

    const cct = ns.codingcontract;
    const flags = ns.flags([
        ['u', false], // unit test
        ['c', false], // clear all contracts on home
    ]);

    if (flags['c']) {
        const contracts = ns.ls('home', '.cct');
        contracts.forEach(x => ns.rm(x));
    } else if (flags['u']) {
        for (const [name, func] of Object.entries(solutions)) {
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

function arrayJumpingGame(ns: NS, server: string, file: string): string {
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

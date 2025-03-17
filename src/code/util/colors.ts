export function toRed(str: string) {
    return '\u001b[31m' + str + '\u001b[0m';
}

export function toCyan(str: string) {
    return '\x1b[36m' + str + '\x1b[0m';
}

export function toGreen(str: string) {
    return '\u001b[32m' + str + '\u001b[0m';
}


export function toPink(str: string) {
    return '\u001b[35m' + str + '\u001b[0m';
}

export function toWhite(str: string) {
    return '\u001b[37m' + str + '\u001b[0m';
}

export function toColor(str: string, code: string) {
    return `\u001b[${code}m` + str + '\u001b[0m';
}

export function colorValid(str: string, valid: boolean) {
    if (valid) return toGreen(str);
    return toRed(str);
}

export function strLenWithoutColors(str: string) {
    // get all occurrences of escape codes, then take each matches length and subtract from string
    return str.length - [...str.matchAll(/[\u001b\x1b]\[[0-9]+m/g)].reduce((acc, x) => acc + x[0].length, 0)
}

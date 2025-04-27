/** Round array of floats to ints while minimizing roundoff error */
export function round(n: number[], sum?: number) {
    // https://stackoverflow.com/questions/792460/how-to-round-floats-to-integers-while-preserving-their-sum
    if (!sum) sum = n.reduce((arr, x) => arr + x, 0);
    let lowerSum = 0;
    const buf = n.map<[number, number, number]>((x, i) => {
        const f = Math.floor(x);
        lowerSum += f;
        return [f, x - f, i];
    }).sort((a, b) => a[1] - b[1]);
    const diff = sum - lowerSum;

    for (let i = buf.length - diff; i < buf.length; i++) buf[i][0]++;

    return buf.sort((a, b) => a[2] - b[2]).map(x => x[0]);
}
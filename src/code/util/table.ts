import { strLenWithoutColors } from "./colors";
import { pad } from "./util";

interface tableSettings {
    divider: boolean;
}

export class table {
    public header: (string | number)[] = [];
    public body: (string | number)[][] = [];
    public settings: tableSettings[] = [];

    public constructor(h: (string | number)[]) {
        this.header = h;

        for (let i = 0; i < h.length; i++) {
            this.settings.push({
                divider: true,
            });
        }
    }

    public print(): string {
        const header = this.header.map(x => typeof x == 'number' ? x.toString() : x);
        const body = this.body.map(x => x.map(y => typeof y == 'number' ? y.toString() : y));

        const length: number[] = header.map(x => strLenWithoutColors(x));
        body.forEach(line => {
            // assumes all lines (and header) have same length
            for (let i = 0; i < line.length; i++) length[i] = Math.max(length[i], strLenWithoutColors(line[i]));
        });

        let out = this.printLine(header, length) + '\n├';
        for (let i = 0; i < header.length; i++) {
            out += '─'.repeat(length[i] + 2) + (i == header.length - 1 ? '┤' : (this.settings[i].divider ? '┼' : '─'));
        }
        out += '\n';
        for (let i = 0; i < body.length; i++) out += this.printLine(body[i], length) + '\n';

        return out;
    }

    private printLine(line: string[], length: number[]) {
        let out = '│';
        for (let i = 0; i < line.length; i++) {
            out += ` ${pad(line[i], length[i] + 1)} ${this.settings[i].divider ? '│' : ' '}`;
        }

        return out;
    }
}

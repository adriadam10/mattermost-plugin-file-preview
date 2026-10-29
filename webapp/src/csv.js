// CSV parsing for the preview table: RFC 4180 quoting, the separator Excel picks for
// the user's locale (";" in Spain) and the Windows-1252 files Excel saves by default.

const DELIMITERS = [';', ',', '\t', '|'];

export function decodeText(buffer) {
    const bytes = new Uint8Array(buffer);
    try {
        // A BOM is dropped by the decoder itself.
        return new TextDecoder('utf-8', {fatal: true}).decode(bytes);
    } catch {
        return new TextDecoder('windows-1252').decode(bytes);
    }
}

// The delimiter that splits the first lines into the same number of fields, the most.
export function detectDelimiter(text) {
    const sample = text.slice(0, 64 * 1024);
    let best = ',';
    let bestScore = 0;
    for (const delimiter of DELIMITERS) {
        const rows = parseCsv(sample, delimiter, 20).filter((row) => row.length > 1 || row[0] !== '');
        if (rows.length === 0) {
            continue;
        }
        const width = rows[0].length;
        const consistent = rows.filter((row) => row.length === width).length / rows.length;
        const score = width > 1 ? width * consistent : 0;
        if (score > bestScore) {
            best = delimiter;
            bestScore = score;
        }
    }
    return best;
}

export function parseCsv(text, delimiter, maxRows = Infinity) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    let i = 0;
    while (i < text.length && rows.length < maxRows) {
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') {
                field += '"';
                i += 2;
                continue;
            }
            if (c === '"') {
                quoted = false;
            } else {
                field += c;
            }
            i++;
            continue;
        }
        if (c === '"' && field === '') {
            quoted = true;
        } else if (c === delimiter) {
            row.push(field);
            field = '';
        } else if (c === '\n' || c === '\r') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
            if (c === '\r' && text[i + 1] === '\n') {
                i++;
            }
        } else {
            field += c;
        }
        i++;
    }
    if ((field !== '' || row.length > 0) && rows.length < maxRows) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

// Numbers as Spaniards and machines write them: "1.234,5", "1234.5", "-3", "12 %".
export function parseNumber(value) {
    const s = value.trim().replace(/\s*%$/, '');
    if (!/^[-+]?[\d.,]+$/.test(s) || !/\d/.test(s)) {
        return null;
    }
    let normalized = s;
    // "1,234" alone stays Spanish (1.234); English thousands need two groups or a decimal point.
    if (/^[-+]?\d{1,3}((,\d{3}){2,}|(,\d{3})+\.\d+)$/.test(s)) {
        normalized = s.replace(/,/g, '');
    } else if (/,\d+$/.test(s)) {
        normalized = s.replace(/\./g, '').replace(',', '.');
    }
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
}

// "29/10/2026" or "29-10-2026 14:05", as Spanish exports write dates; null otherwise.
export function parseDate(value) {
    const m = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m) {
        return null;
    }
    const [, d, mo, y, h = 0, mi = 0, sec = 0] = m.map((x) => (x === undefined ? undefined : Number(x)));
    return Date.UTC(y, mo - 1, d, h, mi, sec);
}

const collator = new Intl.Collator('es', {numeric: true, sensitivity: 'base'});

// Empty cells always last; numbers by value; the rest alphabetically.
export function compareCells(a, b) {
    if (a === '' || b === '') {
        return (a === '') - (b === '');
    }
    const na = parseNumber(a);
    const nb = parseNumber(b);
    if (na !== null && nb !== null) {
        return na - nb;
    }
    const da = parseDate(a);
    const db = parseDate(b);
    if (da !== null && db !== null) {
        return da - db;
    }
    return collator.compare(a, b);
}

export function sortRows(rows, column, direction) {
    const sign = direction === 'desc' ? -1 : 1;
    return rows.slice().sort((x, y) => {
        const a = x[column] ?? '';
        const b = y[column] ?? '';
        if (a === '' || b === '') {
            return compareCells(a, b);
        }
        return sign * compareCells(a, b);
    });
}

// Case and accent insensitive, so "jose" finds "José".
export function normalizeForSearch(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function filterRows(rows, query) {
    const q = normalizeForSearch(query.trim());
    if (!q) {
        return rows;
    }
    return rows.filter((row) => row.some((cell) => normalizeForSearch(cell).includes(q)));
}

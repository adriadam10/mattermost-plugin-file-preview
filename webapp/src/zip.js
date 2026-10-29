// Lists a ZIP file's entries from its central directory, which sits at the end of the
// file: with HTTP range requests a 60 MB archive costs a few KB instead of a download.

const EOCD = 0x06054b50;
const ZIP64_LOCATOR = 0x07064b50;
const ZIP64_EOCD = 0x06064b50;
const CENTRAL_ENTRY = 0x02014b50;

// The end record is 22 bytes plus a comment of up to 64 KB.
const TAIL_BYTES = 22 + 0xffff + 20;

// A central directory this big means hundreds of thousands of entries: not a preview.
export const MAX_DIRECTORY_BYTES = 32 * 1024 * 1024;

// Windows' built-in zip writes names in the OEM code page (850 in Spain) unless they are
// flagged as UTF-8; TextDecoder does not know it, so the upper half goes here.
const CP850 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ';

export class ZipError extends Error {}

export function decodeCp850(bytes) {
    let out = '';
    for (const b of bytes) {
        out += b < 0x80 ? String.fromCharCode(b) : CP850[b - 0x80];
    }
    return out;
}

const utf8 = new TextDecoder('utf-8');

function dosDate(date, time) {
    if (date === 0) {
        return null;
    }
    return new Date((date >> 9) + 1980, ((date >> 5) & 0xf) - 1, date & 0x1f, time >> 11, (time >> 5) & 0x3f, (time & 0x1f) * 2);
}

function u64(view, offset) {
    return Number(view.getBigUint64(offset, true));
}

function findEndRecord(view) {
    for (let i = view.byteLength - 22; i >= 0; i--) {
        if (view.getUint32(i, true) === EOCD) {
            return i;
        }
    }
    throw new ZipError('not a zip file');
}

// readRange(start, end) returns the bytes [start, end) of the file as an ArrayBuffer.
export async function readZipEntries(readRange, fileSize) {
    const tailStart = Math.max(0, fileSize - TAIL_BYTES);
    const tail = new DataView(await readRange(tailStart, fileSize));
    const eocd = findEndRecord(tail);

    let count = tail.getUint16(eocd + 10, true);
    let dirSize = tail.getUint32(eocd + 12, true);
    let dirOffset = tail.getUint32(eocd + 16, true);

    const locator = eocd - 20;
    if (locator >= 0 && tail.getUint32(locator, true) === ZIP64_LOCATOR) {
        const recordOffset = u64(tail, locator + 8);
        const record = recordOffset >= tailStart ?
            new DataView(tail.buffer, tail.byteOffset + recordOffset - tailStart, 56) :
            new DataView(await readRange(recordOffset, recordOffset + 56));
        if (record.getUint32(0, true) !== ZIP64_EOCD) {
            throw new ZipError('broken zip64 record');
        }
        count = u64(record, 32);
        dirSize = u64(record, 40);
        dirOffset = u64(record, 48);
    }

    if (dirSize > MAX_DIRECTORY_BYTES) {
        throw new ZipError('too many entries');
    }
    if (dirOffset + dirSize > fileSize) {
        throw new ZipError('truncated zip file');
    }
    const directory = dirOffset >= tailStart ?
        new DataView(tail.buffer, tail.byteOffset + dirOffset - tailStart, dirSize) :
        new DataView(await readRange(dirOffset, dirOffset + dirSize));
    return parseDirectory(directory, count);
}

function parseDirectory(view, count) {
    const entries = [];
    let pos = 0;
    for (let i = 0; i < count; i++) {
        if (pos + 46 > view.byteLength || view.getUint32(pos, true) !== CENTRAL_ENTRY) {
            throw new ZipError('broken central directory');
        }
        const flags = view.getUint16(pos + 8, true);
        const nameLength = view.getUint16(pos + 28, true);
        const extraLength = view.getUint16(pos + 30, true);
        const commentLength = view.getUint16(pos + 32, true);
        const nameBytes = new Uint8Array(view.buffer, view.byteOffset + pos + 46, nameLength);
        const extra = new DataView(view.buffer, view.byteOffset + pos + 46 + nameLength, extraLength);

        const entry = {
            // Bit 11: the name is UTF-8.
            name: flags & 0x800 ? utf8.decode(nameBytes) : decodeCp850(nameBytes),
            compressedSize: view.getUint32(pos + 20, true),
            size: view.getUint32(pos + 24, true),
            modified: dosDate(view.getUint16(pos + 14, true), view.getUint16(pos + 12, true)),
            encrypted: Boolean(flags & 0x1),
        };
        applyExtraFields(entry, extra, nameBytes);
        // bsdtar writes "./dir/file"; Windows tools sometimes use backslashes.
        entry.name = entry.name.replace(/\\/g, '/').replace(/^(\.\/)+/, '');
        entry.isDir = entry.name.endsWith('/');
        entries.push(entry);
        pos += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
}

function applyExtraFields(entry, extra, nameBytes) {
    let pos = 0;
    while (pos + 4 <= extra.byteLength) {
        const id = extra.getUint16(pos, true);
        const length = extra.getUint16(pos + 2, true);
        const data = pos + 4;
        if (data + length > extra.byteLength) {
            return;
        }
        if (id === 0x0001) {
            // Zip64: the real values of the fields saturated at 0xffffffff, in this order.
            let field = data;
            for (const key of ['size', 'compressedSize']) {
                if (entry[key] === 0xffffffff && field + 8 <= data + length) {
                    entry[key] = u64(extra, field);
                    field += 8;
                }
            }
        } else if (id === 0x7075 && length > 5) {
            // Info-ZIP Unicode path (7-Zip, WinRAR): only valid for the name it was made from.
            const crc = extra.getUint32(data + 1, true);
            if (crc === crc32(nameBytes)) {
                entry.name = utf8.decode(new Uint8Array(extra.buffer, extra.byteOffset + data + 5, length - 5));
            }
        }
        pos = data + length;
    }
}

let crcTable;

export function crc32(bytes) {
    if (!crcTable) {
        crcTable = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) {
                c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            }
            crcTable[n] = c;
        }
    }
    let crc = 0xffffffff;
    for (const b of bytes) {
        crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

// Folders as nodes with their files' total size; zips often omit the folder entries.
export function buildTree(entries) {
    const newDir = (name, path) => ({name, path, children: new Map(), size: 0, files: 0});
    const root = newDir('', '');
    for (const entry of entries) {
        const parts = entry.name.split('/').filter(Boolean);
        const dirParts = entry.isDir ? parts : parts.slice(0, -1);
        let dir = root;
        const ancestors = [root];
        dirParts.forEach((part, i) => {
            if (!dir.children.has(part)) {
                dir.children.set(part, newDir(part, `${dirParts.slice(0, i + 1).join('/')}/`));
            }
            dir = dir.children.get(part);
            ancestors.push(dir);
        });
        if (entry.isDir || parts.length === 0) {
            continue;
        }
        const name = parts[parts.length - 1];
        dir.children.set(name, {...entry, name, path: entry.name});
        for (const ancestor of ancestors) {
            ancestor.size += entry.size;
            ancestor.files++;
        }
    }
    return root;
}

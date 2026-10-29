import assert from 'node:assert/strict';
import {test} from 'node:test';

import {buildTree, crc32, decodeCp850, readZipEntries} from './zip.js';

const enc = new TextEncoder();

// Writes only what the reader looks at: central directory and end records. Each entry
// takes {name: Uint8Array, flags, size, compressedSize, extra}.
function makeZip(entries, {zip64 = false, comment = '', padding = 0} = {}) {
    const parts = [new Uint8Array(padding)];
    const dirOffset = padding;
    let dirSize = 0;
    for (const e of entries) {
        const extra = e.extra || new Uint8Array();
        const header = new DataView(new ArrayBuffer(46));
        header.setUint32(0, 0x02014b50, true);
        header.setUint16(8, e.flags || 0, true);
        header.setUint16(12, (14 << 11) | (30 << 5), true);
        header.setUint16(14, ((2026 - 1980) << 9) | (10 << 5) | 29, true);
        header.setUint32(20, e.compressedSize ?? e.size ?? 0, true);
        header.setUint32(24, e.size ?? 0, true);
        header.setUint16(28, e.name.length, true);
        header.setUint16(30, extra.length, true);
        parts.push(new Uint8Array(header.buffer), e.name, extra);
        dirSize += 46 + e.name.length + extra.length;
    }
    if (zip64) {
        const record = new DataView(new ArrayBuffer(56));
        record.setUint32(0, 0x06064b50, true);
        record.setBigUint64(32, BigInt(entries.length), true);
        record.setBigUint64(40, BigInt(dirSize), true);
        record.setBigUint64(48, BigInt(dirOffset), true);
        const locator = new DataView(new ArrayBuffer(20));
        locator.setUint32(0, 0x07064b50, true);
        locator.setBigUint64(8, BigInt(dirOffset + dirSize), true);
        parts.push(new Uint8Array(record.buffer), new Uint8Array(locator.buffer));
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(10, zip64 ? 0xffff : entries.length, true);
    end.setUint32(12, zip64 ? 0xffffffff : dirSize, true);
    end.setUint32(16, zip64 ? 0xffffffff : dirOffset, true);
    end.setUint16(20, comment.length, true);
    parts.push(new Uint8Array(end.buffer), enc.encode(comment));

    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    parts.reduce((offset, p) => {
        out.set(p, offset);
        return offset + p.length;
    }, 0);
    return out;
}

function reader(bytes) {
    const ranges = [];
    const readRange = async (start, end) => {
        ranges.push([start, end]);
        return bytes.slice(start, end).buffer;
    };
    return {readRange, ranges};
}

const list = async (bytes) => readZipEntries(reader(bytes).readRange, bytes.length);

test('decodeCp850 decodes Spanish names from Windows zips', () => {
    assert.equal(decodeCp850(Uint8Array.of(0x41, 0xa4, 0x6f, 0xa0)), 'Añoá');
});

test('crc32 matches the reference value', () => {
    assert.equal(crc32(enc.encode('123456789')), 0xcbf43926);
});

test('names: UTF-8 flag, code page 850 and Info-ZIP Unicode path', async () => {
    const legacy = Uint8Array.of(...enc.encode('fac'), 0x82, ...enc.encode('.txt'));
    const unicodeExtra = (name, original) => {
        const data = enc.encode(name);
        const view = new DataView(new ArrayBuffer(9 + data.length));
        view.setUint16(0, 0x7075, true);
        view.setUint16(2, 5 + data.length, true);
        view.setUint8(4, 1);
        view.setUint32(5, crc32(original), true);
        const out = new Uint8Array(view.buffer);
        out.set(data, 9);
        return out;
    };
    const entries = await list(makeZip([
        {name: enc.encode('carpeta/año.pdf'), flags: 0x800, size: 10},
        {name: Uint8Array.of(0xa4, 0x2e, 0x63, 0x73, 0x76), size: 5},
        {name: legacy, extra: unicodeExtra('factura€.txt', legacy)},
        {name: enc.encode('stale.txt'), extra: unicodeExtra('ignored.txt', enc.encode('other'))},
        {name: enc.encode('win\\path.txt')},
        {name: enc.encode('./bsdtar/x.txt'), flags: 0x1},
    ]));
    assert.deepEqual(entries.map((e) => e.name), ['carpeta/año.pdf', 'ñ.csv', 'factura€.txt', 'stale.txt', 'win/path.txt', 'bsdtar/x.txt']);
    assert.deepEqual(entries.map((e) => e.encrypted), [false, false, false, false, false, true]);
    assert.equal(entries[0].size, 10);
    assert.deepEqual(entries[0].modified, new Date(2026, 9, 29, 14, 30, 0));
});

test('only the tail is fetched when the directory is in it', async () => {
    const bytes = makeZip([{name: enc.encode('a.txt')}], {padding: 200000, comment: 'hola'});
    const {readRange, ranges} = reader(bytes);
    const entries = await readZipEntries(readRange, bytes.length);
    assert.equal(entries[0].name, 'a.txt');
    assert.equal(ranges.length, 1);
    assert.ok(ranges[0][0] > 100000);
});

test('directory before the tail costs one more range request', async () => {
    const many = Array.from({length: 2000}, (_, i) => ({name: enc.encode(`dir/file-${i}-${'x'.repeat(40)}.txt`)}));
    const bytes = makeZip(many);
    const {readRange, ranges} = reader(bytes);
    assert.equal((await readZipEntries(readRange, bytes.length)).length, 2000);
    assert.equal(ranges.length, 2);
});

test('zip64 end records and sizes', async () => {
    const extra = new DataView(new ArrayBuffer(20));
    extra.setUint16(0, 0x0001, true);
    extra.setUint16(2, 16, true);
    extra.setBigUint64(4, 5_000_000_000n, true);
    extra.setBigUint64(12, 4_900_000_000n, true);
    const entries = await list(makeZip(
        [{name: enc.encode('big.iso'), size: 0xffffffff, compressedSize: 0xffffffff, extra: new Uint8Array(extra.buffer)}],
        {zip64: true},
    ));
    assert.equal(entries[0].size, 5_000_000_000);
    assert.equal(entries[0].compressedSize, 4_900_000_000);
});

test('rejects files that are not zips', async () => {
    await assert.rejects(list(enc.encode('just some text, no end record here')), /not a zip file/);
});

test('buildTree adds up folder sizes, with or without folder entries', () => {
    const root = buildTree([
        {name: 'a/', isDir: true, size: 0},
        {name: 'a/b/c.txt', isDir: false, size: 3},
        {name: 'a/d.txt', isDir: false, size: 4},
        {name: 'e.txt', isDir: false, size: 5},
    ]);
    const a = root.children.get('a');
    assert.equal(root.size, 12);
    assert.equal(root.files, 3);
    assert.equal(a.size, 7);
    assert.equal(a.children.get('b').size, 3);
    assert.equal(a.children.get('b').path, 'a/b/');
    assert.equal(root.children.get('e.txt').path, 'e.txt');
});

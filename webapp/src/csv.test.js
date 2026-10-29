import assert from 'node:assert/strict';
import {test} from 'node:test';

import {compareCells, decodeText, detectDelimiter, filterRows, parseCsv, parseNumber, sortRows} from './csv.js';

test('parseCsv handles quotes, escaped quotes, newlines inside quotes and CRLF', () => {
    const text = 'a;"b;c";"say ""hi"""\r\n1;"two\nlines";3\r\n';
    assert.deepEqual(parseCsv(text, ';'), [['a', 'b;c', 'say "hi"'], ['1', 'two\nlines', '3']]);
});

test('parseCsv keeps a last line without newline and empty fields', () => {
    assert.deepEqual(parseCsv('a,,c\nd,e,', ','), [['a', '', 'c'], ['d', 'e', '']]);
});

test('detectDelimiter picks what Excel would have written', () => {
    assert.equal(detectDelimiter('nombre;importe\nJosé;1,5\nAna;2,25\n'), ';');
    assert.equal(detectDelimiter('name,amount\n"Smith; John",1.5\nAna,2\n'), ',');
    assert.equal(detectDelimiter('a\tb\tc\n1\t2\t3\n'), '\t');
    assert.equal(detectDelimiter('una sola columna\nvalor\n'), ',');
});

test('decodeText falls back to Windows-1252 and drops the UTF-8 BOM', () => {
    assert.equal(decodeText(Uint8Array.of(0x41, 0xf1, 0x6f).buffer), 'Año');
    assert.equal(decodeText(Uint8Array.of(0xef, 0xbb, 0xbf, 0xc3, 0xb1).buffer), 'ñ');
});

test('parseNumber reads Spanish and plain formats', () => {
    assert.equal(parseNumber('1.234,56'), 1234.56);
    assert.equal(parseNumber('1234.56'), 1234.56);
    assert.equal(parseNumber('1,234,567'), 1234567);
    assert.equal(parseNumber('-3'), -3);
    assert.equal(parseNumber('12 %'), 12);
    assert.equal(parseNumber('ES123'), null);
    assert.equal(parseNumber('.'), null);
});

test('sortRows: numbers by value, text alphabetically, empty cells last both ways', () => {
    const rows = [['10'], [''], ['9,5'], ['100']];
    assert.deepEqual(sortRows(rows, 0, 'asc').map((r) => r[0]), ['9,5', '10', '100', '']);
    assert.deepEqual(sortRows(rows, 0, 'desc').map((r) => r[0]), ['100', '10', '9,5', '']);
    assert.ok(compareCells('árbol', 'Bote') < 0);
    assert.ok(compareCells('fila 2', 'fila 10') < 0);
    assert.ok(compareCells('30/09/2026', '01/10/2026') < 0);
    assert.ok(compareCells('01-10-2026 9:05', '01-10-2026 10:00') < 0);
});

test('filterRows ignores case and accents', () => {
    const rows = [['José', 'Madrid'], ['Ana', 'Cádiz']];
    assert.deepEqual(filterRows(rows, 'jose'), [rows[0]]);
    assert.deepEqual(filterRows(rows, 'CADIZ'), [rows[1]]);
    assert.equal(filterRows(rows, '  ').length, 2);
});

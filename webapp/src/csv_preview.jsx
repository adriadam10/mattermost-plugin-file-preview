import React, {useEffect, useMemo, useState} from 'react';

import {decodeText, detectDelimiter, filterRows, parseCsv, sortRows} from './csv.js';
import {fetchFile} from './files.js';
import {formatSize} from './i18n.js';

const MAX_BYTES = 20 * 1024 * 1024;
const PAGE_SIZE = 100;
const NEXT_SORT = {undefined: 'asc', asc: 'desc', desc: undefined};

function useCsv(fileInfo) {
    const [state, setState] = useState({status: 'loading'});
    useEffect(() => {
        if (fileInfo.size > MAX_BYTES) {
            setState({status: 'tooBig'});
            return undefined;
        }
        let cancelled = false;
        fetchFile(fileInfo.id).then((buffer) => {
            const text = decodeText(buffer);
            const delimiter = detectDelimiter(text);
            const [header = [], ...rows] = parseCsv(text, delimiter);
            if (!cancelled) {
                setState({status: 'ready', delimiter, header, rows});
            }
        }).catch((error) => !cancelled && setState({status: 'error', error: error.message}));
        return () => {
            cancelled = true;
        };
    }, [fileInfo.id, fileInfo.size]);
    return state;
}

export default function CsvPreview({fileInfo, t, locale}) {
    const csv = useCsv(fileInfo);
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState({});
    const [page, setPage] = useState(0);

    const shown = useMemo(() => {
        if (csv.status !== 'ready') {
            return [];
        }
        const filtered = filterRows(csv.rows, query);
        return sort.direction ? sortRows(filtered, sort.column, sort.direction) : filtered;
    }, [csv, query, sort]);

    if (csv.status === 'loading') {
        return <div className='file-preview-plugin file-preview-plugin__message'>{t('loading')}</div>;
    }
    if (csv.status === 'tooBig') {
        return (
            <div className='file-preview-plugin file-preview-plugin__message'>
                {t('tooBig', {size: formatSize(fileInfo.size, locale), max: formatSize(MAX_BYTES, locale)})}
            </div>
        );
    }
    if (csv.status === 'error') {
        return <div className='file-preview-plugin file-preview-plugin__message'>{t('loadError', {error: csv.error})}</div>;
    }

    const columns = Math.max(csv.header.length, ...csv.rows.slice(0, 1000).map((row) => row.length));
    const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
    const current = Math.min(page, pages - 1);
    const visible = shown.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
    const number = (n) => n.toLocaleString(locale);

    const toggleSort = (column) => {
        const direction = sort.column === column ? NEXT_SORT[sort.direction] : 'asc';
        setSort(direction ? {column, direction} : {});
        setPage(0);
    };

    return (
        <div className='file-preview-plugin'>
            <div className='file-preview-plugin__toolbar'>
                <input
                    className='form-control file-preview-plugin__filter'
                    type='search'
                    placeholder={t('filter')}
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setPage(0);
                    }}
                />
                <span>{t('rows', {shown: number(shown.length), total: number(csv.rows.length)})}</span>
                <span className='file-preview-plugin__muted'>
                    {t('separator', {separator: csv.delimiter === '\t' ? t('tab') : csv.delimiter})}
                </span>
            </div>
            <div className='file-preview-plugin__scroll'>
                <table className='file-preview-plugin__table'>
                    <thead>
                        <tr>
                            <th className='file-preview-plugin__rownum'>#</th>
                            {Array.from({length: columns}, (_, i) => (
                                <th
                                    key={i}
                                    title={t('sortHint')}
                                    onClick={() => toggleSort(i)}
                                >
                                    {csv.header[i] ?? ''}
                                    <span className='file-preview-plugin__sort'>
                                        {sort.column === i && (sort.direction === 'asc' ? ' ▲' : ' ▼')}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((row, r) => (
                            <tr key={r}>
                                <td className='file-preview-plugin__rownum'>{number(current * PAGE_SIZE + r + 1)}</td>
                                {Array.from({length: columns}, (_, i) => <td key={i}>{row[i] ?? ''}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {shown.length === 0 && <div className='file-preview-plugin__message'>{t('noRows')}</div>}
            </div>
            {pages > 1 && (
                <div className='file-preview-plugin__pager'>
                    <button
                        className='btn btn-tertiary btn-sm'
                        disabled={current === 0}
                        onClick={() => setPage(current - 1)}
                    >
                        {t('previous')}
                    </button>
                    <span>{t('page', {page: number(current + 1), pages: number(pages)})}</span>
                    <button
                        className='btn btn-tertiary btn-sm'
                        disabled={current === pages - 1}
                        onClick={() => setPage(current + 1)}
                    >
                        {t('next')}
                    </button>
                </div>
            )}
        </div>
    );
}

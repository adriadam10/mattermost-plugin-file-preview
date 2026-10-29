import React, {useEffect, useMemo, useState} from 'react';

import {rangeReader} from './files.js';
import {normalizeForSearch} from './csv.js';
import {formatSize} from './i18n.js';
import {buildTree, readZipEntries} from './zip.js';

// Archives up to this size open with every folder expanded.
const EXPAND_ALL_UP_TO = 300;
const MAX_FILTER_RESULTS = 1000;

function useZip(fileInfo) {
    const [state, setState] = useState({status: 'loading'});
    useEffect(() => {
        let cancelled = false;
        readZipEntries(rangeReader(fileInfo.id), fileInfo.size).then((entries) => {
            if (!cancelled) {
                setState({status: 'ready', entries, tree: buildTree(entries)});
            }
        }).catch((error) => !cancelled && setState({status: 'error', error: error.message}));
        return () => {
            cancelled = true;
        };
    }, [fileInfo.id, fileInfo.size]);
    return state;
}

// Folders first, then by name, like a file manager.
function sortedChildren(dir) {
    return [...dir.children.values()].sort((a, b) => {
        if (Boolean(a.children) !== Boolean(b.children)) {
            return a.children ? -1 : 1;
        }
        return a.name.localeCompare(b.name, undefined, {numeric: true});
    });
}

function visibleRows(dir, collapsed, depth = 0, out = []) {
    for (const node of sortedChildren(dir)) {
        out.push({node, depth});
        if (node.children && !collapsed.has(node.path)) {
            visibleRows(node, collapsed, depth + 1, out);
        }
    }
    return out;
}

function initiallyCollapsed(zip) {
    const collapsed = new Set();
    if (zip.entries.length <= EXPAND_ALL_UP_TO) {
        return collapsed;
    }
    const collapseBelow = (dir) => dir.children.forEach((node) => {
        if (node.children) {
            collapsed.add(node.path);
            collapseBelow(node);
        }
    });
    // A zip of a single folder would show nothing but that folder: open the first level.
    const top = sortedChildren(zip.tree);
    top.forEach((node) => node.children && collapseBelow(node));
    if (top.length > 1) {
        top.forEach((node) => node.children && collapsed.add(node.path));
    }
    return collapsed;
}

export default function ZipPreview({fileInfo, t, locale}) {
    const zip = useZip(fileInfo);
    const [collapsed, setCollapsed] = useState(null);
    const [query, setQuery] = useState('');

    const folded = useMemo(() => (zip.status === 'ready' ? initiallyCollapsed(zip) : new Set()), [zip]);
    const closed = collapsed ?? folded;

    const rows = useMemo(() => {
        if (zip.status !== 'ready') {
            return [];
        }
        const q = normalizeForSearch(query.trim());
        if (q) {
            return zip.entries.
                filter((e) => !e.isDir && normalizeForSearch(e.name).includes(q)).
                slice(0, MAX_FILTER_RESULTS).
                map((e) => ({node: {...e, path: e.name}, depth: 0}));
        }
        return visibleRows(zip.tree, closed);
    }, [zip, closed, query]);

    if (zip.status === 'loading') {
        return <div className='file-preview-plugin file-preview-plugin__message'>{t('loading')}</div>;
    }
    if (zip.status === 'error') {
        return <div className='file-preview-plugin file-preview-plugin__message'>{t('zipError', {error: zip.error})}</div>;
    }

    const toggle = (path) => {
        const next = new Set(closed);
        if (next.has(path)) {
            next.delete(path);
        } else {
            next.add(path);
        }
        setCollapsed(next);
    };
    const when = (date) => date?.toLocaleString(locale, {dateStyle: 'short', timeStyle: 'short'}) ?? '';

    return (
        <div className='file-preview-plugin'>
            <div className='file-preview-plugin__toolbar'>
                <input
                    className='form-control file-preview-plugin__filter'
                    type='search'
                    placeholder={t('filter')}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <span>
                    {t('zipSummary', {
                        files: zip.tree.files.toLocaleString(locale),
                        size: formatSize(zip.tree.size, locale),
                    })}
                </span>
            </div>
            <div className='file-preview-plugin__scroll'>
                <table className='file-preview-plugin__table file-preview-plugin__table--zip'>
                    <thead>
                        <tr>
                            <th>{t('name')}</th>
                            <th className='file-preview-plugin__num'>{t('size')}</th>
                            <th className='file-preview-plugin__num'>{t('compressed')}</th>
                            <th>{t('modified')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({node, depth}) => (
                            <tr
                                key={node.path}
                                className={node.children ? 'file-preview-plugin__folder' : ''}
                                onClick={node.children ? () => toggle(node.path) : undefined}
                            >
                                <td style={{paddingLeft: `${8 + (depth * 18)}px`}}>
                                    <span className='file-preview-plugin__icon'>
                                        {node.children ? (closed.has(node.path) ? '▸ 📁' : '▾ 📂') : '📄'}
                                    </span>
                                    {query ? node.path : node.name}
                                    {node.encrypted && <span title={t('encrypted')}>{' 🔒'}</span>}
                                </td>
                                <td className='file-preview-plugin__num'>{formatSize(node.size, locale)}</td>
                                <td className='file-preview-plugin__num'>
                                    {node.children ? '' : formatSize(node.compressedSize, locale)}
                                </td>
                                <td>{node.children ? '' : when(node.modified)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {rows.length === 0 && (
                    <div className='file-preview-plugin__message'>{t(query ? 'noMatches' : 'noEntries')}</div>
                )}
            </div>
        </div>
    );
}

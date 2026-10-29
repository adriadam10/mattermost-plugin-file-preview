import React, {useEffect, useState} from 'react';

import {decodeText} from './csv.js';
import {fetchFile, sandboxedHtmlUrl} from './files.js';

function useSource(fileId, wanted) {
    const [source, setSource] = useState(null);
    useEffect(() => {
        if (!wanted || source !== null) {
            return undefined;
        }
        let cancelled = false;
        fetchFile(fileId).
            then((buffer) => !cancelled && setSource(decodeText(buffer))).
            catch((error) => !cancelled && setSource(`${error.message}`));
        return () => {
            cancelled = true;
        };
    }, [fileId, wanted, source]);
    return source;
}

export default function HtmlPreview({fileInfo, t}) {
    const [tab, setTab] = useState('view');
    const source = useSource(fileInfo.id, tab === 'source');

    const tabButton = (name) => (
        <button
            className={`btn btn-sm ${tab === name ? 'btn-primary' : 'btn-tertiary'}`}
            onClick={() => setTab(name)}
        >
            {t(name)}
        </button>
    );

    return (
        <div className='file-preview-plugin'>
            <div className='file-preview-plugin__toolbar'>
                {tabButton('view')}
                {tabButton('source')}
                <span className='file-preview-plugin__muted'>{t('sandboxNote')}</span>
            </div>
            {tab === 'view' ? (
                <iframe
                    className='file-preview-plugin__frame'
                    title={fileInfo.name}
                    src={sandboxedHtmlUrl(fileInfo.id)}

                    // The server already sends a CSP sandbox; this keeps it if a proxy drops the header.
                    sandbox='allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads'
                    referrerPolicy='no-referrer'
                />
            ) : (
                <pre className='file-preview-plugin__source'>{source ?? t('loading')}</pre>
            )}
        </div>
    );
}

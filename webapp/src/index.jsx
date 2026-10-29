import React from 'react';

import manifest from '../../plugin.json';

import CsvPreview from './csv_preview.jsx';
import HtmlPreview from './html_preview.jsx';
import {translator} from './i18n.js';
import {STYLES} from './styles.js';
import ZipPreview from './zip_preview.jsx';

const PREVIEWS = [
    {extensions: ['csv', 'tsv'], component: CsvPreview},
    {extensions: ['zip'], component: ZipPreview},
    {extensions: ['html', 'htm'], component: HtmlPreview},
];

function currentLocale(state) {
    const {currentUserId, profiles} = state.entities.users;
    return profiles[currentUserId]?.locale || document.documentElement.lang || 'en';
}

class Plugin {
    initialize(registry, store) {
        const locale = currentLocale(store.getState());
        const t = translator(locale);

        this.style = document.createElement('style');
        this.style.textContent = STYLES;
        document.head.appendChild(this.style);

        for (const {extensions, component: Preview} of PREVIEWS) {
            registry.registerFilePreviewComponent(
                (fileInfo) => extensions.includes((fileInfo.extension || '').toLowerCase()),
                ({fileInfo}) => (
                    <Preview
                        key={fileInfo.id}
                        fileInfo={fileInfo}
                        t={t}
                        locale={locale}
                    />
                ),
            );
        }
    }

    uninitialize() {
        this.style?.remove();
    }
}

window.registerPlugin(manifest.id, new Plugin());

const STRINGS = {
    en: {
        loading: 'Loading…',
        loadError: 'Could not load the file: {error}',
        tooBig: 'The file is too big to preview ({size}, maximum {max}). Download it to open it.',
        filter: 'Filter',
        rows: '{shown} of {total} rows',
        noRows: 'No rows match the filter.',
        page: 'Page {page} of {pages}',
        previous: 'Previous',
        next: 'Next',
        separator: 'Separator: {separator}',
        tab: 'tab',
        sortHint: 'Click to sort',
        name: 'Name',
        size: 'Size',
        compressed: 'Compressed',
        modified: 'Modified',
        zipSummary: '{files} files, {size} uncompressed',
        encrypted: 'Password protected',
        noEntries: 'The archive is empty.',
        noMatches: 'No files match the filter.',
        zipError: 'Could not read the archive: {error}',
        view: 'Page',
        source: 'Source',
        sandboxNote: 'Scripts run isolated from Mattermost.',
    },
    es: {
        loading: 'Cargando…',
        loadError: 'No se ha podido cargar el fichero: {error}',
        tooBig: 'El fichero es demasiado grande para previsualizarlo ({size}, máximo {max}). Descárgalo para abrirlo.',
        filter: 'Filtrar',
        rows: '{shown} de {total} filas',
        noRows: 'Ninguna fila coincide con el filtro.',
        page: 'Página {page} de {pages}',
        previous: 'Anterior',
        next: 'Siguiente',
        separator: 'Separador: {separator}',
        tab: 'tabulador',
        sortHint: 'Pulsa para ordenar',
        name: 'Nombre',
        size: 'Tamaño',
        compressed: 'Comprimido',
        modified: 'Modificado',
        zipSummary: '{files} ficheros, {size} descomprimido',
        encrypted: 'Protegido con contraseña',
        noEntries: 'El archivo está vacío.',
        noMatches: 'Ningún fichero coincide con el filtro.',
        zipError: 'No se ha podido leer el archivo: {error}',
        view: 'Página',
        source: 'Código',
        sandboxNote: 'Los scripts se ejecutan aislados de Mattermost.',
    },
};

export function translator(locale) {
    const strings = STRINGS[(locale || '').split('-')[0]] || STRINGS.en;
    return (key, params = {}) => strings[key].replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '');
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export function formatSize(bytes, locale) {
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < UNITS.length - 1) {
        value /= 1024;
        unit++;
    }
    const digits = unit === 0 || value >= 100 ? 0 : 1;
    return `${value.toLocaleString(locale, {maximumFractionDigits: digits})} ${UNITS[unit]}`;
}

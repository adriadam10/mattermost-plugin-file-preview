import manifest from '../../plugin.json';

const base = () => window.basename || '';

export const fileUrl = (fileId) => `${base()}/api/v4/files/${fileId}`;
export const sandboxedHtmlUrl = (fileId) => `${base()}/plugins/${manifest.id}/html/${fileId}`;

async function fetchOk(url, headers) {
    const response = await fetch(url, {credentials: 'include', headers});
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response;
}

export async function fetchFile(fileId) {
    return (await fetchOk(fileUrl(fileId))).arrayBuffer();
}

// Range reader for zip.js. If a proxy drops the Range header the whole file comes back
// once, and later ranges are cut from it.
export function rangeReader(fileId) {
    let whole = null;
    return async (start, end) => {
        if (whole) {
            return whole.slice(start, end);
        }
        const response = await fetchOk(fileUrl(fileId), {Range: `bytes=${start}-${end - 1}`});
        const buffer = await response.arrayBuffer();
        if (response.status === 206) {
            return buffer;
        }
        whole = buffer;
        return whole.slice(start, end);
    };
}

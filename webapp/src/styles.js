// Uses Mattermost's theme variables, so the previews follow light and dark themes.
export const STYLES = `
.file-preview-plugin {
    display: flex;
    flex-direction: column;
    width: min(1200px, 92vw);
    height: calc(100vh - 160px);
    overflow: hidden;
    border-radius: 8px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-size: 13px;
    text-align: left;
}
.file-preview-plugin__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
}
.file-preview-plugin__filter { width: 240px; max-width: 100%; height: 32px; }
.file-preview-plugin__muted { color: rgba(var(--center-channel-color-rgb), 0.64); }
.file-preview-plugin__scroll { flex: 1; overflow: auto; }
.file-preview-plugin__table { border-collapse: collapse; min-width: 100%; }
.file-preview-plugin__table th,
.file-preview-plugin__table td {
    max-width: 420px;
    padding: 4px 8px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: top;
}
.file-preview-plugin__table th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--center-channel-bg);
    box-shadow: inset 0 -1px 0 rgba(var(--center-channel-color-rgb), 0.16);
    font-weight: 600;
    cursor: pointer;
    user-select: none;
}
.file-preview-plugin__table--zip th { cursor: default; }
.file-preview-plugin__table tbody tr:hover { background: rgba(var(--center-channel-color-rgb), 0.04); }
.file-preview-plugin__rownum,
.file-preview-plugin__num { text-align: right; color: rgba(var(--center-channel-color-rgb), 0.64); }
.file-preview-plugin__num { font-variant-numeric: tabular-nums; }
.file-preview-plugin__rownum { width: 1%; }
.file-preview-plugin__sort { color: var(--button-bg); }
.file-preview-plugin__folder { cursor: pointer; }
.file-preview-plugin__icon { display: inline-block; min-width: 40px; }
.file-preview-plugin__pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 8px;
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
}
.file-preview-plugin__message { padding: 24px; text-align: center; }
.file-preview-plugin.file-preview-plugin__message { height: auto; justify-content: center; }
.file-preview-plugin__frame { flex: 1; width: 100%; border: 0; background: #fff; }
.file-preview-plugin__source {
    flex: 1;
    margin: 0;
    padding: 12px;
    overflow: auto;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: inherit;
    font-size: 12px;
    white-space: pre;
}
`;

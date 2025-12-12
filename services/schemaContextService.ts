import { ProcessingFile } from '../types';
import { FileGroup, groupFilesByStructure } from './groupingService';

export interface SchemaContextResult {
    contextStr: string;
    diffSummary: string;
}

const isEmptyCell = (v: any) =>
    v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

const isNumericLike = (v: any) => {
    if (typeof v === 'number') return Number.isFinite(v);
    if (typeof v !== 'string') return false;
    const s = v.trim();
    if (!s) return false;
    return Number.isFinite(Number(s));
};

const normalizeHeaderCell = (v: any) =>
    String(v ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '_')
        .replace(/^_+|_+$/g, '');

const escapeCell = (s: string) =>
    s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').slice(0, 120);

const previewToMarkdownTable = (
    data: any[][],
    maxRows: number,
    headerRowIndex?: number | null
) => {
    if (!data || data.length === 0) return 'No data';
    const slice = data.slice(0, maxRows);
    const maxCols = Math.max(...slice.map(r => (Array.isArray(r) ? r.length : 0)), 0);
    const cols = Array.from({ length: maxCols }, (_, i) => `c${i + 1}`);

    const header = `| row | ${cols.join(' | ')} |`;
    const sep = `| --- | ${cols.map(() => '---').join(' | ')} |`;

    const rows = slice.map((row, i) => {
        const rowLabel = headerRowIndex === i ? `${i} (header?)` : `${i}`;
        const cells = cols.map((_, ci) => escapeCell(String(row?.[ci] ?? '')));
        return `| ${rowLabel} | ${cells.join(' | ')} |`;
    });

    return [header, sep, ...rows].join('\n');
};

const inferHeaderCandidate = (data: any[][], scanRows = 12) => {
    if (!data || data.length === 0) return null;
    const rowsToScan = data.slice(0, scanRows);
    const maxCols = Math.max(...rowsToScan.map(r => (Array.isArray(r) ? r.length : 0)), 1);

    let bestIdx: number | null = null;
    let bestScore = -Infinity;

    rowsToScan.forEach((row, idx) => {
        if (!row || !Array.isArray(row)) return;
        const nonEmpty = row.filter(c => !isEmptyCell(c));
        if (nonEmpty.length < 2) return;

        const strCount = nonEmpty.filter(c => typeof c === 'string' && !isNumericLike(c)).length;
        const numCount = nonEmpty.length - strCount;
        const strRatio = strCount / nonEmpty.length;

        const score =
            strRatio * 2 +
            nonEmpty.length / maxCols -
            numCount / Math.max(nonEmpty.length, 1);

        if (score > bestScore) {
            bestScore = score;
            bestIdx = idx;
        }
    });

    if (bestIdx === null) return null;
    const row = rowsToScan[bestIdx] || [];
    const nonEmpty = row.filter(c => !isEmptyCell(c));
    const strCount = nonEmpty.filter(c => typeof c === 'string' && !isNumericLike(c)).length;
    const strRatio = nonEmpty.length ? strCount / nonEmpty.length : 0;

    if (strRatio < 0.6) return null;

    const raw = row.map(c => String(c ?? '').trim()).filter(Boolean);
    const normalized = raw.map(normalizeHeaderCell).filter(Boolean);

    return { rowIndex: bestIdx, raw, normalized };
};

const pickRepresentativeFiles = (groupFiles: ProcessingFile[], k = 3) => {
    if (groupFiles.length <= k) return groupFiles;

    const withStats = groupFiles.map(f => {
        const preview = f.preview || [];
        const maxCols = Math.max(...preview.map(r => (Array.isArray(r) ? r.length : 0)), 0);
        return { f, maxCols, rows: f.data?.length || preview.length };
    });

    const maxColsFile = withStats.reduce((a, b) => (b.maxCols > a.maxCols ? b : a)).f;
    const minColsFile = withStats.reduce((a, b) => (b.maxCols < a.maxCols ? b : a)).f;

    const chosen: ProcessingFile[] = [];
    const addUnique = (file: ProcessingFile) => {
        if (!chosen.find(c => c.id === file.id)) chosen.push(file);
    };
    addUnique(maxColsFile);
    addUnique(minColsFile);

    while (chosen.length < k) {
        const r = groupFiles[Math.floor(Math.random() * groupFiles.length)];
        addUnique(r);
    }

    return chosen.slice(0, k);
};

const buildDiffSummary = (groups: FileGroup[], groupHeaders: Map<string, Set<string>>) => {
    if (groups.length <= 1) return '';

    const allHeaders = new Set<string>();
    groupHeaders.forEach(set => set.forEach(h => allHeaders.add(h)));

    const common = Array.from(allHeaders).filter(h =>
        groups.every(g => groupHeaders.get(g.id)?.has(h))
    );

    const lines: string[] = [];
    lines.push(`Heuristic header diff summary:`);
    if (common.length) {
        lines.push(`- Common across groups: ${common.slice(0, 20).join(', ')}`);
    }

    groups.forEach((g, idx) => {
        const set = groupHeaders.get(g.id) || new Set<string>();
        const unique = Array.from(set).filter(h =>
            groups.every(other => other.id === g.id || !groupHeaders.get(other.id)?.has(h))
        );
        if (unique.length) {
            lines.push(`- Group ${idx + 1} unique-ish: ${unique.slice(0, 20).join(', ')}`);
        }
    });

    return lines.join('\n');
};

export const buildSchemaContext = (files: ProcessingFile[]): SchemaContextResult => {
    const groups = groupFilesByStructure(files);

    const samples: string[] = [];
    const groupHeaders = new Map<string, Set<string>>();

    groups.forEach((group, idx) => {
        const groupFiles = files.filter(f => group.fileIds.includes(f.id));
        const reps = pickRepresentativeFiles(groupFiles, 3);

        const headerSet = new Set<string>();

        reps.forEach(f => {
            const headerCandidate = inferHeaderCandidate(f.preview || []);
            headerCandidate?.normalized.forEach(h => headerSet.add(h));

            const maxPreviewRows = Math.min(12, (f.preview || []).length);
            const previewMd = previewToMarkdownTable(f.preview || [], maxPreviewRows, headerCandidate?.rowIndex ?? null);

            const metaLines = [
                `Group ${idx + 1} (Signature: ${group.signature.substring(0, 6)}...)`,
                `File: ${f.filename} / Sheet: ${f.sheetName}`,
                `Rows: ${f.data?.length || 'NA'} | Preview cols: ${Math.max(...(f.preview || []).map(r => (Array.isArray(r) ? r.length : 0)), 0)}`,
            ];
            if (headerCandidate) {
                metaLines.push(
                    `Header candidate @ row ${headerCandidate.rowIndex}: ${headerCandidate.raw.slice(0, 12).join(' | ')}`
                );
            } else {
                metaLines.push(`Header candidate: not confidently detected`);
            }

            samples.push(`${metaLines.join('\n')}\nPreview:\n${previewMd}`);
        });

        groupHeaders.set(group.id, headerSet);
    });

    const contextStr = samples.slice(0, 12).join('\n\n---\n\n');
    const diffSummary = buildDiffSummary(groups, groupHeaders);

    return { contextStr, diffSummary };
};


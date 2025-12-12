import { TargetSchema } from '../types';

export interface AnalysisDataContextOptions {
    maxRows?: number;
    randomRows?: number;
    topCategories?: number;
    enableTimeBoost?: boolean;
    maxSortSample?: number;
    freqSampleSize?: number;
}

export interface AnalysisDataContext {
    sampleRows: any[];
    sampleMarkdown: string;
    summaryMarkdown: string;
}

const DEFAULT_OPTIONS: Required<AnalysisDataContextOptions> = {
    maxRows: 50,
    randomRows: 20,
    topCategories: 4,
    enableTimeBoost: true,
    maxSortSample: 5000,
    freqSampleSize: 10000,
};

const QUANTILES = [0, 0.25, 0.5, 0.75, 1];

const safeStringify = (v: any) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    try {
        return JSON.stringify(v);
    } catch {
        return String(v);
    }
};

const escapeCell = (s: string) =>
    s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').slice(0, 120);

const recordsToMarkdownTable = (records: any[], columns: string[]) => {
    const header = `| ${columns.join(' | ')} |`;
    const sep = `| ${columns.map(() => '---').join(' | ')} |`;
    const rows = records.map(r =>
        `| ${columns.map(c => escapeCell(safeStringify(r?.[c]))).join(' | ')} |`
    );
    return [header, sep, ...rows].join('\n');
};

const addReservoirItem = <T>(
    reservoir: T[],
    item: T,
    seen: number,
    maxSample: number
) => {
    if (reservoir.length < maxSample) {
        reservoir.push(item);
    } else {
        const j = Math.floor(Math.random() * seen);
        if (j < maxSample) reservoir[j] = item;
    }
};

const pickQuantileIndices = (pairs: { value: number; idx: number }[]) => {
    if (pairs.length === 0) return [];
    const sorted = pairs.slice().sort((a, b) => a.value - b.value);
    const last = sorted.length - 1;
    return QUANTILES.map(q => sorted[Math.floor(q * last)]?.idx).filter((v): v is number => v !== undefined);
};

const isMissing = (v: any) =>
    v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

export const buildAnalysisDataContext = (
    mergedData: any[],
    schema: TargetSchema,
    selectedColumns: string[],
    options?: AnalysisDataContextOptions
): AnalysisDataContext => {
    const opt = { ...DEFAULT_OPTIONS, ...(options || {}) };
    const totalRows = mergedData.length;
    if (totalRows === 0 || selectedColumns.length === 0) {
        return {
            sampleRows: [],
            sampleMarkdown: 'No data available.',
            summaryMarkdown: 'No data available.',
        };
    }

    const colMeta = new Map(schema.columns.map(c => [c.name, c]));

    const importantIdx = new Set<number>();

    const dateColumns = selectedColumns.filter(c => colMeta.get(c)?.type === 'date');
    const categoricalColumns = selectedColumns.filter(c => {
        const t = colMeta.get(c)?.type;
        return t === 'string' || t === 'boolean';
    });

    // Numeric quantiles & extremes
    for (const col of selectedColumns) {
        const meta = colMeta.get(col);
        if (meta?.type !== 'number') continue;

        const reservoir: { value: number; idx: number }[] = [];
        let minVal: number | undefined;
        let minIdx: number | undefined;
        let maxVal: number | undefined;
        let maxIdx: number | undefined;
        let seen = 0;
        for (let i = 0; i < totalRows; i++) {
            const raw = mergedData[i]?.[col];
            const num = typeof raw === 'number' ? raw : Number(raw);
            if (!Number.isFinite(num)) continue;

            if (minVal === undefined || num < minVal) {
                minVal = num;
                minIdx = i;
            }
            if (maxVal === undefined || num > maxVal) {
                maxVal = num;
                maxIdx = i;
            }

            seen++;
            addReservoirItem(reservoir, { value: num, idx: i }, seen, opt.maxSortSample);
        }

        if (minIdx !== undefined) importantIdx.add(minIdx);
        if (maxIdx !== undefined) importantIdx.add(maxIdx);
        pickQuantileIndices(reservoir).forEach(idx => importantIdx.add(idx));
    }

    // Date/time quantiles along timeline
    for (const col of selectedColumns) {
        const meta = colMeta.get(col);
        if (meta?.type !== 'date') continue;

        const reservoir: { value: number; idx: number }[] = [];
        let minVal: number | undefined;
        let minIdx: number | undefined;
        let maxVal: number | undefined;
        let maxIdx: number | undefined;
        let seen = 0;
        for (let i = 0; i < totalRows; i++) {
            const raw = mergedData[i]?.[col];
            const t = raw instanceof Date ? raw.getTime() : Date.parse(String(raw));
            if (!Number.isFinite(t)) continue;

            if (minVal === undefined || t < minVal) {
                minVal = t;
                minIdx = i;
            }
            if (maxVal === undefined || t > maxVal) {
                maxVal = t;
                maxIdx = i;
            }

            seen++;
            addReservoirItem(reservoir, { value: t, idx: i }, seen, opt.maxSortSample);
        }

        if (minIdx !== undefined) importantIdx.add(minIdx);
        if (maxIdx !== undefined) importantIdx.add(maxIdx);
        pickQuantileIndices(reservoir).forEach(idx => importantIdx.add(idx));
    }

    // Top categorical representatives
    for (const col of selectedColumns) {
        const meta = colMeta.get(col);
        if (!meta || (meta.type !== 'string' && meta.type !== 'boolean')) continue;

        const freq = new Map<string, number>();
        const cap = Math.min(totalRows, opt.freqSampleSize);
        for (let i = 0; i < cap; i++) {
            const v = mergedData[i]?.[col];
            if (isMissing(v)) continue;
            const key = safeStringify(v);
            freq.set(key, (freq.get(key) || 0) + 1);
        }

        const topVals = Array.from(freq.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, opt.topCategories)
            .map(([k]) => k);

        for (const val of topVals) {
            const idx = mergedData.findIndex(r => safeStringify(r?.[col]) === val);
            if (idx >= 0) importantIdx.add(idx);
        }
    }

    // Panel/time-series boost: if we have both a date and a categorical key selected,
    // ensure top categories are represented near the earliest/latest dates.
    if (opt.enableTimeBoost && dateColumns.length > 0 && categoricalColumns.length > 0) {
        const dateCol = dateColumns[0];
        const catCol = categoricalColumns[0];

        let minT = Infinity;
        let maxT = -Infinity;
        const parsedTimes: Array<number | null> = new Array(totalRows);
        for (let i = 0; i < totalRows; i++) {
            const raw = mergedData[i]?.[dateCol];
            const t = raw instanceof Date ? raw.getTime() : Date.parse(String(raw));
            parsedTimes[i] = Number.isFinite(t) ? t : null;
            if (parsedTimes[i] !== null) {
                if (t < minT) minT = t;
                if (t > maxT) maxT = t;
            }
        }

        if (Number.isFinite(minT) && Number.isFinite(maxT)) {
            const freq = new Map<string, number>();
            const cap = Math.min(totalRows, opt.freqSampleSize);
            for (let i = 0; i < cap; i++) {
                const v = mergedData[i]?.[catCol];
                if (isMissing(v)) continue;
                const key = safeStringify(v);
                freq.set(key, (freq.get(key) || 0) + 1);
            }
            const topCats = Array.from(freq.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, opt.topCategories)
                .map(([k]) => k);

            const findClosestForCat = (catVal: string, targetT: number) => {
                let bestIdx = -1;
                let bestDiff = Infinity;
                for (let i = 0; i < totalRows; i++) {
                    if (safeStringify(mergedData[i]?.[catCol]) !== catVal) continue;
                    const t = parsedTimes[i];
                    if (t === null) continue;
                    const diff = Math.abs(t - targetT);
                    if (diff < bestDiff) {
                        bestDiff = diff;
                        bestIdx = i;
                    }
                }
                return bestIdx;
            };

            for (const catVal of topCats) {
                const earlyIdx = findClosestForCat(catVal, minT);
                const lateIdx = findClosestForCat(catVal, maxT);
                if (earlyIdx >= 0) importantIdx.add(earlyIdx);
                if (lateIdx >= 0) importantIdx.add(lateIdx);
            }
        }
    }

    // Fill with random rows up to maxRows
    const importantList = Array.from(importantIdx);
    const remaining = Math.max(0, opt.maxRows - importantList.length);
    const randomIdx = new Set<number>();
    let tries = 0;
    while (randomIdx.size < Math.min(opt.randomRows, remaining) && tries < opt.randomRows * 20) {
        const idx = Math.floor(Math.random() * totalRows);
        if (!importantIdx.has(idx)) randomIdx.add(idx);
        tries++;
    }

    const finalIdx = [...importantList, ...Array.from(randomIdx)];
    const sampleRows = finalIdx.map(i => mergedData[i]).filter(Boolean);

    const sampleMarkdown = recordsToMarkdownTable(sampleRows, selectedColumns);

    // Summary markdown
    const summaryLines: string[] = [];
    for (const col of selectedColumns) {
        const meta = colMeta.get(col);
        const type = meta?.type || 'string';

        let missing = 0;
        const values: any[] = [];
        for (let i = 0; i < totalRows; i++) {
            const v = mergedData[i]?.[col];
            if (isMissing(v)) {
                missing++;
                continue;
            }
            values.push(v);
        }
        const missPct = ((missing / totalRows) * 100).toFixed(1);

        if (type === 'number') {
            const nums = values
                .map(v => (typeof v === 'number' ? v : Number(v)))
                .filter(n => Number.isFinite(n)) as number[];
            nums.sort((a, b) => a - b);
            const min = nums[0];
            const max = nums[nums.length - 1];
            const med = nums.length ? nums[Math.floor((nums.length - 1) / 2)] : undefined;
            summaryLines.push(`- **${col}** (number): missing ${missPct}%, min=${min ?? 'NA'}, median=${med ?? 'NA'}, max=${max ?? 'NA'}`);
        } else if (type === 'date') {
            const ts = values
                .map(v => (v instanceof Date ? v.getTime() : Date.parse(String(v))))
                .filter(t => Number.isFinite(t)) as number[];
            ts.sort((a, b) => a - b);
            const minD = ts.length ? new Date(ts[0]).toISOString() : 'NA';
            const maxD = ts.length ? new Date(ts[ts.length - 1]).toISOString() : 'NA';
            const uniqueDates = new Set(ts.map(t => t)).size;
            summaryLines.push(`- **${col}** (date): missing ${missPct}%, ${uniqueDates} unique, range ${minD} → ${maxD}`);
        } else {
            const freq = new Map<string, number>();
            for (const v of values.slice(0, opt.freqSampleSize)) {
                const key = safeStringify(v);
                freq.set(key, (freq.get(key) || 0) + 1);
            }
            const topVals = Array.from(freq.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, opt.topCategories)
                .map(([k, c]) => `${k} (${((c / values.length) * 100).toFixed(1)}%)`)
                .join(', ');
            summaryLines.push(`- **${col}** (${type}): missing ${missPct}%, ${freq.size} unique, top values: ${topVals || 'NA'}`);
        }
    }

    const summaryMarkdown = summaryLines.join('\n');

    return { sampleRows, sampleMarkdown, summaryMarkdown };
};

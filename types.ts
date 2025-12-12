
export enum AppStage {
    UPLOAD = 'UPLOAD',
    SCHEMA = 'SCHEMA',
    TRANSFORM = 'TRANSFORM',
    EXPORT = 'EXPORT',
    ANALYSIS = 'ANALYSIS'
}

export interface SchemaColumn {
    name: string;
    type: 'string' | 'number' | 'date' | 'boolean';
    description: string;
}

export interface TargetSchema {
    tableName: string;
    columns: SchemaColumn[];
}

export interface ProcessingFile {
    id: string;
    filename: string;
    sheetName: string;
    data: any[][]; // Raw data from Excel
    preview: any[][]; // First 10 rows for preview
    status: 'pending' | 'generating' | 'review' | 'success' | 'error';
    generatedCode?: string;
    error?: string;
    output?: any[]; // Array of objects (records)
}

export interface AnalysisResult {
    report: string; // Markdown text
    plotImage?: string; // Base64 png
    stats?: any; // JSON object of df.describe()
    code: string; // The code executed
    chartExplanation?: string; // Markdown explanation of generated chart
}

export interface PyodideInterface {
    runPythonAsync: (code: string) => Promise<any>;
    globals: any;
    loadPackage: (packages: string[]) => Promise<void>;
    runPython: (code: string) => any;
    pyimport: (pkg: string) => any;
}

declare global {
    interface Window {
        loadPyodide: (config: { indexURL: string }) => Promise<PyodideInterface>;
    }
}

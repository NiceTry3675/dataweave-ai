
import React, { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, Check, ListFilter, ArrowRight, Settings2 } from 'lucide-react';
import { parseExcelFile } from '../services/excelService';
import { ProcessingFile } from '../types';

interface Props {
    onFilesLoaded: (selectedFiles: ProcessingFile[], allFiles: ProcessingFile[]) => void;
    initialAllFiles?: ProcessingFile[];
    initialSelectedIds?: Set<string>;
    schemaModel: string;
    setSchemaModel: (model: string) => void;
    codeModel: string;
    setCodeModel: (model: string) => void;
}

const MODELS = [
    { id: 'gemini-flash-latest', name: 'Gemini Flash (Fast)' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Smart)' },
];

export const UploadStage: React.FC<Props> = ({ 
    onFilesLoaded, 
    initialAllFiles, 
    initialSelectedIds,
    schemaModel,
    setSchemaModel,
    codeModel,
    setCodeModel
}) => {
    const [view, setView] = useState<'upload' | 'selection'>('upload');
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [stagedFiles, setStagedFiles] = useState<ProcessingFile[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Restore state if going back
    useEffect(() => {
        if (initialAllFiles && initialAllFiles.length > 0) {
            setStagedFiles(initialAllFiles);
            if (initialSelectedIds) {
                setSelectedIds(initialSelectedIds);
            }
            setView('selection');
        }
    }, [initialAllFiles, initialSelectedIds]);

    const processFiles = async (fileList: FileList | null) => {
        if (!fileList) return;
        setIsLoading(true);
        const allSheets: ProcessingFile[] = [];
        
        try {
            for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i];
                if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    const sheets = await parseExcelFile(file);
                    allSheets.push(...sheets);
                }
            }
            if (allSheets.length > 0) {
                setStagedFiles(allSheets);
                
                // Logic: Only select the first sheet of each file by default
                const initialSelection = new Set<string>();
                const seenFiles = new Set<string>();
                
                allSheets.forEach(sheet => {
                    if (!seenFiles.has(sheet.filename)) {
                        initialSelection.add(sheet.id);
                        seenFiles.add(sheet.filename);
                    }
                });
                
                setSelectedIds(initialSelection);
                setView('selection');
            } else {
                alert("No valid sheets found in uploaded files.");
            }
        } catch (e) {
            console.error(e);
            alert("Error parsing files. Please ensure they are valid Excel files.");
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleAll = () => {
        if (selectedIds.size === stagedFiles.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(stagedFiles.map(f => f.id)));
        }
    };

    const handleConfirm = () => {
        const selectedFiles = stagedFiles.filter(f => selectedIds.has(f.id));
        if (selectedFiles.length === 0) {
            alert("Please select at least one sheet to proceed.");
            return;
        }
        onFilesLoaded(selectedFiles, stagedFiles);
    };

    // Group files by filename for display
    const filesByName = stagedFiles.reduce((acc, file) => {
        if (!acc[file.filename]) acc[file.filename] = [];
        acc[file.filename].push(file);
        return acc;
    }, {} as Record<string, ProcessingFile[]>);

    if (view === 'selection') {
        return (
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[75vh]">
                    <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 flex items-center">
                                <ListFilter className="w-5 h-5 mr-2 text-brand-600" />
                                Select Sheets to Process
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Uncheck empty sheets or data you don't want to include in the schema generation.
                            </p>
                        </div>
                        <div className="flex items-center space-x-3">
                             <button 
                                onClick={() => {
                                    setStagedFiles([]);
                                    setView('upload');
                                }}
                                className="text-sm text-gray-500 hover:text-gray-700 font-medium px-3 py-2"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleConfirm}
                                className="flex items-center px-4 py-2 bg-brand-600 text-white rounded-lg shadow-sm hover:bg-brand-700 transition-colors font-semibold"
                            >
                                Continue with {selectedIds.size} Sheets
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </button>
                        </div>
                    </div>

                    {/* AI Configuration Bar */}
                    <div className="px-6 py-3 bg-white border-b border-gray-200 flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex items-center text-sm font-semibold text-gray-700">
                            <Settings2 className="w-4 h-4 mr-2 text-gray-400" />
                            AI Configuration:
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
                                <span className="text-xs font-semibold text-gray-500 mr-2">Schema:</span>
                                <select 
                                    value={schemaModel} 
                                    onChange={(e) => setSchemaModel(e.target.value)}
                                    className="text-sm border-none bg-transparent focus:ring-0 text-gray-800 p-0 cursor-pointer font-medium"
                                >
                                    {MODELS.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
                                <span className="text-xs font-semibold text-gray-500 mr-2">Code Gen:</span>
                                <select 
                                    value={codeModel} 
                                    onChange={(e) => setCodeModel(e.target.value)}
                                    className="text-sm border-none bg-transparent focus:ring-0 text-gray-800 p-0 cursor-pointer font-medium"
                                >
                                    {MODELS.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                        <div className="flex justify-end mb-4">
                            <button 
                                onClick={toggleAll}
                                className="text-sm text-brand-600 font-medium hover:text-brand-800"
                            >
                                {selectedIds.size === stagedFiles.length ? "Deselect All" : "Select All"}
                            </button>
                        </div>

                        <div className="space-y-6">
                            {Object.entries(filesByName).map(([filename, sheets]: [string, ProcessingFile[]]) => (
                                <div key={filename} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 bg-gray-100/50 border-b border-gray-200 flex items-center">
                                        <FileSpreadsheet className="w-4 h-4 text-gray-500 mr-2" />
                                        <span className="font-semibold text-gray-700 text-sm">{filename}</span>
                                        <span className="ml-2 text-xs text-gray-400">({sheets.length} sheets)</span>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {sheets.map(sheet => {
                                            const isSelected = selectedIds.has(sheet.id);
                                            return (
                                                <div 
                                                    key={sheet.id} 
                                                    onClick={() => toggleSelection(sheet.id)}
                                                    className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${isSelected ? 'bg-brand-50/30' : 'hover:bg-gray-50'}`}
                                                >
                                                    <div className="flex items-center space-x-3">
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-brand-600 border-brand-600' : 'border-gray-300 bg-white'}`}>
                                                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                                        </div>
                                                        <div>
                                                            <div className={`text-sm font-medium ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                                                                {sheet.sheetName}
                                                            </div>
                                                            <div className="text-xs text-gray-400">
                                                                {sheet.data.length} rows detected
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center">
                                                        {sheet.data.length < 2 && (
                                                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                                                Seems empty
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-[60vh]">
            <div 
                className={`w-full max-w-2xl p-12 border-4 border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center cursor-pointer
                    ${isDragging ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    processFiles(e.dataTransfer.files);
                }}
            >
                <div className="bg-white p-4 rounded-full shadow-lg mb-6">
                    {isLoading ? (
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
                    ) : (
                        <Upload className="w-12 h-12 text-brand-600" />
                    )}
                </div>
                
                <h3 className="text-2xl font-bold text-gray-800 mb-2">
                    {isLoading ? "Parsing Excel Files..." : "Upload your Excel files"}
                </h3>
                <p className="text-gray-500 text-center max-w-md mb-8">
                    Drag and drop .xlsx or .xls files here. You can select which sheets to include in the next step.
                </p>
                
                <label className="relative">
                    <input 
                        type="file" 
                        multiple 
                        accept=".xlsx,.xls" 
                        className="hidden" 
                        onChange={(e) => processFiles(e.target.files)}
                    />
                    <span className="px-8 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow transition-colors cursor-pointer">
                        Select Files
                    </span>
                </label>
            </div>
            
            <div className="mt-8 flex items-center text-gray-400 text-sm">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                <span>Secure local processing enabled via Pyodide</span>
            </div>
        </div>
    );
};

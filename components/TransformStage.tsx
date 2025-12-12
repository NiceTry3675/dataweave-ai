
import React, { useState, useEffect } from 'react';
import { TargetSchema, ProcessingFile } from '../types';
import { generateTransformationCode } from '../services/geminiService';
import { runTransformation, initPyodide } from '../services/pythonService';
import { groupFilesByStructure, FileGroup } from '../services/groupingService';
import { Play, CheckCircle, AlertCircle, Wand2, Loader2, Database, Zap, ArrowLeft, Layers, FileText, Rocket, Cpu, Settings, XCircle, BrainCircuit } from 'lucide-react';
import { Button } from './ui/Button';

interface Props {
    files: ProcessingFile[];
    schema: TargetSchema;
    onComplete: (completedFiles: ProcessingFile[]) => void;
    onBack: () => void;
    initialSelectedModel?: string;
}

const MODELS = [
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Smart)' },
    { id: 'gemini-flash-latest', name: 'Gemini Flash (Fast)' },
];

export const TransformStage: React.FC<Props> = ({ files, schema, onComplete, onBack, initialSelectedModel }) => {
    const [fileStates, setFileStates] = useState<ProcessingFile[]>(files);
    const [groups, setGroups] = useState<FileGroup[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [isPyodideReady, setIsPyodideReady] = useState(false);
    const [activeTab, setActiveTab] = useState<'raw' | 'code' | 'reasoning' | 'preview' | 'group_status'>('code');
    const [isProcessing, setIsProcessing] = useState(false);
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState<string>(initialSelectedModel || 'gemini-3-pro-preview');
    const [concurrency, setConcurrency] = useState<number>(2);

    useEffect(() => {
        initPyodide().then(() => setIsPyodideReady(true)).catch(console.error);
        const calculatedGroups = groupFilesByStructure(files);
        setGroups(calculatedGroups);
        if (calculatedGroups.length > 0) {
            setSelectedGroupId(calculatedGroups[0].id);
        }
    }, [files]);

    const activeGroup = groups.find(g => g.id === selectedGroupId);
    const representativeFileId = activeGroup?.fileIds[0];
    const representativeFile = fileStates.find(f => f.id === representativeFileId);
    const activeGroupFiles = fileStates.filter(f => activeGroup?.fileIds.includes(f.id));
    const completedCount = fileStates.filter(f => f.status === 'success').length;
    const progressPercent = Math.round((completedCount / fileStates.length) * 100);

    const updateFileState = (id: string, updates: Partial<ProcessingFile>) => {
        setFileStates(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const updateGroupData = (groupId: string, updates: Partial<FileGroup>) => {
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, ...updates } : g));
    };

    const generateCodeForGroup = async () => {
        if (!activeGroup || !representativeFile) return;
        setGlobalError(null);
        setActiveTab('code'); // Switch to code view to see streaming
        
        updateFileState(representativeFile.id, { status: 'generating', error: undefined });
        
        // Immediate UI feedback
        updateGroupData(activeGroup.id, { generatedCode: `// Initializing connection to ${selectedModel}...\n// Please wait while the AI analyzes your data structure.` });
        
        setIsProcessing(true); // Lock other actions while streaming
        
        try {
            // Streaming happens here: update generatedCode with the full text temporarily so user sees progress
            const result = await generateTransformationCode(
                representativeFile, 
                schema, 
                selectedModel,
                (partialText) => {
                    updateGroupData(activeGroup.id, { generatedCode: partialText });
                }
            );
            
            // Final update: split code and reasoning
            updateGroupData(activeGroup.id, { 
                generatedCode: result.code,
                aiReasoning: result.reasoning
            });
            
            updateFileState(representativeFile.id, { status: 'review', generatedCode: result.code });
        } catch (e: any) {
            console.error(e);
            const errorMsg = e.message || "Failed to generate code.";
            updateFileState(representativeFile.id, { status: 'error', error: errorMsg });
            updateGroupData(activeGroup.id, { generatedCode: `# Error Generation Failed\n\n# ${errorMsg}\n\n# Please try again or switch models.` });
        } finally {
            setIsProcessing(false);
        }
    };

    const runCodeForFile = async (file: ProcessingFile, code: string) => {
        updateFileState(file.id, { status: 'generating', error: undefined });
        try {
            const result = await runTransformation(code, file.data, file.filename, file.sheetName);
            updateFileState(file.id, { status: 'success', output: result });
            return true;
        } catch (e: any) {
            updateFileState(file.id, { status: 'error', error: e.message || String(e) });
            return false;
        }
    };

    const runGroupTest = async () => {
        if (!representativeFile || !activeGroup?.generatedCode) return;
        const success = await runCodeForFile(representativeFile, activeGroup.generatedCode);
        if (success) setActiveTab('preview');
    };

    const runGroupBatch = async () => {
        if (!activeGroup || !activeGroup.generatedCode) return;
        setIsProcessing(true);
        setActiveTab('group_status');
        const code = activeGroup.generatedCode;
        for (const fileId of activeGroup.fileIds) {
            const file = fileStates.find(f => f.id === fileId);
            if (file && file.status !== 'success') {
                await runCodeForFile(file, code);
                await new Promise(r => setTimeout(r, 100));
            }
        }
        setIsProcessing(false);
    };

    const handleGlobalAutoProcess = async () => {
        setGlobalError(null);
        setIsProcessing(true);
        setActiveTab('group_status');
        
        try {
            const queue = [...groups];
            const processGroup = async (group: FileGroup) => {
                setSelectedGroupId(group.id);
                
                let currentCode = group.generatedCode;
                if (!currentCode) {
                    const repFileId = group.fileIds[0];
                    const repFile = fileStates.find(f => f.id === repFileId);
                    if (repFile) {
                        updateFileState(repFileId, { status: 'generating' });
                        try {
                            const result = await generateTransformationCode(repFile, schema, selectedModel);
                            updateGroupData(group.id, { 
                                generatedCode: result.code,
                                aiReasoning: result.reasoning
                            });
                            currentCode = result.code;
                            updateFileState(repFileId, { status: 'review', generatedCode: result.code });
                        } catch (e) {
                             console.error("Auto-gen failed for group", group.id, e);
                             updateFileState(repFileId, { status: 'error', error: "Auto-generation failed" });
                             return;
                        }
                    }
                }
                if (currentCode) {
                    for (const fId of group.fileIds) {
                        const originalFile = files.find(f => f.id === fId);
                        if (!originalFile) continue;
                        updateFileState(fId, { status: 'generating', error: undefined });
                        try {
                            const result = await runTransformation(currentCode!, originalFile.data, originalFile.filename, originalFile.sheetName);
                            updateFileState(fId, { status: 'success', output: result });
                        } catch (e: any) {
                            updateFileState(fId, { status: 'error', error: e.message || String(e) });
                        }
                    }
                }
            };

            const processQueue = async () => {
                while (queue.length > 0) {
                    const group = queue.shift();
                    if (group) await processGroup(group);
                }
            };

            const workers = [];
            for (let i = 0; i < concurrency; i++) {
                workers.push(processQueue());
            }
            await Promise.all(workers);
        } catch (error: any) {
            console.error("Fatal error in auto-process:", error);
            setGlobalError("An unexpected error occurred during batch processing.");
        } finally {
            setIsProcessing(false);
        }
    };

    const allComplete = fileStates.every(f => f.status === 'success');

    return (
        <div className="flex h-[calc(100vh-140px)] gap-4">
            {/* Sidebar */}
            <div className="w-80 bg-white border border-gray-200 rounded-xl flex flex-col overflow-hidden shadow-sm">
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-semibold text-gray-700">Project Progress</span>
                        <span className="text-xs font-mono text-gray-500">{completedCount}/{fileStates.length} Files</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                        <div className="bg-brand-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    <button onClick={onBack} disabled={isProcessing} className="w-full flex items-center justify-center text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors py-1.5 rounded border border-gray-200 hover:bg-white">
                        <ArrowLeft className="w-3 h-3 mr-1" /> Back to Schema
                    </button>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                         <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-600 flex items-center"><Settings className="w-3 h-3 mr-1" /> Concurrency: {concurrency}</span>
                         </div>
                         <input type="range" min="1" max="5" step="1" value={concurrency} onChange={(e) => setConcurrency(parseInt(e.target.value))} className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer mb-3" />
                         <div className="flex items-center justify-between mb-3 bg-white border border-gray-200 rounded px-2 py-1">
                             <Cpu className="w-3 h-3 text-gray-400" />
                             <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="text-xs border-none focus:ring-0 text-gray-700 w-full bg-transparent">
                                {MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                             </select>
                         </div>
                        <Button
                            onClick={handleGlobalAutoProcess}
                            disabled={isProcessing || !isPyodideReady}
                            size="sm"
                            className="w-full bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 py-2 font-bold"
                        >
                            {isProcessing ? <Loader2 className="w-3 h-3 mr-1 animate-spin"/> : <Rocket className="w-3 h-3 mr-1" />} Auto-Process Project
                        </Button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50/50">
                    <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Detected Layout Groups</div>
                    {groups.map((group, idx) => {
                        const gFiles = fileStates.filter(f => group.fileIds.includes(f.id));
                        const gSuccess = gFiles.filter(f => f.status === 'success').length;
                        const isSelected = selectedGroupId === group.id;
                        return (
                            <button key={group.id} onClick={() => setSelectedGroupId(group.id)} className={`w-full text-left p-3 rounded-lg text-sm transition-all border group relative shadow-sm ${isSelected ? 'bg-white border-brand-500 ring-1 ring-brand-500 z-10' : 'bg-white border-gray-200 hover:border-brand-300'}`}>
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center font-medium text-gray-900">
                                        <Layers className={`w-4 h-4 mr-2 ${isSelected ? 'text-brand-600' : 'text-gray-400'}`} /> Group {idx + 1}
                                    </div>
                                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{group.fileIds.length} files</span>
                                </div>
                                <div className="text-xs text-gray-500 pl-6 mb-2">Signature: <span className="font-mono text-[10px]">{group.signature.substring(0, 15)}...</span></div>
                                <div className="pl-6 flex items-center space-x-2">
                                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                        <div className="bg-green-500 h-full transition-all" style={{ width: `${(gSuccess / group.fileIds.length) * 100}%` }} />
                                    </div>
                                    <span className="text-[10px] text-gray-400 font-mono">{gSuccess}/{group.fileIds.length}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="p-4 border-t border-gray-200 bg-white">
                    <Button
                        onClick={() => onComplete(fileStates)}
                        disabled={completedCount === 0 || isProcessing}
                        className={`w-full py-2.5 px-4 ${completedCount > 0 ? '' : 'bg-gray-100 text-gray-400 hover:bg-gray-100'}`}
                    >
                        {allComplete ? "Proceed to Merge" : `Merge ${completedCount} Files`}
                    </Button>
                </div>
            </div>

            {/* Main Workspace */}
            <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                {activeGroup ? (
                    <>
                        {/* Toolbar */}
                        <div className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4">
                            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                                <button onClick={() => setActiveTab('raw')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'raw' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Ref File (Raw)</button>
                                <button onClick={() => setActiveTab('code')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'code' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Group Code</button>
                                <button onClick={() => setActiveTab('reasoning')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center ${activeTab === 'reasoning' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <BrainCircuit className="w-3.5 h-3.5 mr-1.5" /> AI Insight
                                </button>
                                <button onClick={() => setActiveTab('preview')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'preview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Rep Output</button>
                                <button onClick={() => setActiveTab('group_status')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'group_status' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Group Results</button>
                            </div>
                            <div className="flex items-center space-x-3">
                                {!isPyodideReady && <span className="text-xs text-amber-600 flex items-center animate-pulse"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Loading Python...</span>}
                                <button onClick={generateCodeForGroup} disabled={isProcessing} className="flex items-center px-3 py-1.5 text-sm font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors disabled:opacity-50">
                                    <Wand2 className="w-4 h-4 mr-1.5" /> {activeGroup.generatedCode ? 'Regenerate Code' : 'Generate Group Code'}
                                </button>
                                <button onClick={runGroupTest} disabled={!isPyodideReady || !activeGroup.generatedCode || isProcessing} className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50">
                                    <Play className="w-4 h-4 mr-1.5" /> Test on Rep
                                </button>
                                <button onClick={runGroupBatch} disabled={!isPyodideReady || !activeGroup.generatedCode || isProcessing} className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isProcessing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin"/> : <Zap className="w-4 h-4 mr-1.5" />} Run All {activeGroup.fileIds.length} Files
                                </button>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-hidden relative bg-slate-50">
                            {globalError && (
                                <div className="absolute top-0 left-0 right-0 z-50 p-4 bg-red-50 border-b border-red-200 flex items-center justify-between text-red-800 shadow-sm">
                                    <div className="flex items-center"><XCircle className="w-5 h-5 mr-2" /><span className="text-sm font-medium">{globalError}</span></div>
                                    <button onClick={() => setGlobalError(null)} className="text-red-600 hover:text-red-800 text-sm underline">Dismiss</button>
                                </div>
                            )}

                            {activeTab === 'raw' && representativeFile && (
                                <div className="h-full overflow-auto p-6">
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between">
                                            <span className="font-mono text-xs font-medium text-gray-600">Representative: {representativeFile.filename}</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {representativeFile.preview.map((row, rIdx) => (
                                                        <tr key={rIdx}>
                                                            <td className="px-3 py-2 bg-gray-50 text-xs font-mono text-gray-400 select-none border-r w-10 text-right">{rIdx}</td>
                                                            {row.map((cell: any, cIdx: number) => (
                                                                <td key={cIdx} className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 border-r border-gray-100">{cell !== null && cell !== undefined ? String(cell) : <span className="text-gray-300 italic">null</span>}</td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'code' && (
                                <div className="h-full flex flex-col">
                                    {representativeFile?.error && (
                                        <div className="bg-red-50 border-b border-red-200 p-3 flex items-start text-sm text-red-800">
                                            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 text-red-600" /><pre className="whitespace-pre-wrap font-mono text-xs">{representativeFile.error}</pre>
                                        </div>
                                    )}
                                    <textarea
                                        className="flex-1 w-full p-6 font-mono text-sm leading-relaxed bg-[#1e1e1e] text-gray-100 resize-none focus:outline-none code-editor"
                                        value={activeGroup.generatedCode || "# Click 'Generate Group Code' to have Gemini write a shared transformation script."}
                                        onChange={(e) => updateGroupData(activeGroup.id, { generatedCode: e.target.value })}
                                        spellCheck={false}
                                        disabled={isProcessing}
                                    />
                                </div>
                            )}

                            {activeTab === 'reasoning' && (
                                <div className="h-full overflow-auto p-6 bg-gray-50">
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                        <div className="flex items-center mb-4 text-brand-700">
                                            <BrainCircuit className="w-5 h-5 mr-2" />
                                            <h3 className="text-lg font-semibold">AI Reasoning Plan</h3>
                                        </div>
                                        <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                                            {activeGroup.aiReasoning ? activeGroup.aiReasoning : 
                                                <span className="text-gray-400 italic">No reasoning generated yet. Click "Generate Group Code" to start.</span>
                                            }
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'preview' && representativeFile && (
                                <div className="h-full overflow-auto p-6">
                                     {representativeFile.output ? (
                                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                            <div className="px-4 py-3 bg-green-50 border-b border-green-100 flex items-center">
                                                <CheckCircle className="w-4 h-4 text-green-600 mr-2" /><span className="text-sm font-medium text-green-800">Test Transformation Successful</span>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50 sticky top-0">
                                                        <tr>
                                                            {schema.columns.map(col => <th key={col.name} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">{col.name}</th>)}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {representativeFile.output.slice(0, 20).map((row, rIdx) => (
                                                            <tr key={rIdx} className="hover:bg-gray-50">
                                                                {schema.columns.map(col => <td key={col.name} className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{row[col.name]}</td>)}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                            <Database className="w-12 h-12 mb-4 opacity-20" />
                                            <p>No test output generated yet.</p>
                                            <button onClick={runGroupTest} className="mt-2 text-brand-600 hover:text-brand-700 text-sm font-medium underline">Run Test on Representative File</button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'group_status' && (
                                <div className="h-full overflow-auto p-6">
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200"><span className="font-semibold text-gray-700">Batch Execution Results</span></div>
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File Name</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Output Rows</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {activeGroupFiles.map(file => (
                                                    <tr key={file.id}>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 flex items-center"><FileText className="w-4 h-4 text-gray-400 mr-2" />{file.filename}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            {file.status === 'success' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1"/> Success</span>}
                                                            {file.status === 'error' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1"/> Error</span>}
                                                            {file.status === 'generating' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><Loader2 className="w-3 h-3 mr-1 animate-spin"/> Running</span>}
                                                            {file.status === 'pending' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Pending</span>}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{file.output ? file.output.length : '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                     <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Layers className="w-16 h-16 mb-4 opacity-10" />
                        <p>Select a group from the sidebar to start.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

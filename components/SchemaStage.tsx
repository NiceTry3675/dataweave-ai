
import React, { useEffect, useState, useRef } from 'react';
import { TargetSchema, ProcessingFile } from '../types';
import { generateSchema } from '../services/geminiService';
import { Sparkles, Table, Save, ArrowLeft, AlertCircle, Cpu, Terminal, RefreshCw } from 'lucide-react';

interface Props {
    files: ProcessingFile[];
    onSchemaConfirmed: (schema: TargetSchema) => void;
    onBack: () => void;
    initialSchema: TargetSchema | null;
    initialSelectedModel?: string;
}

const MODELS = [
    { id: 'gemini-flash-latest', name: 'Gemini Flash (Fast)' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Smart)' },
];

export const SchemaStage: React.FC<Props> = ({ files, onSchemaConfirmed, onBack, initialSchema, initialSelectedModel }) => {
    const [schema, setSchema] = useState<TargetSchema | null>(null);
    const [validSchema, setValidSchema] = useState<TargetSchema | null>(null);
    
    const [loading, setLoading] = useState(false);
    const [streamedLog, setStreamedLog] = useState("");
    const logContainerRef = useRef<HTMLDivElement>(null);

    const [jsonInput, setJsonInput] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [syntaxError, setSyntaxError] = useState<boolean>(false);
    
    const [selectedModel, setSelectedModel] = useState<string>(initialSelectedModel || 'gemini-flash-latest');

    // Auto-scroll the log
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [streamedLog]);

    useEffect(() => {
        if (initialSchema) {
            setSchema(initialSchema);
            setValidSchema(initialSchema);
            setJsonInput(JSON.stringify(initialSchema, null, 2));
        } else {
            handleGenerate();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        setStreamedLog(""); // Clear previous logs
        try {
            const generated = await generateSchema(
                files, 
                selectedModel,
                (text) => setStreamedLog(text) // Update log in real-time
            );
            setSchema(generated);
            setValidSchema(generated);
            setJsonInput(JSON.stringify(generated, null, 2));
        } catch (e: any) {
            setError(e.message || "Failed to generate schema.");
            if (!schema) {
                const fallback = { tableName: "combined_data", columns: [] };
                setSchema(fallback);
                setValidSchema(fallback);
                setJsonInput(JSON.stringify(fallback, null, 2));
            }
        } finally {
            setLoading(false);
        }
    };

    // Sync JSON Input -> Valid Schema for Preview
    useEffect(() => {
        if (!jsonInput) return;
        try {
            const parsed = JSON.parse(jsonInput);
            if (parsed && Array.isArray(parsed.columns)) {
                setValidSchema(parsed);
                setSyntaxError(false);
                setError(null);
            } else {
                setSyntaxError(true);
            }
        } catch (e) {
            setSyntaxError(true);
        }
    }, [jsonInput]);

    const handleConfirm = () => {
        try {
            const parsed = JSON.parse(jsonInput);
            if (!parsed.tableName || !Array.isArray(parsed.columns)) {
                throw new Error("Invalid schema format: missing tableName or columns array.");
            }
            onSchemaConfirmed(parsed);
        } catch (e) {
            setError("Invalid JSON schema. Please check for syntax errors.");
        }
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[500px]">
                <div className="w-full bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-700 flex flex-col h-[500px]">
                    {/* Console Header */}
                    <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <Terminal className="w-4 h-4 text-brand-400" />
                            <span className="text-gray-200 text-sm font-mono font-medium">AI Analysis Console</span>
                        </div>
                        <div className="flex items-center space-x-2">
                             <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-500"></span>
                            </span>
                            <span className="text-xs text-gray-400 font-mono">Processing...</span>
                        </div>
                    </div>
                    
                    {/* Console Output */}
                    <div 
                        ref={logContainerRef}
                        className="flex-1 p-6 overflow-y-auto font-mono text-xs md:text-sm leading-relaxed text-gray-300 bg-[#0d1117] whitespace-pre-wrap"
                    >
                        {streamedLog || (
                            <span className="text-gray-500 italic">
                                Initializing connection to {selectedModel}...
                            </span>
                        )}
                        <span className="inline-block w-2 h-4 ml-1 bg-brand-500 animate-pulse align-middle"></span>
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-800 px-4 py-2 border-t border-gray-700 text-xs text-gray-500 flex justify-between">
                        <span>Model: {selectedModel}</span>
                        <span>Streaming Response</span>
                    </div>
                </div>
                <h3 className="mt-8 text-xl font-semibold text-gray-800">Analyzing Data Structure...</h3>
                <p className="text-gray-500 mt-2">The AI is reviewing your file formats to build a unified schema.</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                        <Table className="w-6 h-6 mr-2 text-brand-600" />
                        Target Schema Definition
                    </h2>
                    <p className="text-gray-500 mt-1">
                        The "Gold Standard" structure for your data. Gemini suggested this based on your uploads.
                    </p>
                </div>
                <div className="flex items-center space-x-3">
                     <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
                        <Cpu className="w-4 h-4 text-gray-400 mr-2" />
                        <select 
                            value={selectedModel}
                            onChange={(e) => {
                                setSelectedModel(e.target.value);
                            }}
                            className="text-sm border-none focus:ring-0 text-gray-700 font-medium bg-transparent cursor-pointer"
                        >
                            {MODELS.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                    <button 
                        onClick={handleGenerate}
                        className="flex items-center text-sm font-medium text-brand-600 hover:text-brand-800 transition-colors px-3 py-2 rounded-lg hover:bg-brand-50 border border-transparent hover:border-brand-100"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Regenerate
                    </button>
                    <button 
                        onClick={onBack}
                        className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 border border-transparent"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Upload
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                        <span className="font-mono text-sm font-semibold text-gray-700">Schema JSON Editor</span>
                        {error && <span className="text-red-500 text-xs font-medium">{error}</span>}
                        {syntaxError && !error && <span className="text-amber-600 text-xs font-medium flex items-center"><AlertCircle className="w-3 h-3 mr-1"/> Invalid JSON</span>}
                    </div>
                    <textarea 
                        className="flex-1 w-full p-4 font-mono text-sm text-gray-800 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500"
                        value={jsonInput}
                        onChange={(e) => setJsonInput(e.target.value)}
                        spellCheck={false}
                    />
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
                     <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <span className="font-semibold text-gray-700">Preview: {validSchema?.tableName || '...'}</span>
                    </div>
                    <div className="overflow-auto flex-1 p-0">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Column Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {validSchema?.columns?.map((col: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-700 font-mono">{col.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                ${col.type === 'string' ? 'bg-green-100 text-green-800' : 
                                                  col.type === 'number' ? 'bg-blue-100 text-blue-800' :
                                                  col.type === 'date' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                                                {col.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{col.description}</td>
                                    </tr>
                                ))}
                                {(!validSchema?.columns || validSchema.columns.length === 0) && (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-8 text-center text-gray-400 text-sm">
                                            No columns defined. Add columns in the JSON editor.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 bg-gray-50 border-t border-gray-200">
                         <button 
                            onClick={handleConfirm}
                            className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            Confirm Schema & Continue
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

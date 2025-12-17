
import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TargetSchema, AnalysisResult } from '../types';
import { generateAnalysisCode, generateChartExplanation } from '../services/geminiService';
import { runAnalysis } from '../services/pythonService';
import { buildAnalysisDataContext } from '../services/analysisContextService';
import { Button } from './ui/Button';
import { BarChart3, PieChart, LineChart, MessageSquare, Play, RefreshCw, Image as ImageIcon, FileText, Code2, Table2, ArrowLeft, Loader2, Database, LayoutDashboard } from 'lucide-react';

interface Props {
    mergedData: any[];
    schema: TargetSchema;
    onBack: () => void;
    modelName?: string;
}

const CHART_TYPES = [
    { id: 'Auto-Select', name: '✨ AI Auto-Select' },
    { id: 'Dashboard', name: '📊 Dashboard (Multi-Chart)' },
    { id: 'Bar Chart', name: '📊 Bar Chart' },
    { id: 'Line Chart', name: '📈 Line Chart' },
    { id: 'Scatter Plot', name: '💠 Scatter Plot' },
    { id: 'Pie Chart', name: '🥧 Pie Chart' },
    { id: 'Histogram', name: '📶 Histogram' },
];

export const AnalysisStage: React.FC<Props> = ({ mergedData, schema, onBack, modelName = 'gemini-3-pro-preview' }) => {
    const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(schema.columns.slice(0, 5).map(c => c.name)));
    const [query, setQuery] = useState("");
    const [chartType, setChartType] = useState(CHART_TYPES[0].id);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [sampleMaxRows, setSampleMaxRows] = useState(50);
    const [sampleRandomRows, setSampleRandomRows] = useState(20);
    const [sampleTopCategories, setSampleTopCategories] = useState(4);
    const [enableTimeBoost, setEnableTimeBoost] = useState(true);
    const [autoExplainChart, setAutoExplainChart] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [isExplainingChart, setIsExplainingChart] = useState(false);
    const [chartExplanationStreaming, setChartExplanationStreaming] = useState("");
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [activeTab, setActiveTab] = useState<'preview' | 'report' | 'data' | 'code'>('preview');
    const [streamingText, setStreamingText] = useState("");
    const pdfContentRef = useRef<HTMLDivElement>(null);

    const toggleColumn = (name: string) => {
        const newSet = new Set(selectedColumns);
        if (newSet.has(name)) newSet.delete(name);
        else newSet.add(name);
        setSelectedColumns(newSet);
    };

    const handleAnalyze = async () => {
        if (!query.trim()) return;
        setIsAnalyzing(true);
        setResult(null);
        setStreamingText("");
        setChartExplanationStreaming("");
        setActiveTab('report');

        try {
            const selectedColsArr = Array.from(selectedColumns);
            const dataContext = buildAnalysisDataContext(
                mergedData,
                schema,
                selectedColsArr,
                {
                    maxRows: sampleMaxRows,
                    randomRows: Math.min(sampleRandomRows, sampleMaxRows),
                    topCategories: sampleTopCategories,
                    enableTimeBoost
                }
            );
            // 1. Generate Code with AI
            const { code, report } = await generateAnalysisCode(
                schema,
                Array.from(selectedColumns),
                query,
                chartType,
                modelName,
                (text) => setStreamingText(text),
                {
                    sampleMarkdown: dataContext.sampleMarkdown,
                    summaryMarkdown: dataContext.summaryMarkdown
                }
            );

            // 2. Execute Code in Pyodide
            if (code) {
                const executionResult = await runAnalysis(code, mergedData);
                const baseResult: AnalysisResult = {
                    report: report,
                    code: code,
                    plotImage: executionResult.plotImage || undefined,
                    stats: executionResult.stats
                };
                setResult(baseResult);

                if (autoExplainChart && executionResult.plotImage) {
                    setIsExplainingChart(true);
                    try {
                        const explanation = await generateChartExplanation(
                            schema,
                            selectedColsArr,
                            query,
                            chartType,
                            executionResult.plotImage,
                            modelName,
                            (text) => setChartExplanationStreaming(text)
                        );
                        setResult(prev => prev ? { ...prev, chartExplanation: explanation } : prev);
                    } catch (e: any) {
                        console.error(e);
                        const msg = e?.message ? `**Chart commentary error:** ${e.message}` : "**Chart commentary error:** failed to generate.";
                        setResult(prev => prev ? { ...prev, chartExplanation: msg } : prev);
                    } finally {
                        setIsExplainingChart(false);
                        setChartExplanationStreaming("");
                    }
                }
            } else {
                setResult({
                    report: report, // Report might say "I couldn't generate code"
                    code: ""
                });
            }
        } catch (e: any) {
            console.error(e);
            setResult({
                report: `**Error during analysis:** ${e.message}`,
                code: ""
            });
        } finally {
            setIsAnalyzing(false);
            setStreamingText("");
        }
    };

    const downloadReport = () => {
        if (!result?.report) return;
        const fullReport = result.chartExplanation
            ? `${result.report}\n\n---\n\n## Chart Commentary\n\n${result.chartExplanation}\n`
            : result.report;
        const blob = new Blob([fullReport], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `analysis-report-${dateStr}.md`;
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const downloadPlot = () => {
        if (!result?.plotImage) return;
        const byteString = atob(result.plotImage);
        const bytes = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
            bytes[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `analysis-plot-${dateStr}.png`;
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const downloadPdf = async () => {
        if (!pdfContentRef.current || isExportingPdf) return;
        setIsExportingPdf(true);
        try {
            const canvas = await html2canvas(pdfContentRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            const dateStr = new Date().toISOString().slice(0, 10);
            pdf.save(`analysis-${dateStr}.pdf`);
        } catch (e) {
            console.error(e);
            alert("Failed to generate PDF. Try reducing sample size or report length.");
        } finally {
            setIsExportingPdf(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-140px)] gap-6">
            {/* Left Panel: Controls */}
            <div className="w-96 flex flex-col gap-4">
                {/* Column Selection */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden max-h-[40vh]">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-semibold text-gray-700 text-sm">
                        1. Select Columns to Analyze
                    </div>
                    <div className="overflow-y-auto p-2 space-y-1 bg-white flex-1">
                        {schema.columns.map(col => (
                            <label key={col.name} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors text-sm">
                                <input 
                                    type="checkbox" 
                                    checked={selectedColumns.has(col.name)}
                                    onChange={() => toggleColumn(col.name)}
                                    className="rounded text-brand-600 focus:ring-brand-500 mr-3 border-gray-300"
                                />
                                <div className="flex-1 truncate">
                                    <span className="font-medium text-gray-800">{col.name}</span>
                                    <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{col.type}</span>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Analysis Query */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 p-4">
                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">2. Visualization Type</label>
                        <select 
                            value={chartType} 
                            onChange={(e) => setChartType(e.target.value)}
                            className="w-full text-sm border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                        >
                            {CHART_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>

                    <div className="flex-1 flex flex-col">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">3. What do you want to know?</label>
                        <textarea 
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="e.g. Compare Sales vs Profit by Region, showing both trend and distribution..."
                            className="w-full flex-1 p-3 border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm resize-none"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowAdvanced(v => !v)}
                        className="mt-3 text-xs font-semibold text-gray-600 hover:text-gray-900 text-left"
                    >
                        {showAdvanced ? "Hide Advanced Options" : "Show Advanced Options"}
                    </button>

                    {showAdvanced && (
                        <div className="mt-2 space-y-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Context Sample Rows</label>
                                <select
                                    value={sampleMaxRows}
                                    onChange={(e) => {
                                        const v = parseInt(e.target.value, 10);
                                        setSampleMaxRows(v);
                                        setSampleRandomRows(r => Math.min(r, v));
                                    }}
                                    className="w-full text-xs border-gray-300 rounded-md focus:ring-brand-500 focus:border-brand-500"
                                >
                                    {[20, 40, 50, 60, 80, 100].map(n => (
                                        <option key={n} value={n}>{n} rows</option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-gray-500 mt-1">How many rows are sent to the LLM.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Random Rows (fill)</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={sampleMaxRows}
                                    value={sampleRandomRows}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        const v = raw === "" ? 0 : parseInt(raw, 10);
                                        const clamped = Math.max(0, Math.min(sampleMaxRows, Number.isFinite(v) ? v : 0));
                                        setSampleRandomRows(clamped);
                                    }}
                                    className="w-full text-xs border border-gray-300 rounded-md px-2 py-1 focus:ring-brand-500 focus:border-brand-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Top Categories per Categorical Column</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={sampleTopCategories}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        const v = raw === "" ? 1 : parseInt(raw, 10);
                                        const clamped = Math.max(1, Math.min(10, Number.isFinite(v) ? v : 1));
                                        setSampleTopCategories(clamped);
                                    }}
                                    className="w-full text-xs border border-gray-300 rounded-md px-2 py-1 focus:ring-brand-500 focus:border-brand-500"
                                />
                            </div>

                            <label className="flex items-center text-xs text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={enableTimeBoost}
                                    onChange={(e) => setEnableTimeBoost(e.target.checked)}
                                    className="mr-2 rounded text-brand-600 focus:ring-brand-500 border-gray-300"
                                />
                                Time‑based Panel Boost (date × category)
                            </label>

                            <label className="flex items-center text-xs text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={autoExplainChart}
                                    onChange={(e) => setAutoExplainChart(e.target.checked)}
                                    className="mr-2 rounded text-brand-600 focus:ring-brand-500 border-gray-300"
                                />
                                Auto‑explain chart with LLM
                            </label>
                        </div>
                    )}

                    <Button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || selectedColumns.size === 0 || !query.trim()}
                        className="mt-4 w-full py-2.5"
                    >
                        {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                        {isAnalyzing ? "Analyzing..." : "Run Deep Dive Analysis"}
                    </Button>
                </div>
                
                <button onClick={onBack} className="flex items-center justify-center text-sm text-gray-500 hover:text-gray-800 transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to Export
                </button>
            </div>

            {/* Right Panel: Results */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                {/* Tabs */}
                <div className="border-b border-gray-200 flex items-center px-4 bg-gray-50">
                    <button 
                        onClick={() => setActiveTab('preview')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center ${activeTab === 'preview' ? 'border-brand-600 text-brand-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <Database className="w-4 h-4 mr-2" /> Dataset Preview
                    </button>
                    <button 
                        onClick={() => setActiveTab('report')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center ${activeTab === 'report' ? 'border-brand-600 text-brand-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <LayoutDashboard className="w-4 h-4 mr-2" /> Visualization & Report
                    </button>
                    <button 
                        onClick={() => setActiveTab('data')}
                        disabled={!result?.stats}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center ${activeTab === 'data' ? 'border-brand-600 text-brand-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 disabled:opacity-40'}`}
                    >
                        <Table2 className="w-4 h-4 mr-2" /> Summary Stats
                    </button>
                    <button 
                        onClick={() => setActiveTab('code')}
                        disabled={!result?.code}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center ${activeTab === 'code' ? 'border-brand-600 text-brand-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 disabled:opacity-40'}`}
                    >
                        <Code2 className="w-4 h-4 mr-2" /> Generated Code
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto bg-slate-50 relative p-6">
                    {isAnalyzing && !result && (
                        <div className="absolute inset-0 z-10 bg-white/80 flex flex-col items-center justify-center p-8">
                            <div className="w-full max-w-2xl bg-black rounded-lg p-6 shadow-xl font-mono text-xs text-green-400 h-96 overflow-hidden relative">
                                <div className="absolute top-2 right-2 flex space-x-1">
                                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                </div>
                                <div className="whitespace-pre-wrap opacity-90">{streamingText || "Initializing AI Agent..."}</div>
                                <div className="animate-pulse mt-2">_</div>
                            </div>
                            <p className="mt-4 text-gray-600 font-medium animate-pulse">Running advanced statistical analysis...</p>
                        </div>
                    )}

                    {!isAnalyzing && activeTab === 'report' && !result && (
                         <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <BarChart3 className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg font-medium text-gray-500">Ready to Analyze</p>
                            <p className="text-sm">Select columns and enter a question to generate insights.</p>
                        </div>
                    )}

                    {activeTab === 'preview' && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                             <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                <h3 className="font-semibold text-gray-800">Raw Data Preview (First 100 rows)</h3>
                                <span className="text-xs text-gray-500">Total: {mergedData.length} rows</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            {schema.columns.map(col => (
                                                <th key={col.name} className="px-6 py-3 text-left font-medium text-gray-500 uppercase whitespace-nowrap border-b border-gray-200">
                                                    {col.name}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {mergedData.slice(0, 100).map((row, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                {schema.columns.map(col => (
                                                    <td key={col.name} className="px-6 py-3 text-gray-700 whitespace-nowrap">
                                                        {row[col.name] !== undefined && row[col.name] !== null ? String(row[col.name]) : <span className="text-gray-300 italic">null</span>}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {result && activeTab === 'report' && (
                        <div className="max-w-5xl mx-auto space-y-6">
                            <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                    onClick={downloadPdf}
                                    variant="secondary"
                                    size="sm"
                                    disabled={isExportingPdf}
                                >
                                    <FileText className="w-4 h-4 mr-2" />
                                    {isExportingPdf ? "Generating PDF..." : "Download PDF"}
                                </Button>
                                <Button
                                    onClick={downloadReport}
                                    variant="secondary"
                                    size="sm"
                                >
                                    <FileText className="w-4 h-4 mr-2" />
                                    Download Report
                                </Button>
                                {result.plotImage && (
                                    <Button
                                        onClick={downloadPlot}
                                        variant="secondary"
                                        size="sm"
                                    >
                                        <ImageIcon className="w-4 h-4 mr-2" />
                                        Download Chart
                                    </Button>
                                )}
                            </div>
                            <div ref={pdfContentRef} className="space-y-6">
                                {result.plotImage && (
                                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                                        <img 
                                            src={`data:image/png;base64,${result.plotImage}`} 
                                            alt="Analysis Plot" 
                                            className="w-full h-auto rounded-lg"
                                        />
                                    </div>
                                )}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center">
                                        <MessageSquare className="w-4 h-4 mr-2 text-brand-600" />
                                        <span className="text-sm font-semibold text-gray-800">LLM Report</span>
                                    </div>
                                    <div className="p-8 prose prose-sm max-w-none text-gray-700">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {result.report}
                                        </ReactMarkdown>
                                    </div>
                                </div>

                                {(isExplainingChart || result.chartExplanation || chartExplanationStreaming) && (
                                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                        <div className="px-6 py-3 bg-purple-50/60 border-b border-purple-100 flex items-center">
                                            <ImageIcon className="w-4 h-4 mr-2 text-purple-600" />
                                            <span className="text-sm font-semibold text-purple-900">Chart Commentary</span>
                                            {isExplainingChart && (
                                                <span className="ml-2 text-xs text-purple-700 animate-pulse">generating…</span>
                                            )}
                                        </div>
                                        <div className="p-8 prose prose-sm max-w-none text-gray-700 bg-purple-50/20">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {result.chartExplanation || chartExplanationStreaming || "Generating chart commentary..."}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {result && activeTab === 'data' && result.stats && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                             <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                <h3 className="font-semibold text-gray-800">Descriptive Statistics</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Stat</th>
                                            {Object.keys(result.stats).map(col => (
                                                <th key={col} className="px-6 py-3 text-left font-medium text-gray-500 uppercase whitespace-nowrap">{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max'].map(stat => (
                                            <tr key={stat} className="hover:bg-gray-50">
                                                <td className="px-6 py-3 font-medium text-gray-900 bg-gray-50">{stat}</td>
                                                {Object.values(result.stats).map((colStats: any, idx) => (
                                                    <td key={idx} className="px-6 py-3 text-gray-700 font-mono">
                                                        {colStats[stat] !== undefined && colStats[stat] !== null 
                                                            ? (typeof colStats[stat] === 'number' ? colStats[stat].toLocaleString(undefined, { maximumFractionDigits: 2 }) : colStats[stat])
                                                            : '-'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {result && activeTab === 'code' && (
                        <div className="h-full flex flex-col">
                            <textarea 
                                readOnly
                                className="flex-1 w-full p-6 font-mono text-sm leading-relaxed bg-[#1e1e1e] text-gray-100 resize-none focus:outline-none rounded-xl"
                                value={result.code}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

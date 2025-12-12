
import React, { useState } from 'react';
import { UploadStage } from './components/UploadStage';
import { SchemaStage } from './components/SchemaStage';
import { TransformStage } from './components/TransformStage';
import { AnalysisStage } from './components/AnalysisStage';
import { AppStage, ProcessingFile, TargetSchema } from './types';
import { exportToCSV } from './services/excelService';
import { Layers, Sparkles, CheckCheck, Download, ChevronRight, BarChart3 } from 'lucide-react';

export default function App() {
    const [stage, setStage] = useState<AppStage>(AppStage.UPLOAD);
    const [files, setFiles] = useState<ProcessingFile[]>([]);
    const [allDetectedFiles, setAllDetectedFiles] = useState<ProcessingFile[]>([]);
    const [schema, setSchema] = useState<TargetSchema | null>(null);

    // AI Model Configuration State
    const [schemaModel, setSchemaModel] = useState<string>('gemini-flash-latest');
    const [codeModel, setCodeModel] = useState<string>('gemini-3-pro-preview');

    const handleFilesLoaded = (selectedFiles: ProcessingFile[], allFiles: ProcessingFile[]) => {
        setFiles(selectedFiles);
        setAllDetectedFiles(allFiles);
        setStage(AppStage.SCHEMA);
    };

    const handleSchemaConfirmed = (confirmedSchema: TargetSchema) => {
        setSchema(confirmedSchema);
        setStage(AppStage.TRANSFORM);
    };

    const handleTransformationComplete = (completedFiles: ProcessingFile[]) => {
        setFiles(completedFiles);
        setStage(AppStage.EXPORT);
    };

    const handleBack = () => {
        if (stage === AppStage.SCHEMA) setStage(AppStage.UPLOAD);
        if (stage === AppStage.TRANSFORM) setStage(AppStage.SCHEMA);
        if (stage === AppStage.ANALYSIS) setStage(AppStage.EXPORT);
    };

    const handleExport = () => {
        if (!files.length) return;
        const mergedData = files.flatMap(f => f.output || []);
        exportToCSV(mergedData, `${schema?.tableName || 'merged_data'}.csv`);
    };

    const restart = () => {
        if (files.length > 0) {
            if (!confirm("Start over? Current progress will be lost.")) {
                return;
            }
        }
        // Soft reset
        setFiles([]);
        setAllDetectedFiles([]);
        setSchema(null);
        setStage(AppStage.UPLOAD);
    };

    // Navigation Helper
    const canNavigateTo = (target: AppStage) => {
        if (target === AppStage.UPLOAD) return true;
        if (target === AppStage.SCHEMA) return files.length > 0;
        if (target === AppStage.TRANSFORM) return files.length > 0 && schema !== null;
        if (target === AppStage.EXPORT) {
            // Allow if we have success status or if we are already there
            return stage === AppStage.EXPORT || stage === AppStage.ANALYSIS || (files.length > 0 && files.every(f => f.status === 'success'));
        }
        if (target === AppStage.ANALYSIS) {
             return (files.length > 0 && files.every(f => f.status === 'success'));
        }
        return false;
    };

    const navigateTo = (target: AppStage) => {
        if (stage === target) return;
        if (canNavigateTo(target)) {
            setStage(target);
        }
    };

    const renderStep = (stepStage: AppStage, number: number, label: string) => {
        const isActive = stage === stepStage;
        const isAccessible = canNavigateTo(stepStage);
        
        return (
            <div 
                onClick={() => navigateTo(stepStage)}
                className={`flex items-center transition-colors ${
                    isAccessible ? 'cursor-pointer hover:text-brand-800' : 'cursor-not-allowed opacity-50'
                } ${isActive ? 'text-brand-600 font-bold' : isAccessible ? 'text-gray-600' : 'text-gray-400'}`}
            >
                <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-2 text-xs transition-all ${
                    isActive ? 'border-brand-600 bg-brand-50' : 
                    isAccessible ? 'border-gray-400' : 'border-gray-200'
                }`}>
                    {number}
                </span>
                {label}
            </div>
        );
    };

    const getMergedData = () => files.flatMap(f => f.output || []);

    return (
        <div className="min-h-screen bg-slate-50 text-gray-900 font-sans">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-3 cursor-pointer group" onClick={restart}>
                        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center shadow-lg shadow-brand-200 group-hover:bg-brand-700 transition-colors">
                            <Sparkles className="text-white w-5 h-5" />
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-700 to-brand-500 group-hover:from-brand-800 group-hover:to-brand-600">
                            DataWeave AI
                        </span>
                    </div>

                    {/* Progress Stepper */}
                    <div className="hidden md:flex items-center space-x-4 text-sm font-medium">
                        {renderStep(AppStage.UPLOAD, 1, 'Upload')}
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                        {renderStep(AppStage.SCHEMA, 2, 'Schema')}
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                        {renderStep(AppStage.TRANSFORM, 3, 'Clean')}
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                        {renderStep(AppStage.EXPORT, 4, 'Export')}
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                        {renderStep(AppStage.ANALYSIS, 5, 'Analyze')}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {stage === AppStage.UPLOAD && (
                    <UploadStage 
                        onFilesLoaded={handleFilesLoaded} 
                        initialAllFiles={allDetectedFiles}
                        initialSelectedIds={files.length > 0 ? new Set(files.map(f => f.id)) : undefined}
                        schemaModel={schemaModel}
                        setSchemaModel={setSchemaModel}
                        codeModel={codeModel}
                        setCodeModel={setCodeModel}
                    />
                )}

                {stage === AppStage.SCHEMA && files.length > 0 && (
                    <SchemaStage 
                        files={files} 
                        onSchemaConfirmed={handleSchemaConfirmed} 
                        onBack={handleBack}
                        initialSchema={schema}
                        initialSelectedModel={schemaModel}
                    />
                )}

                {stage === AppStage.TRANSFORM && files.length > 0 && schema && (
                    <TransformStage 
                        files={files} 
                        schema={schema} 
                        onComplete={handleTransformationComplete} 
                        onBack={handleBack}
                        initialSelectedModel={codeModel}
                    />
                )}

                {stage === AppStage.EXPORT && (
                    <div className="max-w-3xl mx-auto text-center py-16">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                            <CheckCheck className="w-10 h-10 text-green-600" />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Processing Complete!</h2>
                        <p className="text-lg text-gray-600 mb-8">
                            Successfully unified {files.length} sheets into a single standard dataset.
                        </p>
                        
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8 text-left">
                            <h3 className="font-semibold text-gray-800 mb-4">Summary</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-xs text-gray-500 uppercase">Total Rows</div>
                                    <div className="text-2xl font-mono text-gray-900">
                                        {files.reduce((acc, f) => acc + (f.output?.length || 0), 0).toLocaleString()}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase">Columns</div>
                                    <div className="text-2xl font-mono text-gray-900">{schema?.columns.length} (+ metadata)</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-center space-x-4">
                            <button 
                                onClick={handleExport}
                                className="flex items-center px-8 py-4 bg-brand-600 text-white rounded-xl shadow-lg hover:bg-brand-700 hover:shadow-xl transition-all font-semibold text-lg"
                            >
                                <Download className="w-6 h-6 mr-2" />
                                Download CSV
                            </button>
                            <button 
                                onClick={() => setStage(AppStage.ANALYSIS)}
                                className="flex items-center px-8 py-4 bg-purple-600 text-white rounded-xl shadow-lg hover:bg-purple-700 hover:shadow-xl transition-all font-semibold text-lg"
                            >
                                <BarChart3 className="w-6 h-6 mr-2" />
                                Analyze Data
                            </button>
                        </div>
                        <div className="mt-6">
                             <button 
                                onClick={restart}
                                className="text-gray-500 hover:text-gray-800 text-sm font-medium underline"
                            >
                                Start New Project
                            </button>
                        </div>
                    </div>
                )}

                {stage === AppStage.ANALYSIS && schema && (
                    <AnalysisStage 
                        mergedData={getMergedData()}
                        schema={schema}
                        onBack={handleBack}
                        modelName={codeModel}
                    />
                )}
            </main>
        </div>
    );
}

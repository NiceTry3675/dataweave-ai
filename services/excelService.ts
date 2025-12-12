import * as XLSX from 'xlsx';
import { ProcessingFile } from '../types';

export const parseExcelFile = async (file: File): Promise<ProcessingFile[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                
                const sheets: ProcessingFile[] = [];

                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    // Get raw data as array of arrays, don't assume header is row 0
                    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
                    
                    // Filter out rows that are completely empty or just whitespace
                    const jsonData = rawData.filter(row => 
                        row && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== "")
                    );
                    
                    if (jsonData.length > 0) {
                        sheets.push({
                            id: Math.random().toString(36).substring(7),
                            filename: file.name,
                            sheetName: sheetName,
                            data: jsonData,
                            preview: jsonData.slice(0, 30), // Top 30 rows for context
                            status: 'pending'
                        });
                    }
                });
                resolve(sheets);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

export const exportToCSV = (data: any[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
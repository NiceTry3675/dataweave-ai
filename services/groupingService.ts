
import { ProcessingFile } from '../types';

export interface FileGroup {
    id: string;
    signature: string;
    fileIds: string[];
    generatedCode?: string;
    aiReasoning?: string;
}

/**
 * Calculates a "Skeleton Signature" for a sheet to identify its layout structure.
 * 
 * Strategy:
 * 1. Take the first 6 rows (header area).
 * 2. Map each cell to a simplified type:
 *    - 'X': Empty/Null/Undefined
 *    - 'N': Number
 *    - 'S': String (actual text content is ignored)
 * 3. Join rows with '|' and cells with ',' to form a unique string key.
 */
const calculateSkeleton = (data: any[][]): string => {
    // If empty, return special signature
    if (!data || data.length === 0) return "EMPTY";

    const rowsToCheck = data.slice(0, 6);
    
    // Normalize rows to ensure consistent length for the signature if needed,
    // but usually map is sufficient.
    const signature = rowsToCheck.map(row => {
        // If row is empty/undefined
        if (!row || !Array.isArray(row)) return "EMPTY_ROW";
        
        return row.map(cell => {
            if (cell === null || cell === undefined || cell === "") return "X";
            const type = typeof cell;
            if (type === 'number') return "N";
            // Treat everything else (mostly strings) as S
            return "S";
        }).join(",");
    }).join("|");

    return signature;
};

export const groupFilesByStructure = (files: ProcessingFile[]): FileGroup[] => {
    const groups: Record<string, string[]> = {};

    // 1. Group file IDs by signature
    files.forEach(file => {
        const signature = calculateSkeleton(file.preview); // Use preview data which is the top rows
        if (!groups[signature]) {
            groups[signature] = [];
        }
        groups[signature].push(file.id);
    });

    // 2. Convert to array of Group objects
    return Object.entries(groups).map(([signature, fileIds], index) => ({
        id: `group_${index + 1}`,
        signature,
        fileIds
    }));
};

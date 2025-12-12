
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { ProcessingFile, TargetSchema } from "../types";
import { groupFilesByStructure } from "./groupingService";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const dataToMarkdown = (data: any[][], rows = 10) => {
    if (!data || data.length === 0) return "No data";
    const slice = data.slice(0, rows);
    // Convert to simple markdown table string for LLM context
    return slice.map(row => row.map(cell => String(cell || '')).join(" | ")).join("\n");
};

/**
 * Executes an async operation with exponential backoff retry logic.
 * Specifically targets 503 (Overloaded) and 429 (Rate Limit) errors.
 */
const retryWithBackoff = async <T>(
    operation: () => Promise<T>,
    retries = 3,
    initialDelay = 2000
): Promise<T> => {
    let currentDelay = initialDelay;

    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error: any) {
            const errorCode = error?.status || error?.code || error?.error?.code || error?.error?.status;
            const errorMessage = (error?.message || error?.error?.message || JSON.stringify(error)).toLowerCase();

            const isOverloaded =
                errorCode === 503 ||
                errorCode === 429 ||
                errorMessage.includes("503") ||
                errorMessage.includes("overloaded") ||
                errorMessage.includes("unavailable") ||
                errorMessage.includes("too many requests");

            if (isOverloaded && i < retries - 1) {
                console.warn(`Gemini API busy (Status ${errorCode}). Retrying in ${currentDelay}ms... (Attempt ${i + 1}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, currentDelay));
                currentDelay *= 2;
            } else {
                throw error;
            }
        }
    }
    throw new Error("Max retries exceeded. The service is currently too busy.");
};

export const generateSchema = async (
    files: ProcessingFile[],
    modelName: string = "gemini-flash-latest",
    onStreamUpdate?: (text: string) => void
): Promise<TargetSchema> => {
    const ai = getAI();

    // 1. Group files
    const groups = groupFilesByStructure(files);

    // 2. Sample Representatives
    const samples: string[] = [];
    groups.forEach((group, idx) => {
        const groupFiles = files.filter(f => group.fileIds.includes(f.id));
        const groupSamples = groupFiles.slice(0, 3).map(f => {
            return `Group ${idx + 1} (Signature: ${group.signature.substring(0, 6)}...)\nFile: ${f.filename} / Sheet: ${f.sheetName}\n${dataToMarkdown(f.preview)}`;
        });
        samples.push(...groupSamples);
    });

    const contextStr = samples.slice(0, 12).join("\n\n---\n\n");

    const prompt = `
    You are a Senior Data Architect. Analyze these Excel file samples. 
    
    Task: Create a SINGLE Unified Target Schema that works as a superset for all these groups.
    
    Input Samples:
    ${contextStr}
    
    Instructions:
    1. **Analyze**: First, explain your reasoning. Identify the common entity (e.g., Sales, Inventory). Note specific differences between Groups (e.g., "Group 1 has 'Date', Group 2 has 'Timestamp'").
    2. **Define**: Create a unified schema. Use clean snake_case for column names.
    3. **Output**: Finally, provide the Schema JSON wrapped in a \`\`\`json\`\`\` block.
    
    The JSON structure must be:
    {
      "tableName": "string",
      "columns": [ { "name": "string", "type": "string", "description": "string" } ]
    }
    `;

    let fullText = "";

    try {
        const response: any = await retryWithBackoff(() => ai.models.generateContentStream({
            model: modelName,
            contents: prompt,
        }));

        const stream = response.stream || response; // Handle potentially different SDK response shapes

        for await (const chunk of stream) {
            const c = chunk as GenerateContentResponse;
            const text = c.text;
            if (text) {
                fullText += text;
                if (onStreamUpdate) onStreamUpdate(fullText);
            }
        }

        const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/) || fullText.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            // fallback: check if the text itself is valid json
            try {
                JSON.parse(fullText);
                return JSON.parse(fullText);
            } catch {
                throw new Error("AI generated reasoning but failed to output a valid JSON block.");
            }
        }

        const jsonStr = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonStr) as TargetSchema;

    } catch (e) {
        console.error("Schema Generation Error", e);
        throw e;
    }
};

export const generateTransformationCode = async (
    file: ProcessingFile,
    targetSchema: TargetSchema,
    modelName: string = "gemini-3-pro-preview",
    onStreamUpdate?: (text: string) => void
): Promise<{ code: string; reasoning: string }> => {
    const ai = getAI();

    const schemaStr = targetSchema.columns.map(c => `- ${c.name} (${c.type}): ${c.description}`).join("\n");
    const dataSample = dataToMarkdown(file.preview, 30);

    const prompt = `
    You are a Python Pandas Data Engineering Expert.
    
    GOAL: Write a Python function \`transform(df)\` to clean a specific dataframe so it matches the Target Schema.
    
    TARGET SCHEMA:
    ${schemaStr}
    
    INPUT DATA SAMPLE:
    ${dataSample}
    
    INSTRUCTIONS:
    1. **Plan**: Start by briefly explaining your logic (e.g., "Row 3 looks like the header...").
    2. **Code**: Write the code inside a \`\`\`python\`\`\` block.
    3. **Requirements**: 
       - Define \`def transform(df):\`
       - Input \`df\` is raw (header=None).
       - Return \`(cleaned_df, metadata_dict)\`.
       - Use .iloc, regex, etc. No hardcoded values.
    `;

    let fullText = "";

    try {
        // NOTE: 직접 호출 - retryWithBackoff 래퍼 사용 시 hang 발생 이슈로 인해 직접 호출
        const response: any = await ai.models.generateContentStream({
            model: modelName,
            contents: prompt,
        });

        const stream = response.stream || response;

        for await (const chunk of stream) {
            const c = chunk as GenerateContentResponse;
            const text = c.text;
            if (text) {
                fullText += text;
                if (onStreamUpdate) onStreamUpdate(fullText);
            }
        }

        if (!fullText) {
            throw new Error("No content generated by the model.");
        }

        const codeBlockRegex = /```python\s*([\s\S]*?)\s*```/;
        const match = fullText.match(codeBlockRegex);

        let code = "";
        let reasoning = "";

        if (match) {
            code = match[1].trim();
            reasoning = fullText.substring(0, match.index).trim();
        } else {
            code = fullText.replace(/```python/g, '').replace(/```/g, '').trim();
            reasoning = "No structured reasoning provided by AI.";
        }

        return { code, reasoning };
    } catch (e) {
        console.error("Code Generation Error", e);
        throw e;
    };
};

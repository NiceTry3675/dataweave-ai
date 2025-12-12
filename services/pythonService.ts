
import { PyodideInterface } from '../types';

let pyodideInstance: PyodideInterface | null = null;
let isLoading = false;

// Simple Mutex to ensure exclusive access to the Python runtime globals
class Mutex {
    private queue: (() => void)[] = [];
    private locked = false;

    async acquire() {
        if (this.locked) {
            await new Promise<void>(resolve => this.queue.push(resolve));
        }
        this.locked = true;
    }

    release() {
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            if (next) next();
        } else {
            this.locked = false;
        }
    }
}

const pythonRuntimeMutex = new Mutex();

export const initPyodide = async (): Promise<PyodideInterface> => {
    if (pyodideInstance) return pyodideInstance;
    if (isLoading) throw new Error("Pyodide is already loading");

    isLoading = true;
    try {
        console.log("Loading Pyodide...");
        const pyodide = await window.loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
        });
        
        console.log("Loading Core Packages...");
        // Load core scientific stack and micropip
        // Note: We use micropip to install seaborn to ensure robust loading
        await pyodide.loadPackage(["pandas", "matplotlib", "micropip"]);
        
        console.log("Installing Seaborn...");
        const micropip = pyodide.pyimport("micropip");
        await micropip.install("seaborn");
        
        // Define a helper to convert JS array to DF
        // We inject a small preamble to make the environment ready
        await pyodide.runPythonAsync(`
            import pandas as pd
            import numpy as np
            import io
            import json
            import re
            import matplotlib
            matplotlib.use("Agg") # Use non-interactive backend
            import matplotlib.pyplot as plt
            import seaborn as sns
            
            # Set default style
            sns.set_theme(style="whitegrid")
            
            def js_to_df(js_data):
                # Convert list of lists to dataframe
                return pd.DataFrame(js_data)

            def df_to_json(df):
                return df.to_json(orient='records', date_format='iso')
        `);

        pyodideInstance = pyodide;
        return pyodide;
    } finally {
        isLoading = false;
    }
};

export const runTransformation = async (
    code: string, 
    rawData: any[][], 
    filename: string, 
    sheetName: string
): Promise<any[]> => {
    if (!pyodideInstance) throw new Error("Python runtime not initialized");

    // Acquire lock to prevent race conditions on globals
    await pythonRuntimeMutex.acquire();

    // 160 Second Timeout to prevent infinite hangs
    const TIMEOUT_MS = 160000;
    let timeoutId: any;

    try {
        // 1. Pass data and metadata to Python globals
        // Using globals avoids string injection vulnerabilities in the wrapper script
        pyodideInstance.globals.set("raw_data_js", rawData);
        pyodideInstance.globals.set("meta_filename", filename);
        pyodideInstance.globals.set("meta_sheetname", sheetName);
        
        // 2. Prepare the execution script
        // We wrap the user's `transform` function
        // We assign the result to a global variable 'final_json_output' to ensure we can retrieve it reliably
        const wrapperScript = `
import pandas as pd
import numpy as np
import json
import re

# User provided code
${code}

# Execution Logic
try:
    # Convert JS proxy to list, then DF
    df_raw = pd.DataFrame(raw_data_js.to_py())
    
    # Run user transform
    result_df, metadata = transform(df_raw)
    
    # --- AUTOMATIC CLEANUP ---
    # 1. Replace empty strings or whitespace-only strings with NaN
    result_df = result_df.replace(r'^\\s*$', np.nan, regex=True)
    
    # 2. Drop rows where ALL columns are NaN (ghost rows)
    result_df = result_df.dropna(how='all')
    
    # 3. Add tracking columns using the global variables
    result_df['_source_file'] = meta_filename
    result_df['_source_sheet'] = meta_sheetname
    
    # Serialize to JSON and assign to global variable
    final_json_output = result_df.to_json(orient='records', date_format='iso')
except Exception as e:
    # Re-raise to be caught by JS
    raise e
`;
        // 3. Run with Race against Timeout
        const executionPromise = pyodideInstance.runPythonAsync(wrapperScript);
        
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`Python script execution timed out after ${TIMEOUT_MS/1000} seconds. Check for infinite loops in generated code.`));
            }, TIMEOUT_MS);
        });

        await Promise.race([executionPromise, timeoutPromise]);
        
        // 4. Retrieve the result from the global variable
        const resultJson = pyodideInstance.globals.get("final_json_output");
        
        if (!resultJson) {
            throw new Error("Transformation script finished but produced no output.");
        }
        
        // 5. Cleanup globals
        pyodideInstance.runPython("del final_json_output");

        return JSON.parse(resultJson);
    } catch (error) {
        console.error("Python Execution Error:", error);
        throw error;
    } finally {
        clearTimeout(timeoutId);
        // Release lock
        pythonRuntimeMutex.release();
    }
};

export const runAnalysis = async (
    code: string,
    mergedData: any[]
): Promise<{ plotImage: string | null; stats: any }> => {
    if (!pyodideInstance) throw new Error("Python runtime not initialized");

    await pythonRuntimeMutex.acquire();
    
    try {
        pyodideInstance.globals.set("merged_data_js", mergedData);
        
        // Script wrapper to capture plot and stats
        const wrapperScript = `
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import io
import base64
import json

# Reset plot
plt.clf()
plt.close('all')

# Load data
df = pd.DataFrame(merged_data_js.to_py())

# --- User Code Start ---
${code}
# --- User Code End ---

# Capture Plot
plot_b64 = None
if plt.get_fignums():
    # We grab the current figure (or the last one created)
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=120)
    buf.seek(0)
    plot_b64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close('all')

# Capture Stats
# We assume the user might have created 'df' or filtered it. 
# We run describe on the current 'df' variable.
stats_json = df.describe(include='all').to_json(date_format='iso')
`;
        await pyodideInstance.runPythonAsync(wrapperScript);
        
        const plotImage = pyodideInstance.globals.get("plot_b64");
        const statsJson = pyodideInstance.globals.get("stats_json");
        
        // Cleanup
        pyodideInstance.runPython("del merged_data_js; del plot_b64; del stats_json");
        
        return {
            plotImage: plotImage || null,
            stats: statsJson ? JSON.parse(statsJson) : null
        };

    } catch (e) {
        console.error("Analysis Execution Error", e);
        throw e;
    } finally {
        pythonRuntimeMutex.release();
    }
}

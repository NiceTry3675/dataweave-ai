# DataWeave AI

<div align="center">

**AI-Powered Data Unification & Analysis Platform**

*Leveraging Google Gemini AI to transform heterogeneous data into actionable insights*

[![React](https://img.shields.io/badge/React-19.2.1-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Google Gemini](https://img.shields.io/badge/Gemini-AI-8E75B2?logo=google&logoColor=white)](https://ai.google.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

### 🎬 [Demo Video](https://www.youtube.com/watch?v=wpHIC7TzIKY) | 🚀 [Live Demo](https://aistudio.google.com/apps/drive/1N-Gg_jGwuR-W92wV-wpkkFKV06uyowcO?fullscreenApplet=true)

</div>

---

## 📖 Overview

**DataWeave AI** is an intelligent web application that automates the unification, cleaning, and analysis of heterogeneous data sources. Built with React, TypeScript, and Vite, it offers a seamless five-stage workflow for complex data transformation.

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 📁 **Smart File Upload** | Supports Excel (.xlsx, .xls) and CSV files with intelligent sheet detection |
| 🧠 **AI-Powered Schema Generation** | Automatically generates unified schemas from diverse sources using Gemini models |
| 🧹 **Intelligent Data Cleaning** | AI-generated transformation code standardizes data formats |
| 📊 **Advanced Data Analysis** | Natural language queries enable AI-generated visualizations and insights |
| 📤 **Flexible Export** | Exports unified data as CSV files ready for downstream use |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Google Gemini API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/dataweave-ai.git
   cd dataweave-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Create .env.local file
   echo "VITE_GEMINI_API_KEY=your_api_key_here" > .env.local
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   
   Navigate to `http://localhost:5173`

## 📂 Project Structure

```
dataweave-ai/
├── App.tsx                 # Main application component
├── index.tsx               # Application entry point
├── index.html              # HTML template
├── index.css               # Global styles
├── types.ts                # TypeScript type definitions
├── components/
│   ├── UploadStage.tsx     # File upload functionality
│   ├── SchemaStage.tsx     # Schema generation stage
│   ├── TransformStage.tsx  # Data transformation stage
│   ├── AnalysisStage.tsx   # Data analysis & visualization
│   └── ui/                 # Reusable UI components
├── services/
│   ├── geminiService.ts    # Gemini AI integration
│   ├── excelService.ts     # Excel file processing
│   ├── pythonService.ts    # Python code execution
│   ├── groupingService.ts  # Data grouping logic
│   ├── analysisContextService.ts  # Analysis context management
│   └── schemaContextService.ts    # Schema context management
└── vite.config.ts          # Vite configuration
```

## 🔄 Workflow Stages

```mermaid
graph LR
    A[📁 Upload] --> B[📋 Schema]
    B --> C[🔄 Transform]
    C --> D[📊 Analyze]
    D --> E[📤 Export]
```

1. **Upload** - Import Excel/CSV files with automatic sheet detection
2. **Schema** - AI generates a unified schema from your data sources
3. **Transform** - AI-generated code cleans and standardizes your data
4. **Analyze** - Query your data using natural language
5. **Export** - Download the unified dataset as CSV

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript
- **Build Tool**: Vite 6
- **AI Integration**: Google Gemini API (`@google/genai`)
- **File Processing**: xlsx, jspdf, html2canvas
- **UI Components**: Lucide React (icons)
- **Markdown**: react-markdown, remark-gfm

## 💡 Importance & Impact

### Solving Real-World Data Challenges
Organizations frequently struggle with data scattered across multiple formats, inconsistent schemas, and varying quality levels. DataWeave AI addresses this by automating the tedious and error-prone process of data unification.

### Democratizing Data Analysis
Natural language interactions enable non-technical users to perform sophisticated analysis without coding, democratizing data insights across organizations.

### Time & Cost Efficiency
Manual data cleaning consumes significant resources. DataWeave AI reduces this burden, letting teams focus on deriving value from their data.

### AI-First Architecture
The application showcases modern AI integration using Gemini models for schema inference, code generation, and analytical reasoning—demonstrating how LLMs enhance traditional data workflows.

## 🏗️ Development Process

This application was built entirely within **Google AI Studio**, showcasing the platform's end-to-end development capabilities:

1. **Specification Design**: Brainstormed and refined the app specifications using Gemini 3 in the AI Studio playground
2. **Rapid Prototyping**: Created the initial application by pasting specifications into the **Build App** feature
3. **Iterative Development**: Debugging and feature refinement were conducted within AI Studio, leveraging the **Annotate App** feature for targeted feedback and the **automatic error fix** functionality for rapid issue resolution

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**Built with ❤️ using Google Gemini AI**

</div>

# DataWeave AI

<div align="center">

**AI 기반 데이터 통합 및 분석 플랫폼**

*Google Gemini AI를 활용하여 이질적인 데이터를 실행 가능한 인사이트로 변환*

[![React](https://img.shields.io/badge/React-19.2.1-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Google Gemini](https://img.shields.io/badge/Gemini-AI-8E75B2?logo=google&logoColor=white)](https://ai.google.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

### 🚀 [라이브 데모](https://aistudio.google.com/apps/drive/1N-Gg_jGwuR-W92wV-wpkkFKV06uyowcO?fullscreenApplet=true)

### 🎬 데모 영상

[![DataWeave AI Demo](https://img.youtube.com/vi/wpHIC7TzIKY/maxresdefault.jpg)](https://www.youtube.com/watch?v=wpHIC7TzIKY)

</div>

---

## 📖 개요

**DataWeave AI**는 Google Gemini AI를 활용하여 이질적인 데이터 소스의 통합, 정제, 분석을 자동화하는 지능형 웹 애플리케이션입니다. React, TypeScript, Vite로 구축되었으며, 복잡한 데이터 변환을 위한 5단계 워크플로우를 제공합니다.

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| � **스마트 파일 업로드** | Excel(.xlsx, .xls) 및 CSV 파일 지원, 시트 자동 감지 |
| 🧠 **AI 스키마 생성** | Gemini 모델을 사용하여 다양한 소스에서 통합 스키마 자동 생성 |
| 🧹 **지능형 데이터 정제** | AI 생성 변환 코드로 데이터 형식 표준화 |
| 📊 **고급 데이터 분석** | 자연어 쿼리로 AI 생성 시각화 및 인사이트 제공 |
| 📤 **유연한 내보내기** | 통합된 데이터를 CSV 파일로 내보내기 |

## 🚀 빠른 시작

### 사전 요구사항

- Node.js 18+
- npm 또는 yarn
- Google Gemini API 키

### 설치

1. **저장소 복제**
   ```bash
   git clone https://github.com/your-username/dataweave-ai.git
   cd dataweave-ai
   ```

2. **의존성 설치**
   ```bash
   npm install
   ```

3. **환경 변수 설정**
   ```bash
   echo "VITE_GEMINI_API_KEY=your_api_key_here" > .env.local
   ```

4. **개발 서버 시작**
   ```bash
   npm run dev
   ```

5. **브라우저에서 열기**
   
   `http://localhost:5173` 으로 이동

## 📂 프로젝트 구조

```
dataweave-ai/
├── App.tsx                 # 메인 애플리케이션 컴포넌트
├── index.tsx               # 애플리케이션 진입점
├── index.html              # HTML 템플릿
├── index.css               # 전역 스타일
├── types.ts                # TypeScript 타입 정의
├── components/
│   ├── UploadStage.tsx     # 파일 업로드 기능
│   ├── SchemaStage.tsx     # 스키마 생성 단계
│   ├── TransformStage.tsx  # 데이터 변환 단계
│   ├── AnalysisStage.tsx   # 데이터 분석 및 시각화
│   └── ui/                 # 재사용 가능한 UI 컴포넌트
├── services/
│   ├── geminiService.ts    # Gemini AI 통합
│   ├── excelService.ts     # Excel 파일 처리
│   ├── pythonService.ts    # Python 코드 실행
│   ├── groupingService.ts  # 데이터 그룹화 로직
│   ├── analysisContextService.ts  # 분석 컨텍스트 관리
│   └── schemaContextService.ts    # 스키마 컨텍스트 관리
└── vite.config.ts          # Vite 설정
```

## 🔄 워크플로우 단계

```mermaid
graph LR
    A[📁 업로드] --> B[📋 스키마]
    B --> C[🔄 변환]
    C --> D[📊 분석]
    D --> E[📤 내보내기]
```

1. **업로드** - Excel/CSV 파일 가져오기 및 시트 자동 감지
2. **스키마** - AI가 데이터 소스에서 통합 스키마 생성
3. **변환** - AI 생성 코드로 데이터 정제 및 표준화
4. **분석** - 자연어를 사용하여 데이터 쿼리
5. **내보내기** - 통합된 데이터셋을 CSV로 다운로드

## 🛠️ 기술 스택

- **프론트엔드**: React 19, TypeScript
- **빌드 도구**: Vite 6
- **AI 통합**: Google Gemini API (`@google/genai`)
- **파일 처리**: xlsx, jspdf, html2canvas
- **UI 컴포넌트**: Lucide React (아이콘)
- **마크다운**: react-markdown, remark-gfm

## 💡 중요성 및 영향

### 실제 데이터 과제 해결
조직은 여러 형식에 분산된 데이터, 일관성 없는 스키마, 다양한 품질 수준으로 어려움을 겪습니다. DataWeave AI는 지루하고 오류가 발생하기 쉬운 데이터 통합 프로세스를 자동화하여 이를 해결합니다.

### 데이터 분석 민주화
자연어 상호작용을 통해 비기술 사용자도 코딩 없이 정교한 분석을 수행할 수 있어, 조직 전체에 데이터 인사이트를 누구에게나 제공합니다.

### 시간 및 비용 효율성
수동 데이터 정제는 상당한 리소스를 소비합니다. DataWeave AI는 이 부담을 줄여 팀이 데이터에서 가치를 도출하는 데 집중할 수 있게 합니다.

### AI 우선 아키텍처
이 애플리케이션은 스키마 추론, 코드 생성, 분석적 추론을 위해 Gemini 모델을 사용하는 현대적인 AI 통합을 보여주며, LLM이 기존 데이터 워크플로우를 어떻게 향상시키는지 보여줍니다.

## 🏗️ 개발 과정

이 애플리케이션은 **Google AI Studio** 내에서 완전히 구축되어, 플랫폼의 엔드투엔드 개발 기능을 보여줍니다:

1. **사양 설계**: AI Studio 플레이그라운드에서 Gemini 3을 사용하여 앱 사양 구상 및 정제
2. **빠른 프로토타이핑**: **Build App** 기능에 사양을 붙여넣어 초기 애플리케이션 생성
3. **반복 개발**: AI Studio 내에서 디버깅 및 기능 개선, **Annotate App** 기능과 **자동 오류 수정** 기능 활용

## 📜 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 시작 |
| `npm run build` | 프로덕션용 빌드 |
| `npm run preview` | 프로덕션 빌드 미리보기 |

## 📄 라이센스

이 프로젝트는 [MIT 라이센스](LICENSE)로 라이센스됩니다.

---

<br>

# English Version

<div align="center">

**AI-Powered Data Unification & Analysis Platform**

*Leveraging Google Gemini AI to transform heterogeneous data into actionable insights*

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

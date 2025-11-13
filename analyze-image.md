# Analyze Image Feature - Code Module Analysis

## Overview
This document provides a comprehensive breakdown of all code modules involved in implementing the "Analyze Image" action feature on the Project page.

---

## 1. UI Entry Points (Project Page)

**File:** `src/routes/_authed/project.tsx`

**Key Components:**
- **Lines 60-64:** `AnalyzeImageIcon` component definition
- **Line 42:** Imports `ImageAnalyticsModal` component
- **Line 259:** State management: `showImageAnalytics`
- **Lines 1377-1383:** Desktop Dock button (Analyze Image)
- **Lines 1449-1458:** Mobile button (Analyze Image)
- **Lines 4560-4567:** Modal rendering

**Code Snippet:**
```typescript
// State management
const [showImageAnalytics, setShowImageAnalytics] = useState(false);

// Desktop Dock Icon
<DockIcon 
  onClick={() => setShowImageAnalytics(true)}
  title="Analyze Image"
>
  <AnalyzeImageIcon className="w-4 h-4" />
</DockIcon>

// Modal rendering
<ImageAnalyticsModal
  isOpen={showImageAnalytics}
  onClose={() => setShowImageAnalytics(false)}
  onTasksCreated={() => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }}
/>
```

---

## 2. Main Modal Component

**File:** `src/components/app/image-analytics-modal.tsx`

**Responsibilities:**
- Manages 3-step flow: Upload → Analyzing → Results
- Handles image upload (FileReader → base64)
- Calls AI analysis API
- Creates tasks from analysis results
- Error handling and loading states

**Key Functions:**
- `handleImageSelect()` - File selection handler
- `handleAnalyze()` - Triggers analysis
- `handleTasksSelect()` - Creates multiple tasks
- `handleSingleTaskCreate()` - Creates single task

**API Calls:**
- `orpc.ai.analyzeTaskImage.call()` - Analyzes image
- `orpc.ai.createTasksFromImage.call()` - Creates multiple tasks
- `orpc.ai.createTaskFromImage.call()` - Creates single task

---

## 3. Image Upload Component

**File:** `src/components/ui/image-upload.tsx`

**Features:**
- Drag & drop support
- File validation (type, size)
- Preview with file info
- Error handling

**Props:**
- `onImageSelect: (file: File) => void`
- `onImageRemove?: () => void`
- `selectedImage?: File | null`
- `maxSize?: number` (default: 10MB)
- `acceptedFormats?: string[]`

---

## 4. Analysis Results Display

**File:** `src/components/app/image-analysis-results.tsx`

**Features:**
- Displays extracted tasks with checkboxes
- Shows priority badges and time estimates
- Image preview toggle
- Select all/deselect all functionality
- Create individual or bulk tasks
- Analysis summary (confidence, task count, etc.)

---

## 5. Backend API Routes

**File:** `src/server/routes/ai.ts`

**Endpoints:**
1. `analyzeTaskImage` - Analyzes image and extracts tasks
2. `createTasksFromImage` - Creates multiple tasks from analysis
3. `createTaskFromImage` - Creates single task from analysis

**Router Registration:** `src/server/routes/index.ts` (line 40)

---

## 6. AI Analysis Engine

**File:** `src/lib/ai/image-analysis.ts`

**Core Function:** `analyzeTaskImage(imageUrl: string, context?: string)`

**Features:**
- Uses Anthropic Claude 3.7 Sonnet model
- Structured JSON output with Zod validation
- Extracts:
  - Individual tasks with priorities
  - Time estimates per task
  - Overall priority and total time
  - Confidence score (0-1)
  - Additional notes

**Schema Validation:**
- `ImageAnalysisSchema` - Validates AI response
- `ExtractedTaskSchema` - Validates individual tasks

---

## 7. Type Definitions

**File:** `src/types/task.ts`

**Interfaces:**
- `ImageAnalysisResult` - Analysis result structure
- `ExtractedTask` - Individual extracted task

**Helper Functions:**
- `parseAnalysisData()` - Parses stored analysis data
- `stringifyAnalysisData()` - Converts to JSON string
- `isTaskFromImageAnalysis()` - Checks if task came from image

---

## 8. ORPC Client Setup

**File:** `src/lib/orpc.ts`

- Creates oRPC client for API calls
- Handles authentication
- React Query integration

---

## Data Flow

```
1. User clicks "Analyze Image" button
   ↓
2. ImageAnalyticsModal opens
   ↓
3. User uploads image via ImageUpload component
   ↓
4. Image converted to base64 data URL
   ↓
5. User clicks "Analyze Image" button
   ↓
6. Calls orpc.ai.analyzeTaskImage.call({ imageUrl })
   ↓
7. Backend: src/server/routes/ai.ts → analyzeTaskImage handler
   ↓
8. Backend: Calls src/lib/ai/image-analysis.ts → analyzeTaskImage()
   ↓
9. AI: Anthropic Claude analyzes image via streamText()
   ↓
10. Response validated with Zod schema
   ↓
11. Returns ImageAnalysisResult to frontend
   ↓
12. ImageAnalysisResults component displays results
   ↓
13. User selects tasks and clicks "Create Tasks"
   ↓
14. Calls orpc.ai.createTasksFromImage.call()
   ↓
15. Backend creates tasks in database
   ↓
16. Tasks appear in task list (via query invalidation)
```

---

## Dependencies

- `@ai-sdk/anthropic` - Anthropic AI SDK
- `ai` - Vercel AI SDK (`streamText`)
- `zod` - Schema validation
- `@tanstack/react-query` - Data fetching/mutations
- `@orpc/client` - RPC client
- `sonner` - Toast notifications

---

## Key Files Summary

| File | Purpose | Lines |
|------|---------|-------|
| `src/routes/_authed/project.tsx` | Project page with Analyze Image button | ~4615 |
| `src/components/app/image-analytics-modal.tsx` | Main modal component | 348 |
| `src/components/app/image-analysis-results.tsx` | Results display component | 335 |
| `src/components/ui/image-upload.tsx` | Image upload UI component | 199 |
| `src/server/routes/ai.ts` | Backend API routes | 174 |
| `src/lib/ai/image-analysis.ts` | AI analysis engine | 319 |
| `src/types/task.ts` | Type definitions | ~104 |

---

## API Endpoints

### Analyze Task Image
- **Endpoint:** `/api/rpc/ai/analyzeTaskImage`
- **Method:** POST (via oRPC)
- **Input:**
  ```typescript
  {
    imageUrl: string;
    context?: string;
  }
  ```
- **Output:** `ImageAnalysisResult`

### Create Tasks From Image
- **Endpoint:** `/api/rpc/ai/createTasksFromImage`
- **Method:** POST (via oRPC)
- **Input:**
  ```typescript
  {
    imageUrl: string;
    analysisData: ImageAnalysisResult;
    selectedTasks: string[];
    defaultPriority?: 'low' | 'medium' | 'high';
    defaultHrs?: number;
  }
  ```
- **Output:** Array of created tasks

### Create Task From Image
- **Endpoint:** `/api/rpc/ai/createTaskFromImage`
- **Method:** POST (via oRPC)
- **Input:**
  ```typescript
  {
    imageUrl: string;
    analysisData: ImageAnalysisResult;
    taskText: string;
    priority?: 'low' | 'medium' | 'high';
    hrs?: number;
  }
  ```
- **Output:** Created task

---

## Error Handling

1. **Image Upload Errors:**
   - File type validation
   - File size validation (max 10MB)
   - Displayed via `ImageUpload` component

2. **Analysis Errors:**
   - Network errors
   - AI API errors
   - JSON parsing errors
   - Displayed in modal with error message

3. **Task Creation Errors:**
   - Database errors
   - Validation errors
   - Displayed via toast notifications

---

## Future Improvements

1. **Image Storage:**
   - Currently uses base64 data URLs
   - Could integrate with cloud storage (S3, Cloudinary, etc.)

2. **Batch Processing:**
   - Support multiple images at once
   - Batch analysis and task creation

3. **Analysis History:**
   - Store analysis results
   - Allow reusing previous analyses

4. **Enhanced AI Prompts:**
   - Context-aware analysis
   - Project-specific task extraction
   - Custom priority/time estimation rules


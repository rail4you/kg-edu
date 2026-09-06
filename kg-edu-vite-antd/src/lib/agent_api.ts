export interface AgentResponse {
  success: boolean;
  message?: string;
  data?: unknown;
  results?: unknown[];
}

export interface AgentFile {
  id: number;
  fileName: string;
  fileUrl: string;
  orgSchema: string | null;
  threadId: string | null;
  createdAt: string;
  updatedAt: string;
}

// 后端返回的是 PascalCase，需要转换为 camelCase
interface ApiAgentFile {
  Id: number;
  FileName: string;
  FileUrl: string;
  OrgSchema: string | null;
  ThreadId: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

const mapAgentFile = (item: ApiAgentFile): AgentFile => ({
  id: item.Id,
  fileName: item.FileName,
  fileUrl: item.FileUrl,
  orgSchema: item.OrgSchema,
  threadId: item.ThreadId,
  createdAt: item.CreatedAt,
  updatedAt: item.UpdatedAt,
});

export async function generateContent(
  _prompt: string,
  _options?: Record<string, unknown>,
): Promise<AgentResponse> {
  return { success: false, message: "Agent API not implemented" };
}

export async function streamGenerateContent(
  _prompt: string,
  _options?: Record<string, unknown>,
): Promise<AgentResponse> {
  return { success: false, message: "Agent API not implemented" };
}

export async function chat(
  _messages: Array<{ role: string; content: string }>,
  _options?: Record<string, unknown>,
): Promise<AgentResponse> {
  return { success: false, message: "Agent API not implemented" };
}

export async function generateAiExercise(
  config: {
    tenant: string;
    input: {
      courseId: string;
      knowledgeName: string;
      chapterName?: string;
      exerciseType: string;
      number: number;
      difficulty: number;
    };
    headers?: Record<string, string>;
  }
): Promise<AgentResponse> {
  try {
    const response = await fetch("/agent/api/generate_ai_exercise", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...config.headers,
      },
      body: JSON.stringify({
        tenant: config.tenant,
        input: config.input,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { success: false, message: error.message || "Failed to generate exercise" };
    }

    const data = await response.json();
    return { success: true, data, message: "练习题生成成功" };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to generate exercise"
    };
  }
}

export async function updateAnswerExplanation(
  config: {
    orgSchema: string;
    exerciseId: string;
    headers?: Record<string, string>;
  }
): Promise<AgentResponse> {
  try {
    const response = await fetch("/agent/update_answer_explanation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...config.headers,
      },
      body: JSON.stringify({
        orgSchema: config.orgSchema,
        exerciseId: config.exerciseId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { success: false, message: error.message || "Failed to update answer explanation" };
    }

    const data = await response.json();
    return { success: true, data, message: "答案解析生成成功" };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to update answer explanation"
    };
  }
}


export async function listAgentFiles(
  options?: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<AgentResponse> {
  try {
    const params = new URLSearchParams();
    if (options?.orgSchema) {
      params.append("orgSchema", options.orgSchema as string);
    }
    if (options?.threadId) {
      params.append("threadId", options.threadId as string);
    }

    const url = `/agent/agentfiles${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { success: false, error: error.error || "Failed to fetch files" };
    }

    const data = await response.json();
    // 将后端返回的 PascalCase 字段映射为 camelCase
    const mappedData = (data as ApiAgentFile[]).map(mapAgentFile);
    return { success: true, data: mappedData };
  } catch {
    return { success: false, error: "Failed to fetch files" };
  }
}

export async function deleteAgentFile(
  id: number,
  headers?: Record<string, string>,
): Promise<AgentResponse> {
  try {
    const response = await fetch(`/agent/agentfiles/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { success: false, error: error.error || "Failed to delete file" };
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting agent file:", error);
    return { success: false, error: "Failed to delete file" };
  }
}

// Preview types
export interface PreviewExercise {
  id: string;
  title?: string;
  questionContent: string;
  questionType: string;
  options?: string;
  answer?: string;
  points?: number;
  answerExplanation?: string;
}

export interface PreviewSection {
  questionType: string;
  questionTypeName: string;
  requestedCount: number;
  actualCount: number;
  exercises: PreviewExercise[];
}

export interface PreviewExamResponse {
  success: boolean;
  message: string;
  sections: PreviewSection[];
  courseId?: string;
  totalPoints?: number;
}

// API returns PascalCase, need to map to camelCase
interface ApiExercisePreview {
  Id: string;
  Title?: string;
  QuestionType: string;
  QuestionTypeName: string;
  Content: string;
  Options: string;
  Answer: string;
  Points: number;
}

interface ApiExamPreviewSection {
  QuestionType: string;
  QuestionTypeName: string;
  RequestedCount: number;
  ActualCount: number;
  Exercises: ApiExercisePreview[];
}

interface ApiExamPreviewResponse {
  Success: boolean;
  Message: string;
  CourseId: string;
  TotalPoints: number;
  Sections: ApiExamPreviewSection[];
}

const mapExercisePreview = (item: ApiExercisePreview): PreviewExercise => ({
  id: item.Id,
  questionType: item.QuestionType,
  questionContent: item.Content,
  title: item.Title || item.Content?.substring(0, 100) || "",
  options: item.Options,
  answer: item.Answer,
  points: item.Points,
});

const mapPreviewSection = (item: ApiExamPreviewSection): PreviewSection => ({
  questionType: item.QuestionType,
  questionTypeName: item.QuestionTypeName,
  requestedCount: item.RequestedCount,
  actualCount: item.ActualCount,
  exercises: (item.Exercises || []).map(mapExercisePreview),
});

export async function previewExam(
  input: {
    orgSchema: string;
    courseId: string;
    exerciseConfig: Record<string, { count: number; points: number; difficulties: number[] }>;
  },
  headers?: Record<string, string>,
): Promise<PreviewExamResponse> {
  try {
    const response = await fetch("/agent/exam/preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        orgSchema: input.orgSchema,
        courseId: input.courseId,
        exerciseConfig: input.exerciseConfig,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        message: error.message || "Failed to preview exam",
        sections: [],
      };
    }

    const data: ApiExamPreviewResponse = await response.json();
    return {
      success: data.Success,
      message: data.Message,
      courseId: data.CourseId,
      totalPoints: data.TotalPoints,
      sections: (data.Sections || []).map(mapPreviewSection),
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to preview exam",
      sections: [],
    };
  }
}

export async function generateReport(_input: unknown): Promise<AgentResponse> {
  return { success: false, message: "Agent API not implemented" };
}

export interface KnowledgePoint {
  id: string;
  name: string;
  enName: string;
  description: string;
  courseId: string;
}

export async function generateKnowledgePoints(
  config: {
    orgSchema: string;
    courseId: string;
    text: string;
    count: number;
  },
  headers?: Record<string, string>,
): Promise<AgentResponse> {
  try {
    const response = await fetch("/agent/knowledge/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { success: false, message: error.message || "Failed to generate knowledge points" };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to generate knowledge points"
    };
  }
}

export interface CompetencyGraphRequest {
  orgSchema: string;
  majorId: string;
  customPrompt: string;
}

export interface CompetencyGraphNodeData {
  id: string;
  name: string;
  description: string;
  category: string;
  level: number;
  parentId: string | null;
}

export interface CompetencyGraphResponse {
  success: boolean;
  message: string;
  data?: {
    nodes: CompetencyGraphNodeData[];
    savedCount: number;
  };
}

export async function generateCompetencyGraph(
  config: CompetencyGraphRequest,
  headers?: Record<string, string>,
): Promise<CompetencyGraphResponse> {
  try {
    const response = await fetch("/agent/competency-graph/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { success: false, message: error.error || error.message || "Failed to generate competency graph" };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to generate competency graph"
    };
  }
}

export interface CurriculumDocxRequest {
  orgSchema: string;
  majorId: string;
  customPrompt: string;
}

export interface CurriculumDocxResponse {
  success: boolean;
  message: string;
  data?: {
    curriculumId: string;
    title: string;
    downloadUrl: string;
    fileName: string;
    markdownPreview: string;
  };
}

export async function generateCurriculumDocx(
  config: CurriculumDocxRequest,
  headers?: Record<string, string>,
): Promise<CurriculumDocxResponse> {
  try {
    const response = await fetch("/curriculum/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { success: false, message: error.error || error.message || "Failed to generate curriculum" };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to generate curriculum"
    };
  }
}

// 兼容旧接口（保留但使用新端点）
export interface CurriculumDocxJobCreateResponse {
  success: boolean;
  message: string;
  data?: {
    jobId: string;
    status: "queued";
  };
}

export interface CurriculumDocxJobStatusResponse {
  success: boolean;
  message?: string;
  data?: {
    jobId: string;
    status: "queued" | "running" | "succeeded" | "failed";
    message: string;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    result?: {
      curriculumId: string;
      title: string;
      downloadUrl: string;
      fileName: string;
      markdownPreview: string;
    };
  };
}

export async function createCurriculumDocxJob(
  config: CurriculumDocxRequest,
  headers?: Record<string, string>,
): Promise<CurriculumDocxJobCreateResponse> {
  try {
    const response = await fetch("/api/curriculum/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(config),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        message: data.message || data.error || "Failed to create curriculum job",
      };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to create curriculum job",
    };
  }
}

export async function getCurriculumDocxJob(
  jobId: string,
  headers?: Record<string, string>,
): Promise<CurriculumDocxJobStatusResponse> {
  try {
    const response = await fetch(`/api/curriculum/jobs/${jobId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        message: data.message || data.error || "Failed to fetch curriculum job",
      };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch curriculum job",
    };
  }
}

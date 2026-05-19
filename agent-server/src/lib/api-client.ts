/**
 * KgEdu API 客户端
 * 通过 Phoenix 后端 AshTypescript RPC 接口获取数据
 *
 * RPC 格式: POST /rpc/run
 * Body: { action: string, tenant: string, fields: string[], filter?: {}, sort?: string, page?: {} }
 */

// 后端地址
const BACKEND_URL = process.env.KG_EDU_BACKEND_URL || "http://localhost:4000";
const AGENT_URL = process.env.KG_EDU_AGENT_URL || "http://localhost:5000";

// ---- 类型定义 ----

export interface Course {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  major: string | null;
  semester: string | null;
  publishStatus: boolean | null;
  semesterHours: number | null;
  credits: number | null;
  knowledgeResourcesCount: number;
}

export interface KnowledgeResource {
  id: string;
  name: string;
  description: string | null;
  importance: number | null;
  courseId: string;
  parentKnowledgeResourceId: string | null;
}

export interface Exercise {
  id: string;
  title: string;
  questionContent: string;
  questionType: string;
  options: string | null;
  answer: string | null;
  answerExplanation: string | null;
  difficulty: number | null;
  courseId: string | null;
  knowledgeResourceId: string | null;
}

export interface Exam {
  id: string;
  title: string;
  description: string | null;
  courseId: string | null;
  totalPoints: number | null;
  duration: number | null;
}

// ---- 租户上下文管理 ----

let currentOrgSchema = "";
let currentUserId = "";
let currentAuthToken = "";

export function setTenantContext(orgSchema: string, userId?: string, token?: string): void {
  if (orgSchema) currentOrgSchema = orgSchema;
  if (userId) currentUserId = userId;
  if (token) currentAuthToken = token;
}

export function getOrgSchema(): string {
  return currentOrgSchema;
}

export function getUserId(): string {
  return currentUserId;
}

// ---- 通用 RPC 请求 ----

interface RpcOptions {
  filter?: Record<string, unknown>;
  sort?: string;
  page?: { limit?: number; offset?: number };
  tenant?: string;
}

async function rpcRequest(
  action: string,
  fields: string[],
  options?: RpcOptions,
): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const tenant = options?.tenant || currentOrgSchema;

  const payload: Record<string, unknown> = {
    action,
    fields,
    ...(tenant && { tenant }),
    ...(options?.filter && { filter: options.filter }),
    ...(options?.sort && { sort: options.sort }),
    ...(options?.page && { page: options.page }),
  };

  if (currentAuthToken) {
    headers["Authorization"] = `Bearer ${currentAuthToken}`;
  }

  const response = await fetch(`${BACKEND_URL}/rpc/run`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RPC ${action} failed (${response.status}): ${text}`);
  }

  return response.json();
}

// ---- JSON API 请求 (课程有 JSON API 暴露) ----

async function jsonApiGet(
  type: string,
  id?: string,
  filters?: Record<string, string>,
  tenant?: string,
): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.api+json",
  };

  if (currentAuthToken) {
    headers["Authorization"] = `Bearer ${currentAuthToken}`;
  }

  let url = `${BACKEND_URL}/api/json/${type}`;
  if (id) {
    url += `/${id}`;
  }
  if (filters) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      params.append(`filter[${key}]`, value);
    }
    url += `?${params.toString()}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`JSON API ${type} failed (${response.status}): ${text}`);
  }

  return response.json();
}

// ---- Agent 后端 REST API (.NET Agent) ----

async function agentPost(
  path: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (currentOrgSchema) {
    headers["X-Org-Schema"] = currentOrgSchema;
  }

  const response = await fetch(`${AGENT_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Agent API ${path} failed (${response.status}): ${text}`);
  }

  return response.json();
}

// ---- 工具函数 ----

function mapJsonApiResource(item: any): any {
  if (!item?.attributes) return item;
  return { id: item.id, ...item.attributes };
}

function extractRpcResults(data: any): any[] {
  if (data?.results && Array.isArray(data.results)) return data.results;
  if (Array.isArray(data)) return data;
  if (data?.result) return [data.result];
  return [];
}

// ============================================================
// 课程 API
// ============================================================

export async function getCourses(tenant?: string): Promise<Course[]> {
  try {
    // 使用 get_all_courses (无需 actor 过滤，返回租户下所有课程)
    const data = await rpcRequest("get_all_courses", ["id", "title", "description", "imageUrl", "major", "semester", "publishStatus", "semesterHours", "credits", "knowledgeResourcesCount"], {
      tenant,
    }) as any;
    // get_all_courses 返回 { data: [...], success: true }
    if (Array.isArray(data?.data)) return data.data;
    return extractRpcResults(data);
  } catch (err) {
    console.error("[kg-edu] getCourses failed:", err);
    return [];
  }
}

export async function getCoursesByMajor(major: string, tenant?: string): Promise<Course[]> {
  const courses = await getCourses(tenant);
  return courses.filter((c) => c.major?.includes(major));
}

export async function getCoursesBySemester(semester: string, tenant?: string): Promise<Course[]> {
  const courses = await getCourses(tenant);
  return courses.filter((c) => c.semester === semester);
}

// ============================================================
// 知识资源 API
// ============================================================

export async function getKnowledgeResources(courseId?: string, tenant?: string): Promise<KnowledgeResource[]> {
  const filter: Record<string, unknown> = {};
  if (courseId) {
    filter.courseId = { eq: courseId };
  }

  try {
    const data = await rpcRequest("list_knowledges", ["id", "name", "description", "importance", "courseId", "parentKnowledgeResourceId"], {
      ...(Object.keys(filter).length > 0 ? { filter } : {}),
      page: { limit: 200 },
      tenant,
    }) as any;
    return extractRpcResults(data);
  } catch (err) {
    console.error("[kg-edu] getKnowledgeResources failed:", err);
    return [];
  }
}

export async function getKnowledgeResourceById(id: string, tenant?: string): Promise<KnowledgeResource | null> {
  try {
    const data = await rpcRequest("list_knowledges", ["id", "name", "description", "importance", "courseId", "parentKnowledgeResourceId"], {
      filter: { id: { eq: id } },
      page: { limit: 1 },
      tenant,
    }) as any;
    const results = extractRpcResults(data);
    return results[0] || null;
  } catch {
    return null;
  }
}

// ============================================================
// 练习题 API
// ============================================================

export async function getExercises(courseId?: string, knowledgeResourceId?: string, tenant?: string): Promise<Exercise[]> {
  const filter: Record<string, unknown> = {};
  if (courseId) filter.courseId = { eq: courseId };
  if (knowledgeResourceId) filter.knowledgeResourceId = { eq: knowledgeResourceId };

  try {
    const data = await rpcRequest("list_exercises", ["id", "title", "questionContent", "questionType", "options", "answer", "answerExplanation", "difficulty", "courseId", "knowledgeResourceId"], {
      ...(Object.keys(filter).length > 0 ? { filter } : {}),
      page: { limit: 200 },
      tenant,
    }) as any;
    return extractRpcResults(data);
  } catch (err) {
    console.error("[kg-edu] getExercises failed:", err);
    return [];
  }
}

export async function getExerciseById(id: string, tenant?: string): Promise<Exercise | null> {
  try {
    const data = await rpcRequest("get_exercise", ["id", "title", "questionContent", "questionType", "options", "answer", "answerExplanation", "difficulty", "courseId", "knowledgeResourceId"], {
      filter: { id: { eq: id } },
      tenant,
    }) as any;
    return data?.result || data || null;
  } catch {
    return null;
  }
}

// ============================================================
// 试卷 API
// ============================================================

export async function getExams(courseId?: string, tenant?: string): Promise<Exam[]> {
  const filter: Record<string, unknown> = {};
  if (courseId) filter.courseId = { eq: courseId };

  try {
    const data = await rpcRequest("list_exams", ["id", "title", "description", "courseId", "totalPoints", "duration"], {
      ...(Object.keys(filter).length > 0 ? { filter } : {}),
      page: { limit: 100 },
      tenant,
    }) as any;
    return extractRpcResults(data);
  } catch (err) {
    console.error("[kg-edu] getExams failed:", err);
    return [];
  }
}

export async function getExamById(id: string, tenant?: string): Promise<Exam | null> {
  try {
    const data = await rpcRequest("get_exam", ["id", "title", "description", "courseId", "totalPoints", "duration"], {
      filter: { id: { eq: id } },
      tenant,
    }) as any;
    return data?.result || data || null;
  } catch {
    return null;
  }
}

// ============================================================
// 创建练习题
// ============================================================

export async function createExercise(params: {
  title: string;
  questionContent: string;
  answer: string;
  questionType: string;
  options?: string;
  answerExplanation?: string;
  courseId?: string;
  knowledgeResourceId?: string;
}, tenant?: string): Promise<unknown> {
  const fields: Record<string, unknown> = {
    title: params.title,
    questionContent: params.questionContent,
    answer: params.answer,
    questionType: params.questionType,
  };
  if (params.options) fields.options = params.options;
  if (params.answerExplanation) fields.answerExplanation = params.answerExplanation;
  if (params.courseId) fields.courseId = params.courseId;
  if (params.knowledgeResourceId) fields.knowledgeResourceId = params.knowledgeResourceId;

  return rpcRequest("create_exercise", fields as any, { tenant });
}

// ============================================================
// 生成类 API (调用 .NET Agent 后端)
// ============================================================

export async function generatePptx(params: {
  orgSchema: string;
  courseName: string;
  knowledgeName?: string;
  courseId?: string;
  knowledgeResourceId?: string;
  author?: string;
  userRequirements?: string;
  userId?: string;
}): Promise<{ success: boolean; fileUrl?: string; fileId?: string; error?: string }> {
  return agentPost("/agent/skills/generate-pptx", params) as any;
}

export async function generateDocx(params: {
  orgSchema: string;
  content: string;
  courseId: string;
  fileName?: string;
  userId?: string;
  knowledgeResourceId?: string;
}): Promise<{ success: boolean; fileUrl?: string; fileId?: string; error?: string }> {
  return agentPost("/agent/skills/generate-docx", params) as any;
}

export async function generateExercises(params: {
  tenant: string;
  input: {
    courseId: string;
    knowledgeName: string;
    chapterName?: string;
    exerciseType: string;
    number: number;
    difficulty: number;
  };
}): Promise<{ success: boolean; data?: unknown; message?: string; error?: string }> {
  return agentPost("/agent/generate_ai_exercise", params) as any;
}

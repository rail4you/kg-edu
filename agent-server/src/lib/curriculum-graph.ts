/**
 * 课程体系生成服务
 *
 * 流程:
 * 1. 通过 RPC 获取专业信息 + 岗位数据 + 能力图谱
 * 2. 调 LLM 生成完整的课程体系设计
 * 3. 生成 DOCX 文档并上传到 OSS
 * 4. 创建 CurriculumDesign 记录
 * 5. 返回结果
 */

import { callRpc } from "./api-client.js";
import { convertMarkdownToDocx } from "./docx.js";
import { uploadFileToOss } from "./oss.js";
import { tmpdir } from "node:os";
import path from "node:path";
import fs from "node:fs";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
} from "@mariozechner/pi-coding-agent";

// ============================================================
// Pi SDK LLM 调用
// ============================================================

let _curriculumSession: any = null;

async function getCurriculumSession() {
  if (_curriculumSession) return _curriculumSession;

  const loader = new DefaultResourceLoader({
    systemPromptOverride: () => "你是高校课程体系设计专家，为专业生成结构化的课程体系方案。",
  });
  await loader.reload();

  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);
  await modelRegistry.refresh();

  const provider = process.env.PI_AGENT_MODEL_PROVIDER || "qwen";
  const modelId = process.env.PI_AGENT_MODEL_ID || "qwen-plus";
  const model = modelRegistry.find(provider, modelId);
  if (!model) {
    throw new Error(`[curriculum-graph] Model ${provider}/${modelId} not found in Pi SDK registry`);
  }
  console.log(`[curriculum-graph] Using model: ${model.id} (provider: ${model.provider})`);

  const { session } = await createAgentSession({
    authStorage,
    modelRegistry,
    sessionManager: SessionManager.inMemory(),
    resourceLoader: loader,
    model,
    noTools: true,
  });

  _curriculumSession = session;
  return session;
}

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const session = await getCurriculumSession();

  const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;
  console.log(`[curriculum-graph] Calling LLM via Pi SDK`);

  let result = "";
  session.subscribe((event: any) => {
    if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
      result += event.assistantMessageEvent.delta || "";
    }
  });

  await session.prompt(fullPrompt, { source: "user" });
  await session.agent.waitForIdle();

  if (!result) {
    const messages = session.agent.state?.messages || [];
    const lastAssistant = [...messages].reverse().find((m: any) => m.role === "assistant");
    if (lastAssistant?.content) {
      result = typeof lastAssistant.content === "string"
        ? lastAssistant.content
        : Array.isArray(lastAssistant.content)
          ? lastAssistant.content.filter((p: any) => p.type === "text").map((p: any) => p.text).join("")
          : "";
    }
  }

  console.log(`[curriculum-graph] LLM response length: ${result.length}`);
  return result;
}

// ============================================================
// LLM Prompt
// ============================================================

const SYSTEM_PROMPT = `你是高校课程体系设计专家。

你的任务是为一门专业设计完整的课程体系方案，包括：
1. 课程总体框架
2. 各学期课程安排
3. 每门课程的详细信息（名称、学分、类型、目标）
4. 实践教学环节设计

## 输出格式

请输出一个结构化的课程体系方案，格式如下：

### 一、培养目标
描述本专业的培养目标和毕业要求

### 二、课程总体框架
- 通识基础课程：X学分
- 专业基础课程：X学分  
- 专业核心课程：X学分
- 实践教学环节：X学分
- 选修课程：X学分
- **总计：X学分**

### 三、学期课程安排
按学期列出所有课程

#### 第一学期
| 课程名称 | 学分 | 类型 | 说明 |
|---------|-----|-----|------|
| 课程1   | X   | 通识 | ...  |

#### 第二学期
...

### 四、专业核心课程说明
详细描述每门核心课程的教学目标和主要内容

### 五、实践教学环节
- 课程实验
- 课程设计
- 实习实训
- 毕业设计

请严格按照上述格式输出，不要添加额外的格式符号（如markdown代码块）。`;

function buildUserPrompt(
  majorName: string,
  majorDescription: string,
  jobs: any[],
  competencies: any[],
  customPrompt?: string
): string {
  const jobsText = jobs.length > 0
    ? jobs.map((j: any) => `- ${j.title}`).join("\n")
    : "暂无岗位数据";

  const competenciesText = competencies.length > 0
    ? competencies.map((c: any) => `- ${c.name}`).join("\n")
    : "暂无能力数据";

  let prompt = `请为以下专业设计完整的课程体系：

## 专业信息
- **专业名称**: ${majorName}
- **专业描述**: ${majorDescription || "暂无描述"}

## 岗位需求（来自企业调研）
${jobsText}

## 能力素质要求（来自能力图谱）
${competenciesText}

## 用户自定义要求
${customPrompt || "无特殊要求，按常规标准设计课程体系。"}`;

  return prompt;
}

// ============================================================
// 主函数
// ============================================================

export interface CurriculumGenerateOptions {
  orgSchema: string;
  majorId: string;
  customPrompt?: string;
  userId?: string;
}

export interface CurriculumGenerateResult {
  success: boolean;
  message?: string;
  data?: {
    curriculumId: string;
    title: string;
    markdownPreview: string;
    downloadUrl: string;
    fileName: string;
  };
}

export async function generateCurriculumGraph(
  options: CurriculumGenerateOptions,
  tenant: string,
): Promise<CurriculumGenerateResult> {
  const { orgSchema, majorId, customPrompt } = options;

  console.log(`[curriculum-graph] Starting generation for major ${majorId} in tenant ${orgSchema || tenant}`);

  try {
    // 1. 获取专业信息
    const majorResult = await callRpc("get_major", {
      tenant: orgSchema || tenant,
      input: { id: majorId },
      fields: ["id", "name", "description", "code", "college"],
    });
    const major = majorResult?.result || majorResult?.data || majorResult;

    if (!major?.name) {
      return { success: false, message: "无法获取专业信息" };
    }

    console.log(`[curriculum-graph] Got major: ${major.name}`);

    // 2. 获取岗位数据
    const jobsResult = await callRpc("get_positions_by_major", {
      tenant: orgSchema || tenant,
      input: { major_id: majorId },
      fields: ["id", "title", "description"],
    });
    const jobs = jobsResult?.results || jobsResult?.data || (Array.isArray(jobsResult) ? jobsResult : []) || [];
    console.log(`[curriculum-graph] Got ${jobs.length} jobs`);

    // 3. 获取能力图谱
    const competenciesResult = await callRpc("get_competencies_by_major", {
      tenant: orgSchema || tenant,
      input: { major_id: majorId },
      fields: ["id", "name", "category", "level", "description"],
    });
    const competencies = competenciesResult?.results || competenciesResult?.data || (Array.isArray(competenciesResult) ? competenciesResult : []) || [];
    console.log(`[curriculum-graph] Got ${competencies.length} competencies`);

    // 3.1 获取微专业关联课程
    const coursesResult = await callRpc("list_major_courses_by_major", {
      tenant: orgSchema || tenant,
      input: { major_id: majorId },
      fields: ["id", "courseId", "courseType", "supportRole", "credit", { course: ["id", "title"] }],
    });
    const courses = coursesResult?.results || coursesResult?.data || (Array.isArray(coursesResult) ? coursesResult : []) || [];
    console.log(`[curriculum-graph] Got ${courses.length} courses for major`);

    // 3.2 获取能力-课程支撑关系
    const courseCompetencyMatrix = await buildCourseCompetencyMatrix(competencies, courses, tenant || (orgSchema || ""));

    // 4. 调用 LLM 生成课程体系
    const userPrompt = buildUserPrompt(
      major.name,
      major.description,
      jobs,
      competencies,
      customPrompt
    );

    const markdown = await callLLM(SYSTEM_PROMPT, userPrompt);

    // 4.1 在 Markdown 末尾添加课程-能力支撑矩阵
    const enhancedMarkdown = addCourseCompetencyMatrixToMarkdown(markdown, courseCompetencyMatrix, courses, competencies);

    // 5. 解析 LLM 返回的 Markdown，生成结构化数据
    const designData = parseCurriculumMarkdown(enhancedMarkdown);

    // 6. 生成 DOCX 文件
    const fileName = `${major.name || "课程体系"}_${Date.now()}.docx`;
    const docxPath = path.join(tmpdir(), fileName);

    await convertMarkdownToDocx(enhancedMarkdown, docxPath);

    // 7. 上传到 OSS
    const ossUrl = await uploadFileToOss(docxPath);

    // 清理临时文件
    await fs.promises.unlink(docxPath).catch(() => {});

    if (!ossUrl) {
      return { success: false, message: "文档生成失败：上传失败" };
    }

    console.log(`[curriculum-graph] Uploaded to OSS: ${ossUrl}`);

    // 8. 创建 CurriculumDesign 记录（包含课程-能力矩阵）
    const createResult = await callRpc("create_curriculum_design", {
      tenant: orgSchema || tenant,
      input: {
        title: `${major.name} - 课程体系设计`,
        description: "AI 辅助生成的课程体系方案",
        major_id: majorId,
        design_data: JSON.stringify({
          ...designData,
          courseCompetencyMatrix: courseCompetencyMatrix,
        }),
        file_url: ossUrl,
        markdown_content: enhancedMarkdown,
      },
      fields: ["id", "title", "description", "file_url", "status"],
    });

    const curriculumData = createResult?.result || createResult?.data || createResult;
    if (!curriculumData?.id) {
      return { success: false, message: "无法创建课程体系记录" };
    }

    const curriculumId = curriculumData.id;
    console.log(`[curriculum-graph] Created curriculum design: ${curriculumId}`);

    console.log(`[curriculum-graph] Successfully generated curriculum for major ${majorId}`);

    // 截取预览（前3000字符）
    const markdownPreview = markdown.length > 3000 ? markdown.slice(0, 3000) + "\n\n...(内容已截断)" : markdown;

    return {
      success: true,
      message: "课程体系生成成功",
      data: {
        curriculumId: String(curriculumId),
        title: curriculumData?.title || `${major.name} - 课程体系设计`,
        markdownPreview,
        downloadUrl: ossUrl || "",
        fileName,
      },
    };
  } catch (error: any) {
    console.error(`[curriculum-graph] Error:`, error);
    return { success: false, message: error.message || "生成失败" };
  }
}

// ============================================================
// 解析 Markdown 为结构化数据
// ============================================================

function parseCurriculumMarkdown(markdown: string): any {
  try {
    // 尝试解析 JSON 部分
    const jsonMatch = markdown.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // 默认返回原始 markdown
    return {
      markdown,
      generated_at: new Date().toISOString(),
    };
  } catch {
    return {
      markdown,
      generated_at: new Date().toISOString(),
    };
  }
}

// ============================================================
// 课程-能力支撑矩阵构建
// ============================================================

interface CourseInfo {
  id: string;
  courseId: string;
  courseType: string;
  supportRole: string;
  credit?: number;
  course?: { id: string; title: string };
}

interface CompetencyInfo {
  id: string;
  name: string;
  category: string;
  level: number;
}

interface CourseCompetencyEntry {
  courseId: string;
  courseName: string;
  competencyId: string;
  competencyName: string;
  supportLevel: string;
  supportDescription: string;
}

async function buildCourseCompetencyMatrix(
  competencies: CompetencyInfo[],
  courses: CourseInfo[],
  tenant: string
): Promise<CourseCompetencyEntry[]> {
  const matrix: CourseCompetencyEntry[] = [];

  for (const course of courses) {
    const courseTitle = course.course?.title || `课程${course.courseId}`;
    const courseId = course.courseId;

    // 获取该课程已关联的能力支撑关系
    const supports = await getCourseCompetencySupports(courseId, tenant);

    // 为每个相关能力创建矩阵条目
    for (const support of supports) {
      matrix.push({
        courseId,
        courseName: courseTitle,
        competencyId: support.competencyId,
        competencyName: support.competencyName,
        supportLevel: support.supportLevel,
        supportDescription: support.description || "",
      });
    }
  }

  return matrix;
}

async function getCourseCompetencySupports(
  courseId: string,
  tenant: string
): Promise<Array<{ competencyId: string; competencyName: string; supportLevel: string; description?: string }>> {
  try {
    // 使用新添加的 by_course 查询获取该课程的所有能力支撑关系
    const result = await callRpc("list_supports_by_course", {
      tenant,
      input: { course_id: courseId },
      fields: ["id", "majorCompetencyId", "courseId", "supportLevel", "description", { majorCompetency: ["id", "name"] }],
    });

    const supports = result?.results || result?.data || (Array.isArray(result) ? result : []) || [];

    return supports.map((s: any) => ({
      competencyId: s.majorCompetencyId || s.major_competency_id || s.majorCompetency?.id,
      competencyName: s.majorCompetency?.name || "",
      supportLevel: s.supportLevel || s.support_level || "secondary",
      description: s.description,
    }));
  } catch {
    return [];
  }
}

function addCourseCompetencyMatrixToMarkdown(
  markdown: string,
  matrix: CourseCompetencyEntry[],
  courses: CourseInfo[],
  competencies: CompetencyInfo[]
): string {
  if (matrix.length === 0) {
    return markdown;
  }

  // 按课程分组
  const byCourse = new Map<string, CourseCompetencyEntry[]>();
  for (const entry of matrix) {
    const existing = byCourse.get(entry.courseId) || [];
    existing.push(entry);
    byCourse.set(entry.courseId, existing);
  }

  // 生成 Markdown 表格
  const tableLines = [
    "\n\n## 六、课程-能力支撑矩阵\n",
    "| 课程名称 | 支撑能力 | 支撑级别 | 说明 |",
    "|---------|---------|---------|------|",
  ];

  for (const course of courses) {
    const courseId = course.courseId;
    const courseTitle = course.course?.title || `课程${courseId}`;
    const supports = byCourse.get(courseId) || [];

    if (supports.length === 0) {
      // 课程没有已知的支撑关系
      tableLines.push(`| ${courseTitle} | - | - | 暂无支撑关系 |`);
    } else {
      // 第一行显示课程名和第一个能力
      const first = supports[0];
      tableLines.push(`| ${courseTitle} | ${first.competencyName} | ${getSupportLevelLabel(first.supportLevel)} | ${first.supportDescription || ""} |`);

      // 后续行只显示支撑关系
      for (let i = 1; i < supports.length; i++) {
        const s = supports[i];
        tableLines.push(`| | ${s.competencyName} | ${getSupportLevelLabel(s.supportLevel)} | ${s.supportDescription || ""} |`);
      }
    }
  }

  return markdown + tableLines.join("\n");
}

function getSupportLevelLabel(level: string): string {
  const labels: Record<string, string> = {
    "primary": "主要支撑",
    "secondary": "辅助支撑",
    "practice": "实践支撑",
    "core": "核心课程",
    "supporting": "支撑课程",
    "practice_course": "实践课程",
  };
  return labels[level] || level;
}
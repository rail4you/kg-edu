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

    // 4. 调用 LLM 生成课程体系
    const userPrompt = buildUserPrompt(
      major.name,
      major.description,
      jobs,
      competencies,
      customPrompt
    );

    const markdown = await callLLM(SYSTEM_PROMPT, userPrompt);

    // 5. 解析 LLM 返回的 Markdown，生成结构化数据
    const designData = parseCurriculumMarkdown(markdown);

    // 6. 生成 DOCX 文件
    const fileName = `${major.name || "课程体系"}_${Date.now()}.docx`;
    const docxPath = path.join(tmpdir(), fileName);

    await convertMarkdownToDocx(markdown, docxPath);

    // 7. 上传到 OSS
    const ossUrl = await uploadFileToOss(docxPath);

    // 清理临时文件
    await fs.promises.unlink(docxPath).catch(() => {});

    if (!ossUrl) {
      return { success: false, message: "文档生成失败：上传失败" };
    }

    console.log(`[curriculum-graph] Uploaded to OSS: ${ossUrl}`);

    // 8. 创建 CurriculumDesign 记录
    const createResult = await callRpc("create_curriculum_design", {
      tenant: orgSchema || tenant,
      input: {
        title: `${major.name} - 课程体系设计`,
        description: "AI 辅助生成的课程体系方案",
        major_id: majorId,
        design_data: JSON.stringify(designData),
        file_url: ossUrl,
        markdown_content: markdown,
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
/**
 * 能力图谱生成服务
 *
 * 流程:
 * 1. 通过 RPC 获取专业信息 + 岗位数据 + 已有能力节点
 * 2. 调 LLM 生成树形能力图谱 JSON
 * 3. 删除该专业已有的 AI 生成能力节点
 * 4. 通过 RPC create_competency 逐条写入新节点
 * 5. 返回生成结果
 */

import { callRpc, getOrgSchema } from "./api-client.js";
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

let _competencySession: any = null;

async function getCompetencySession() {
  if (_competencySession) return _competencySession;

  const loader = new DefaultResourceLoader({
    systemPromptOverride: () => "你是专业能力素质图谱构建专家，只返回 JSON 格式的图谱数据。",
  });
  await loader.reload();

  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);
  await modelRegistry.refresh();

  const provider = process.env.PI_AGENT_MODEL_PROVIDER || "qwen";
  const modelId = process.env.PI_AGENT_MODEL_ID || "qwen-plus";
  const model = modelRegistry.find(provider, modelId);
  if (!model) {
    throw new Error(`[competency-graph] Model ${provider}/${modelId} not found in Pi SDK registry`);
  }
  console.log(`[competency-graph] Using model: ${model.id} (provider: ${model.provider})`);

  const { session } = await createAgentSession({
    authStorage,
    modelRegistry,
    sessionManager: SessionManager.inMemory(),
    resourceLoader: loader,
    model,
    noTools: true,
  });

  _competencySession = session;
  return session;
}

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const session = await getCompetencySession();

  const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;
  console.log(`[competency-graph] Calling LLM via Pi SDK`);

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

  console.log(`[competency-graph] LLM response length: ${result.length}`);
  return result;
}

// ============================================================
// LLM Prompt
// ============================================================

const SYSTEM_PROMPT = `你是高校专业能力素质图谱构建专家。

你的任务是根据专业信息、岗位数据和行业标准，构建完整的专业能力素质图谱。

## 能力分类

能力分为三大类：
- **professional**: 专业能力 — 本专业核心技术技能
- **general**: 通用能力 — 沟通、团队协作、创新思维等
- **practical**: 实践能力 — 实验操作、项目实践、实习实训等

## 输出格式

返回 JSON 数组，每个节点包含：
- name: 能力名称（简洁明确）
- description: 能力描述（50-100字）
- category: "professional" | "general" | "practical"
- level: 层级，0=一级能力（顶层分类），1=二级能力（子类），2=三级能力（具体技能）
- parentId: 父节点 name（一级节点为 null）

## 构建原则

1. 一级节点（level 0）通常是 3-5 个大类，如"专业核心能力""通用基础能力""实践应用能力"
2. 二级节点（level 1）是各一级能力的细分方向，每个一级节点下 3-6 个
3. 三级节点（level 2）是具体可衡量的能力点，每个二级节点下 2-5 个
4. 总节点数建议 25-50 个
5. 能力描述要具体，便于后续课程体系映射
6. 必须有 parent-child 结构，形成树形`;

// ============================================================
// 主生成函数
// ============================================================

interface CompetencyNodeInput {
  name: string;
  description: string;
  category: string;
  level: number;
  parentId: string | null;
}

export async function generateCompetencyGraph(
  params: {
    orgSchema: string;
    majorId: string;
    customPrompt?: string;
  },
  tenant?: string,
): Promise<{
  success: boolean;
  message: string;
  data?: {
    nodes: CompetencyNodeInput[];
    savedCount: number;
  };
}> {
  const orgSchema = tenant || params.orgSchema || getOrgSchema();
  if (!orgSchema) {
    return { success: false, message: "未设置租户上下文" };
  }

  try {
    // 1. 获取专业信息
    console.log(`[competency-graph] Fetching major info for ${params.majorId}`);
    const majorData = await callRpc("get_major", {
      tenant: orgSchema,
      input: { id: params.majorId },
      fields: ["id", "name", "code", "description", "college", "degreeType", "duration"],
    });
    const major = majorData?.result || majorData?.data || majorData;
    if (!major?.name) {
      return { success: false, message: "未找到专业信息" };
    }
    console.log(`[competency-graph] Major: ${major.name}`);

    // 2. 获取岗位数据
    let jobsText = "";
    try {
      const jobsData = await callRpc("get_positions_by_major", {
        tenant: orgSchema,
        input: { major_id: params.majorId },
        fields: ["id", "title", "description", "requirements"],
      });
      const jobs = jobsData?.results || jobsData?.data || (Array.isArray(jobsData) ? jobsData : []);
      if (Array.isArray(jobs) && jobs.length > 0) {
        jobsText = `\n\n## 相关岗位数据\n${jobs.slice(0, 10).map((j: any) =>
          `- **${j.title || ""}**: ${j.description || ""} 要求: ${j.requirements || ""}`
        ).join("\n")}`;
      }
    } catch {
      console.log("[competency-graph] No job position data available");
    }

    // 3. 获取已有能力节点（用于参考）
    let existingText = "";
    try {
      const existingData = await callRpc("get_competencies_by_major", {
        tenant: orgSchema,
        input: { major_id: params.majorId },
        fields: ["id", "name", "category", "level"],
      });
      const existing = existingData?.results || existingData?.data || [];
      if (Array.isArray(existing) && existing.length > 0) {
        existingText = `\n\n## 已有能力节点（${existing.length}个，供参考优化）\n${
          existing.slice(0, 20).map((n: any) => `- ${n.name} (${n.category || "professional"}, level ${n.level || 0})`).join("\n")
        }`;
      }
    } catch {
      console.log("[competency-graph] No existing competency data");
    }

    // 4. 构建 prompt
    const customPromptSection = params.customPrompt
      ? `\n\n## 用户自定义要求\n${params.customPrompt}`
      : "";

    const userPrompt = `请为以下专业构建完整的能力素质图谱：

## 专业信息
- 专业名称：${major.name}
- 专业代码：${major.code || "未设置"}
- 所属学院：${major.college || "未设置"}
- 学位类型：${major.degreeType || "未设置"}
- 学制：${major.duration ? major.duration + "年" : "未设置"}
- 专业描述：${major.description || "暂无描述"}
${jobsText}${existingText}${customPromptSection}

请直接返回 JSON 数组，不要包裹在代码块中。每个节点必须有 name, description, category, level, parentId 字段。`;

    // 5. 调 LLM
    const responseText = await callLLM(SYSTEM_PROMPT, userPrompt);

    // 6. 解析 JSON
    const nodes = parseCompetencyJson(responseText);
    if (!nodes || nodes.length === 0) {
      return { success: false, message: "AI 未能生成有效的图谱数据" };
    }

    console.log(`[competency-graph] Parsed ${nodes.length} nodes`);

    // 7. 删除已有的 AI 生成节点
    try {
      const existingAll = await callRpc("get_competencies_by_major", {
        tenant: orgSchema,
        input: { major_id: params.majorId },
        fields: ["id", "aiGenerated"],
      });
      const existingNodes = existingAll?.results || existingAll?.data || [];
      if (Array.isArray(existingNodes)) {
        // 收集所有节点（包括子节点）
        const allExisting: any[] = [];
        for (const n of existingNodes) {
          allExisting.push(n);
          if (n.children && Array.isArray(n.children)) {
            allExisting.push(...n.children);
          }
        }
        // 先删除子节点，再删除父节点
        const aiNodes = allExisting.filter((n: any) => n.aiGenerated || n.ai_generated);
        // 按 level 降序排序，先删子节点
        const sorted = aiNodes.sort((a: any, b: any) => (b.level || 0) - (a.level || 0));
        for (const node of sorted) {
          try {
            await callRpc("delete_competency", {
              tenant: orgSchema,
              input: { id: node.id },
              fields: ["id"],
            });
          } catch {
            // 忽略单个删除错误
          }
        }
        if (sorted.length > 0) {
          console.log(`[competency-graph] Deleted ${sorted.length} old AI-generated nodes`);
        }
      }
    } catch (err) {
      console.warn("[competency-graph] Failed to delete old nodes:", err);
    }

    // 8. 保存新节点（先保存一级节点，再保存子节点）
    const savedNodes: CompetencyNodeInput[] = [];
    const nameToIdMap = new Map<string, string>();

    // 按 level 排序，确保父节点先创建
    const sortedNodes = [...nodes].sort((a, b) => a.level - b.level);

    for (const node of sortedNodes) {
      try {
        const parentId = node.parentId ? nameToIdMap.get(node.parentId) || null : null;

        const result = await callRpc("create_competency", {
          tenant: orgSchema,
          input: {
            name: node.name,
            description: node.description,
            category: node.category,
            level: String(node.level),
            weight: node.level === 0 ? 1.0 : node.level === 1 ? 0.8 : 0.5,
            ai_generated: true,
            major_id: params.majorId,
            parent_id: parentId,
          },
          fields: ["id", "name"],
        });

        const created = result?.result || result?.data || result;
        if (created?.id) {
          nameToIdMap.set(node.name, created.id);
          savedNodes.push(node);
        }
      } catch (err: any) {
        console.warn(`[competency-graph] Failed to save node "${node.name}":`, err?.message);
      }
    }

    console.log(`[competency-graph] Saved ${savedNodes.length}/${nodes.length} nodes`);

    // 9. 自动生成能力-课程支撑关系（仅当微专业有关联课程时）
    try {
      await generateCompetencyCourseSupports(params.majorId, savedNodes, tenant || orgSchema);
    } catch (err: any) {
      console.warn("[competency-graph] Failed to generate course supports:", err?.message);
      // 不影响主流程，仅警告
    }

    return {
      success: true,
      message: `能力图谱生成成功，共生成 ${savedNodes.length} 个能力节点`,
      data: {
        nodes: savedNodes,
        savedCount: savedNodes.length,
      },
    };
  } catch (err: any) {
    console.error("[competency-graph] Generation failed:", err?.message || err);
    return {
      success: false,
      message: err?.message || "能力图谱生成失败",
    };
  }
}

// ============================================================
// 能力-课程支撑关系自动生成
// ============================================================

interface CompetencyCourseSupport {
  competencyId: string;
  competencyName: string;
  courseId: string;
  courseName: string;
  supportLevel: "primary" | "secondary" | "practice";
  weight: number;
  description: string;
}

async function generateCompetencyCourseSupports(
  majorId: string,
  competencies: CompetencyNodeInput[],
  tenant: string
): Promise<void> {
  // 1. 获取微专业关联的课程
  const coursesResult = await callRpc("list_major_courses_by_major", {
    tenant,
    input: { major_id: majorId },
    fields: ["id", "majorId", "courseId", "courseType", "supportRole", "sortOrder", "credit"],
  });
  
  const courses = coursesResult?.results || coursesResult?.data || [];
  if (!Array.isArray(courses) || courses.length === 0) {
    console.log("[competency-graph] No courses linked to major, skipping course supports generation");
    return;
  }
  
  console.log(`[competency-graph] Found ${courses.length} courses for major ${majorId}`);

  // 2. 构建能力与课程的支撑关系
  // 策略：
  // - 核心课程 (supportRole=core) 主要支撑专业能力 (category=professional)
  // - 实践课程 (supportRole=practice) 主要支撑实践能力 (category=practical)
  // - 支撑课程 (supportRole=supporting) 支撑各类能力
  const supports: CompetencyCourseSupport[] = [];

  for (const competency of competencies) {
    // 跳过一级节点（不直接支撑课程）
    if (competency.level === 0) continue;

    // 按能力类别分配课程
    const matchingCourses = courses.filter((course: any) => {
      switch (competency.category) {
        case "professional":
          return course.supportRole === "core" || course.supportRole === "supporting";
        case "practical":
          return course.supportRole === "practice" || course.supportRole === "supporting";
        case "general":
          return true; // 通用能力任何课程都可以支撑
        default:
          return false;
      }
    });

    // 每个能力分配最多3门课程
    const selectedCourses = matchingCourses.slice(0, 3);
    
    for (const course of selectedCourses) {
      const supportLevel = course.supportRole === "core" ? "primary" : 
                          course.supportRole === "practice" ? "practice" : "secondary";
      const weight = course.supportRole === "core" ? 1.0 : 0.7;
      
      supports.push({
        competencyId: nameToIdMap.get(competency.name) || "",
        competencyName: competency.name,
        courseId: course.courseId,
        courseName: "",
        supportLevel: supportLevel as any,
        weight,
        description: `${competency.name}由${course.supportRole === "core" ? "核心" : course.supportRole === "practice" ? "实践" : "支撑"}课程"${course.courseId}"支撑`,
      });
    }
  }

  console.log(`[competency-graph] Generated ${supports.length} course supports`);

  // 3. 保存支撑关系
  // 先获取能力节点 ID 映射
  if (!nameToIdMap || nameToIdMap.size === 0) {
    console.log("[competency-graph] No competency ID map, cannot create supports");
    return;
  }

  for (const support of supports) {
    const competencyId = nameToIdMap.get(support.competencyName);
    if (!competencyId) continue;

    try {
      await callRpc("create_competency_course_support", {
        tenant,
        input: {
          major_competency_id: competencyId,
          course_id: support.courseId,
          support_level: support.supportLevel,
          description: support.description,
          weight: support.weight,
        },
        fields: ["id", "majorCompetencyId", "courseId"],
      });
    } catch (err: any) {
      console.warn(`[competency-graph] Failed to create course support:`, err?.message);
    }
  }

  console.log(`[competency-graph] Created ${supports.length} competency-course support records`);
}

// ============================================================
// JSON 解析
// ============================================================

function parseCompetencyJson(text: string): CompetencyNodeInput[] | null {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

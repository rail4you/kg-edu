/**
 * 练习题生成服务
 * 从 .NET Agent 的 AgentController.GenerateAiExercise 迁移
 *
 * 流程:
 * 1. 查询已有练习题标题（避免重复）
 * 2. 调 LLM 生成 JSON 格式练习题
 * 3. 解析 JSON，去重标题
 * 4. 通过 Phoenix RPC create_exercise 逐条写入
 */

import { getExercises, callRpc, getOrgSchema } from "./api-client.js";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
} from "@mariozechner/pi-coding-agent";

// ============================================================
// Pi SDK LLM 调用（复用 Pi Agent 的模型配置和认证）
// ============================================================

let _exerciseSession: any = null;

async function getExerciseSession() {
  if (_exerciseSession) return _exerciseSession;

  const loader = new DefaultResourceLoader({
    systemPromptOverride: () => "你是练习题生成专家，只返回 JSON 格式的练习题数据。",
  });
  await loader.reload();

  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);
  await modelRegistry.refresh();

  // 与 pi-agent-gateway 保持一致：优先环境变量，fallback 到 qwen
  const provider = process.env.PI_AGENT_MODEL_PROVIDER || "qwen";
  const modelId = process.env.PI_AGENT_MODEL_ID || "qwen-plus";
  const model = modelRegistry.find(provider, modelId);
  if (!model) {
    throw new Error(`[exercise] Model ${provider}/${modelId} not found in Pi SDK registry`);
  }
  console.log(`[exercise] Using model: ${model.id} (provider: ${model.provider})`);

  const { session } = await createAgentSession({
    authStorage,
    modelRegistry,
    sessionManager: SessionManager.inMemory(),
    resourceLoader: loader,
    model,
    noTools: true,
  });

  _exerciseSession = session;
  return session;
}

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const session = await getExerciseSession();

  const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;
  console.log(`[exercise] Calling LLM via Pi SDK`);

  // 收集 assistant 响应
  let result = "";
  session.subscribe((event: any) => {
    if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
      result += event.assistantMessageEvent.delta || "";
    }
  });

  await session.prompt(fullPrompt, { source: "user" });
  await session.agent.waitForIdle();

  // 从 session state 取最终 assistant 消息作为 fallback
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

  console.log(`[exercise] LLM response length: ${result.length}`);
  return result;
}

  console.log(`[exercise] LLM response length: ${result.length}`);
  return result;
}

// ============================================================
// Exercise 生成指令
// ============================================================

const EXERCISE_INSTRUCTION = `你是一位练习题生成专家，专门根据知识点和练习题类型生成高质量的练习题。

## 你的任务

1. **理解知识点**：理解用户提供的知识点名称和章节信息
2. **生成练习题**：根据练习题类型生成相应数量的练习题
3. **设置难度**：根据难度级别（1-5）调整题目难度
4. **设置选项**：对于选择题，生成合理的选项
5. **提供答案**：为每道题提供正确答案
6. **答案解析**：为每道题提供详细的答案解析

## 练习题类型

- **multiple_choice**: 单选题，4个选项，1个正确答案
- **multiple_response**: 多选题，4个选项，2+正确答案，answer用逗号分隔字母
- **true_false**: 判断题，选项固定 "A. 正确\\nB. 错误"，answer为A或B
- **fill_in_blank**: 填空题
- **essay**: 问答题
- **term_definition**: 名词解释
- **case_study**: 案例题

## 输出格式

直接返回JSON数组，不要包裹在代码块中。每道题包含:
- title: 题目标题（必须唯一，有意义）
- questionContent: 题目内容
- answer: 正确答案
- answerExplanation: 答案解析
- questionType: 题目类型
- options: 选项（选择题/多选题/判断题，其他类型可为null）
- difficulty: 难度级别(1-5)`;

// ============================================================
// 主生成函数
// ============================================================

export interface GenerateExercisesParams {
  courseId: string;
  knowledgeName: string;
  chapterName?: string;
  exerciseType: string;
  number: number;
  difficulty?: number;
}

export interface GeneratedExercise {
  title: string;
  questionContent: string;
  answer: string;
  answerExplanation?: string;
  questionType: string;
  options?: string;
  difficulty?: number;
}

export async function generateExercises(
  params: GenerateExercisesParams,
  tenant?: string,
): Promise<{
  success: boolean;
  exercises?: any[];
  message?: string;
  error?: string;
}> {
  const orgSchema = tenant || getOrgSchema();
  if (!orgSchema) {
    return { success: false, error: "未设置租户上下文" };
  }

  try {
    // 1. 获取已有练习题标题
    const existing = await getExercises(params.courseId, undefined, orgSchema);
    const existingTitles = new Set(
      existing.map((e) => e.title).filter(Boolean).map((t) => t!.toLowerCase()),
    );
    console.log(`[exercise] Found ${existingTitles.size} existing titles`);

    // 2. 构建已有标题列表
    const existingTitlesText =
      existingTitles.size > 0
        ? `\n\n**已存在的题目标题（禁止重复）：**\n${[...existingTitles]
            .slice(0, 20)
            .map((t, i) => `${i + 1}. ${t}`)
            .join("\n")}` +
          (existingTitles.size > 20 ? `\n... 还有 ${existingTitles.size - 20} 个` : "")
        : "";

    // 3. 构建 prompt
    const prompt = `请根据以下信息生成${params.number}道练习题：

知识点名称：${params.knowledgeName}
章节：${params.chapterName || "未指定"}
练习题类型：${params.exerciseType}
难度级别：${params.difficulty || 3}（1=简单，5=困难）
${existingTitlesText}

要求：
1. 生成的题目要与知识点紧密相关
2. 题目难度符合指定的难度级别
3. 选择题的选项要合理且有迷惑性
4. 多选题(multiple_response)必须有2个或以上正确答案，answer用逗号分隔字母
5. 判断题(true_false)选项固定为"A. 正确\\nB. 错误"，answer为A或B
6. 名词解释(term_definition)的questionContent中给出术语，answer给完整解释
7. 每道题都有明确的正确答案和详细的答案解析
8. **题目标题必须唯一且有意义，不能与已有标题重复**
9. 直接返回JSON数组

JSON格式示例：
[{
  "title": "题目标题",
  "questionContent": "题目内容",
  "answer": "正确答案",
  "answerExplanation": "答案解析",
  "questionType": "multiple_choice",
  "options": "A. 选项1\\nB. 选项2\\nC. 选项3\\nD. 选项4",
  "difficulty": 2
}]`;

    // 4. 调 LLM 生成
    const responseText = await callLLM(EXERCISE_INSTRUCTION, prompt);
    console.log(`[exercise] LLM response length: ${responseText.length}`);

    // 5. 解析 JSON
    const exerciseData = parseExerciseJson(responseText);
    if (!exerciseData || exerciseData.length === 0) {
      return { success: false, error: "LLM 未返回有效的练习题数据" };
    }

    // 6. 处理 options 格式 + 标题去重 + 写入数据库
    const created: any[] = [];
    for (const data of exerciseData) {
      let title = data.title || `${params.exerciseType}_${Date.now()}`;

      // 标题去重
      if (existingTitles.has(title.toLowerCase())) {
        let suffix = 2;
        let newTitle = `${title}（${suffix}）`;
        while (existingTitles.has(newTitle.toLowerCase())) {
          suffix++;
          newTitle = `${title}（${suffix}）`;
        }
        title = newTitle;
      }
      existingTitles.add(title.toLowerCase());

      // 处理 options
      const optionsJson = processOptions(data);

      // 通过 RPC 创建练习题
      try {
        const result = await callRpc("create_exercise", {
          tenant: orgSchema,
          input: {
            title,
            question_content: data.questionContent,
            answer: data.answer,
            answer_explanation: data.answerExplanation || "",
            question_type: data.questionType || params.exerciseType,
            options: optionsJson,
            course_id: params.courseId,
            difficulty: data.difficulty || params.difficulty || 3,
            ai_type: "ai_generated",
          },
          fields: ["id", "title"],
        });
        created.push({ id: result?.id, title, ...data });
      } catch (err: any) {
        console.warn(`[exercise] Failed to create exercise "${title}":`, err?.message);
      }
    }

    return {
      success: true,
      message: `练习题生成成功，共生成 ${created.length} 道题`,
      exercises: created,
    };
  } catch (err: any) {
    console.error("[exercise] Generation failed:", err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
}

// ============================================================
// JSON 解析
// ============================================================

function parseExerciseJson(text: string): GeneratedExercise[] | null {
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

// ============================================================
// Options 处理（与 .NET Agent 逻辑一致）
// ============================================================

function processOptions(data: GeneratedExercise): string | null {
  const qt = (data.questionType || "").toLowerCase();
  if (!data.options) return null;

  if (qt === "true_false") {
    return JSON.stringify({ choices: ["A. 正确", "B. 错误"] });
  }

  if (qt === "multiple_choice" || qt === "multiple_response") {
    const choices = data.options
      .split(/[\n\\]/)
      .map((o) => o.trim())
      .filter(Boolean);

    if (choices.length === 0) return null;

    if (qt === "multiple_response") {
      const answerLetters = (data.answer || "")
        .split(/[,，\s;]+/)
        .map((a) => a.trim().toUpperCase())
        .filter((a) => a.length === 1 && a.charCodeAt(0) >= 65 && a.charCodeAt(0) <= 68)
        .map((a) => a.charCodeAt(0) - 65);

      return JSON.stringify({ choices, correctAnswers: answerLetters });
    }

    return JSON.stringify({ choices });
  }

  return null;
}

/** P3: AI 实践 6 场景配置 + 轻量 SSE 对话 + 安全公式求值 */

export type ScenarioKey =
  | "dialogue"
  | "work_upload"
  | "thinking_ladder"
  | "debate_arena"
  | "code_editor"
  | "interactive_story";

export const SCENARIOS: Array<{
  key: ScenarioKey;
  name: string;
  desc: string;
  systemPrompt: string;
  placeholder: string;
  inputKind: "chat" | "code" | "upload";
  template: string;
}> = [
  {
    key: "dialogue",
    name: "情景对话",
    desc: "AI 扮演情境角色，与学生实时对话练习",
    systemPrompt:
      "你是情景对话陪练官。根据学生的话题设定一个生活/职场/校园情境并扮演其中角色，用中文与学生多轮对话，每轮回复后给出一个简短的表达建议。",
    placeholder: "先设定一个情境，如：在餐厅点餐",
    inputKind: "chat",
    template: "情境：你是一名面试官，正在面试一位刚毕业的学生。请你先向我提问三个面试问题。",
  },
  {
    key: "work_upload",
    name: "上传作品",
    desc: "学生粘贴作品文本，AI 实时点评打分",
    systemPrompt:
      "你是作品评审专家。学生通过粘贴文本提交作品（作文/设计说明/实验报告/代码等）。请直接依据所粘贴的文本内容进行评审，不要索取截图、文档文件或额外材料。输出结构：1) 简要点评（完整性、规范性、创新性各一句）；2) 百分制评分；3) 三条具体可操作的改进建议。若文本较短或信息不足，请基于现有文本给出明确的初步评分与建议，并在末尾用一句话说明如能补充更多内容可提升评分，但不要要求学生提供其他形式材料。",
    placeholder: "粘贴你的作品文本",
    inputKind: "upload",
    template: "我的作品：《基于校园二手交易的小程序设计方案》\n功能：学生注册登录、发布闲置物品、按分类检索、在线聊天议价、线下自提。\n设计思路：采用前后端分离，前端用微信小程序，后端用 Python + 数据库。创新点：引入校园信用评分，交易完成后买卖双方互评，信用分高的用户可优先展示。",
  },
  {
    key: "thinking_ladder",
    name: "思维阶梯",
    desc: "AI 逐级追问，引导思维层层递进",
    systemPrompt:
      "你是思维教练。围绕学生提出的问题，用苏格拉底式追问引导其从现象到本质逐级深入，每次只问一个关键问题，并肯定其上一轮思考的进步。",
    placeholder: "提出你想深入思考的问题",
    inputKind: "chat",
    template: "我想深入思考的问题：为什么现在的年轻人越来越不愿意结婚生子？请你引导我从社会、经济、观念等角度层层深入分析。",
  },
  {
    key: "debate_arena",
    name: "思辨擂台",
    desc: "AI 持反方立场，与学生展开辩论",
    systemPrompt:
      "你是思辨擂台反方辩手。学生给出论点后，你针锋相对地反驳，要求论据充分；每轮结束后点评其论证的逻辑漏洞。先请学生亮明论点。",
    placeholder: "亮明你的论点，如：AI 应该取代教师",
    inputKind: "chat",
    template: "我的论点是：人工智能不应该取代教师。理由：教育不仅是知识传递，更包含情感关怀、品格塑造和因材施教，这些是 AI 难以替代的。",
  },
  {
    key: "code_editor",
    name: "代码编辑",
    desc: "学生粘贴代码，AI 审查并给出优化版",
    systemPrompt:
      "你是代码评审专家。学生粘贴代码后，请指出 bug 与坏味道，从正确性、规范性、效率三方面评分（百分制），并给出优化后的完整代码（用代码块包裹）。",
    placeholder: "粘贴你的代码",
    inputKind: "code",
    template: "def calc_avg(nums):\n    total = 0\n    for i in range(len(nums)):\n        total = total + nums[i]\n    return total / len(nums)\n\ndata = [85, 90, 78, 92, 88]\nprint(calc_avg(data))",
  },
  {
    key: "interactive_story",
    name: "互动故事",
    desc: "AI 讲故事并在关键处让学生做选择",
    systemPrompt:
      "你是互动故事讲述者。先请学生选一个题材（科幻/历史/悬疑），然后讲述故事，每讲一段就给出 2-3 个选项让学生决定剧情走向，并记录其选择偏好。",
    placeholder: "选择题材或直接说开始",
    inputKind: "chat",
    template: "我想听一个科幻题材的互动故事，关于人类在火星建立殖民地的冒险经历，请开始并让我做选择。",
  },
];

/** 场景作答类型：问答型（首轮用户消息是开场设定，AI 提问后才算作答）/ 提交型（用户消息即提交内容） */
export function getScenarioAnswerMode(key: ScenarioKey): "qa" | "submission" {
  return key === "work_upload" || key === "code_editor" ? "submission" : "qa";
}

/** 提取学生的真实作答内容（用于评估前校验，与后端 extract_answers 规则一致） */
export function extractAnswers(
  msgs: Array<{ role: string; content: string }>,
  key: ScenarioKey
): string[] {
  const entries = msgs.map((m) => ({ role: m.role, content: (m.content || "").trim() }));
  if (getScenarioAnswerMode(key) === "qa") {
    const idx = entries.findIndex((e) => e.role === "ai");
    if (idx < 0) return [];
    return entries
      .slice(idx + 1)
      .filter((e) => e.role === "user" && e.content)
      .map((e) => e.content);
  }
  return entries.filter((e) => e.role === "user" && e.content).map((e) => e.content);
}

/** 最小 SSE 解析：读取 data 行 JSON 中的 type/delta 拼接。
 * 后端 ChatController.sse_write 只写 `data: {"type":"TEXT_MESSAGE_CONTENT","delta":"..."}`，
 * 不带 `event:` 行（event: 分支仅为兼容旧格式保留）。 */
export async function chatOnce(opts: {
  message: string;
  systemPrompt: string;
  tenant: string;
  userId?: string;
  headers?: Record<string, string>;
  onToken?: (delta: string) => void;
}): Promise<string> {
  const resp = await fetch("/agent/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    body: JSON.stringify({
      message: opts.message,
      systemPrompt: opts.systemPrompt,
      orgSchema: opts.tenant,
      userId: opts.userId,
    }),
  });
  if (!resp.ok || !resp.body) throw new Error("对话请求失败");
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buf = "";
  let runError = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n");
    buf = parts.pop() || "";
    let isContent = false;
    for (const line of parts) {
      if (line.startsWith("event:")) {
        isContent = line.includes("TEXT_MESSAGE_CONTENT");
      } else if (line.startsWith("data:")) {
        const raw = line.slice(5).trim();
        if (!raw) continue;
        try {
          const evt = JSON.parse(raw);
          const type = typeof evt.type === "string" ? evt.type : "";
          if (type === "TEXT_MESSAGE_CONTENT" || (type === "" && isContent)) {
            const delta = typeof evt.delta === "string" ? evt.delta : "";
            if (delta) {
              full += delta;
              opts.onToken?.(delta);
            }
          } else if (type === "RUN_ERROR") {
            runError = typeof evt.message === "string" ? evt.message : "未知错误";
          }
        } catch {
          /* ignore */
        }
        isContent = false;
      }
    }
  }
  if (!full && runError) throw new Error(runError);
  return full;
}

/** 安全公式求值：字段标识 + 数字 + + - * / ( ) + SUM/AVG */
export function evaluateFormula(expr: string, values: Record<string, any>): number {
  const tokens = expr.match(/[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[+\-*/(),]/g);
  if (!tokens) throw new Error("空表达式");
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr(): number {
    let v = parseTerm();
    for (;;) {
      const t = peek();
      if (t === "+") { next(); v += parseTerm(); }
      else if (t === "-") { next(); v -= parseTerm(); }
      else return v;
    }
  }
  function parseTerm(): number {
    let v = parseFactor();
    for (;;) {
      const t = peek();
      if (t === "*") { next(); v *= parseFactor(); }
      else if (t === "/") { next(); v /= parseFactor(); }
      else return v;
    }
  }
  function parseFactor(): number {
    const t = next();
    if (t === undefined) throw new Error("表达式不完整");
    if (t === "(") {
      const v = parseExpr();
      if (next() !== ")") throw new Error("括号不匹配");
      return v;
    }
    if (t === "-") return -parseFactor();
    if (/^\d/.test(t)) return parseFloat(t);
    if (/^[A-Za-z_]/.test(t)) {
      if (peek() === "(") {
        next();
        const args: number[] = [];
        if (peek() !== ")") {
          args.push(parseExpr());
          while (peek() === ",") { next(); args.push(parseExpr()); }
        }
        if (next() !== ")") throw new Error("函数括号不匹配");
        const fn = t.toUpperCase();
        if (fn === "SUM") return args.reduce((a, b) => a + b, 0);
        if (fn === "AVG") return args.length ? args.reduce((a, b) => a + b, 0) / args.length : 0;
        throw new Error(`不支持的函数 ${t}`);
      }
      const v = Number(values[t]);
      if (Number.isNaN(v)) throw new Error(`字段 ${t} 无数值`);
      return v;
    }
    throw new Error(`非法符号 ${t}`);
  }

  const result = parseExpr();
  if (pos !== tokens.length) throw new Error("表达式有多余部分");
  return result;
}

/* ------------------------------------------------------------------ *
 * AI 实践记录（教师端按门户 / 学生查看）
 * ------------------------------------------------------------------ */

export interface PracticeAttemptRecord {
  id: string;
  scenario: string;
  userId?: string | null;
  courseId?: string | null;
  transcript: Array<{ role: string; content: string }>;
  score?: number | null;
  report?: string | null;
  status: string;
  insertedAt?: string;
  updatedAt?: string;
}

/** 拉取租户内 AI 实践记录（可按场景 / 学生过滤） */
export async function fetchPracticeAttempts(opts: {
  tenant: string;
  scenario?: string;
  userId?: string;
  headers?: Record<string, string>;
}): Promise<PracticeAttemptRecord[]> {
  const qs = new URLSearchParams();
  if (opts.tenant) qs.set("tenant", opts.tenant);
  if (opts.scenario) qs.set("scenario", opts.scenario);
  if (opts.userId) qs.set("userId", opts.userId);
  try {
    const resp = await fetch(`/api/practice/attempts?${qs.toString()}`, {
      headers: { ...(opts.headers || {}), Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const r = await resp.json().catch(() => null);
    if (!resp.ok || !r?.success) return [];
    return (r.data || []).map((a: any) => ({
      id: a.id,
      scenario: a.scenario,
      userId: a.user_id ?? null,
      courseId: a.course_id ?? null,
      transcript: Array.isArray(a.transcript) ? a.transcript : [],
      score: a.score ?? null,
      report: a.report ?? null,
      status: a.status,
      insertedAt: a.inserted_at,
      updatedAt: a.updated_at,
    }));
  } catch {
    return [];
  }
}

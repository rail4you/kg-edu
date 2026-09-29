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
}> = [
  {
    key: "dialogue",
    name: "情景对话",
    desc: "AI 扮演情境角色，与学生实时对话练习",
    systemPrompt:
      "你是情景对话陪练官。根据学生的话题设定一个生活/职场/校园情境并扮演其中角色，用中文与学生多轮对话，每轮回复后给出一个简短的表达建议。",
    placeholder: "先设定一个情境，如：在餐厅点餐",
    inputKind: "chat",
  },
  {
    key: "work_upload",
    name: "上传作品",
    desc: "学生粘贴作品文本，AI 实时点评打分",
    systemPrompt:
      "你是作品评审专家。学生会粘贴自己的作品（作文/设计说明/实验报告等），请从完整性、规范性、创新性三方面点评并打分（百分制），给出3条改进建议。",
    placeholder: "粘贴你的作品文本",
    inputKind: "upload",
  },
  {
    key: "thinking_ladder",
    name: "思维阶梯",
    desc: "AI 逐级追问，引导思维层层递进",
    systemPrompt:
      "你是思维教练。围绕学生提出的问题，用苏格拉底式追问引导其从现象到本质逐级深入，每次只问一个关键问题，并肯定其上一轮思考的进步。",
    placeholder: "提出你想深入思考的问题",
    inputKind: "chat",
  },
  {
    key: "debate_arena",
    name: "思辨擂台",
    desc: "AI 持反方立场，与学生展开辩论",
    systemPrompt:
      "你是思辨擂台反方辩手。学生给出论点后，你针锋相对地反驳，要求论据充分；每轮结束后点评其论证的逻辑漏洞。先请学生亮明论点。",
    placeholder: "亮明你的论点，如：AI 应该取代教师",
    inputKind: "chat",
  },
  {
    key: "code_editor",
    name: "代码编辑",
    desc: "学生粘贴代码，AI 审查并给出优化版",
    systemPrompt:
      "你是代码评审专家。学生粘贴代码后，请指出 bug 与坏味道，从正确性、规范性、效率三方面评分（百分制），并给出优化后的完整代码（用代码块包裹）。",
    placeholder: "粘贴你的代码",
    inputKind: "code",
  },
  {
    key: "interactive_story",
    name: "互动故事",
    desc: "AI 讲故事并在关键处让学生做选择",
    systemPrompt:
      "你是互动故事讲述者。先请学生选一个题材（科幻/历史/悬疑），然后讲述故事，每讲一段就给出 2-3 个选项让学生决定剧情走向，并记录其选择偏好。",
    placeholder: "选择题材或直接说开始",
    inputKind: "chat",
  },
];

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

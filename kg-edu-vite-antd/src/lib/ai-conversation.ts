/**
 * AI 会话的补充 RPC（重命名 / 切换命令）。
 * `update_conversation` 已在后端 KgEdu.AI.Conversation 暴露，但未包含在生成的客户端中，
 * 这里提供最小封装。
 */
export async function updateConversation(config: {
  primaryKey: string;
  input: { title?: string; aiCommandId?: string | null };
  headers?: Record<string, string>;
}): Promise<{ success: boolean; data?: { id: string; title?: string; aiCommandId?: string | null; [k: string]: unknown }; errors?: unknown[] }> {
  const response = await fetch("/rpc/run", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...config.headers },
    body: JSON.stringify({
      action: "update_conversation",
      primaryKey: config.primaryKey,
      input: config.input,
      fields: ["id", "title", "aiCommandId"],
    }),
  });

  if (!response.ok) {
    return { success: false };
  }
  return response.json();
}

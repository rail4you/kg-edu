/**
 * ash_typescript Lifecycle Hooks — 集中管理 RPC 请求的认证和监控
 *
 * 用法: 在 config.exs 中配置后，ash_rpc.ts 重新生成时会自动导入此模块。
 * 所有 RPC 调用无需手动传 headers，hook 自动注入 JWT。
 *
 * 职责分工:
 *   - rpcHooks.ts: 处理 ash_rpc.ts 生成的 RPC 调用 (/rpc/run, /rpc/validate)
 *   - fetch-interceptor.ts: 处理所有其他 fetch 调用 (chat, upload, agent API 等)
 */

import type { ActionConfig, ValidationConfig } from "./ash_rpc";
import {
  clearAuthStorage,
  getLoginRedirectPath,
  refreshAuthToken,
} from "./auth-check";
import { computeEditPermission } from "@/hooks/use-edit-permission";

/**
 * 写类 RPC 动作前缀（与后端 EnforceEditWindow 的黑名单保持一致）。
 * 命中前缀且不在 @WRITE_ACTION_ALLOW 名单内的动作，只读教师一律短路拦截。
 */
const WRITE_ACTION_PREFIXES = [
  "create_", "update_", "delete_", "destroy_", "bulk_", "import_", "remove_",
  "unlink_", "link_", "move_", "mark_", "add_", "grade_", "submit_", "replace_",
  "publish_", "unpublish_", "generate_", "regenerate_", "close_", "assign_",
  "reorder_", "change_", "unenroll_", "trigger_", "start_", "send_", "revoke_",
  "restore_", "reset_", "reply_", "reject_", "recalculate_", "reapply_", "enroll_",
  "complete_", "clone_", "approve_", "apply_", "activate_", "dismiss_", "upload_",
  "save_", "set_", "edit_", "copy_", "backup_", "random_", "select_", "continue_",
];

/** 命中写前缀但属于会话/认证/下载类，必须放行 */
const WRITE_ACTION_ALLOW = new Set([
  "change_password",
  "change_password_direct",
  "sign_out",
  "refresh_session",
  "export_exercise_template",
  "export_question_template",
  "export_homework_template",
  "check_in",
  "checkIn",
]);

export function isRpcWriteAction(actionName: string): boolean {
  if (WRITE_ACTION_ALLOW.has(actionName)) return false;
  return WRITE_ACTION_PREFIXES.some((prefix) => actionName.startsWith(prefix));
}

interface StoredUser {
  role?: string;
  editEnabled?: boolean | null;
  editPeriodStart?: string | null;
  editPeriodEnd?: string | null;
}

function storedUser(): StoredUser | null {
  try {
    const raw = sessionStorage.getItem("user_data");
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

function editLockedResponse(message: string): Response {
  return new Response(
    JSON.stringify({
      success: false,
      errors: [
        { type: "forbidden", message, details: { code: "edit_locked" } },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

/**
 * beforeRequest Hook — 在所有 RPC action 调用前自动执行
 *
 * 自动注入:
 *   1. Authorization: Bearer <jwt_access_token> (从 sessionStorage)
 *   2. X-Org-Schema: <tenant> (从 sessionStorage)
 * 只读教师执行写动作时直接短路返回失败，不发网络请求。
 */
export async function beforeRequest(
  actionName: string,
  config: ActionConfig
): Promise<ActionConfig> {
  const token = sessionStorage.getItem("jwt_access_token");
  const tenant = sessionStorage.getItem("tenant");

  const headers: Record<string, string> = {
    ...config.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (tenant) {
    headers["X-Org-Schema"] = tenant;
  }

  // 只读教师写操作集中拦截（前端兜底，后端仍为最终权威）
  const permission = computeEditPermission(storedUser());
  if (!permission.canEdit && isRpcWriteAction(actionName)) {
    return {
      ...config,
      headers,
      customFetch: async () => editLockedResponse(permission.statusText),
    };
  }

  return {
    ...config,
    headers,
  };
}

/**
 * afterRequest Hook — 在所有 RPC action 调用后自动执行
 *
 * 职责:
 *   1. 检测 401/403 认证失败 → 透明刷新 token 或跳转登录
 *   2. 生产环境日志/监控
 */
export async function afterRequest(
  actionName: string,
  response: Response,
  result: any | null,
  _config: ActionConfig
): Promise<void> {
  // 不拦截 refresh_session 自身（防止无限循环）
  if (actionName === "refresh_session") return;

  // 非 API 路径不处理
  if (!response.url.includes("/rpc/")) return;

  // 处理认证失败
  if (response.status === 401 || response.status === 403) {
    const currentToken = sessionStorage.getItem("jwt_access_token");
    if (currentToken) {
      const newToken = await refreshAuthToken(currentToken);
      if (newToken) {
        // token 刷新成功，交由 fetch-interceptor.ts 的重试逻辑处理
        // (ash_typescript hooks 不支持自动重试，重试由 fetch-interceptor 的全局 fetch 拦截负责)
        return;
      }
    }

    // 刷新失败，跳转登录页
    const role = sessionStorage.getItem("user_role") || "";
    clearAuthStorage();
    setTimeout(() => {
      window.location.href = getLoginRedirectPath(role);
    }, 100);
  }

  // 生产环境监控 (可接入 Sentry/Datadog)
  if (import.meta.env.PROD && response.status >= 500) {
    console.error(
      `[RPC Error] ${actionName}: HTTP ${response.status}`,
      result
    );
  }
}

/**
 * beforeValidationRequest Hook — 在 RPC validation 调用前执行
 */
export async function beforeValidationRequest(
  _actionName: string,
  config: ValidationConfig
): Promise<ValidationConfig> {
  const token = sessionStorage.getItem("jwt_access_token");

  if (token) {
    return {
      ...config,
      headers: {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      },
    };
  }

  return config;
}

/**
 * Token 验证和 JWT 解码工具
 *
 * 解决服务器重启后 sessionStorage 中残留的 token 失效导致
 * 页面认证状态与实际 API 可用性不一致的问题。
 */

/**
 * Base64 URL 解码（处理 JWT 的 base64url 编码）
 */
function base64UrlDecode(str: string): string {
  // 补齐 padding
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  try {
    return decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch {
    // fallback: 纯 ASCII
    return atob(base64);
  }
}

export interface JwtPayload {
  sub?: string;
  exp?: number;
  iat?: number;
  jti?: string;
  [key: string]: unknown;
}

/**
 * 解码 JWT token 的 payload（不验证签名）
 */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * 检查 JWT token 是否已过期
 * @param token JWT token 字符串
 * @param graceSeconds 宽限期（秒），避免客户端时间略慢导致的误判，默认 60 秒
 * @returns true 表示已过期
 */
export function isTokenExpired(token: string, graceSeconds = 60): boolean {
  const payload = decodeJwt(token);
  if (!payload || !payload.exp) {
    // 无法解码或没有 exp 字段，保守处理：认为可能过期
    return true;
  }
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now + graceSeconds;
}

/**
 * 验证当前存储的 token 是否有效
 * 1. 检查 sessionStorage 中是否有 token
 * 2. 检查 token 是否已过期（JWT exp 字段）
 *
 * @returns {valid: true} 如果 token 存在且未过期，否则 {valid: false, reason: string}
 */
export function checkStoredToken(): { valid: true } | { valid: false; reason: string } {
  const token = sessionStorage.getItem("jwt_access_token");

  if (!token) {
    return { valid: false, reason: "no_token" };
  }

  if (isTokenExpired(token)) {
    return { valid: false, reason: "token_expired" };
  }

  return { valid: true };
}

/**
 * 清除所有认证相关的 sessionStorage 数据
 */
export function clearAuthStorage(): void {
  sessionStorage.removeItem("user_data");
  sessionStorage.removeItem("user_role");
  sessionStorage.removeItem("jwt_access_token");
  sessionStorage.removeItem("tenant");
}

/**
 * 获取登录重定向路径
 */
export function getLoginRedirectPath(role: string): string {
  const roleLoginPaths: Record<string, string> = {
    user: "/login?role=student",
    student: "/login?role=student",
    teacher: "/login?role=teacher",
    admin: "/login?role=admin",
    super_admin: "/login?role=admin",
  };
  return roleLoginPaths[role] || "/login";
}

/**
 * 使用 refresh_session RPC 刷新过期的 token
 * 
 * 直接调用 /rpc/run，不经过 fetch 拦截器（避免无限循环）。
 * 只有 HttpOnly cookie 方案不需要这个步骤；当前 sessionStorage 方案需要手动刷新。
 * 
 * @returns 新的 token 字符串，刷新失败返回 null
 */
export async function refreshAuthToken(currentToken: string): Promise<string | null> {
  try {
    const response = await fetch("/rpc/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify({
        action: "refresh_session",
        input: { token: currentToken },
      }),
    });

    if (!response.ok) return null;

    const result = await response.json();

    // 从响应中提取新 token
    // Ash RPC 格式: { success: true, data: { token: "..." } }
    // 或 metadata 格式: { success: true, metadata: { token: "..." } }
    const newToken =
      result?.data?.token ||
      result?.metadata?.token ||
      result?.data?.__metadata__?.token;

    if (newToken && typeof newToken === "string") {
      sessionStorage.setItem("jwt_access_token", newToken);
      return newToken;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 检测 API 响应是否为认证失败（401/403）
 * 适用于 ash_rpc 返回的错误格式:
 *   { success: false, errors: [{ type: "network"|"forbidden"|..., message: "..." }] }
 * 以及标准的 HTTP 401/403 响应
 */
export function isAuthError(responseOrError: unknown): boolean {
  if (!responseOrError) return false;

  // Handle Error objects from network failures
  if (responseOrError instanceof Error) {
    const msg = responseOrError.message.toLowerCase();
    return (
      msg.includes("401") ||
      msg.includes("403") ||
      msg.includes("unauthorized") ||
      msg.includes("unauthenticated") ||
      msg.includes("forbidden") ||
      msg.includes("token") ||
      msg.includes("expired") ||
      msg.includes("invalid_grant")
    );
  }

  // Handle ash_rpc error format
  if (typeof responseOrError === "object") {
    const obj = responseOrError as Record<string, unknown>;

    // Check for error array
    const errors = Array.isArray(obj.errors) ? obj.errors : [];
    for (const err of errors) {
      if (typeof err === "object" && err !== null) {
        const e = err as Record<string, unknown>;
        const type = String(e.type || "").toLowerCase();
        const msg = String(e.message || "").toLowerCase();
        if (
          type === "forbidden" ||
          type === "authentication" ||
          msg.includes("unauthorized") ||
          msg.includes("unauthenticated") ||
          msg.includes("token") ||
          msg.includes("expired") ||
          msg.includes("invalid_grant")
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

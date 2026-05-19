/**
 * JWT 解码工具 - 从 token 中提取 tenant 信息
 * 不验证签名（验证由后端完成），只读取 payload
 */

export interface JwtPayload {
  sub?: string;
  tenant?: string;
  orgSchema?: string;
  userId?: string;
  role?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

/**
 * 解码 JWT token（不验证签名）
 */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = parts[1];
    // Base64url decode
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * 从请求中提取 tenant (orgSchema) 和 userId
 * 优先级：
 * 1. X-Org-Schema header
 * 2. JWT token 中的 tenant/orgSchema 字段
 * 3. 请求体中的 orgSchema
 */
export function extractTenantContext(req: {
  headers: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
}): { orgSchema: string; userId: string; role: string } {
  let orgSchema = "";
  let userId = "";
  let role = "";

  // 1. 从 header 获取
  const headerOrgSchema = req.headers["x-org-schema"] as string | undefined;
  if (headerOrgSchema) orgSchema = headerOrgSchema;

  const headerUserId = req.headers["x-user-id"] as string | undefined;
  if (headerUserId) userId = headerUserId;

  // 2. 从 JWT token 获取
  const authHeader = req.headers["authorization"] as string | undefined;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = decodeJwt(token);
    if (payload) {
      if (!orgSchema) orgSchema = payload.tenant || payload.orgSchema || "";
      if (!userId) userId = payload.sub || "";
      if (!role) role = payload.role || "";
    }
  }

  // 3. 从请求体获取
  if (req.body) {
    if (!orgSchema) {
      const fp = req.body.forwardedProps as Record<string, string> | undefined;
      if (fp?.orgSchema) orgSchema = fp.orgSchema;
      else if (req.body.orgSchema as string) orgSchema = req.body.orgSchema as string;
      else if (req.body.tenant as string) orgSchema = req.body.tenant as string;
    }
    if (!userId) {
      const fp = req.body.forwardedProps as Record<string, string> | undefined;
      if (fp?.userId) userId = fp.userId;
    }
  }

  return { orgSchema, userId, role };
}

/**
 * 统一 API Headers 工具 — 用于非 RPC 的 fetch 请求
 *
 * 适用于:
 *   - /api/assistant/ag-ui (SSE 聊天)
 *   - /api/upload, /api/sts-token (文件上传)
 *   - /agent/* (AI 生成)
 *   - /curriculum/* (课程体系)
 *   - /competency-graph/* (能力图谱)
 *   - 其他非 ash_rpc 的 fetch 调用
 *
 * 注意: 通过 ash_rpc.ts 生成的 RPC 调用
 * 已通过 rpcHooks.ts 自动注入 headers，无需手动调用此函数。
 */

/**
 * 获取标准 API 请求 headers（含 JWT 认证和租户信息）
 *
 * @param extraHeaders 额外的自定义 headers（会覆盖默认值）
 * @returns Headers 对象
 */
export function getApiHeaders(
  extraHeaders?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  const token = sessionStorage.getItem("jwt_access_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const tenant = sessionStorage.getItem("tenant");
  if (tenant) {
    headers["X-Org-Schema"] = tenant;
  }

  return headers;
}

/**
 * 获取文件上传 Headers（不含 Content-Type，由浏览器自动设置 multipart boundary）
 */
export function getUploadHeaders(
  extraHeaders?: Record<string, string>
): Record<string, string> {
  // 文件上传不能设 Content-Type，浏览器会自动设置包含 boundary 的 multipart/form-data
  const headers: Record<string, string> = {
    ...extraHeaders,
  };

  const token = sessionStorage.getItem("jwt_access_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const tenant = sessionStorage.getItem("tenant");
  if (tenant) {
    headers["X-Org-Schema"] = tenant;
  }

  return headers;
}

/**
 * 获取 SSE/Streaming 请求 Headers（用于 AG-UI Chat）
 */
export function getSSEHeaders(
  extraHeaders?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    ...extraHeaders,
  };

  const token = sessionStorage.getItem("jwt_access_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const tenant = sessionStorage.getItem("tenant");
  if (tenant) {
    headers["X-Org-Schema"] = tenant;
  }

  return headers;
}

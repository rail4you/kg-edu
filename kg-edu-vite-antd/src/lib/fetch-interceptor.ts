/**
 * 全局 fetch 拦截器 + 透明 token 刷新
 *
 * 在 HTTP 层面拦截 401/403 响应：
 * 1. 先尝试调用 refresh_session 刷新 token
 * 2. 刷新成功后自动重试原始请求
 * 3. 刷新失败则清除登录状态跳转登录页
 *
 * 覆盖所有 API 调用（包括直接 RPC、fetch、useQuery、useMutation）。
 */

import {
  clearAuthStorage,
  getLoginRedirectPath,
  refreshAuthToken,
} from "./auth-check";

import { message } from "antd";

let interceptorInstalled = false;
/** 防止短时间内重复跳转 */
let lastRedirectTime = 0;
const REDIRECT_COOLDOWN = 5000;
/** 防止并发刷新 */
let refreshPromise: Promise<string | null> | null = null;

/**
 * 获取当前存储的 token
 */
function getCurrentToken(): string | null {
  return sessionStorage.getItem("jwt_access_token");
}

/**
 * 尝试刷新 token，如果成功则重试原始请求
 * @returns 重试后的 Response，或原始的 401 Response（如果刷新失败）
 */
async function tryRefreshAndRetry(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  originalResponse: Response,
): Promise<Response> {
  const currentToken = getCurrentToken();
  if (!currentToken) {
    return originalResponse;
  }

  // 防止并发刷新：多个 401 请求共享同一个刷新 Promise
  if (!refreshPromise) {
    refreshPromise = refreshAuthToken(currentToken);
  }

  const newToken = await refreshPromise;
  refreshPromise = null;

  if (newToken) {
    // 刷新成功，用新 token 重试原始请求
    const retryInit: RequestInit = {
      ...init,
      headers: {
        ...(init?.headers as Record<string, string>),
        Authorization: `Bearer ${newToken}`,
      },
    };

    try {
      return await fetch(input, retryInit);
    } catch {
      // 重试也失败了，返回原始 401
      return originalResponse;
    }
  }

  // 刷新失败，返回原始 401
  return originalResponse;
}

/**
 * 处理认证失败：跳转登录页
 */
function handleAuthFailure(response: Response): void {
  const now = Date.now();
  if (now - lastRedirectTime < REDIRECT_COOLDOWN) {
    console.warn("[FetchInterceptor] 已在冷却期内，跳过重复的登录跳转");
    return;
  }
  lastRedirectTime = now;

  // 只对 API 请求进行拦截（避免拦截静态资源等）
  const url = typeof response.url === "string" ? response.url : "";
  const isApiRequest =
    url.includes("/rpc/") ||
    url.includes("/api/") ||
    url.includes("/agent/");

  if (!isApiRequest) return;

  console.warn(
    `[FetchInterceptor] Token 刷新失败，检测到 ${response.status} 响应 (${url})，清除登录状态并跳转登录页`,
  );

  const role = sessionStorage.getItem("user_role") || "";
  clearAuthStorage();

  setTimeout(() => {
    window.location.href = getLoginRedirectPath(role);
  }, 100);
}

/**
 * 判断 403 响应是否为"教师只读编辑权限被限制"（code: edit_locked）。
 * 此类响应不应触发 token 刷新或登出，仅提示用户。
 */
async function isEditLockedResponse(response: Response): Promise<boolean> {
  try {
    const clone = response.clone();
    const body = await clone.json();
    return body?.code === "edit_locked";
  } catch {
    return false;
  }
}

/**
 * 安装全局 fetch 拦截器
 * 应在应用入口最早时机调用一次
 */
export function installFetchInterceptor(): void {
  if (interceptorInstalled) return;
  interceptorInstalled = true;

  const originalFetch = window.fetch;

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    try {
      const response = await originalFetch(input, init);

      // 检测 401 或 403 响应
      if (response.status === 401 || response.status === 403) {
        const url = typeof response.url === "string" ? response.url : "";
        const isApiRequest =
          url.includes("/rpc/") ||
          url.includes("/api/") ||
          url.includes("/agent/");

        if (!isApiRequest) return response;

        // 不要拦截 refresh_session 请求本身（防止无限循环）
        if (url.includes("refresh_session")) {
          return response;
        }

        // 403 且为"教师只读"：提示原因，不刷新 token、不登出
        if (response.status === 403 && (await isEditLockedResponse(response))) {
          const clone = response.clone();
          const body = await clone.json().catch(() => null);
          message.warning(body?.message || "当前处于只读模式，编辑权限已被限制");
          return response;
        }

        // 尝试透明刷新 token
        const retryResponse = await tryRefreshAndRetry(
          input,
          init,
          response,
        );

        if (retryResponse.ok) {
          return retryResponse;
        }

        // 刷新也失败，跳转登录页
        handleAuthFailure(response);
      }

      return response;
    } catch (error) {
      // 网络错误不主动触发登录跳转（避免断网时误判）
      throw error;
    }
  };
}

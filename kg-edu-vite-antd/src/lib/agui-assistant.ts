/**
 * assistant-ui AG-UI 配置
 * 用于教师页 assistant-ui 运行时连接到后端 AG-UI Agent
 */

import { getCurrentTenant } from './tenant';

/**
 * 获取 assistant-ui AG-UI 代理端点 URL
 */
export function getAssistantAgUiUrl(): string {
  return '/api/assistant/ag-ui';
}

/**
 * 获取当前认证 headers，用于 AG-UI 请求
 */
export function getAssistantHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  // JWT Token
  const token = sessionStorage.getItem('jwt_access_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 租户 schema
  const tenant = getCurrentTenant();
  if (tenant?.schemaName) {
    headers['X-Org-Schema'] = tenant.schemaName;
  }

  // 用户 ID
  try {
    const userData = sessionStorage.getItem('user_data');
    if (userData) {
      const user = JSON.parse(userData);
      if (user?.id) {
        headers['X-User-Id'] = user.id;
      }
    }
  } catch (e) {
    console.error('[assistant-ui] Error getting userId:', e);
  }

  return headers;
}

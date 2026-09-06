// ----------------------------------------------------------------------

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return translateAuthError(error.message) || error.name || '登录过程中发生错误';
  }

  if (typeof error === 'string') {
    return translateAuthError(error);
  }

  if (typeof error === 'object' && error !== null) {
    const errorMessage = (error as { message?: string }).message;
    if (typeof errorMessage === 'string') {
      return translateAuthError(errorMessage);
    }
  }

  return '登录过程中发生未知错误';
}

function translateAuthError(error: string): string {
  // Convert to lowercase for case-insensitive matching
  const lowerError = error.toLowerCase();

  // Authentication-related error translations
  if (lowerError.includes('unauthorized') || lowerError.includes('invalid credentials')) {
    return '用户名或密码错误，请检查后重试';
  }

  if (lowerError.includes('not found') || lowerError.includes('user not found')) {
    return '用户不存在，请检查学号是否正确';
  }

  if (lowerError.includes('password') && (lowerError.includes('incorrect') || lowerError.includes('wrong'))) {
    return '密码错误，请重新输入';
  }

  if (lowerError.includes('invalid') && lowerError.includes('token')) {
    return '登录令牌无效，请重新登录';
  }

  if (lowerError.includes('expired') && lowerError.includes('token')) {
    return '登录令牌已过期，请重新登录';
  }

  if (lowerError.includes('forbidden') || lowerError.includes('access denied')) {
    return '访问被拒绝，权限不足';
  }

  if (lowerError.includes('network') || lowerError.includes('connection')) {
    return '网络连接错误，请检查网络后重试';
  }

  if (lowerError.includes('timeout')) {
    return '请求超时，请稍后重试';
  }

  if (lowerError.includes('tenant') && (lowerError.includes('required') || lowerError.includes('missing'))) {
    return '缺少租户信息，请选择学校后重试';
  }

  if (lowerError.includes('server') && (lowerError.includes('error') || lowerError.includes('internal'))) {
    return '服务器内部错误，请稍后重试';
  }

  // If no specific translation found, return the original error if it's already Chinese
  if (/[\u4e00-\u9fa5]/.test(error)) {
    return error;
  }

  // Return a generic Chinese error message
  return '登录失败，请检查输入信息后重试';
}

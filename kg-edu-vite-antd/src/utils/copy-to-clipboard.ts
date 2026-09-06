/**
 * 通用的复制到剪贴板工具函数
 * 支持最大兼容性，在 HTTP 和 HTTPS 环境下都能工作
 *
 * 优先级：
 * 1. 尝试使用现代的 navigator.clipboard API (HTTPS)
 * 2. 回退到 document.execCommand('copy') (HTTP/HTTPS 都支持)
 *
 * @param text - 要复制的文本
 * @returns Promise<boolean> - 复制是否成功
 */
export function copyToClipboard(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    // 方法 1: 尝试使用现代 Clipboard API (仅 HTTPS)
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          console.log('复制成功 (Clipboard API):', text);
          resolve(true);
        })
        .catch((err) => {
          // Clipboard API 失败，尝试 fallback 方法
          console.log('Clipboard API 失败，尝试 fallback方法:', err);
          resolve(fallbackCopy(text));
        });
      return;
    }

    // 方法 2: 使用 document.execCommand (HTTP/HTTPS 兼容)
    resolve(fallbackCopy(text));
  });
}

/**
 * Fallback 复制方法
 * 使用 document.execCommand('copy') 和临时 textarea
 * 适用于 HTTP 和 HTTPS 环境
 */
function fallbackCopy(text: string): boolean {
  const textArea = document.createElement('textarea');
  textArea.value = text;

  // 使 textarea 不可见但仍在 DOM 中
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  textArea.style.opacity = '0';
  textArea.style.pointerEvents = 'none';
  textArea.setAttribute('readonly', '');

  document.body.appendChild(textArea);

  // 选中文本
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, text.length); // 为了移动设备兼容性

  try {
    const successful = document.execCommand('copy');
    if (successful) {
      console.log('复制成功 (execCommand):', text);
    } else {
      console.error('execCommand 复制失败');
    }
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('复制过程中出错:', err);
    document.body.removeChild(textArea);
    return false;
  }
}

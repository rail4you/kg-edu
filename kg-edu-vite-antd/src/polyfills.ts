import "core-js/stable";
import "regenerator-runtime/runtime";

/**
 * 兼容 Chrome 95 等老内核（政企/信创环境常见）
 * - core-js/stable 已按需 polyfill 大部分 ES 特性（基于 browserslist chrome>=95），
 *   下方再兜底 DOM 相关的 AbortSignal / structuredClone 等非 core-js 范畴。
 * - AbortSignal.timeout 在 Chrome 100 才加入，Chrome 95 调用会抛 TypeError，导致
 *   /api/portal-config、/api/course-categories 等公开接口直接 catch 返回空，
 *   进而“关于我们/合作单位”等动态 Tab 不显示。
 * - structuredClone 在 Chrome 98 才加入，echarts / 业务代码中的深拷贝会抛 ReferenceError，导致
 *   全景相册（CoursePanorama）与图谱页（graph）白屏/打不开。
 * - Array.prototype.findLast / findLastIndex 在 Chrome 97 才加入，图谱排序等会抛 TypeError。
 * - 此 polyfill 必须在任何模块 import fetch 之前执行。
 */
if (typeof AbortSignal !== "undefined" && typeof (AbortSignal as unknown as Record<string, unknown>).timeout !== "function") {
  (AbortSignal as unknown as Record<string, unknown>).timeout = (ms: number) => {
    const controller = new AbortController();
    const id = setTimeout(() => {
      // Chrome 95 的 AbortController.abort 不支持带 reason 参数，做兼容
      try {
        controller.abort(new DOMException("TimeoutError", "TimeoutError"));
      } catch {
        controller.abort();
      }
    }, ms);
    // 若外部已 abort，清理定时器
    controller.signal.addEventListener("abort", () => clearTimeout(id), { once: true } as AddEventListenerOptions);
    return controller.signal;
  };
}

// AbortSignal.any 在 Chrome 112 才加入，虽未直接使用，顺带兜底以防依赖引入
if (typeof AbortSignal !== "undefined" && typeof (AbortSignal as unknown as Record<string, unknown>).any !== "function") {
  (AbortSignal as unknown as Record<string, unknown>).any = (signals: AbortSignal[]) => {
    const controller = new AbortController();
    const onAbort = () => {
      try {
        controller.abort((signals.find((s) => s.aborted) as unknown as { reason?: unknown })?.reason);
      } catch {
        controller.abort();
      }
    };
    for (const sig of signals) {
      if (sig.aborted) {
        onAbort();
        break;
      }
      sig.addEventListener("abort", onAbort, { once: true } as AddEventListenerOptions);
    }
    return controller.signal;
  };
}

// structuredClone – Chrome 98+，全景相册/图谱的深拷贝（echarts 内部、业务 clone）会直接抛错
if (typeof globalThis.structuredClone !== "function") {
  (globalThis as unknown as Record<string, unknown>).structuredClone = (value: unknown) => {
    return JSON.parse(JSON.stringify(value));
  };
}

// Array.prototype.findLast / findLastIndex – Chrome 97+，图谱排序/检索会抛 TypeError
if (!(Array.prototype as unknown as Record<string, unknown>).findLast) {
  (Array.prototype as unknown as Record<string, unknown>).findLast = function (predicate: (v: unknown, i: number, a: unknown[]) => boolean, thisArg?: unknown) {
    for (let i = (this as unknown as unknown[]).length - 1; i >= 0; i--) {
      if (predicate.call(thisArg, (this as unknown as unknown[])[i], i, this as unknown as unknown[])) return (this as unknown as unknown[])[i];
    }
    return undefined;
  };
}
if (!(Array.prototype as unknown as Record<string, unknown>).findLastIndex) {
  (Array.prototype as unknown as Record<string, unknown>).findLastIndex = function (predicate: (v: unknown, i: number, a: unknown[]) => boolean, thisArg?: unknown) {
    for (let i = (this as unknown as unknown[]).length - 1; i >= 0; i--) {
      if (predicate.call(thisArg, (this as unknown as unknown[])[i], i, this as unknown as unknown[])) return i;
    }
    return -1;
  };
}

// Array.prototype.toSorted / toReversed – Chrome 110+，echarts 6 的工具函数可能使用
if (!(Array.prototype as unknown as Record<string, unknown>).toSorted) {
  (Array.prototype as unknown as Record<string, unknown>).toSorted = function (compareFn?: (a: unknown, b: unknown) => number) {
    return [...(this as unknown as unknown[])].sort(compareFn as never);
  };
}
if (!(Array.prototype as unknown as Record<string, unknown>).toReversed) {
  (Array.prototype as unknown as Record<string, unknown>).toReversed = function () {
    return [...(this as unknown as unknown[])].reverse();
  };
}

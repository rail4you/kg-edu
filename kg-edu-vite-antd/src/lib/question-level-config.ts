export const QUESTION_LEVEL_KEYS = ["global", "concept", "method"] as const;

export type QuestionLevelKey = (typeof QUESTION_LEVEL_KEYS)[number];

export type QuestionLevelConfig = {
  id: string;
  levelKey: QuestionLevelKey;
  label: string;
  description: string;
  color: string;
  position: number;
  courseId: string;
};

export const DEFAULT_QUESTION_LEVEL_CONFIGS: Record<
  QuestionLevelKey,
  Omit<QuestionLevelConfig, "id" | "courseId">
> = {
  global: {
    levelKey: "global",
    label: "全局问题",
    description: "课程的所有问题",
    color: "#ec4899",
    position: 0,
  },
  concept: {
    levelKey: "concept",
    label: "概念问题",
    description: "从概念角度对课程教学内容分解",
    color: "#3b82f6",
    position: 1,
  },
  method: {
    levelKey: "method",
    label: "方法问题",
    description: "从过程方法角度对课程教学内容分解",
    color: "#10b981",
    position: 2,
  },
};

const STORAGE_PREFIX = "kg-edu:question-level-configs";
const CHANGE_EVENT = "question-level-configs:changed";

function getStorageKey(tenant: string, courseId: string) {
  return `${STORAGE_PREFIX}:${tenant}:${courseId}`;
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function createId(courseId: string, levelKey: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `local-${courseId}-${levelKey}`;
}

function sortConfigs(configs: QuestionLevelConfig[]) {
  return [...configs].sort((a, b) => a.position - b.position);
}

function emitChange(tenant: string, courseId: string) {
  if (!isBrowser()) return;

  window.dispatchEvent(
    new CustomEvent(CHANGE_EVENT, {
      detail: { tenant, courseId },
    }),
  );
}

function normalizeConfigs(courseId: string, value: unknown): QuestionLevelConfig[] {
  if (!Array.isArray(value)) return [];

  return sortConfigs(
    value
      .filter((item): item is Partial<QuestionLevelConfig> & { levelKey: QuestionLevelKey } => {
        return !!item && typeof item === "object" && QUESTION_LEVEL_KEYS.includes((item as QuestionLevelConfig).levelKey);
      })
      .map((item, index) => ({
        id: typeof item.id === "string" && item.id ? item.id : createId(courseId, item.levelKey),
        levelKey: item.levelKey,
        label: typeof item.label === "string" && item.label ? item.label : DEFAULT_QUESTION_LEVEL_CONFIGS[item.levelKey].label,
        description:
          typeof item.description === "string"
            ? item.description
            : DEFAULT_QUESTION_LEVEL_CONFIGS[item.levelKey].description,
        color: typeof item.color === "string" && item.color ? item.color : DEFAULT_QUESTION_LEVEL_CONFIGS[item.levelKey].color,
        position:
          typeof item.position === "number"
            ? item.position
            : DEFAULT_QUESTION_LEVEL_CONFIGS[item.levelKey].position ?? index,
        courseId,
      })),
  );
}

export function listQuestionLevelConfigs(tenant: string, courseId?: string) {
  if (!tenant || !courseId || !isBrowser()) return [];

  const raw = window.localStorage.getItem(getStorageKey(tenant, courseId));
  if (!raw) return [];

  try {
    return normalizeConfigs(courseId, JSON.parse(raw));
  } catch {
    return [];
  }
}

export function buildDefaultQuestionLevelConfigs(courseId: string): QuestionLevelConfig[] {
  return QUESTION_LEVEL_KEYS.map((levelKey) => {
    const defaults = DEFAULT_QUESTION_LEVEL_CONFIGS[levelKey];

    return {
      id: createId(courseId, levelKey),
      courseId,
      ...defaults,
    };
  });
}

export function seedQuestionLevelConfigs(tenant: string, courseId?: string) {
  if (!tenant || !courseId || !isBrowser()) return [];

  const existing = listQuestionLevelConfigs(tenant, courseId);
  if (existing.length > 0) return existing;

  const defaults = buildDefaultQuestionLevelConfigs(courseId);
  window.localStorage.setItem(getStorageKey(tenant, courseId), JSON.stringify(defaults));
  emitChange(tenant, courseId);
  return defaults;
}

export function saveQuestionLevelConfigs(
  tenant: string,
  courseId: string,
  configs: QuestionLevelConfig[],
) {
  if (!tenant || !courseId || !isBrowser()) return [];

  const normalized = normalizeConfigs(courseId, configs);
  window.localStorage.setItem(getStorageKey(tenant, courseId), JSON.stringify(normalized));
  emitChange(tenant, courseId);
  return normalized;
}

export function subscribeQuestionLevelConfigChanges(
  listener: (detail: { tenant?: string; courseId?: string }) => void,
) {
  if (!isBrowser()) return () => {};

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<{ tenant?: string; courseId?: string }>;
    listener(customEvent.detail || {});
  };

  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

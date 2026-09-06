export type StudentActivityKind = "discussion" | "group_task";

export interface StudentActivityHistoryItem {
  kind: StudentActivityKind;
  tenantSchema: string;
  courseId: string;
  token: string;
  title: string;
  description?: string;
  status?: string;
  courseTitle?: string;
  visitedAt: string;
}

const STORAGE_KEY = "student_activity_history";
const MAX_ITEMS = 20;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeItems(items: StudentActivityHistoryItem[]) {
  const deduped = new Map<string, StudentActivityHistoryItem>();

  items.forEach((item) => {
    if (!item.kind || !item.tenantSchema || !item.token) {
      return;
    }
    deduped.set(`${item.kind}:${item.tenantSchema}:${item.token}`, item);
  });

  return Array.from(deduped.values())
    .sort((a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime())
    .slice(0, MAX_ITEMS);
}

export function getStudentActivityHistory(kind?: StudentActivityKind) {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as StudentActivityHistoryItem[]) : [];
    const normalized = normalizeItems(Array.isArray(parsed) ? parsed : []);
    return kind ? normalized.filter((item) => item.kind === kind) : normalized;
  } catch {
    return [];
  }
}

export function saveStudentActivityHistory(item: StudentActivityHistoryItem) {
  if (!canUseStorage()) {
    return;
  }

  const nextItems = normalizeItems([
    {
      ...item,
      visitedAt: item.visitedAt || new Date().toISOString(),
    },
    ...getStudentActivityHistory(),
  ]);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
}

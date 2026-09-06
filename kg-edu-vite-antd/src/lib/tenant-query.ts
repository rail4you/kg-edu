/**
 * 跨租户查询工具：并行查询多个租户并合并结果。
 * 每条记录附加 `_tenant`（来源租户 schema），供编辑/删除等操作确定租户。
 */

interface SuccessLike {
  success?: boolean;
  data?: unknown;
}

export async function fetchAcrossTenants<T extends { id: string }>(
  tenants: string[],
  fetchOne: (tenant: string) => Promise<SuccessLike | null>,
): Promise<T[]> {
  if (tenants.length === 0) return [];
  const results = await Promise.all(
    tenants.map((t) => fetchOne(t).catch(() => null)),
  );
  const seen = new Set<string>();
  const out: T[] = [];
  for (let idx = 0; idx < results.length; idx++) {
    const r = results[idx];
    if (!r?.success) continue;
    const items = Array.isArray(r.data)
      ? r.data
      : ((r.data as Record<string, unknown>)?.results as T[]) || [];
    for (const item of items) {
      // 克隆租户可能导致同一 id 出现在多个 schema，按 id 去重（保留首个）
      if (item.id && !seen.has(item.id)) {
        seen.add(item.id);
        out.push({ ...item, _tenant: tenants[idx] });
      }
    }
  }
  return out;
}

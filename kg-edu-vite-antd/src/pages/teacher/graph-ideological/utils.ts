import { KnowledgeResource } from "./types";

export const extractArrayData = (result: any): any[] => {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (result?.success && result.data) {
    if (Array.isArray(result.data)) return result.data;
    if ("results" in result.data && Array.isArray(result.data.results))
      return result.data.results;
    if ("data" in result.data && Array.isArray(result.data.data))
      return result.data.data;
  }
  if (result?.data) {
    if (Array.isArray(result.data)) return result.data;
    if ("results" in result.data && Array.isArray(result.data.results))
      return result.data.results;
  }
  return [];
};

export const getHeaders = (user: any): Record<string, string> =>
  getAuthHeaders(user) as Record<string, string>;

// 需要在顶部导入 getAuthHeaders
import { getAuthHeaders } from "@/lib/auth";

export const renderKnowledgeOptions = (
  resources: KnowledgeResource[],
  excludedId?: string,
) => {
  const subjects = resources.filter((r) => r.knowledgeType === "subject");
  const units = resources.filter((r) => r.knowledgeType === "knowledge_unit");
  const cells = resources.filter((r) => r.knowledgeType === "knowledge_cell");

  const options: Array<{ label: string; value: string; disabled?: boolean }> = [];

  const filterExcluded = (resource: KnowledgeResource) =>
    resource.id !== excludedId;

  const filteredSubjects = subjects.filter(filterExcluded);
  if (filteredSubjects.length > 0) {
    options.push({
      label: "--- 主题 ---",
      value: "header-subjects",
      disabled: true,
    });
    filteredSubjects.forEach((resource) => {
      options.push({
        label: resource.name,
        value: resource.id,
      });
    });
  }

  const filteredUnits = units.filter(filterExcluded);
  if (filteredUnits.length > 0) {
    options.push({
      label: "--- 知识单元 ---",
      value: "header-units",
      disabled: true,
    });
    filteredUnits.forEach((resource) => {
      options.push({
        label: `${resource.subject || ""} - ${resource.name}`,
        value: resource.id,
      });
    });
  }

  const filteredCells = cells.filter(filterExcluded);
  if (filteredCells.length > 0) {
    options.push({
      label: "--- 知识点 ---",
      value: "header-cells",
      disabled: true,
    });
    filteredCells.forEach((resource) => {
      options.push({
        label: `${resource.subject || ""} - ${resource.unit || ""} - ${resource.name}`,
        value: resource.id,
      });
    });
  }

  return options;
};

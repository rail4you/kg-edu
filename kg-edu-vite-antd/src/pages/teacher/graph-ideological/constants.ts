export const knowledgeTypeMap = {
  subject: "主题",
  knowledge_unit: "知识单元",
  knowledge_cell: "知识点",
} as const;

export const CONNECTION_TYPES = {
  contain: "包含关系",
  order: "属序关系",
  related: "相关关系",
} as const;

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: "选择题",
  fill_in_blank: "填空题",
  short_answer: "简答题",
  essay: "论述题",
  calculation: "计算题",
  case_analysis: "案例分析题",
};

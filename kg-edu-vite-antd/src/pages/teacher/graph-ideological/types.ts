// 知识点相关类型
export interface KnowledgeResource {
  id: string;
  name: string;
  description?: string;
  knowledgeType: "subject" | "knowledge_unit" | "knowledge_cell";
  subject?: string | null;
  unit?: string | null;
}

// 关系类型
export interface IdeopoliticalRelationRow {
  id: string;
  relationTypeName: string;
  relationTypeDisplayName: string;
  sourceKnowledgeName: string;
  targetKnowledgeName: string;
  sourceKnowledgeType: string;
  targetKnowledgeType: string;
  sourceKnowledgeId: string;
  targetKnowledgeId: string;
  relationTypeId: string;
}

// 案例类型
export interface IdeopoliticalCase {
  id: string;
  title: string;
  description?: string;
  content?: string;
  knowledgeResourceId?: string;
  knowledgeResource?: { name: string };
  caseRelationName?: string | null;
}

// 图谱节点类型
export interface IdeopoliticalNode {
  id: string;
  name: string;
  description?: string;
  category?: number;
  symbolSize?: number;
  itemStyle?: {
    color?: string;
    borderColor?: string;
    borderWidth?: number;
  };
  label?: {
    show?: boolean;
    fontSize?: number;
    color?: string;
  };
}

// 图谱连接类型
export interface IdeopoliticalLink {
  source: string | IdeopoliticalNode;
  target: string | IdeopoliticalNode;
  name?: string;
  relationData?: any;
  lineStyle?: {
    opacity?: number;
    width?: number;
    color?: string;
    curveness?: number;
  };
}

// 图谱数据类型
export interface IdeopoliticalGraphData {
  nodes: IdeopoliticalNode[];
  links: IdeopoliticalLink[];
  categories: Array<{ name: string; itemStyle: { color: string } }>;
}

// 案例详情类型
export interface CaseDetail {
  id: string;
  title: string;
  description?: string;
  content?: string;
  caseRelationName?: string | null;
  knowledgeResourceId?: string;
}

// 关系类型
export interface RelationType {
  id: string;
  name: string;
  displayName: string;
  description?: string | null;
}

// 练习类型
export interface Exercise {
  id: string;
  title: string;
  questionContent?: string;
  questionType?: string;
  options?: any;
}

// 知识点类型（用于Drawer）
export interface KnowledgePoint {
  id: string;
  name: string;
  description?: string;
  knowledgeType?: string;
}

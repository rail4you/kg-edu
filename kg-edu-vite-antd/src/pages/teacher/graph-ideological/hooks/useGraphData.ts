import { useMemo } from "react";
import { IdeopoliticalGraphData, IdeopoliticalNode, IdeopoliticalLink } from "../types";

export const useGraphData = (
  knowledgeData: any[] | undefined,
  casesData: any[] | undefined,
  relationsData: any[] | undefined
): IdeopoliticalGraphData => {
  return useMemo(() => {
    if (
      !knowledgeData ||
      !Array.isArray(knowledgeData)
    ) {
      return { nodes: [], links: [], categories: [] };
    }

    const nodes: IdeopoliticalNode[] = [];
    const links: IdeopoliticalLink[] = [];
    const nodeIds = new Set<string>();

    // 添加知识点节点
    knowledgeData.forEach((knowledge: any) => {
      const nodeId = String(knowledge.id);
      nodeIds.add(nodeId);

      nodes.push({
        id: nodeId,
        name: knowledge.name,
        description: knowledge.description,
        category: 0,
        symbolSize: 50,
        itemStyle: { color: "#ef5350", borderColor: "#fff", borderWidth: 2 },
        label: { show: true, fontSize: 12, color: "#333" },
      });
    });

    // 添加案例节点和案例-知识点关系
    if (casesData && Array.isArray(casesData)) {
      casesData.forEach((caseItem: any) => {
        const caseId = String(caseItem.id);
        nodeIds.add(caseId);

        nodes.push({
          id: caseId,
          name: caseItem.title,
          category: 1,
          symbolSize: 40,
          itemStyle: { color: "#ff9800", borderColor: "#fff", borderWidth: 2 },
          label: { show: true, fontSize: 11, color: "#333" },
        });

        if (caseItem.knowledgeResourceId) {
          const knowledgeId = String(caseItem.knowledgeResourceId);
          if (nodeIds.has(knowledgeId)) {
            const relationName = caseItem.caseRelationName || "关联";
            links.push({
              source: caseId,
              target: knowledgeId,
              name: relationName,
              relationData: {
                relationName: relationName,
              },
              lineStyle: { opacity: 0.6, width: 2, color: "#999", curveness: 0.2 },
            });
          }
        }
      });
    }

    // 添加知识点之间的关系
    if (relationsData && Array.isArray(relationsData)) {
      relationsData.forEach((relation: any) => {
        const sourceId = String(relation.sourceKnowledgeId);
        const targetId = String(relation.targetKnowledgeId);

        // 只添加两端节点都存在的知识关系
        if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
          const relationName = relation.relationTypeDisplayName || relation.relationTypeName || "关联";
          links.push({
            source: sourceId,
            target: targetId,
            name: relationName,
            relationData: {
              relationName: relationName,
            },
            lineStyle: { opacity: 0.8, width: 2, color: "#5470c6", curveness: 0.1 },
          });
        }
      });
    }

    const categories = [
      { name: "思政知识点", itemStyle: { color: "#ef5350" } },
      { name: "思政案例", itemStyle: { color: "#ff9800" } },
    ];

    return { nodes, links, categories };
  }, [knowledgeData, casesData, relationsData]);
};

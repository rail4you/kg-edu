import { useQuery } from "@tanstack/react-query";
import {
  listCourses,
  listKnowledges,
  listUserCases,
  listRelations,
  listRelationTypes,
  getFullHierarchy,
  buildCSRFHeaders,
} from "@/lib/ash_rpc";
import { extractArrayData, getHeaders } from "../utils";

export const useCoursesQuery = (user: any, tenantValue: string) => {
  return useQuery({
    queryKey: ["courses", user?.id, tenantValue],
    queryFn: async () => {
      const result = await listCourses({
        tenant: tenantValue,
        fields: ["id", "title", "description"],
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!tenantValue && !!user,
    staleTime: 10 * 60 * 1000,
  });
};

export const useKnowledgeQuery = (
  selectedCourseId: string,
  user: any,
  tenantValue: string
) => {
  return useQuery({
    queryKey: ["ideopolitical-knowledge", selectedCourseId, tenantValue],
    queryFn: async () => {
      if (!selectedCourseId) return [];

      const result = await listKnowledges({
        tenant: tenantValue,
        fields: ["id", "name", "subject", "unit", "tag", "description"],
        filter: { courseId: { eq: selectedCourseId } },
        headers: getHeaders(user),
      });

      const allData = extractArrayData(result);
      return allData.filter((k: any) => k.tag && k.tag.includes("课程思政"));
    },
    enabled: !!selectedCourseId && !!tenantValue && !!user,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCasesQuery = (
  selectedCourseId: string,
  user: any,
  tenantValue: string
) => {
  return useQuery({
    queryKey: ["ideological-cases", selectedCourseId, tenantValue],
    queryFn: async () => {
      if (!selectedCourseId) return [];

      const result = await listUserCases({
        tenant: tenantValue,
        fields: [
          "id",
          "title",
          "description",
          "content",
          "caseRelationName",
          "knowledgeResourceId",
          { knowledgeResource: ["id", "name", "courseId"] },
        ],
        filter: {
          knowledgeResource: { courseId: { eq: selectedCourseId } },
        },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!selectedCourseId && !!tenantValue && !!user,
    staleTime: 5 * 60 * 1000,
  });
};

export const useResourcesQuery = (
  selectedCourseId: string,
  user: any,
  tenantValue: string
) => {
  return useQuery({
    queryKey: ["ideological-resources", selectedCourseId, tenantValue],
    queryFn: async () => {
      if (!selectedCourseId) return { flat: [], hierarchy: [] };

      const result = await getFullHierarchy({
        tenant: tenantValue,
        input: { courseId: selectedCourseId },
        fields: [
          "id",
          "name",
          "knowledgeType",
          "subject",
          "unit",
          "tag",
          {
            childUnits: [
              "id",
              "name",
              "knowledgeType",
              "subject",
              "unit",
              "tag",
              {
                childCells: ["id", "name", "knowledgeType", "subject", "unit", "tag"],
              },
            ],
          },
        ],
        headers: buildCSRFHeaders() as Record<string, string>,
      });

      if (!result.success) {
        const errorMsg = (result as any).errors?.[0]?.message || "Failed to fetch resources";
        throw new Error(errorMsg);
      }

      const flatResources: any[] = [];
      const hierarchyData = result.data;

      if (Array.isArray(hierarchyData)) {
        hierarchyData.forEach((subject: any) => {
          flatResources.push({
            id: subject.id,
            name: subject.name,
            knowledgeType: subject.knowledgeType,
            subject: subject.subject,
            unit: subject.unit,
            tag: subject.tag,
          });

          if (subject.childUnits && Array.isArray(subject.childUnits)) {
            subject.childUnits.forEach((unit: any) => {
              flatResources.push({
                id: unit.id,
                name: unit.name,
                knowledgeType: unit.knowledgeType,
                subject: unit.subject,
                unit: unit.unit,
                tag: unit.tag,
              });

              if (unit.childCells && Array.isArray(unit.childCells)) {
                unit.childCells.forEach((cell: any) => {
                  flatResources.push({
                    id: cell.id,
                    name: cell.name,
                    knowledgeType: cell.knowledgeType,
                    subject: cell.subject,
                    unit: cell.unit,
                    tag: cell.tag,
                  });
                });
              }
            });
          }
        });
      }

      return { flat: flatResources, hierarchy: hierarchyData };
    },
    enabled: !!selectedCourseId && !!tenantValue && !!user,
    staleTime: 10 * 60 * 1000,
  });
};

export const useRelationTypesQuery = (user: any, tenantValue: string) => {
  return useQuery({
    queryKey: ["relation-types", tenantValue],
    queryFn: async () => {
      const result = await listRelationTypes({
        tenant: tenantValue,
        fields: ["id", "name", "displayName", "description"],
        sort: "displayName",
        headers: buildCSRFHeaders() as Record<string, string>,
      });

      if (!result.success) {
        const errorMsg = (result as any).errors?.[0]?.message || "Failed to fetch relation types";
        throw new Error(errorMsg);
      }
      return extractArrayData(result);
    },
    enabled: !!tenantValue && !!user,
    staleTime: 10 * 60 * 1000,
  });
};

export const useRelationsQuery = (
  selectedCourseId: string,
  user: any,
  tenantValue: string
) => {
  return useQuery({
    queryKey: ["ideological-relations", selectedCourseId, tenantValue],
    queryFn: async () => {
      if (!selectedCourseId) return [];

      const result = await listRelations({
        tenant: tenantValue,
        fields: [
          "id",
          "relationTypeId",
          "sourceKnowledgeId",
          "targetKnowledgeId",
          { relationType: ["id", "name", "displayName"] },
          {
            sourceKnowledge: ["id", "name", "knowledgeType", "subject", "unit", "tag"],
          },
          { targetKnowledge: ["id", "name", "knowledgeType", "subject", "unit"] },
        ],
        filter: {
          or: [
            { sourceKnowledge: { courseId: { eq: selectedCourseId } } },
            { targetKnowledge: { courseId: { eq: selectedCourseId } } },
          ],
        },
        sort: "-id",
        page: { limit: 1000 },
        headers: buildCSRFHeaders() as Record<string, string>,
      });

      if (!result.success) {
        const errorMsg = (result as any).errors?.[0]?.message || "Failed to fetch relations";
        throw new Error(errorMsg);
      }

      const allRelations = extractArrayData(result);
      return allRelations.filter(
        (r: any) => r.sourceKnowledge?.tag && r.sourceKnowledge.tag.includes("课程思政")
      );
    },
    enabled: !!selectedCourseId && !!tenantValue && !!user,
    staleTime: 5 * 60 * 1000,
  });
};

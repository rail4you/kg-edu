import { useMutation, useQueryClient } from "@tanstack/react-query";
import { message } from "antd";
import {
  createUserCase,
  updateUserCase,
  destroyUserCase,
  createRelation,
  updateRelation,
  destroyRelation,
  createResource,
  updateResource,
  destroyResource,
} from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";

const getHeaders = (user: any): Record<string, string> =>
  getAuthHeaders(user) as Record<string, string>;

export const useCaseMutations = (
  tenant: string,
  user: any,
  selectedCourseId: string,
) => {
  const queryClient = useQueryClient();

  const createCaseMutation = useMutation({
    mutationFn: async (data: any) => {
      const result = await createUserCase({
        tenant,
        input: {
          title: data.title,
          content: data.content,
          knowledgeResourceId: data.knowledgeResourceId,
          caseRelationName: data.caseRelationName || null,
        },
        fields: [
          "id",
          "title",
          "content",
          "knowledgeResourceId",
          "caseRelationName",
        ],
        headers: getHeaders(user),
      });

      if (!result.success) {
        const errorMsg = (result as any).errors?.[0]?.message || "Failed to create case";
        throw new Error(errorMsg);
      }

      return result.data;
    },
    onSuccess: () => {
      message.success("案例创建成功");
      queryClient.invalidateQueries({ queryKey: ["ideological-cases"] });
    },
    onError: (error: any) => {
      message.error(error?.message || "创建失败");
    },
  });

  const updateCaseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const result = await updateUserCase({
        tenant,
        primaryKey: id,
        input: {
          title: data.title,
          content: data.content,
          description: data.description || "",
          caseRelationName: data.caseRelationName || null,
        },
        fields: [
          "id",
          "title",
          "content",
          "knowledgeResourceId",
          "caseRelationName",
        ],
        headers: getHeaders(user),
      });

      if (!result.success) {
        const errorMsg = (result as any).errors?.[0]?.message || "Failed to update case";
        throw new Error(errorMsg);
      }

      return result.data;
    },
    onSuccess: () => {
      message.success("案例更新成功");
      queryClient.invalidateQueries({ queryKey: ["ideological-cases"] });
    },
    onError: (error: any) => {
      message.error(error?.message || "更新失败");
    },
  });

  const deleteCaseMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await destroyUserCase({
        tenant,
        primaryKey: id,
        headers: getHeaders(user),
      });

      if (!result.success) {
        const errorMsg = (result as any).errors?.[0]?.message || "Failed to delete case";
        throw new Error(errorMsg);
      }

      return result.data;
    },
    onSuccess: () => {
      message.success("案例删除成功");
      queryClient.invalidateQueries({ queryKey: ["ideological-cases"] });
    },
    onError: (error: any) => {
      message.error(error?.message || "删除失败");
    },
  });

  return {
    createCaseMutation,
    updateCaseMutation,
    deleteCaseMutation,
  };
};

export const useRelationMutations = (
  tenant: string,
  user: any,
  selectedCourseId: string,
  onRelationCreateSuccess?: () => void,
) => {
  const queryClient = useQueryClient();

  const createRelationMutation = useMutation({
    mutationFn: async (data: {
      sourceKnowledgeId: string;
      targetKnowledgeId: string;
      relationTypeId: string;
    }) => {
      const result = await createRelation({
        tenant,
        input: {
          sourceKnowledgeId: data.sourceKnowledgeId,
          targetKnowledgeId: data.targetKnowledgeId,
          relationTypeId: data.relationTypeId,
        },
        fields: [
          "id",
          "relationTypeId",
          "sourceKnowledgeId",
          "targetKnowledgeId",
          { relationType: ["id", "name", "displayName"] },
          {
            sourceKnowledge: ["id", "name", "knowledgeType", "subject", "unit"],
          },
          {
            targetKnowledge: ["id", "name", "knowledgeType", "subject", "unit"],
          },
        ],
        headers: getHeaders(user),
      });

      if (!result.success) {
        const errorMsg = (result as any).errors?.[0]?.message || "Failed to create knowledge relation";
        throw new Error(errorMsg);
      }

      return result.data;
    },
    onSuccess: () => {
      message.success("关系创建成功");
      queryClient.invalidateQueries({
        queryKey: ["ideological-relations", selectedCourseId],
      });
      if (onRelationCreateSuccess) {
        onRelationCreateSuccess();
      }
    },
    onError: (error: any) => {
      message.error(error?.message || "创建失败");
    },
  });

  const updateRelationMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      updateData: {
        sourceKnowledgeId: string;
        targetKnowledgeId: string;
        relationTypeId: string;
      };
    }) => {
      const result = await updateRelation({
        tenant,
        primaryKey: data.id,
        input: {
          relationTypeId: data.updateData.relationTypeId,
          sourceKnowledgeId: data.updateData.sourceKnowledgeId,
          targetKnowledgeId: data.updateData.targetKnowledgeId,
        },
        fields: [
          "id",
          "relationTypeId",
          "sourceKnowledgeId",
          "targetKnowledgeId",
          { relationType: ["id", "name", "displayName"] },
          {
            sourceKnowledge: ["id", "name", "knowledgeType", "subject", "unit"],
          },
          {
            targetKnowledge: ["id", "name", "knowledgeType", "subject", "unit"],
          },
        ],
        headers: getHeaders(user),
      });

      if (!result.success) {
        const errorMsg = (result as any).errors?.[0]?.message || "Failed to update knowledge relation";
        throw new Error(errorMsg);
      }

      return result.data;
    },
    onSuccess: () => {
      message.success("关系更新成功");
      queryClient.invalidateQueries({
        queryKey: ["ideological-relations", selectedCourseId],
      });
    },
    onError: (error: any) => {
      message.error(error?.message || "更新失败");
    },
  });

  const deleteRelationMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await destroyRelation({
        tenant,
        primaryKey: id,
        headers: getHeaders(user),
      });

      if (!result.success) {
        const errorMsg = (result as any).errors?.[0]?.message || "Failed to delete knowledge relation";
        throw new Error(errorMsg);
      }

      return result.data;
    },
    onSuccess: () => {
      message.success("关系删除成功");
      queryClient.invalidateQueries({
        queryKey: ["ideological-relations", selectedCourseId],
      });
    },
    onError: (error: any) => {
      message.error(error?.message || "删除失败");
    },
  });

  return {
    createRelationMutation,
    updateRelationMutation,
    deleteRelationMutation,
  };
};

export const useKnowledgeMutations = (
  tenant: string,
  user: any,
  selectedCourseId: string,
) => {
  const queryClient = useQueryClient();

  const createKnowledgeMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      tag?: string;
      subject?: string;
      unit?: string;
      importanceLevel?: string;
      knowledgeType?: "subject" | "knowledge_unit" | "knowledge_cell";
    }) => {
      const result = await createResource({
        tenant,
        input: {
          name: data.name,
          description: data.description || null,
          tag: data.tag || "课程思政",
          subject: data.subject || null,
          unit: data.unit || null,
          courseId: selectedCourseId,
          importanceLevel: data.importanceLevel || "normal",
          knowledgeType: data.knowledgeType || "subject",
        },
        fields: ["id", "name", "description", "tag", "subject", "unit", "knowledgeType"],
        headers: getHeaders(user),
      });

      if (!result.success) {
        const errorMsg = (result as any).errors?.[0]?.message || "Failed to create knowledge";
        throw new Error(errorMsg);
      }

      return result.data;
    },
    onSuccess: () => {
      message.success("知识点创建成功");
      queryClient.invalidateQueries({ queryKey: ["ideopolitical-knowledge", selectedCourseId] });
    },
    onError: (error: any) => {
      message.error(error?.message || "创建失败");
    },
  });

  const updateKnowledgeMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      name: string;
      description?: string;
      tag?: string;
      importanceLevel?: string;
    }) => {
      const result = await updateResource({
        tenant,
        primaryKey: data.id,
        input: {
          name: data.name,
          description: data.description || null,
          tag: data.tag || "课程思政",
          importanceLevel: data.importanceLevel || "normal",
        },
        fields: ["id", "name", "description", "tag", "knowledgeType"],
        headers: getHeaders(user),
      });

      if (!result.success) {
        const errorMsg = (result as any).errors?.[0]?.message || "Failed to update knowledge";
        throw new Error(errorMsg);
      }

      return result.data;
    },
    onSuccess: () => {
      message.success("知识点更新成功");
      queryClient.invalidateQueries({ queryKey: ["ideopolitical-knowledge", selectedCourseId] });
    },
    onError: (error: any) => {
      message.error(error?.message || "更新失败");
    },
  });

  const deleteKnowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await destroyResource({
        tenant,
        primaryKey: id,
        headers: getHeaders(user),
      });

      if (!result.success) {
        const errorMsg = (result as any).errors?.[0]?.message || "Failed to delete knowledge";
        throw new Error(errorMsg);
      }

      return result.data;
    },
    onSuccess: () => {
      message.success("知识点删除成功");
      queryClient.invalidateQueries({ queryKey: ["ideopolitical-knowledge", selectedCourseId] });
    },
    onError: (error: any) => {
      message.error(error?.message || "删除失败");
    },
  });

  return {
    createKnowledgeMutation,
    updateKnowledgeMutation,
    deleteKnowledgeMutation,
  };
};

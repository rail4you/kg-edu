/**
 * KgEdu Agent 工具定义
 * 使用 Pi SDK defineTool() 创建所有工具
 */

import { Type } from "@sinclair/typebox";
import { defineTool } from "@mariozechner/pi-coding-agent";
import * as api from "../lib/api-client.js";

// ============================================================
// 课程工具
// ============================================================

export const getCoursesTool = defineTool({
  name: "GetCourses",
  label: "获取课程列表",
  description:
    "获取所有课程列表。当用户询问任何关于课程的内容时，必须首先调用此工具。",
  parameters: Type.Object({}),
  execute: async () => {
    const courses = await api.getCourses();
    const summary = courses.map((c) => ({
      id: c.id,
      title: c.title,
      major: c.major,
      semester: c.semester,
      publishStatus: c.publishStatus,
    }));
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }], details: { courses } };
  },
});

export const getCoursesByMajorTool = defineTool({
  name: "GetCoursesByMajor",
  label: "按专业获取课程",
  description: "根据专业/学科获取课程列表",
  parameters: Type.Object({
    major: Type.String({ description: "专业名称" }),
  }),
  execute: async (_id, params) => {
    const courses = await api.getCoursesByMajor(params.major);
    return { content: [{ type: "text", text: JSON.stringify(courses, null, 2) }], details: {} };
  },
});

export const getCoursesBySemesterTool = defineTool({
  name: "GetCoursesBySemester",
  label: "按学期获取课程",
  description: "根据学期获取课程列表",
  parameters: Type.Object({
    semester: Type.String({ description: "学期" }),
  }),
  execute: async (_id, params) => {
    const courses = await api.getCoursesBySemester(params.semester);
    return { content: [{ type: "text", text: JSON.stringify(courses, null, 2) }], details: {} };
  },
});

// ============================================================
// 知识资源工具
// ============================================================

export const getKnowledgeResourcesTool = defineTool({
  name: "GetKnowledgeResources",
  label: "获取知识资源",
  description: "获取知识资源（知识点/课时），可按课程ID筛选",
  parameters: Type.Object({
    courseId: Type.Optional(Type.String({ description: "课程ID" })),
  }),
  execute: async (_id, params) => {
    const resources = await api.getKnowledgeResources(params.courseId);
    return { content: [{ type: "text", text: JSON.stringify(resources, null, 2) }], details: {} };
  },
});

// ============================================================
// 练习题工具
// ============================================================

export const getExercisesTool = defineTool({
  name: "GetExercises",
  label: "获取练习题",
  description: "获取练习题，可按课程ID或知识资源ID筛选",
  parameters: Type.Object({
    courseId: Type.Optional(Type.String({ description: "课程ID" })),
    knowledgeResourceId: Type.Optional(Type.String({ description: "知识资源ID" })),
  }),
  execute: async (_id, params) => {
    const exercises = await api.getExercises(params.courseId, params.knowledgeResourceId);
    return { content: [{ type: "text", text: JSON.stringify(exercises, null, 2) }], details: {} };
  },
});

export const generateExercisesTool = defineTool({
  name: "GenerateExercises",
  label: "AI生成练习题",
  description: "使用AI生成多个练习题。需要指定知识点、题型、数量和难度。",
  parameters: Type.Object({
    courseId: Type.String({ description: "课程ID（必需）" }),
    knowledgeName: Type.String({ description: "知识点名称" }),
    exerciseType: Type.String({ description: "题目类型" }),
    number: Type.Number({ description: "生成数量" }),
    difficulty: Type.Optional(Type.Number({ description: "难度(1-5)" })),
  }),
  execute: async (_id, params) => {
    const orgSchema = api.getOrgSchema();
    if (!orgSchema) {
      return { content: [{ type: "text", text: "错误：未设置租户上下文(orgSchema)" }], isError: true };
    }
    const result = await api.generateExercises({
      tenant: orgSchema,
      input: { ...params, difficulty: params.difficulty || 3 },
    });
    return {
      content: [{
        type: "text",
        text: result.success
          ? `练习题生成成功！\n${JSON.stringify((result as any).exercises || result.data, null, 2)}`
          : `生成失败：${result.error || (result as any).message}`,
      }],
      details: result,
    };
  },
});

// ============================================================
// 试卷工具
// ============================================================

export const getExamsTool = defineTool({
  name: "GetExams",
  label: "获取试卷列表",
  description: "获取试卷列表，可按课程ID筛选",
  parameters: Type.Object({
    courseId: Type.Optional(Type.String({ description: "课程ID" })),
  }),
  execute: async (_id, params) => {
    const exams = await api.getExams(params.courseId);
    return { content: [{ type: "text", text: JSON.stringify(exams, null, 2) }], details: {} };
  },
});

// ============================================================
// 文档生成工具
// ============================================================

export const saveAsDocxTool = defineTool({
  name: "SaveAsDocxAndUpload",
  label: "生成DOCX文档",
  description: "创建DOCX文档（如教案）并上传到云存储。必需：content、courseId。",
  parameters: Type.Object({
    content: Type.String({ description: "Markdown 格式的文档内容" }),
    courseId: Type.String({ description: "课程ID（必需）" }),
    fileName: Type.Optional(Type.String({ description: "文件名" })),
    knowledgeResourceId: Type.Optional(Type.String({ description: "知识资源ID" })),
  }),
  execute: async (_id, params) => {
    const orgSchema = api.getOrgSchema();
    if (!orgSchema) {
      return { content: [{ type: "text", text: "错误：未设置租户上下文" }], isError: true };
    }
    const result = await api.generateDocx({
      orgSchema,
      content: params.content,
      courseId: params.courseId,
      fileName: params.fileName,
      knowledgeResourceId: params.knowledgeResourceId,
      userId: api.getUserId() || undefined,
    });
    return {
      content: [{
        type: "text",
        text: result.success
          ? `文档已生成！\n- URL: ${result.fileUrl}\n- ID: ${result.fileId}`
          : `文档生成失败：${result.error}`,
      }],
      details: result,
      isError: !result.success,
    };
  },
});

// ============================================================
// PPT 生成工具
// ============================================================

export const generatePptxTool = defineTool({
  name: "GeneratePowerPointWithShapeCrawler",
  label: "生成PPT课件",
  description: "生成PPT/PPTX演示文稿课件。用户提到PPT、课件、幻灯片时必须调用。",
  parameters: Type.Object({
    courseName: Type.String({ description: "课程名称" }),
    knowledgeName: Type.Optional(Type.String({ description: "知识点名称" })),
    courseId: Type.Optional(Type.String({ description: "课程ID" })),
    knowledgeResourceId: Type.Optional(Type.String({ description: "知识资源ID" })),
    userRequirements: Type.Optional(Type.String({ description: "用户额外需求" })),
    author: Type.Optional(Type.String({ description: "作者" })),
  }),
  execute: async (_id, params, _signal, onUpdate) => {
    const orgSchema = api.getOrgSchema();
    if (!orgSchema) {
      return { content: [{ type: "text", text: "错误：未设置租户上下文" }], isError: true };
    }
    onUpdate?.({ content: [{ type: "text", text: `正在为「${params.courseName}」生成PPT课件...` }] });

    const result = await api.generatePptx({
      orgSchema,
      courseName: params.courseName,
      knowledgeName: params.knowledgeName,
      courseId: params.courseId,
      knowledgeResourceId: params.knowledgeResourceId,
      author: params.author,
      userRequirements: params.userRequirements,
      userId: api.getUserId() || undefined,
    });
    return {
      content: [{
        type: "text",
        text: result.success
          ? `PPT课件已生成！\n- 课程: ${params.courseName}\n- URL: ${result.fileUrl}\n- ID: ${result.fileId}`
          : `PPT生成失败：${result.error}`,
      }],
      details: result,
      isError: !result.success,
    };
  },
});

// 所有工具汇总
export const allTools = [
  getCoursesTool,
  getCoursesByMajorTool,
  getCoursesBySemesterTool,
  getKnowledgeResourcesTool,
  getExercisesTool,
  generateExercisesTool,
  getExamsTool,
  saveAsDocxTool,
  generatePptxTool,
];

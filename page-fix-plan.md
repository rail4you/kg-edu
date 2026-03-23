# 页面功能修复计划

## 概述
本项目记录 `app-fix.md` 中的所有页面功能修复任务。

## 任务总览

| 序号 | 页面 | 功能修复 | 状态 | 开始时间 | 完成时间 |
|------|------|----------|------|----------|----------|
| 1 | knowledge-file.tsx | AI生成文件加AI标签 | ✅ 已完成 | 2026-03-23 | 2026-03-23 |
| 2 | video.tsx | 修复全部课程筛选 | ✅ 已完成 | 2026-03-23 | 2026-03-23 |
| 3 | exam-exercises.tsx | 组卷预览添加移除按钮 | ✅ 已完成 | 2026-03-23 | 2026-03-23 |
| 4 | knowledge-resource.tsx | 知识点序号按层级显示 | ✅ 已完成 | 2026-03-23 | 2026-03-23 |
| 5 | check-in-management.tsx | 去掉签到记录位置列 | ✅ 已完成 | 2026-03-23 | 2026-03-23 |
| 6 | learning-recommendations.tsx | 修复推荐课程列表显示 | ✅ 已完成 | 2026-03-23 | 2026-03-23 |
| 7 | activity-summary.tsx | 学习知识点资源显示名称 | ✅ 已完成 | 2026-03-23 | 2026-03-23 |
| 8 | student/front.tsx | 修复课程目录章节编号 | ✅ 已完成 | 2026-03-23 | 2026-03-23 |
| 9 | student/graph.tsx | 图谱学习历史视频显示 | ✅ 已完成 | 2026-03-23 | 2026-03-23 |
| 10 | student/resource.tsx | 添加习题作业悬停预览 | ✅ 已完成 | 2026-03-23 | 2026-03-23 |
| 11 | student/chat.tsx | AI助手默认命令设置 | ✅ 已完成 | 2026-03-23 | 2026-03-23 |
| 12 | teacher/ai-agent-chat.tsx | 去掉会话历史文本提示 | ✅ 已完成 | 2026-03-23 | 2026-03-23 |
| 13 | student/graph.tsx | 习题答案显示完整选项 | ✅ 已完成 | 2026-03-23 | 2026-03-23 |

## 详细修复方案

### 1. knowledge-file.tsx - AI标签
- **文件**: `kg-edu-vite-antd/src/pages/teacher/knowledge-file.tsx`
- **说明**: 确认AI生成文件的AI标签已正确显示
- **相关代码**: 第602-604行，检查 exercise.aiType === "ai_generated"

### 2. video.tsx - 全部课程筛选
- **文件**: `kg-edu-vite-antd/src/pages/teacher/video.tsx`
- **说明**: 修复"全部课程"选项无法正确筛选视频的问题
- **相关代码**: 第1161-1174行，课程筛选Select组件
- **问题**: 空字符串值处理逻辑

### 3. exam-exercises.tsx - 组卷预览移除按钮
- **文件**: `kg-edu-vite-antd/src/pages/teacher/exam-exercises.tsx`
- **说明**: 在组卷预览界面添加移除按钮，允许移除不需要的习题
- **相关代码**: 第1460-1651行，预览Modal组件
- **修复内容**:
  - 在预览卡片中添加移除按钮
  - 添加移除回调函数
  - 更新预览列表状态

### 4. knowledge-resource.tsx - 知识点序号层级显示
- **文件**: `kg-edu-vite-antd/src/pages/teacher/knowledge-resource.tsx`
- **说明**: 知识点序号改为按层级显示 (1, 1.1, 1.1.1)
- **相关代码**: 第1099-1104行，序号列渲染
- **修复内容**:
  - 解析 path 字段生成层级序号
  - 修改 render 逻辑显示层级序号

### 5. check-in-management.tsx - 去掉位置列
- **文件**: `kg-edu-vite-antd/src/pages/teacher/check-in-management.tsx`
- **说明**: 签到记录表格去掉位置列
- **相关代码**: 第397-402行，recordColumns 定义

### 6. learning-recommendations.tsx - 推荐课程列表
- **文件**: `kg-edu-vite-antd/src/pages/teacher/learning-recommendations.tsx`
- **说明**: 修复选择课程列表显示"无课程"的问题
- **相关代码**: 第726-736行，课程筛选Select组件
- **修复内容**:
  - 显示有推荐项目的课程列表
  - 而非仅显示已选课程

### 7. activity-summary.tsx - 知识点资源名称显示
- **文件**: `kg-edu-vite-antd/src/pages/teacher/activity-summary.tsx`
- **说明**: 学习知识点资源需要显示资源名称
- **相关代码**: 第428-434行 formatMetadata，第601-656行 formatResourceDetails
- **修复内容**:
  - 当 actionType === "study" 且 resourceType === "knowledge_resource" 时
  - 添加查询获取知识点资源详情并显示名称

### 8. student/front.tsx - 课程目录章节编号
- **文件**: `kg-edu-vite-antd/src/pages/student/front.tsx`
- **说明**: 修复课程目录章节编号错误问题（第二章变成4）
- **相关代码**: 第786-798行，章节编号逻辑
- **修复内容**:
  - 移除基于 path 的编号逻辑
  - 改用扁平化顺序编号 (1, 2, 3...)

### 9. student/graph.tsx - 图谱学习历史视频标题
- **文件**: `kg-edu-vite-antd/src/pages/student/graph.tsx`
- **说明**: 图谱资源学习历史中视频显示为"未命名视频"
- **相关代码**: 第401-441行，getResourceDisplay 函数
- **修复内容**: 确保从 API 获取视频标题并显示

### 10. student/resource.tsx - 习题作业悬停预览
- **文件**: `kg-edu-vite-antd/src/pages/student/resource.tsx`
- **说明**: 学生端资源管理添加习题和作业的鼠标悬停预览效果
- **相关代码**: 第605-607行
- **修复内容**:
  - 参考 teacher/knowledge-file.tsx 的 ExercisesTable 实现
  - 为 exercise 和 homework 添加 Popover 悬停预览

### 11. student/chat.tsx - AI助手默认命令
- **文件**: `kg-edu-vite-antd/src/pages/student/chat.tsx`
- **说明**: 学生端AI助手添加默认AI命令选择
- **相关代码**: 第79-95行，第228-234行
- **修复内容**:
  - 设置 selectedCommand 默认值
  - 建议默认为"课程助手"或第一条命令

### 12. teacher/ai-agent-chat.tsx - 去掉会话历史文本
- **文件**: `kg-edu-vite-antd/src/pages/teacher/ai-agent-chat.tsx`
- **说明**: 教师端AI智能体助手左侧会话列表去掉历史信息文本提示
- **相关代码**: 第553-556行，会话列表项渲染

### 13. student/graph.tsx - 习题答案显示完整选项
- **文件**: `kg-edu-vite-antd/src/pages/student/graph.tsx`
- **说明**: 图谱学习选择题答案只显示选项字母，需显示完整选项内容
- **相关代码**: 第670-699行，习题答案显示
- **修复内容**:
  - 获取选项内容
  - 显示 "C. xxxxxxx" 而非仅 "C"

---

## 更新日志

### 2026-03-23
- 创建修复计划文档

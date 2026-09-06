## Context

当前教师端实验管理模块的保存逻辑存在问题：
- `experiment-form.tsx` 在创建或更新实验成功后，直接跳转到 `/teacher/dashboard/experiment-management`，不携带任何课程参数
- `experiment-management.tsx` 使用本地 state `selectedCourseId` 来过滤实验列表，初始值为 `null`
- 这导致保存成功后页面显示未选择课程的空实验列表，用户无法确认实验是否已正确保存到对应课程

## Goals / Non-Goals

**Goals:**
- 修复实验保存后重定向到正确课程栏目的问题
- 保存成功后自动选中对应的课程并展示实验列表

**Non-Goals:**
- 不修改实验管理的整体架构
- 不修改课程选择组件的基本交互逻辑

## Decisions

1. **使用 URL Query 参数传递课程 ID**
   - 替代方案：使用 React Context 全局状态
   - 理由：URL 参数更直观、可分享，且与页面刷新后状态保持一致

2. **修改 experiment-management 读取 URL 参数**
   - 在组件加载时从 URL search params 读取 `courseId` 参数
   - 设置到本地 state `selectedCourseId`，初始化选中状态
   - 这样可以支持从实验表单页面跳转过来时带上的课程 ID

## Risks / Trade-offs

- [风险] URL 参数可能为空或不合法 → 兜底为空时显示全课程选择状态
- [风险] 刷新页面后 URL 参数保留，但 state 重置 → 与 URL 同步即可解决

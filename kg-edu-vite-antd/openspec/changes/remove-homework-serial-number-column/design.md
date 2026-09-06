## Context

当前教师端作业管理页面 (`src/pages/teacher/homework.tsx`) 的表格组件包含"序号"列，该列显示作业的排序位置（position 字段）。序号列目前不是用户关注的核心信息，移除该列可以使界面更加简洁。

## Goals / Non-Goals

**Goals:**
- 移除作业管理表格中的"序号"列
- 保持其他列的功能和显示不变

**Non-Goals:**
- 不修改作业的排序逻辑（position 字段仍然存在）
- 不修改其他页面或功能

## Decisions

### 1. 移除序号列 vs 隐藏序号列
- **决定**: 直接移除序号列定义
- **理由**: 序号列不再被业务需求，不需要保留代码。如果未来需要恢复，可以从 git 历史中恢复

### 2. 保留 position 字段
- **决定**: 后端 API 和数据结构中保留 position 字段
- **理由**: 作业的排序功能仍然需要，序号列只是展示层面不需要

## Risks / Trade-offs

- **风险**: 无明显风险
- **权衡**: 移除展示列不影响功能，收益大于风险

## Migration Plan

1. 修改 `src/pages/teacher/homework.tsx` 中的 columns 定义，移除序号列
2. 运行 `npm run lint` 检查代码
3. 验证页面显示正常

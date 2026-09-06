## Why

当前知识点关联页面的源知识点和目标知识点选择使用的是简单的下拉选择器，无法展示知识点的层级结构。用户难以直观地了解所选知识点在知识体系中的位置和与其他知识点的关系，影响知识点关联的效率和准确性。

## What Changes

- 将源知识点选择器从 Select 下拉框替换为树状视图选择器
- 将目标知识点选择器从 Select 下拉框替换为树状视图选择器
- 树状视图的数据获取、显示和排序逻辑与知识点管理页面保持一致
- 支持搜索过滤功能，与现有搜索体验一致

## Capabilities

### New Capabilities
- `knowledge-point-tree-select`: 知识点树状选择组件，支持在知识点关联场景中选择源知识点和目标知识点

### Modified Capabilities
- 无

## Impact

- 主要影响文件：`src/pages/teacher/knowledge-relation.tsx`
- 可能复用组件：`src/pages/teacher/knowledge-file.tsx` 中的 `KnowledgeTreeView`
- API：无新增，使用现有 `/api/knowledge/hierarchy/nested` 接口

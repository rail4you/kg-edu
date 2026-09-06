## Why

当前知识点树在页面加载时默认展开所有节点，当知识点层级较深时，用户需要滚动很长时间才能查看一级节点的完整列表。默认折叠子节点可以提升页面加载性能和用户体验，让用户首先看到知识点的整体结构，再按需展开查看细节。

## What Changes

- 修改 `KnowledgeTreeView` 组件的默认展开行为
- 初始状态只展开第一级节点，其他层级默认折叠
- 用户可以手动展开/折叠节点
- 搜索时保持原有的自动展开行为

## Capabilities

### New Capabilities
- `knowledge-tree-collapse-levels`: 知识点树默认折叠层级功能

### Modified Capabilities
- 无

## Impact

- 仅影响 `src/pages/teacher/knowledge-file.tsx` 中的 `KnowledgeTreeView` 组件
- 无 API 变更
- 无数据库变更

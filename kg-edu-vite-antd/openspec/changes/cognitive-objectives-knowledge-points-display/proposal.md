## Why

当前认知目标页面的知识点显示采用表格形式，按学科分组，无法展示知识点的层级结构。用户需要能够像知识点管理页面一样，以树状视图查看知识点，并按照 sortPath 排序。

## What Changes

- 修改认知目标页面知识点展示方式，从表格改为树状视图
- 使用 sortPath 字段进行排序，保持与知识点管理页面一致的排序逻辑
- 支持树节点的展开/折叠操作
- 保留原有的认知维度筛选和搜索功能

## Capabilities

### New Capabilities
- `cognitive-objectives-tree-view`: 认知目标页面知识点树状视图展示

### Modified Capabilities
- (无)

## Impact

- 修改文件：`src/pages/teacher/knowledge-cognitive-goals.tsx`
- 需要引入 `buildTree` 工具函数和排序逻辑
- 保持向后兼容，现有功能不受影响

## Context

当前知识点关联页面 (`knowledge-relation.tsx`) 使用 `Select` 下拉选择器来选择源知识点和目标知识点。这种实现存在以下问题：
1. 无法展示知识点的层级结构
2. 用户难以直观了解知识点在知识体系中的位置
3. 当知识点数量较多时，搜索和定位困难

知识点管理页面 (`knowledge-resource.tsx`) 和知识文件页面 (`knowledge-file.tsx`) 已经实现了树状视图展示知识点层级的功能，使用 `/api/knowledge/hierarchy/nested` API 获取层级数据，并通过 `sortPath` 字段进行排序。

## Goals / Non-Goals

**Goals:**
- 将源知识点和目标选择器替换为树状视图选择器
- 树状视图的数据获取逻辑与知识点管理页面一致
- 树状视图的排序逻辑与知识点管理页面一致（按 sortPath 排序）
- 保持现有的搜索过滤功能
- 保持用户交互体验的一致性

**Non-Goals:**
- 不修改知识点管理页面本身的树状视图实现
- 不添加新的 API 接口
- 不修改已创建关系的显示方式

## Decisions

**Decision 1: 复用现有 KnowledgeTreeView 组件 vs 新建组件**

方案 A：复用 `knowledge-file.tsx` 中的 `KnowledgeTreeView` 组件
- 优点：减少代码重复，保持一致性
- 缺点：需要适配 modal 中的使用场景

方案 B：创建新的树状选择组件
- 优点：更灵活，可以针对 modal 场景优化
- 缺点：代码重复

**选择方案 A**：复用 `KnowledgeTreeView` 组件，但需要将其从 `knowledge-file.tsx` 中提取为独立组件，或在 `knowledge-relation.tsx` 中实现类似逻辑。

**Decision 2: 数据获取方式**

使用 `/api/knowledge/hierarchy/nested` 接口获取层级数据，与知识点管理页面保持一致。

**Decision 3: 树节点选择交互**

由于是在 Modal 中使用，选择单个节点后应自动关闭树展开状态并显示已选择的项目名称。

## Risks / Trade-offs

1. **性能风险**：层级数据可能较大
   -  Mitigation: 利用 AntD Tree 的虚拟滚动特性

2. **用户体验风险**：树状选择不如下拉选择直观
   - Mitigation: 保留搜索功能，保持与现有体验一致

3. **代码耦合风险**：复用组件可能导致模块耦合
   - Mitigation: 提取通用组件，保持接口清晰

## Context

当前认知目标页面（knowledge-cognitive-goals.tsx）使用 Table 组件展示知识点，按学科（subject）分组显示。这种方式无法展示知识点的层级结构（学科 -> 知识点单元 -> 知识点），用户难以直观地理解知识点的层次关系。

知识点管理页面（knowledge-resource.tsx）已经实现了树状视图展示，使用 `buildTree` 函数构建树结构，并使用 `sortPath` 字段进行排序。

## Goals / Non-Goals

**Goals:**
- 在认知目标页面实现知识点树状视图展示
- 使用 sortPath 字段进行排序，与知识点管理页面保持一致
- 支持树节点的展开/折叠操作
- 保留原有的认知维度筛选和搜索功能

**Non-Goals:**
- 不修改知识点数据模型
- 不修改认知维度的管理功能
- 不添加新的 API 接口

## Decisions

### 1. 复用现有 buildTree 函数

从 knowledge-resource.tsx 复用 `buildTree` 函数构建树结构。该函数已经处理了：
- 将平铺数据转换为树结构
- 按 sortPath 排序子树节点
- 移除空 children 数组

### 2. 使用 Ant Design Tree 组件

选择 Ant Design 的 Tree 组件进行展示，原因：
- 项目已使用 Ant Design UI 库
- 支持树节点的展开/折叠
- 支持拖拽排序（未来可扩展）
- 支持自定义节点渲染

### 3. 保持现有数据结构

知识点查询需要增加 `parentId` 和 `sortPath` 字段，以支持树结构的构建和排序。

## Risks / Trade-offs

- [风险] 大数据量下树组件性能可能下降 →  Mitigation: 使用虚拟滚动或分页加载
- [风险] 与现有筛选功能可能存在冲突 →  Mitigation: 树视图仅改变展示方式，筛选逻辑保持不变

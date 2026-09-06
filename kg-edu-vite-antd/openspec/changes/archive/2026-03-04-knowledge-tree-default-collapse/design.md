## Context

当前 `KnowledgeTreeView` 组件在 `src/pages/teacher/knowledge-file.tsx` 中使用 Ant Design 的 `Tree` 组件展示知识点树。代码中使用了 `defaultExpandAll` 属性，使得页面加载时所有节点都自动展开。当知识点层级较深时，这会导致：
1. 页面加载时需要渲染大量 DOM 节点，影响性能
2. 用户需要滚动大量距离才能查看其他一级节点
3. 视觉上不够整洁，难以快速了解知识点的整体结构

## Goals / Non-Goals

**Goals:**
- 实现知识点树默认只展开第一级节点
- 保持用户手动展开/折叠节点的功能
- 搜索时自动展开匹配节点的行为保持不变

**Non-Goals:**
- 不修改后端 API 或数据结构
- 不添加新的 UI 组件
- 不改变树节点的渲染逻辑

## Decisions

1. **使用受控的 expandedKeys 替代 defaultExpandAll**
   - 当前代码使用 `defaultExpandAll` 属性实现全展开
   - 改为使用 `expandedKeys` 状态进行受控展开
   - 初始状态只包含第一级节点的 key

2. **初始展开逻辑**
   - 从树数据中提取第一级节点的 key
   - 作为 `expandedKeys` 的初始值
   - 用户点击展开图标时更新 `expandedKeys`

3. **搜索保持原有行为**
   - 搜索时仍然自动展开所有匹配的节点
   - 清除搜索后恢复只展开第一级的状态

## Risks / Trade-offs

- [风险] 用户可能习惯于之前的全展开行为 → 文档说明此为产品决策
- [风险] 深层嵌套的知识点可能需要多次点击才能展开 → 可接受的交互成本

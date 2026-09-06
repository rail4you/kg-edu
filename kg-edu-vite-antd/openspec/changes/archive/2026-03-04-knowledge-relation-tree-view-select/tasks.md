## 1. 数据获取

- [x] 1.1 在 knowledge-relation.tsx 中添加使用 `/api/knowledge/hierarchy/nested` API 获取层级数据的 query
- [x] 1.2 实现数据处理函数，将 API 返回的层级数据转换为树形结构（与 knowledge-resource.tsx 一致）
- [x] 1.3 实现按 sortPath 排序的逻辑

## 2. 树状选择组件

- [x] 2.1 创建 KnowledgeTreeSelect 组件，支持：
  - 树状展示知识点
  - 搜索过滤功能
  - 选中节点回调
- [x] 2.2 实现搜索高亮功能（与 knowledge-file.tsx 一致）
- [x] 2.3 支持清空已选节点

## 3. 集成到知识点关联页面

- [x] 3.1 将源知识点的 Select 替换为 KnowledgeTreeSelect 组件
- [x] 3.2 将目标知识点的 Select 替换为 KnowledgeTreeSelect 组件
- [x] 3.3 确保课程切换时树数据正确更新
- [x] 3.4 保留或适配 form 表单验证逻辑

## 4. 测试与验证

- [x] 4.1 测试源知识点树选择功能
- [x] 4.2 测试目标知识点树选择功能
- [x] 4.3 测试搜索过滤功能
- [x] 4.4 测试课程切换后树数据更新
- [x] 4.5 测试创建知识点关系功能正常工作

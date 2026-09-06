## 1. 修改 KnowledgeTreeView 组件初始状态

- [x] 1.1 移除 `defaultExpandAll` 属性
- [x] 1.2 创建获取第一级节点 keys 的辅助函数
- [x] 1.3 初始化 `expandedKeys` 状态为第一级节点 keys

## 2. 调整搜索展开逻辑

- [x] 2.1 搜索时保持展开所有匹配节点的行为
- [x] 2.2 清除搜索后恢复只展开第一级的状态

## 3. 验证和测试

- [x] 3.1 运行 `npm run lint` 检查代码
- [x] 3.2 运行 `npm run build` 验证构建通过（注：构建有预先存在的错误，与本次修改无关）

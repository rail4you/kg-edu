## 1. 准备工作

- [x] 1.1 在 knowledge-cognitive-goals.tsx 中引入 Tree 组件 from antd
- [x] 1.2 从 knowledge-resource.tsx 复制 buildTree 工具函数到 cognitive-goals 页面

## 2. 数据查询改造

- [x] 2.1 修改知识点查询，增加 sortPath 字段
- [x] 2.2 创建 TreeNode 接口定义

## 3. 树状视图实现

- [x] 3.1 使用 buildTree 函数将平铺数据转换为树结构
- [x] 3.2 用 Ant Design Tree 组件替换现有的 Table 组件展示知识点
- [x] 3.3 实现树节点的展开/折叠功能

## 4. 功能适配

- [x] 4.1 保留认知维度筛选功能，更新筛选逻辑适配树视图
- [x] 4.2 保留搜索功能，更新搜索逻辑适配树视图
- [x] 4.3 保留认知目标分布统计功能

## 5. 样式和交互优化

- [x] 5.1 调整树节点样式，显示知识点名称和认知维度标签
- [x] 5.2 添加空状态处理

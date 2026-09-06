## Why

能力图谱页面存在三个用户体验问题：1）能力节点点击后只显示基本信息，无法查看关联的文件、视频、习题等学习资源；2）能力管理表格中描述字段文本过长导致布局混乱；3）图谱节点悬停时无法查看描述信息。这些问题影响了教师使用能力图谱进行教学资源管理的效率。

## What Changes

1. **能力节点关联资源展示**：在能力图谱中，点击主能力或子能力节点时，显示侧边面板展示关联的文件、视频、习题等资源（与课程图谱知识点点击效果一致）
2. **表格描述字段截断**：能力管理表格中，描述列超出宽度时自动截断并显示省略号，鼠标悬停显示完整文本的 Tooltip
3. **图谱节点悬停描述**：能力图谱节点悬停时，显示节点名称和描述文本的 Tooltip

## Capabilities

### New Capabilities
- `competency-node-resources`: 能力节点关联资源展示 - 点击能力节点时显示侧边面板，包含关联的文件、视频、习题等资源列表

### Modified Capabilities
- `competency-graph-display`: 能力图谱显示优化 - 修改图谱节点 tooltip 显示描述，优化表格列的文本显示

## Impact

- 修改 `src/pages/teacher/graph-competency.tsx` - 主能力图谱页面
- 复用 `src/components/KnowledgeResourcePanel.tsx` 组件展示关联资源
- 可能需要调整 API 查询以获取能力节点关联的资源数据

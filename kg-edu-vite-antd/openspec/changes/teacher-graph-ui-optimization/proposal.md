## Why

教师端图谱界面存在以下问题需要优化：
1. 四个图谱（知识图谱、树状图谱、环状图谱、问题图谱）各自独立选择课程，不统一
2. "知识图谱"Tab名称不够清晰，未体现"关系"概念
3. 知识关系图谱的关系过滤功能不完善，未基于真实数据，且无点击过滤功能
4. 问题图谱点击后只显示基本信息，缺少问题详情和关联知识点信息
5. 思政图谱缺少知识点管理功能，关系类型未统一

## What Changes

1. **统一课程选择**：将课程选择器移至页面顶部，四个图谱共享同一个课程选择状态
2. **Tab重命名**：将"知识图谱"改为"知识关系图谱"
3. **关系过滤增强**：
   - 关系类型选项基于图谱真实数据动态生成
   - 不同颜色区分
  关系类型使用不同 - 点击关系标签可触发过滤
4. **问题图谱详情**：
   - 点击问题节点显示问题详情Drawer
   - 显示问题关联的知识点信息
5. **思政图谱知识点管理**：
   - 新增知识点管理模块
   - 关系类型复用 `/teacher/dashboard/knowledge-relation` 页面的类型

## Capabilities

### New Capabilities
- `unified-course-selection`: 统一课程选择组件，四个图谱共享课程状态
- `knowledge-relation-graph`: 知识关系图谱（重命名+功能增强）
- `question-graph-details`: 问题图谱详情查看功能
- `ideological-knowledge-management`: 思政图谱知识点管理

### Modified Capabilities
- `graph-tabs`: Tab导航组件（修改Tab名称）

## Impact

- 修改文件：
  - `src/pages/teacher/graph-knowledge.tsx`
  - `src/pages/teacher/graph-question.tsx`
  - `src/pages/teacher/graph-tree.tsx`
  - `src/pages/teacher/graph-circle.tsx`
  - `src/pages/teacher/graph-ideological/index.tsx`
- 新增文件：
  - 思政图谱知识点管理组件
  - 统一课程选择组件
- API：无新增API，复用现有接口

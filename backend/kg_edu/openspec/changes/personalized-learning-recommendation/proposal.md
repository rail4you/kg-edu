## Why

当前前端已有"有待学习推荐、正在学习的推荐、已完成的推荐"界面，但后端缺少相应的API支持。需要基于用户学习行为（activity_logs）和知识点答题情况（student_exam_answers）来实现个性化学习推荐，分析知识点薄弱程度，并基于同课程学生的学习行为推荐热门资源。

## What Changes

1. 新增学习推荐记录表 `user_learning_recommendations`，记录推荐给用户的学习资源及状态
2. 新增知识点掌握度分析功能，基于答题错误率计算知识点薄弱程度
3. 新增资源推荐API，支持三种推荐类型：待学习（其他学生常看但该用户未查看）、进行中（已查看）、已完成（用户标记完成）
4. 新增推荐资源状态管理API，支持标记完成操作
5. 新增教师端知识点薄弱分析API，支持查看班级学生的知识点掌握情况

## Capabilities

### New Capabilities
- `knowledge-point-weakness-analysis`: 基于答题错误率分析知识点薄弱程度
- `resource-recommendation`: 基于同课程学生学习行为推荐热门资源
- `learning-progress-tracking`: 跟踪和管理用户的学习进度与推荐状态

### Modified Capabilities
- 无

## Impact

- 后端新增 API 端点：学习推荐、知识点分析
- 新增数据表或字段：user_learning_recommendations
- 涉及模块：KgEdu.Knowledge、KgEdu.Activity

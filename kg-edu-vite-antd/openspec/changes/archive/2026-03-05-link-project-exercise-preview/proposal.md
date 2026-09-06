## Why

当前知识点详情页面已支持关联习题列表显示，但用户需要点击进入详情页面才能查看习题的具体内容，查看习题效率较低。通过鼠标悬停快速预览习题详情，可以提升用户体验，让教师快速了解习题内容，提高知识点与习题关联管理的效率。

## What Changes

- 在习题列表中增加鼠标悬停预览功能
- 悬停时显示习题详情浮层，包含题目内容、答案、解析等信息
- 保持原有点击进入详情页的功能不变
- 优化习题卡片的交互体验

## Capabilities

### New Capabilities
- `exercise-hover-preview`: 习题鼠标悬停预览功能

### Modified Capabilities
- 无

## Impact

- 仅影响 `src/pages/teacher/knowledge-file.tsx` 中的 `ExercisesTable` 组件
- 无 API 变更
- 无数据库变更

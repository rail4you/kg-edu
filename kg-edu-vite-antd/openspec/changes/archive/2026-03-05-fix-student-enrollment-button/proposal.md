## Why

学生选课页面的"选课"按钮缺失，登录后的学生在课程详情页查看未选课程时，无法进行选课操作。当前页面仅显示"进入课程学习"(已选课)或"浏览更多课程"(未登录)，但缺少"立即选课"按钮供已登录但未选课的学生使用。

## What Changes

1. 在学生课程详情页(front.tsx)添加"立即选课"按钮
2. 添加 enrollStudent API 调用实现选课功能
3. 选课成功后自动跳转到课程学习页面
4. 添加选课按钮的加载状态和错误处理

## Capabilities

### New Capabilities
- `student-self-enrollment`: 学生自主选课功能，允许登录学生在课程详情页直接选课

### Modified Capabilities
- (无)

## Impact

- 修改文件: `src/pages/student/front.tsx`
- 使用 API: `enrollStudent` from `@/lib/ash_rpc`

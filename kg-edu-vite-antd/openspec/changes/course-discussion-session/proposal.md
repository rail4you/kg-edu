## Why

目前系统中的讨论功能 (`discussion-management`) 是一个静态的讨论列表管理页面，学生无法直接参与讨论，需要教师作为中介。用户需要一个可以通过扫码方式进入的实时互动讨论区，学生可以针对自己选修的课程，与同课程的同学和老师进行讨论。

## What Changes

1. **新增讨论会话管理功能 (教师端)**
   - 教师可以创建讨论会话，选择课程、填写主题
   - 创建后生成 6 位 token 和二维码
   - 教师可以查看、关闭、删除讨论会话

2. **新增学生讨论区页面 (学生端)**
   - 通过二维码或链接访问，需要登录
   - 验证用户的选课关系
   - 显示课程列表和成员列表
   - 显示讨论帖子列表（类似博客）
   - 支持发布新讨论帖子

3. **复用现有 Discussion 数据模型**
   - 讨论帖子使用现有的 `discussion` 表
   - 新增 `discussion_session` 表用于管理讨论会话

## Capabilities

### New Capabilities
- `course-discussion-session`: 课程讨论会话功能，包括教师创建会话、学生扫码参与讨论

## Impact

- **前端**: 新增教师端讨论会话管理页面、学生端讨论区页面
- **后端**: 需要新增 `discussion_session` 相关 API
- **路由**: 新增 `/student/discussion/:tenantSchema/:token` 路由

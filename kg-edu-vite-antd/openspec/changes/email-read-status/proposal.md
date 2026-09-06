## Why

当前邮件系统缺少已读/未读状态跟踪功能，老师无法快速识别哪些邮件是新收到的，学生给老师发送邮件后也没有即时提醒。这影响了邮件的处理效率和用户体验。

## What Changes

- **后端改动**：
  - 在 `EmailMessageResourceSchema` 中新增 `readStatus` 字段（枚举：`unread` | `read`）
  - 新增 `readAt` 字段记录已读时间
  - 新增邮件标记已读API
- **前端改动**：
  - 老师端邮件列表显示未读状态标识（红点或Tag）
  - 增加"一键已读"按钮，可批量标记为已读
  - 页面顶部显示未读邮件数量提醒

## Capabilities

### New Capabilities
- `email-read-status`: 邮件可读状态管理 - 后端模型字段和API，前端展示和交互

### Modified Capabilities
- 无

## Impact

- 后端：`ash_rpc.ts` 中的 EmailMessageResourceSchema 和相关API
- 前端：`src/pages/teacher/email-messages.tsx`

## Context

当前邮件系统（EmailMessageResourceSchema）只跟踪邮件的发送状态（pending/sending/sent/failed），没有已读/未读状态。学生给老师发送邮件后，老师无法快速识别新邮件，影响邮件处理效率。

## Goals / Non-Goals

**Goals:**
- 为邮件增加可读状态（unread/read）
- 在老师端界面显示未读邮件提醒
- 提供一键已读功能

**Non-Goals:**
- 不包含邮件撤回、归档等功能
- 不修改学生端界面

## Decisions

1. **数据模型设计**
   - 新增 `readStatus` 字段（枚举：`unread` | `read`），默认值为 `unread`
   - 新增 `readAt` 字段记录已读时间戳
   - 根邮件（parentMessageId为空）才有独立的已读状态

2. **API设计**
   - 新增 `markEmailAsRead` API，支持单个和批量标记已读
   - 读取邮件列表时自动将邮件标记为已读（可选）

3. **前端交互设计**
   - 未读邮件显示红点标识
   - 顶部显示未读数量提醒 badge
   - 列表操作列增加"标记已读"按钮
   - 新增"一键已读"按钮，批量标记所有未读邮件

## Risks / Trade-offs

- [风险] 新字段可能影响现有数据 → 迁移时设置默认值为 `unread`
- [风险] 批量操作性能问题 → 分批处理，设置合理超时

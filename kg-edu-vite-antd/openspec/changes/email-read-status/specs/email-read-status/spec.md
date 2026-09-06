## ADDED Requirements

### Requirement: 邮件可读状态
系统 SHALL 支持邮件的已读/未读状态跟踪，默认值为未读（unread）。

#### Scenario: 新邮件默认为未读
- **WHEN** 学生给老师发送新邮件
- **THEN** 该邮件的 readStatus 为 `unread`

#### Scenario: 标记邮件为已读
- **WHEN** 老师点击"标记已读"按钮
- **THEN** 该邮件的 readStatus 变为 `read`，readAt 记录当前时间

### Requirement: 批量标记已读
系统 SHALL 支持一键将所有未读邮件标记为已读。

#### Scenario: 一键已读
- **WHEN** 老师点击"一键已读"按钮
- **THEN** 所有未读邮件的 readStatus 变为 `read`，readAt 记录当前时间

### Requirement: 未读邮件提醒
系统 SHALL 在老师端界面显示未读邮件数量提醒。

#### Scenario: 显示未读数量
- **WHEN** 老师打开邮件列表页面
- **THEN** 页面顶部显示未读邮件数量 badge

#### Scenario: 未读标识
- **WHEN** 邮件的 readStatus 为 `unread`
- **THEN** 该邮件在列表中显示未读标识（如红点）

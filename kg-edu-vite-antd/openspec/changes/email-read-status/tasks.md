## 1. 后端实现

- [x] 1.1 在 EmailMessageResourceSchema 中增加 readStatus 字段（枚举：unread | read）
- [x] 1.2 在 EmailMessageResourceSchema 中增加 readAt 字段（时间戳）
- [x] 1.3 创建 markEmailAsRead API（支持单个和批量标记已读）

## 2. 前端实现

- [x] 2.1 在 EmailMessage 接口中增加 readStatus 和 readAt 字段
- [x] 2.2 在邮件列表查询中包含 readStatus 和 readAt 字段
- [x] 2.3 在表格中增加未读标识列或样式
- [x] 2.4 在页面顶部增加未读数量 badge 提醒
- [x] 2.5 增加"一键已读"按钮及功能
- [x] 2.6 增加单个邮件"标记已读"按钮

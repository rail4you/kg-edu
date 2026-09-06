## ADDED Requirements

### Requirement: 教师创建讨论会话
系统 SHALL 允许教师创建课程讨论会话，生成可供学生扫码参与的讨论区。

#### Scenario: 创建讨论会话
- **WHEN** 教师填写讨论主题、选择课程、点击创建
- **THEN** 系统创建讨论会话，生成 6 位 token，返回成功消息

#### Scenario: 查看讨论会话列表
- **WHEN** 教师打开讨论会话管理页面
- **THEN** 系统显示该教师创建的所有讨论会话列表，包括主题、课程、状态、创建时间

#### Scenario: 查看二维码
- **WHEN** 教师点击讨论会话的二维码按钮
- **THEN** 系统显示该会话的二维码和访问链接

#### Scenario: 关闭讨论会话
- **WHEN** 教师点击关闭讨论会话
- **THEN** 系统将会话状态设为 closed，学生不能再发帖

#### Scenario: 删除讨论会话
- **WHEN** 教师点击删除讨论会话
- **WHEN** 系统确认删除操作
- **THEN** 系统删除讨论会话

### Requirement: 学生访问讨论区
系统 SHALL 允许学生通过二维码或链接访问课程讨论区。

#### Scenario: 访问讨论区链接
- **WHEN** 学生访问 /student/discussion/:tenantSchema/:token
- **THEN** 系统验证 token 有效性，无效则显示错误

#### Scenario: 未登录时访问
- **WHEN** 未登录用户访问有效讨论链接
- **THEN** 系统显示登录提示，引导用户登录

#### Scenario: 验证选课关系
- **WHEN** 已登录用户访问讨论链接
- **THEN** 系统验证用户是否选了该课程，未选则显示无权限

#### Scenario: 会话已关闭
- **WHEN** 用户访问状态为 closed 的讨论会话
- **THEN** 系统显示会话已关闭提示

### Requirement: 查看课程列表和成员
系统 SHALL 显示学生所选课程的列表和课程成员。

#### Scenario: 显示课程列表
- **WHEN** 学生进入讨论区
- **THEN** 系统显示该学生选的所有课程列表

#### Scenario: 显示课程成员
- **WHEN** 学生选择某个课程
- **THEN** 系统显示该课程的所有学生和老师列表，区分身份

### Requirement: 发布讨论帖子
系统 SHALL 允许已登录且已选课的学生和老师发布讨论帖子。

#### Scenario: 发布新帖子
- **WHEN** 用户填写标题和内容、点击发布
- **THEN** 系统创建讨论帖子，刷新列表显示新帖子

#### Scenario: 查看帖子列表
- **WHEN** 用户进入课程讨论区
- **THEN** 系统显示该课程的讨论帖子列表，按时间倒序

#### Scenario: 删除帖子
- **WHEN** 帖子作者或会话创建者点击删除
- **THEN** 系统删除该帖子

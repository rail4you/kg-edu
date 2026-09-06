## 1. 后端 Elixir 资源定义

- [x] 1.1 ~~在 ash_rpc.ts 中添加 DiscussionSession 相关类型定义~~ (由 mix ash.codegen 生成)
- [x] 1.2 ~~实现 create_discussion_session API~~ (由 mix ash.codegen 生成)
- [x] 1.3 ~~实现 list_discussion_sessions API~~ (由 mix ash.codegen 生成)
- [x] 1.4 ~~实现 get_discussion_session_by_token API~~ (由 mix ash.codegen 生成)
- [x] 1.5 ~~实现 close_discussion_session API~~ (由 mix ash.codegen 生成)
- [x] 1.6 ~~实现 delete_discussion_session API~~ (由 mix ash.codegen 生成)
- [x] 1.7 创建 DiscussionSession 资源 (Elixir)
- [x] 1.8 运行 mix ash.migrate 创建数据库表
- [x] 1.9 运行 mix ash.codegen 生成 TypeScript API
- [x] 1.10 Discussion 资源添加 session_id 关联 (可选，简化实现)

## 2. 教师端页面开发

- [x] 2.1 创建讨论会话管理页面 discussion-session.tsx
- [x] 2.2 实现会话列表展示功能
- [x] 2.3 实现创建会话对话框
- [x] 2.4 实现二维码显示功能
- [x] 2.5 实现关闭/删除会话功能

## 3. 学生端页面开发

- [x] 3.1 创建学生讨论区页面 student/discussion.tsx
- [x] 3.2 实现 token 验证和登录检查
- [x] 3.3 实现选课关系验证
- [x] 3.4 实现课程列表展示
- [x] 3.5 实现课程成员列表展示
- [x] 3.6 实现讨论帖子列表
- [x] 3.7 实现发布新帖子功能

## 4. 路由和菜单配置

- [x] 4.1 在 App.tsx 中添加学生讨论区路由
- [x] 4.2 在 teacher-menu-config 中添加入口（或在现有菜单中）
- [x] 4.3 添加教师端讨论会话管理路由

## 5. 测试和优化

- [ ] 5.1 测试教师创建会话流程
- [ ] 5.2 测试学生扫码访问流程
- [ ] 5.3 测试发布讨论功能
- [x] 5.4 运行 lint 检查代码
- [x] 5.5 构建验证

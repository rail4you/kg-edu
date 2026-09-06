## Context

当前系统已有 `discussion` 表用于存储讨论帖子，但只支持教师管理，学生无法直接参与。系统已有 `check-in` 模块实现了类似的扫码访问模式，本设计参考该模式进行实现。

## Goals / Non-Goals

**Goals:**
- 实现教师创建课程讨论会话，生成二维码供学生扫码参与
- 实现学生扫码后登录，进入讨论区与同学和老师互动
- 复用现有 `discussion` 表存储讨论帖子
- 保持与现有签到系统一致的用户体验

**Non-Goals:**
- 不实现实时推送功能（WebSocket）
- 不实现复杂的讨论管理功能（锁定、置顶等）
- 不支持匿名用户发言（必须登录）

## Decisions

### 1. 数据模型设计

新增 `discussion_session` 表：

```typescript
interface DiscussionSession {
  id: UUID;
  title: string;                    // 讨论主题
  description?: string;             // 描述
  courseId: UUID;                   // 关联课程
  createdById: UUID;                // 创建者(老师)
  token: string;                    // 6位随机字符串
  status: "active" | "closed";      // 状态
  startedAt: UtcDateTime;
  endedAt?: UtcDateTime;
}
```

讨论帖子复用现有 `discussion` 表，新增 `sessionId` 字段关联会话。

### 2. 访问验证流程

```
学生访问 → 验证 token → 验证会话状态 → 验证登录 → 验证选课关系 → 进入讨论区
```

### 3. 前端架构

参考现有签到系统实现：
- 教师端：`/teacher/dashboard/discussion-session` 页面
- 学生端：`/student/discussion/:tenantSchema/:token` 页面

### 4. API 设计

| API | 说明 |
|-----|------|
| `create_discussion_session` | 创建讨论会话 |
| `list_discussion_sessions` | 列出老师的讨论会话 |
| `get_discussion_session_by_token` | 通过 token 获取会话 |
| `close_discussion_session` | 关闭讨论会话 |
| `delete_discussion_session` | 删除讨论会话 |

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 后端 API 需要新增 | 需要后端配合实现 |
| token 可能冲突 | 使用 UUID 或足够长度的随机字符串 |

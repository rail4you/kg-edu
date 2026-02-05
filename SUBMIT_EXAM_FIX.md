# 学生考试提交功能修复说明

## 问题描述

在调用 `submit_exam` RPC action 时，出现以下错误：

```
%Ash.Error.Invalid.NoSuchInput{
  resource: KgEdu.Knowledge.StudentExamAnswer,
  action: :update,
  input: :answer,
  ...
}
```

**原因**：`StudentExamAnswer` 资源的默认 `update` action 没有接受 `answer` 和 `answered_at` 字段。

## 修复方案

### 1. 添加新的 update action (lib/kg_edu/knowledge/student_exam_answer.ex)

在 `StudentExamAnswer` 资源中添加了专门的 `update_answer` action：

```elixir
update :update_answer do
  description "Update answer for a student exam answer"
  accept [:answer]
  change fn changeset, _context ->
    changeset
    |> Ash.Changeset.change_attribute(:answered_at, DateTime.utc_now())
  end
end
```

这个 action：
- ✅ 接受 `answer` 字段
- ✅ 自动设置 `answered_at` 为当前时间

### 2. 修改 submit_exam action (lib/kg_edu/knowledge/student_exam.ex)

修改了 `StudentExam.submit_exam` action 中更新答案的逻辑：

**修改前**（错误）：
```elixir
Ash.update(
  answer_record,
  %{
    answer: answer_value,
    answered_at: DateTime.utc_now()
  },
  tenant: tenant
)
```

**修改后**（正确）：
```elixir
answer_record
|> Ash.Changeset.for_update(:update_answer, %{answer: answer_value})
|> Ash.update(tenant: tenant)
```

## 如何测试修复

### 步骤 1：重新编译代码

```bash
cd /Users/bai/projects/kg-edu/backend/kg_edu
mix compile
```

### 步骤 2：重启服务器

如果服务器正在运行，需要重启它：

```bash
# 停止当前运行的服务器（Ctrl+C）
# 然后重新启动
mix phx.server
```

### 步骤 3：测试 submit_exam 接口

使用以下 JSON 请求测试：

```json
{
  "action": "submit_exam",
  "tenant": "org_2af44c7b_081a_497a_9858_365fa90ad5d7",
  "input": {
    "student_exam_id": "dc42cc90-a636-40f8-a22c-ce49398d3644",
    "answers": {
      "99199d54-c2ed-4d7b-914a-9a662ddd0479": "1"
    }
  },
  "fields": ["id", "status", "submittedAt"]
}
```

### 步骤 4：检查日志

查看应用日志，应该看到：

```
[info] submit_exam called with student_exam_id: dc42cc90-a636-40f8-a22c-ce49398d3644
[info] Answers count: 1
[info] Updating answer 99199d54-c2ed-4d7b-914a-9a662ddd0479 with value: 1
[info] All answers updated successfully, submitting exam
[info] Sent 200 in XXXms
```

### 成功的响应示例

```json
{
  "success": true,
  "data": {
    "id": "dc42cc90-a636-40f8-a22c-ce49398d3644",
    "status": "submitted",
    "submittedAt": "2025-01-22T12:34:56Z"
  }
}
```

## 可能的错误情况

### 1. 考试不在进行中

**错误响应**：
```json
{
  "success": false,
  "errors": [
    {
      "type": "invalid",
      "message": "Exam is not in progress, current status: submitted"
    }
  ]
}
```

**解决方案**：确保考试状态为 `in_progress`

### 2. 答案不属于该考试

**错误响应**：
```json
{
  "success": false,
  "errors": [
    {
      "type": "invalid",
      "message": "Failed to update some answers: Answer xxx does not belong to student exam xxx"
    }
  ]
}
```

**解决方案**：确保所有答案 ID 都属于该学生考试

### 3. 答案 ID 不存在

**错误响应**：
```json
{
  "success": false,
  "errors": [
    {
      "type": "invalid",
      "message": "Failed to update some answers: ..."
    }
  ]
}
```

**解决方案**：检查答案 ID 是否正确

## 完整的测试流程

### 1. 开始考试

```bash
curl -X POST http://localhost:4000/rpc/run \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -d '{
    "action": "start_exam",
    "input": {
      "exam_id": "YOUR_EXAM_ID",
      "student_id": "YOUR_STUDENT_ID"
    },
    "fields": ["id", "status"]
  }'
```

### 2. 获取考试题目

```bash
curl -X POST http://localhost:4000/rpc/run \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -d '{
    "action": "get_exam_with_questions",
    "input": {
      "student_exam_id": "STUDENT_EXAM_ID_FROM_STEP_1"
    },
    "fields": [
      "id",
      "status",
      {
        "student_exam_answers": ["id", "answer", "exercise_id"]
      }
    ]
  }'
```

### 3. 提交考试

```bash
curl -X POST http://localhost:4000/rpc/run \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -d '{
    "action": "submit_exam",
    "input": {
      "student_exam_id": "STUDENT_EXAM_ID_FROM_STEP_1",
      "answers": {
        "ANSWER_ID_1": "答案1",
        "ANSWER_ID_2": "答案2"
      }
    },
    "fields": ["id", "status", "submittedAt"]
  }'
```

### 4. 评分考试（可选）

```bash
curl -X POST http://localhost:4000/rpc/run \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -d '{
    "action": "grade_exam",
    "input": {
      "student_exam_id": "STUDENT_EXAM_ID_FROM_STEP_1"
    },
    "fields": ["id", "score", "passed", "status"]
  }'
```

## 调试技巧

### 查看详细日志

在 `lib/kg_edu/knowledge/student_exam.ex` 中，已经有详细的日志输出：

```elixir
Logger.info("submit_exam called with student_exam_id: #{student_exam_id}")
Logger.info("Answers count: #{map_size(answers_map)}")
Logger.info("Updating answer #{answer_id} with value: #{answer_value}")
Logger.info("All answers updated successfully, submitting exam")
```

### 使用 IEx 调试

启动服务器时使用 IEx：

```bash
iex -S mix phx.server
```

然后在代码中添加 `IO.inspect` 或使用 `IEx.pry` 进行调试。

## 验证修复是否成功

修复成功的标志：

1. ✅ 编译成功，没有错误
2. ✅ 日志显示 "All answers updated successfully, submitting exam"
3. ✅ 返回 HTTP 200 状态码
4. ✅ 返回的 `status` 为 `"submitted"`
5. ✅ 数据库中 `student_exam_answers` 表的 `answer` 和 `answered_at` 字段已更新

## 相关文件

- ✅ `lib/kg_edu/knowledge/student_exam_answer.ex` - 添加了 `update_answer` action
- ✅ `lib/kg_edu/knowledge/student_exam.ex` - 修改了 `submit_exam` action
- ✅ `lib/kg_edu/knowledge.ex` - RPC 配置

## 注意事项

1. **必须重启服务器**：代码更改后需要重启 Phoenix 服务器才能生效
2. **CSRF Token**：确保在请求头中包含有效的 CSRF Token
3. **Tenant Context**：确保正确设置 tenant context
4. **答案格式**：`answers` 参数必须是 map 格式，key 为答案 ID，value 为答案内容

## 后续改进建议

1. **添加事务支持**：确保所有答案更新在一个事务中完成
2. **添加验证**：验证答案数量是否匹配考试题目数量
3. **添加重试机制**：对于临时性错误自动重试
4. **优化日志**：可以添加更多调试信息
5. **添加单元测试**：确保功能的稳定性

# 考试逻辑使用指南

## 概述

新的考试逻辑实现了以下功能：
1. 学生同时只能参加一个未完成的考试
2. 如果学生有未完成的考试，系统会返回该考试而不是创建新的
3. 提供了便捷的API来继续或开始考试

## 状态说明

学生考试有以下状态：
- `:in_progress` - 进行中
- `:submitted` - 已提交
- `:graded` - 已评分

只有状态为 `:graded` 的考试才算完成，学生才能开始新的考试。

## API 说明

### 1. start_exam - 开始考试

**描述：** 创建一个新的学生考试记录。如果学生有未完成的考试（状态不是`:graded`），则返回错误。

**参数：**
- `exam_id` - 考试ID (UUID)
- `student_id` - 学生ID (UUID)

**返回：**
- 成功：`{:ok, student_exam}` - 返回新创建的学生考试记录
- 失败：`{:error, reason}` - 如果学生有未完成的考试，返回错误信息

**示例：**
```elixir
case KgEdu.Knowledge.StudentExam.start_exam(
  %{exam_id: exam_id, student_id: student_id},
  tenant: tenant
) do
  {:ok, student_exam} ->
    # 考试创建成功
    IO.puts("Exam started: #{student_exam.id}")

  {:error, reason} ->
    # 创建失败，可能是学生有未完成的考试
    IO.puts("Cannot start exam: #{inspect(reason)}")
end
```

### 2. continue_or_start_exam - 继续或开始考试（推荐使用）

**描述：** 智能判断是继续现有考试还是开始新考试：
- 如果学生正在参加该考试（状态为`:in_progress`），返回该考试及答案
- 如果学生没有该考试的进行中记录，但有其他未完成的考试，返回那个考试
- 如果学生没有未完成的考试，创建新的考试记录

**参数：**
- `exam_id` - 考试ID (UUID)
- `student_id` - 学生ID (UUID)

**返回：**
- 成功：`{:ok, student_exam}` - 返回学生考试记录，包含已加载的考试和答案
- 失败：`{:error, reason}`

**示例：**
```elixir
case KgEdu.Knowledge.StudentExam.continue_or_start_exam(
  %{exam_id: exam_id, student_id: student_id},
  tenant: tenant
) do
  {:ok, student_exam} ->
    # 获取考试数据
    exam = student_exam.exam
    answers = student_exam.student_exam_answers

    IO.puts("Exam: #{exam.title}")
    IO.puts("Status: #{student_exam.status}")
    IO.puts("Answers: #{length(answers)}")

  {:error, reason} ->
    IO.puts("Error: #{inspect(reason)}")
end
```

### 3. get_in_progress_exam - 获取进行中的考试

**描述：** 获取学生的进行中考试，包含完整的答案数据和关联的练习题信息。

**参数：**
- `student_id` - 学生ID (UUID)

**返回：**
- 成功：`{:ok, student_exam}` - 返回包含考试、答案和练习题的完整数据
- 未找到：`{:error, :not_found}` - 学生没有进行中的考试
- 失败：`{:error, reason}`

**示例：**
```elixir
case KgEdu.Knowledge.StudentExam.get_in_progress_exam(
  %{student_id: student_id},
  tenant: tenant
) do
  {:ok, student_exam} ->
    # 访问完整数据
    exam = student_exam.exam
    answers = student_exam.student_exam_answers

    # 遍历答案
    Enum.each(answers, fn answer ->
      exercise = answer.exercise
      exam_exercise = answer.exam_exercise

      IO.puts("Question: #{exercise.question}")
      IO.puts("Answer: #{answer.answer || "(未回答)"}")
      IO.puts("Points: #{exam_exercise.points}")
    end)

  {:error, :not_found} ->
    IO.puts("No in-progress exam found")

  {:error, reason} ->
    IO.puts("Error: #{inspect(reason)}")
end
```

## 使用场景

### 场景1：学生点击"开始考试"按钮

```elixir
# 前端发送请求：POST /api/exams/:exam_id/start
# 后端处理：
def start_exam(conn, %{"exam_id" => exam_id}) do
  student_id = get_student_id_from_session(conn)
  tenant = get_tenant(conn)

  case KgEdu.Knowledge.StudentExam.continue_or_start_exam(
    %{exam_id: exam_id, student_id: student_id},
    tenant: tenant
  ) do
    {:ok, student_exam} ->
      # 返回考试数据给前端
      json(conn, %{
        success: true,
        data: %{
          student_exam_id: student_exam.id,
          exam_id: student_exam.exam_id,
          status: student_exam.status,
          started_at: student_exam.started_at,
          exam: student_exam.exam,
          answers: student_exam.student_exam_answers
        }
      })

    {:error, reason} ->
      json(conn, %{
        success: false,
        error: inspect(reason)
      })
  end
end
```

### 场景2：学生刷新页面后继续答题

```elixir
# 前端发送请求：GET /api/student-exams/in-progress
# 后端处理：
def get_in_progress_exam(conn, _params) do
  student_id = get_student_id_from_session(conn)
  tenant = get_tenant(conn)

  case KgEdu.Knowledge.StudentExam.get_in_progress_exam(
    %{student_id: student_id},
    tenant: tenant
  ) do
    {:ok, student_exam} ->
      json(conn, %{
        success: true,
        data: %{
          student_exam_id: student_exam.id,
          exam: student_exam.exam,
          answers: student_exam.student_exam_answers,
          can_continue: true
        }
      })

    {:error, :not_found} ->
      json(conn, %{
        success: false,
        error: "No in-progress exam found",
        can_continue: false
      })
  end
end
```

### 场景3：检查学生是否能开始新考试

```elixir
# 前端发送请求：GET /api/students/:student_id/can-start-exam
# 后端处理：
def can_start_exam(conn, %{"student_id" => student_id}) do
  tenant = get_tenant(conn)

  # 查询学生的未完成考试
  incomplete_query =
    Ash.Query.filter(
      KgEdu.Knowledge.StudentExam,
      student_id == ^student_id and status != :graded
    )

  case Ash.read(incomplete_query, tenant: tenant) do
    {:ok, []} ->
      json(conn, %{
        can_start: true,
        message: "Student can start a new exam"
      })

    {:ok, incomplete_exams} ->
      first_exam = List.first(incomplete_exams)

      json(conn, %{
        can_start: false,
        message: "Student has an incomplete exam",
        existing_exam_id: first_exam.id,
        existing_exam_status: first_exam.status
      })

    {:error, reason} ->
      json(conn, %{
        error: inspect(reason)
      })
  end
end
```

## 数据流程

### 开始新考试的流程

```
1. 学生点击"开始考试"
   ↓
2. 前端调用 continue_or_start_exam
   ↓
3. 后端检查是否有该考试的进行中记录
   ├─ 有 → 返回该记录（继续考试）
   └─ 没有 → 检查是否有其他未完成考试
       ├─ 有 → 返回那个考试（不能开始新考试）
       └─ 没有 → 创建新的student_exam记录
           ↓
           创建空的答案记录
           ↓
           返回新考试数据
```

### 提交考试的流程

```
1. 学生完成所有答题
   ↓
2. 前端调用 submit_exam
   ↓
3. 更新所有答案
   ↓
4. 更新student_exam状态为 :submitted
   ↓
5. 调用 grade_exam 进行评分
   ↓
6. 更新student_exam状态为 :graded
   ↓
7. 学生现在可以开始新的考试了
```

## 注意事项

1. **原子性检查**：`start_exam` 使用原子性检查确保学生在创建新考试时没有未完成的考试

2. **推荐API**：建议使用 `continue_or_start_exam` 而不是直接调用 `start_exam`，因为前者会自动处理继续现有考试的情况

3. **考试答案**：开始考试时会自动为考试中的每个练习题创建空的答案记录

4. **多租户**：所有API都需要传入tenant参数以确保数据隔离

5. **错误处理**：所有API都返回 `{:ok, result}` 或 `{:error, reason}`，确保正确处理错误情况

## 测试

运行测试脚本：
```bash
# 修改 test_exam_logic.exs 中的 tenant, student_id, exam_id 后运行
elixir test_exam_logic.exs
```

## 总结

新的考试逻辑确保了：
- ✅ 学生同时只能参加一个未完成的考试
- ✅ 可以无缝继续之前的考试
- ✅ 提供了便捷的API来管理考试状态
- ✅ 防止学生同时参加多个考试导致的数据混乱

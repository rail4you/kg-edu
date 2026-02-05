# 考试系统 RPC 快速参考

## 最新更新 ✨

### `get_in_progress_exam` 空值错误已修复

**问题**: 之前当学生没有进行中的考试时，`get_in_progress_exam` 会返回 `{:error, :not_found}`，导致前端出现空值错误。

**解决方案**: 现在 `get_in_progress_exam` 支持可选的 `exam_id` 参数：
- 如果没有进行中的考试且提供了 `exam_id`，会自动创建新考试
- 修复了空值错误，确保总是返回有效的考试数据

**使用方式**:
```typescript
// 推荐：提供 exam_id，如果没有考试会自动创建
const result = await rpc.KgEdu.Knowledge.StudentExam.get_in_progress_exam({
  student_id: "student-uuid",
  exam_id: "exam-uuid"  // 可选，但推荐提供
});
```

## 问题已解决

之前的错误 `"RPC action 'continue_or_start_exam' not found"` 已经修复。

## 可用的 RPC Actions

在 Knowledge domain 中，`StudentExam` 资源现在暴露了以下 RPC actions：

### 1. `start_exam` - 开始考试
```typescript
// 前端调用
const result = await rpc.KgEdu.Knowledge.StudentExam.start_exam({
  exam_id: "exam-uuid",
  student_id: "student-uuid"
});
```

**行为：**
- ✅ 如果学生没有未完成的考试 → 创建新考试
- ❌ 如果学生有未完成的考试 → 返回错误

### 2. `continue_or_start_exam` - 继续或开始考试（推荐）⭐
```typescript
// 前端调用
const result = await rpc.KgEdu.Knowledge.StudentExam.continue_or_start_exam({
  exam_id: "exam-uuid",
  student_id: "student-uuid"
});

// 返回的数据包含：
// - student_exam: 学生考试记录
// - exam: 考试信息
// - student_exam_answers: 学生的答案列表
```

**行为：**
1. 如果学生正在参加该考试 → 返回该考试（继续）
2. 如果学生有其他未完成考试 → 返回那个考试
3. 如果学生没有未完成考试 → 创建新考试

### 3. `get_in_progress_exam` - 获取进行中的考试（支持自动创建）⭐
```typescript
// 前端调用（带自动创建）
const result = await rpc.KgEdu.Knowledge.StudentExam.get_in_progress_exam({
  student_id: "student-uuid",
  exam_id: "exam-uuid"  // 可选：如果没有进行中的考试，会自动创建
});

// 前端调用（仅查询）
const result = await rpc.KgEdu.Knowledge.StudentExam.get_in_progress_exam({
  student_id: "student-uuid"
});

// 返回的数据包含：
// - student_exam: 学生考试记录
// - exam: 考试信息
// - student_exam_answers: 答案（包含 exercise 和 exam_exercise）
```

**行为：**
- ✅ 学生有进行中的考试 → 返回完整数据
- ✅ 学生没有进行中的考试 + 提供 exam_id → **自动创建新考试并返回**（修复了空值错误）
- ❌ 学生没有进行中的考试 + 未提供 exam_id → 返回 not_found

### 4. `submit_exam` - 提交考试
```typescript
// 前端调用
const result = await rpc.KgEdu.Knowledge.StudentExam.submit_exam({
  student_exam_id: "student-exam-uuid",
  answers: {
    "answer-id-1": "答案内容1",
    "answer-id-2": "答案内容2"
  }
});
```

### 5. `grade_exam` - 评分
```typescript
// 前端调用
const result = await rpc.KgEdu.Knowledge.StudentExam.grade_exam({
  student_exam_id: "student-exam-uuid"
});
```

## 前端集成示例

### 场景1：学生点击"开始考试"按钮

```typescript
async function handleStartExam(examId: string, studentId: string) {
  try {
    // 使用 continue_or_start_exam - 推荐方式
    const response = await rpc.KgEdu.Knowledge.StudentExam.continue_or_start_exam({
      exam_id: examId,
      student_id: studentId
    });

    if (response.success) {
      const { student_exam, exam, student_exam_answers } = response.data;

      // 保存到状态
      setCurrentExam({
        studentExamId: student_exam.id,
        examId: exam.id,
        examTitle: exam.title,
        status: student_exam.status,
        startedAt: student_exam.started_at,
        questions: student_exam_answers.map(answer => ({
          answerId: answer.id,
          exerciseId: answer.exercise_id,
          question: answer.exercise.question,
          currentAnswer: answer.answer,
          points: answer.exam_exercise.points
        }))
      });

      // 跳转到考试页面
      router.push(`/exams/${student_exam.id}`);
    } else {
      // 显示错误信息
      showError(response.errors[0].message);
    }
  } catch (error) {
    console.error('Failed to start exam:', error);
  }
}
```

### 场景2：页面刷新后恢复考试状态（或自动创建）

```typescript
async function loadInProgressExam(studentId: string, examId?: string) {
  try {
    const response = await rpc.KgEdu.Knowledge.StudentExam.get_in_progress_exam({
      student_id: studentId,
      exam_id: examId  // 可选：如果没有进行中的考试，会自动创建
    });

    if (response.success && response.data) {
      const { student_exam, exam, student_exam_answers } = response.data;

      // 恢复考试状态
      setCurrentExam({
        studentExamId: student_exam.id,
        examId: exam.id,
        examTitle: exam.title,
        status: student_exam.status,
        startedAt: student_exam.started_at,
        questions: student_exam_answers.map(answer => ({
          answerId: answer.id,
          exerciseId: answer.exercise_id,
          question: answer.exercise.question,
          currentAnswer: answer.answer || "",
          points: answer.exam_exercise.points
        }))
      });

      return true;
    } else {
      // 没有进行中的考试，且未提供 exam_id
      return false;
    }
  } catch (error) {
    console.error('Failed to load in-progress exam:', error);
    return false;
  }
}
```

### 场景3：提交考试

```typescript
async function handleSubmitExam(studentExamId: string, answers: Record<string, string>) {
  try {
    const response = await rpc.KgEdu.Knowledge.StudentExam.submit_exam({
      student_exam_id: studentExamId,
      answers: answers
    });

    if (response.success) {
      // 考试已提交，现在进行评分
      const gradeResponse = await rpc.KgEdu.Knowledge.StudentExam.grade_exam({
        student_exam_id: studentExamId
      });

      if (gradeResponse.success) {
        const { student_exam } = gradeResponse.data;
        // 显示评分结果
        showScore(student_exam.score, student_exam.passed);
      }
    } else {
      showError(response.errors[0].message);
    }
  } catch (error) {
    console.error('Failed to submit exam:', error);
  }
}
```

## API 对比

| API | 用途 | 推荐场景 |
|-----|------|---------|
| `start_exam` | 强制开始新考试 | 已知学生没有其他考试时 |
| `continue_or_start_exam` ⭐ | 智能继续或开始 | **推荐用于大多数场景** |
| `get_in_progress_exam` | 获取当前考试或自动创建 | 页面刷新、恢复状态（支持自动创建） |
| `submit_exam` | 提交答案 | 学生完成考试后 |
| `grade_exam` | 评分考试 | 提交后自动评分 |

## 返回数据结构

### continue_or_start_exam 返回值

```typescript
{
  success: true,
  data: {
    student_exam: {
      id: "uuid",
      exam_id: "uuid",
      student_id: "uuid",
      status: "in_progress", // | "submitted" | "graded"
      score: 0,
      passed: false,
      started_at: "2024-01-22T10:00:00Z",
      submitted_at: null
    },
    exam: {
      id: "uuid",
      title: "期中考试",
      description: "考试说明",
      duration_minutes: 60,
      passing_score: 60
    },
    student_exam_answers: [
      {
        id: "uuid",
        answer: null,
        points_earned: 0,
        answered_at: null,
        exercise: {
          id: "uuid",
          question: "题目内容",
          type: "choice",
          options: ["A", "B", "C", "D"]
        },
        exam_exercise: {
          id: "uuid",
          points: 10,
          order: 1
        }
      }
    ]
  }
}
```

## 常见错误处理

### 错误1：学生有未完成的考试

```json
{
  "success": false,
  "errors": [
    {
      "message": "Student has incomplete exams. Please complete or finish the current exam before starting a new one."
    }
  ]
}
```

**处理：** 使用 `continue_or_start_exam` 代替 `start_exam`，它会自动处理这种情况。

### 错误2：没有进行中的考试

```json
{
  "success": false,
  "errors": [
    {
      "message": "not_found"
    }
  ]
}
```

**处理：** 这是正常情况，说明学生当前没有进行中的考试。

## 总结

✅ **修复完成** - RPC actions 已在 `lib/kg_edu/knowledge.ex` 中正确配置
✅ **推荐使用** - `continue_or_start_exam` 是最安全的选择
✅ **完整数据** - `get_in_progress_exam` 返回所有需要的数据
✅ **类型安全** - TypeScript 类型已自动生成

现在你可以直接在前端调用这些 RPC actions 了！

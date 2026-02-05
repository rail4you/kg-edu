# 学生考试整体提交功能使用指南

## 概述

学生考试模块已重新设计，现在要求学生一次性提交所有答案，而不是单独提交每个题目的答案。

## 后端更改

### 1. StudentExam 资源 (lib/kg_edu/knowledge/student_exam.ex)

#### 新的 `submit_exam` Action

```elixir
action :submit_exam do
  description "Submit a completed exam with all answers at once"

  argument :student_exam_id, :uuid do
    allow_nil? false
    description "ID of the student exam to submit"
  end

  argument :answers, :map do
    allow_nil? false
    description "Map of student_exam_answer_id to answer value. Example: %{\"uuid1\" => \"answer1\", \"uuid2\" => \"answer2\"}"
  end

  run fn input, context ->
    # 实现逻辑：
    # 1. 验证学生考试存在且状态为 in_progress
    # 2. 批量更新所有答案
    # 3. 验证每个答案是否属于该学生考试
    # 4. 如果所有答案更新成功，更新学生考试状态为 submitted
    # 5. 返回更新后的学生考试
  end
end
```

### 2. StudentExamAnswer 资源 (lib/kg_edu/knowledge/student_exam_answer.ex)

#### 移除的内容

- ❌ 移除了 `submit_answer` update action（之前的单独提交答案接口）
- ❌ 移除了 code_interface 中的 `submit_answer` 定义

### 3. Knowledge Domain (lib/kg_edu/knowledge.ex)

#### 移除的内容

- ❌ 移除了 `rpc_action :submit_answer, :submit_answer` 的RPC配置

## 前端 RPC 调用示例

### 基础调用示例

```typescript
// 定义类型
type SubmitExamInput = {
  student_exam_id: string;
  answers: {
    [key: string]: string;  // student_exam_answer_id -> answer
  };
};

// 调用 submit_exam action
const submitExam = async (studentExamId: string, answers: Record<string, string>) => {
  const response = await fetch('/rpc/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken(),
    },
    body: JSON.stringify({
      action: 'submit_exam',
      input: {
        student_exam_id: studentExamId,
        answers: answers
      },
      fields: ['id', 'status', 'submitted_at', 'score', 'passed']
    })
  });

  const result = await response.json();

  if (result.success) {
    console.log('考试提交成功！', result.data);
    return result.data;
  } else {
    console.error('提交失败:', result.errors);
    throw new Error(result.errors.map(e => e.message).join(', '));
  }
};

// 获取 CSRF token
function getCSRFToken(): string | null {
  return document
    ?.querySelector("meta[name='csrf-token']")
    ?.getAttribute("content") || null;
}
```

### React 完整示例

```typescript
import { useState, useEffect } from 'react';

interface StudentExamAnswer {
  id: string;
  answer: string | null;
  exercise_id: string;
  exam_exercise_id: string;
}

interface ExamTakingPageProps {
  studentExamId: string;
}

export function ExamTakingPage({ studentExamId }: ExamTakingPageProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [examAnswers, setExamAnswers] = useState<StudentExamAnswer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 加载考试题目
  useEffect(() => {
    const loadExamQuestions = async () => {
      try {
        const response = await fetch('/rpc/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCSRFToken(),
          },
          body: JSON.stringify({
            action: 'get_exam_with_questions',
            input: { student_exam_id: studentExamId },
            fields: ['id', 'status', {
              student_exam_answers: ['id', 'answer', 'exercise_id', 'exam_exercise_id']
            }]
          })
        });

        const result = await response.json();
        if (result.success) {
          setExamAnswers(result.data.student_exam_answers);

          // 初始化答案状态
          const initialAnswers: Record<string, string> = {};
          result.data.student_exam_answers.forEach((answer: StudentExamAnswer) => {
            if (answer.answer) {
              initialAnswers[answer.id] = answer.answer;
            } else {
              initialAnswers[answer.id] = '';
            }
          });
          setAnswers(initialAnswers);
        }
      } catch (err) {
        setError('加载考试题目失败');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadExamQuestions();
  }, [studentExamId]);

  // 处理答案变化
  const handleAnswerChange = (answerId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [answerId]: value
    }));
  };

  // 提交考试
  const handleSubmit = async () => {
    if (isSubmitting) return;

    // 验证所有题目都已作答
    const unansweredQuestions = examAnswers.filter(
      answer => !answers[answer.id] || answers[answer.id].trim() === ''
    );

    if (unansweredQuestions.length > 0) {
      setError(`还有 ${unansweredQuestions.length} 道题未作答`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await fetch('/rpc/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken(),
        },
        body: JSON.stringify({
          action: 'submit_exam',
          input: {
            student_exam_id: studentExamId,
            answers: answers
          },
          fields: ['id', 'status', 'submitted_at', 'score', 'passed']
        })
      });

      const response = await result.json();

      if (response.success) {
        setSuccess(true);
        console.log('考试提交成功！', response.data);

        // 可选：自动评分
        await autoGradeExam(studentExamId);
      } else {
        const errorMsg = response.errors
          .map((e: any) => e.message)
          .join(', ');
        setError(errorMsg);
      }
    } catch (err) {
      setError('提交失败，请重试');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 自动评分（可选）
  const autoGradeExam = async (examId: string) => {
    try {
      const response = await fetch('/rpc/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken(),
        },
        body: JSON.stringify({
          action: 'grade_exam',
          input: { student_exam_id: examId },
          fields: ['id', 'score', 'passed', 'status']
        })
      });

      const result = await response.json();
      if (result.success) {
        console.log('评分完成！', result.data);
      }
    } catch (err) {
      console.error('自动评分失败:', err);
    }
  };

  if (isLoading) {
    return <div>加载中...</div>;
  }

  if (success) {
    return (
      <div className="success-message">
        <h2>考试提交成功！</h2>
        <p>您的答案已成功提交，请等待老师批改。</p>
      </div>
    );
  }

  return (
    <div className="exam-taking-page">
      <h1>考试进行中</h1>

      {/* 显示所有题目 */}
      {examAnswers.map((examAnswer) => (
        <div key={examAnswer.id} className="question-item">
          <label>
            题目 {examAnswer.exercise_id}:
            <input
              type="text"
              value={answers[examAnswer.id] || ''}
              onChange={(e) => handleAnswerChange(examAnswer.id, e.target.value)}
              disabled={isSubmitting}
            />
          </label>
        </div>
      ))}

      {/* 提交按钮 */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="submit-button"
      >
        {isSubmitting ? '提交中...' : '提交考试'}
      </button>

      {/* 错误信息 */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
}

function getCSRFToken(): string | null {
  return document
    ?.querySelector("meta[name='csrf-token']")
    ?.getAttribute("content") || null;
}
```

### 完整的考试流程示例

```typescript
// 1. 学生开始考试
async function startExam(examId: string, studentId: string) {
  const response = await fetch('/rpc/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken(),
    },
    body: JSON.stringify({
      action: 'start_exam',
      input: {
        exam_id: examId,
        student_id: studentId
      },
      fields: ['id', 'status', 'started_at']
    })
  });

  const result = await response.json();

  if (result.success) {
    const studentExam = result.data;
    console.log('考试已开始，学生考试ID:', studentExam.id);
    return studentExam;
  } else {
    throw new Error(result.errors.map(e => e.message).join(', '));
  }
}

// 2. 获取考试题目（会自动创建空的答案记录）
async function getExamQuestions(studentExamId: string) {
  const response = await fetch('/rpc/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken(),
    },
    body: JSON.stringify({
      action: 'get_exam_with_questions',
      input: { student_exam_id: studentExamId },
      fields: [
        'id',
        'status',
        {
          student_exam_answers: ['id', 'answer', 'exercise_id', 'exam_exercise_id'],
          exam: ['id', 'title']
        }
      ]
    })
  });

  const result = await response.json();

  if (result.success) {
    return result.data;
  } else {
    throw new Error(result.errors.map(e => e.message).join(', '));
  }
}

// 3. 学生答题（前端维护答案状态）
const userAnswers: Record<string, string> = {};

function updateAnswer(answerId: string, answerValue: string) {
  userAnswers[answerId] = answerValue;
}

// 4. 提交考试（一次性提交所有答案）
async function submitExam(studentExamId: string, answers: Record<string, string>) {
  const response = await fetch('/rpc/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken(),
    },
    body: JSON.stringify({
      action: 'submit_exam',
      input: {
        student_exam_id: studentExamId,
        answers: answers
        // 格式示例:
        // {
        //   "answer-uuid-1": "这是第一题的答案",
        //   "answer-uuid-2": "这是第二题的答案",
        //   "answer-uuid-3": "A"
        // }
      },
      fields: ['id', 'status', 'submitted_at', 'score', 'passed']
    })
  });

  const result = await response.json();

  if (result.success) {
    console.log('考试提交成功！', result.data);
    return result.data;
  } else {
    throw new Error(result.errors.map(e => e.message).join(', '));
  }
}

// 5. 评分考试（可选，自动评分）
async function gradeExam(studentExamId: string) {
  const response = await fetch('/rpc/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken(),
    },
    body: JSON.stringify({
      action: 'grade_exam',
      input: { student_exam_id: studentExamId },
      fields: ['id', 'score', 'passed', 'status']
    })
  });

  const result = await response.json();

  if (result.success) {
    console.log('评分完成！得分:', result.data.score);
    console.log('是否通过:', result.data.passed);
    return result.data;
  } else {
    throw new Error(result.errors.map(e => e.message).join(', '));
  }
}

// 完整流程示例
async function completeExamFlow(examId: string, studentId: string) {
  try {
    // 1. 开始考试
    const studentExam = await startExam(examId, studentId);

    // 2. 获取题目
    const examData = await getExamQuestions(studentExam.id);
    console.log('题目数量:', examData.student_exam_answers.length);

    // 3. 学生答题（这里模拟答题过程）
    const answers: Record<string, string> = {};
    examData.student_exam_answers.forEach((answer: any) => {
      answers[answer.id] = "学生的答案"; // 实际应用中来自用户输入
    });

    // 4. 提交考试
    const submittedExam = await submitExam(studentExam.id, answers);
    console.log('考试已提交:', submittedExam);

    // 5. 自动评分
    const gradedExam = await gradeExam(studentExam.id);
    console.log('考试已完成，得分:', gradedExam.score);

    return gradedExam;
  } catch (error) {
    console.error('考试流程失败:', error);
    throw error;
  }
}
```

## 数据格式说明

### 答案映射格式

```typescript
// answers 参数格式
{
  "student_exam_answer_id_1": "答案内容1",
  "student_exam_answer_id_2": "答案内容2",
  "student_exam_answer_id_3": "A",
  // ... 更多答案
}
```

### 错误响应格式

```typescript
// 失败时的响应
{
  "success": false,
  "errors": [
    {
      "type": "validation_error",
      "message": "Exam is not in progress, current status: submitted",
      "fieldPath": null,
      "details": {}
    }
  ]
}
```

### 成功响应格式

```typescript
// 成功时的响应
{
  "success": true,
  "data": {
    "id": "student-exam-uuid",
    "status": "submitted",
    "submitted_at": "2025-01-22T12:34:56Z",
    "score": 0,
    "passed": false
  }
}
```

## 重要特性

### ✅ 原子性操作
- 所有答案要么全部保存成功，要么全部失败
- 不会出现部分答案保存、部分答案失败的情况

### ✅ 安全验证
- 验证答案是否属于该学生考试
- 验证考试状态是否为 `in_progress`
- 防止重复提交已完成的考试

### ✅ 错误处理
- 详细的错误信息
- 明确的字段路径指示
- 便于前端显示友好的错误提示

### ✅ 时间戳
- 自动记录提交时间
- 便于追踪考试进度

## 注意事项

1. **必须一次性提交所有答案**：不再支持单独提交某个题目的答案
2. **答案 ID 验证**：确保每个 answer ID 都属于该学生考试
3. **状态检查**：只能提交状态为 `in_progress` 的考试
4. **前端状态管理**：前端需要维护答案状态，直到用户点击提交

## 迁移指南

如果你之前使用的是单独提交答案的接口，需要进行以下更改：

### 旧方式（已废弃）

```typescript
// ❌ 旧方式：单独提交每个答案
await fetch('/rpc/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'submit_answer',
    input: {
      // 答案数据
    }
  })
});
```

### 新方式（推荐）

```typescript
// ✅ 新方式：一次性提交所有答案
await fetch('/rpc/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'submit_exam',
    input: {
      student_exam_id: 'exam-id',
      answers: {
        'answer-id-1': 'answer1',
        'answer-id-2': 'answer2',
        // ... 所有答案
      }
    }
  })
});
```

## 总结

这次重新设计确保了：
1. ✅ 学生必须一次性提交所有答案
2. ✅ 答案保存的原子性
3. ✅ 更好的数据一致性
4. ✅ 更清晰的业务流程
5. ✅ 更好的用户体验（避免部分提交的困惑）

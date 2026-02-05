# get_in_progress_exam 空值错误修复总结

## 🐛 问题描述

### 原始问题
- **函数**: `get_in_progress_exam`
- **位置**: `lib/kg_edu/knowledge/student_exam.ex:271`
- **错误**: 当学生没有进行中的考试时，函数返回 `{:error, :not_found}`
- **影响**: 前端调用时遇到空值错误，导致页面崩溃或无法正常工作

### 错误场景
1. 学生首次进入考试页面
2. 学生完成了之前的考试，准备开始新的考试
3. 页面刷新后尝试恢复考试状态，但之前的考试已提交

## ✅ 解决方案

### 代码变更
在 `get_in_progress_exam` action 中添加了可选的 `exam_id` 参数：

```elixir
argument :exam_id, :uuid do
  allow_nil? true
  description "ID of the exam to create if no in-progress exam exists"
end
```

### 新逻辑流程

#### 1. 查找进行中的考试
```elixir
in_progress_query = Ash.Query.filter(
  KgEdu.Knowledge.StudentExam,
  student_id == ^student_id and status == :in_progress
)
```

#### 2. 处理查询结果
```elixir
case Ash.read_one(in_progress_query, tenant: tenant) do
  {:ok, nil} ->
    # 没有进行中的考试
    if exam_id do
      # ✅ 有 exam_id：自动创建新考试
      Ash.create(KgEdu.Knowledge.StudentExam, %{exam_id: exam_id, student_id: student_id})
    else
      # ❌ 没有 exam_id：返回 not_found 错误（保持向后兼容）
      {:error, :not_found}
    end

  {:ok, student_exam} ->
    # ✅ 找到进行中的考试：返回考试数据
    Ash.load(student_exam, [:exam, student_exam_answers: [:exam_exercise, :exercise]])
end
```

## 📝 使用方式

### 方式 1：带自动创建（推荐 ⭐）

```typescript
const result = await rpc.KgEdu.Knowledge.StudentExam.get_in_progress_exam({
  student_id: "student-uuid",
  exam_id: "exam-uuid"  // 如果没有考试会自动创建
});

if (response.success) {
  // 总是返回有效的考试数据
  const { student_exam, exam, student_exam_answers } = response.data;
  // 安全地使用数据，不会出现空值错误
}
```

### 方式 2：仅查询（原有行为）

```typescript
const result = await rpc.KgEdu.Knowledge.StudentExam.get_in_progress_exam({
  student_id: "student-uuid"
});

if (response.success) {
  // 有进行中的考试
} else {
  // 没有进行中的考试，返回 false
}
```

## 🔄 与其他 API 的对比

| API | 自动创建 | 推荐场景 |
|-----|---------|---------|
| `start_exam` | ❌ 强制创建 | 确保没有其他考试时 |
| `continue_or_start_exam` | ✅ 智能创建 | **最智能的选择** |
| `get_in_progress_exam` | ✅ 可选创建 | 恢复状态或自动创建 |

### 何时使用 `get_in_progress_exam`

**使用场景**：
- 页面刷新后恢复考试状态
- 需要获取当前考试（或创建新考试）
- 不需要复杂的"检查其他未完成考试"逻辑

**优势**：
- 简单直接
- 支持自动创建
- 代码更清晰

## 🎯 前端集成示例

### React 组件示例

```typescript
import { useState, useEffect } from 'react';
import { rpc } from '@/services/rpc';

export function ExamPage({ examId, studentId }: { examId: string; studentId: string }) {
  const [examData, setExamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadOrCreateExam() {
      try {
        setLoading(true);
        setError(null);

        // 使用 get_in_progress_exam，自动处理创建逻辑
        const response = await rpc.KgEdu.Knowledge.StudentExam.get_in_progress_exam({
          student_id: studentId,
          exam_id: examId  // ✅ 提供 exam_id，确保总是有考试数据
        });

        if (response.success) {
          const { student_exam, exam, student_exam_answers } = response.data;

          // ✅ 安全地设置数据，不会出现空值错误
          setExamData({
            studentExamId: student_exam.id,
            examId: exam.id,
            examTitle: exam.title,
            status: student_exam.status,
            questions: student_exam_answers.map(answer => ({
              answerId: answer.id,
              question: answer.exercise.question,
              currentAnswer: answer.answer || "",
              points: answer.exam_exercise.points
            }))
          });
        } else {
          setError('Failed to load exam');
        }
      } catch (err) {
        console.error('Error loading exam:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadOrCreateExam();
  }, [examId, studentId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!examData) return <div>No exam data</div>;

  return (
    <div>
      <h1>{examData.examTitle}</h1>
      {/* 渲染考试题目 */}
    </div>
  );
}
```

## 🔍 测试建议

### 测试场景 1：首次进入考试
1. 学生没有进行中的考试
2. 调用 `get_in_progress_exam` 时提供 `exam_id`
3. **预期**: 自动创建新考试并返回数据

### 测试场景 2：页面刷新
1. 学生有进行中的考试
2. 页面刷新后调用 `get_in_progress_exam`
3. **预期**: 返回现有的进行中考试（不创建新考试）

### 测试场景 3：完成考试后再进入
1. 学生完成并提交了之前的考试
2. 调用 `get_in_progress_exam` 时提供新的 `exam_id`
3. **预期**: 创建新的考试

### 测试场景 4：不提供 exam_id
1. 学生没有进行中的考试
2. 调用 `get_in_progress_exam` 时不提供 `exam_id`
3. **预期**: 返回 `not_found` 错误（向后兼容）

## 📊 影响范围

### 修改的文件
1. ✅ `lib/kg_edu/knowledge/student_exam.ex` - 添加 `exam_id` 参数和自动创建逻辑
2. ✅ `RPC_QUICK_REFERENCE.md` - 更新文档说明新功能

### 向后兼容性
- ✅ **完全兼容**: 不提供 `exam_id` 时行为与之前完全一致
- ✅ **可选升级**: 可以逐步迁移到新的使用方式
- ✅ **类型安全**: TypeScript 类型会自动更新

### 无需修改的代码
- 不使用 `get_in_progress_exam` 的代码不受影响
- 已使用 `continue_or_start_exam` 的代码无需修改
- 其他 API 调用不受影响

## 🚀 部署建议

### 1. 数据库迁移
无需数据库迁移，因为这只是逻辑层面的改进。

### 2. 前端更新
前端可以分阶段更新：
- **阶段 1**: 在现有代码中添加 `exam_id` 参数（推荐）
- **阶段 2**: 移除不必要的状态检查代码
- **阶段 3**: 简化错误处理逻辑

### 3. 监控建议
监控以下指标：
- `get_in_progress_exam` 的调用频率
- 自动创建考试的成功率
- 页面加载时间的改善

## 🎉 总结

### 解决的问题
✅ 修复了空值错误
✅ 支持自动创建考试
✅ 简化了前端代码
✅ 保持了向后兼容

### 推荐用法
```typescript
// ✅ 推荐：提供 exam_id，确保总是有数据
const result = await rpc.KgEdu.Knowledge.StudentExam.get_in_progress_exam({
  student_id: studentId,
  exam_id: examId
});
```

### 下一步
1. 在前端集成此修复
2. 测试所有考试流程
3. 移除临时的错误处理代码
4. 更新相关的错误日志

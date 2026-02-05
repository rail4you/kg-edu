# 个性化学习推荐系统使用指南

## 系统概述

本推荐系统基于知识点体系，通过分析学生的学习行为、考试表现和练习数据，为每个学生生成个性化的学习推荐，实现"千人千面"的智能推荐。

## 核心功能

### 1. 知识点薄弱环节识别

自动分析学生的考试和练习数据，识别薄弱知识点：

```elixir
# 分析考试结果并更新掌握度
KgEdu.Knowledge.LearningAnalyzer.analyze_exam_results(student_exam_id, tenant: "org_tenant")

# 分析单个练习结果
KgEdu.Knowledge.LearningAnalyzer.analyze_exercise_result(
  exercise_id,
  student_id,
  is_correct,
  tenant: "org_tenant"
)

# 获取学生的薄弱知识点列表
KgEdu.Knowledge.StudentKnowledgeMastery.get_weak_knowledge_points(
  student_id: student_id,
  threshold: 0.6,
  course_id: course_id,
  tenant: "org_tenant"
)
```

### 2. 个性化学习推荐

基于学生的薄弱环节和学习特点生成推荐：

```elixir
# 获取学生的推荐列表
recommendations = KgEdu.Knowledge.RecommendationAPI.get_student_recommendations(
  student_id,
  course_id: course_id,
  limit: 20,
  force_refresh: true,
  tenant: "org_tenant"
)

# 标记推荐为已查看
KgEdu.Knowledge.RecommendationAPI.mark_recommendation_viewed(
  recommendation_id,
  tenant: "org_tenant"
)

# 标记推荐为已完成
KgEdu.Knowledge.RecommendationAPI.mark_recommendation_completed(
  recommendation_id,
  tenant: "org_tenant"
)
```

### 3. 学习分析报告

获取学生的完整学习分析报告：

```elixir
# 获取学习分析报告
analysis = KgEdu.Knowledge.RecommendationAPI.get_learning_analysis(
  student_id,
  course_id: course_id,
  tenant: "org_tenant"
)

# 报告包含：
# - 知识点掌握情况统计
# - 薄弱知识点列表
# - 学习行为模式分析
# - 推荐状态
```

### 4. 知识点掌握度查询

查询学生对特定知识点的掌握情况：

```elixir
mastery = KgEdu.Knowledge.RecommendationAPI.get_knowledge_mastery(
  student_id,
  knowledge_resource_id,
  tenant: "org_tenant"
)
```

## 推荐策略

系统采用多种推荐策略组合：

### 1. 基于薄弱环节的推荐 (Weakness-based)

- 优先推荐掌握度低于 60% 的知识点
- 根据掌握度高低分配推荐优先级（0-30% 为关键薄弱点，优先级最高）
- 根据可用资源类型推荐最佳学习方式（视频、文档、练习等）

### 2. 基于前置知识的推荐 (Prerequisite-based)

- 分析知识点之间的前置关系
- 在学生学习高级知识点前，推荐先掌握前置知识点

### 3. 基于学习行为的推荐 (Behavior-based)

- 分析学生的活跃时段
- 识别学生偏好的学习方式（视频、阅读、练习）
- 根据学习一致性调整推荐频率

### 4. 基于关联知识的推荐 (Relation-based)

- 利用知识图谱关系，推荐相关知识点
- 支持横向拓展和纵向深入

## 推荐类型

系统支持以下推荐类型：

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| `:weak_knowledge_review` | 薄弱知识点复习 | 掌握度低于 60% |
| `:prerequisite_learning` | 前置知识学习 | 学习高级知识前 |
| `:related_practice` | 相关练习 | 需要加强练习 |
| `:video_learning` | 视频学习 | 有可用视频资源 |
| `:reading_material` | 阅读材料学习 | 有可用文档资源 |
| `:homework_practice` | 作业练习 | 有可用作业 |
| `:exam_review` | 考试复习 | 考试后错题回顾 |

## 推荐优先级

推荐优先级从 1 到 10：

- **10 (最高)**: 关键薄弱点（掌握度 < 30%）
- **8-9**: 前置知识缺失
- **6-7**: 需要复习的知识点（掌握度 30%-60%）
- **4-5**: 一般建议
- **1-3**: 可选学习内容

## 推荐状态

推荐的状态流转：

```
pending (待处理)
  ↓
viewed (已查看)
  ↓
in_progress (学习中)
  ↓
completed (已完成)

或

pending → dismissed (已忽略)
```

## 数据模型

### StudentKnowledgeMastery (学生知识点掌握度)

记录每个学生对每个知识点的掌握情况：

```elixir
%{
  student_id: "uuid",
  knowledge_resource_id: "uuid",
  mastery_level: 0.65,        # 掌握度 0.0 - 1.0
  correct_count: 13,           # 正确次数
  wrong_count: 7,              # 错误次数
  practice_count: 20,          # 练习次数
  last_practiced_at: ~U[2024-01-15 10:30:00Z]
}
```

### LearningRecommendation (学习推荐)

为每个学生生成的推荐记录：

```elixir
%{
  id: "uuid",
  student_id: "uuid",
  knowledge_resource_id: "uuid",
  recommendation_type: :video_learning,
  priority: 8,
  reason: "Your mastery level is 35%. This is a critical weak point...",
  status: :pending,
  metadata: %{
    current_mastery_level: 0.35,
    practice_count: 5,
    importance_level: "hard"
  }
}
```

## 集成指南

### 1. 考试完成后自动分析

在考试评分完成后自动触发分析：

```elixir
# 在 Exam.grading 逻辑中添加
def grade_exam(student_exam_id) do
  # ... 原有评分逻辑 ...

  # 考试评分完成后，分析结果并生成推荐
  KgEdu.Knowledge.LearningAnalyzer.analyze_exam_results(
    student_exam_id,
    tenant: tenant,
    auto_generate_recommendations: true
  )
end
```

### 2. 练习提交后实时更新

在学生提交练习后更新掌握度：

```elixir
# 在 Exercise.submit_answer 逻辑中添加
def submit_exercise_answer(exercise_id, student_id, answer) do
  # ... 保存答案 ...

  # 判断是否正确
  is_correct = check_answer(exercise_id, answer)

  # 更新掌握度
  KgEdu.Knowledge.LearningAnalyzer.analyze_exercise_result(
    exercise_id,
    student_id,
    is_correct,
    tenant: tenant
  )
end
```

### 3. 前端集成示例

```javascript
// 获取学生推荐
const getRecommendations = async (studentId, courseId) => {
  const response = await fetch('/api/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'get_student_recommendations',
      student_id: studentId,
      course_id: courseId,
      limit: 20
    })
  });

  return response.json();
};

// 获取学习分析报告
const getLearningAnalysis = async (studentId, courseId) => {
  const response = await fetch('/api/recommendations/analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'get_learning_analysis',
      student_id: studentId,
      course_id: courseId
    })
  });

  return response.json();
};

// 标记推荐为已查看
const markAsViewed = async (recommendationId) => {
  const response = await fetch('/api/recommendations/viewed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'mark_viewed',
      recommendation_id: recommendationId
    })
  });

  return response.json();
};
```

## 系统初始化

### 1. 批量分析历史数据

对于系统上线前的历史数据，可以批量分析：

```elixir
# 批量分析所有考试数据
KgEdu.Knowledge.LearningAnalyzer.batch_analyze_all_exams(
  tenant: "org_tenant",
  course_id: course_id  # 可选：指定课程
)
```

### 2. 生成初始推荐

为所有学生生成初始推荐：

```elixir
# 获取课程所有学生
students = get_course_students(course_id)

# 为每个学生生成推荐
Enum.each(students, fn student ->
  KgEdu.Knowledge.RecommendationEngine.generate_comprehensive_recommendations(
    student.id,
    course_id,
    tenant: "org_tenant"
  )
end)
```

## 性能优化建议

1. **异步处理**: 考试分析、推荐生成等耗时操作应该异步执行
2. **缓存策略**: 推荐结果可以缓存 24 小时
3. **批量操作**: 批量更新掌握度时使用批量操作提高性能
4. **定时任务**: 可以设置定时任务每天更新一次推荐

## 扩展功能

### 1. AI 辅助推荐

可以集成 LLM 生成更智能的推荐理由：

```elixir
def generate_ai_reason(mastery, knowledge_resource) do
  prompt = """
  学生对知识点"#{knowledge_resource.name}"的掌握度为 #{mastery.mastery_level * 100}%，
  已练习 #{mastery.practice_count} 次，正确 #{mastery.correct_count} 次。

  请生成一段鼓励性的学习建议，不超过 50 字。
  """

  # 调用 LLM API 生成建议
  call_llm_api(prompt)
end
```

### 2. 社交学习

基于协同过滤推荐相似学生的学习路径：

```elixir
def find_similar_students(student_id, course_id, tenant) do
  # 找到掌握度分布相似的学生
  # 推荐他们学习过的有效资源
end
```

### 3. 自适应学习

根据学生学习速度调整推荐难度：

```elixir
def adjust_difficulty(student_id, tenant) do
  # 分析学生完成练习的速度和准确率
  # 动态调整后续推荐的难度
end
```

## 监控和日志

系统会记录关键操作日志：

```elixir
# 查看推荐生成日志
Logger.info("Generated #{count} recommendations for student #{student_id}")

# 查看分析日志
Logger.info("Analyzing weak points for student #{student_id}")
```

建议设置监控指标：
- 推荐生成成功率
- 推荐点击率
- 推荐完成率
- 学习效果提升率

## 常见问题

### Q: 推荐多久更新一次？

A: 系统会在以下情况自动更新推荐：
- 学生完成考试后
- 学生完成练习后（如果掌握度变化较大）
- 请求推荐时超过 24 小时未更新
- 手动调用时使用 `force_refresh: true`

### Q: 如何调整推荐算法的参数？

A: 可以修改以下模块中的参数：
- `StudentKnowledgeMastery`: 掌握度计算权重
- `RecommendationEngine`: 推荐策略和优先级计算
- `LearningAnalyzer`: 薄弱环节阈值

### Q: 支持哪些类型的资源推荐？

A: 系统支持推荐以下资源：
- 视频教程
- 文档资料
- 练习题
- 作业
- 关联知识点

## 技术架构

```
前端 API 调用
    ↓
RecommendationAPI (统一接口层)
    ↓
├── LearningAnalyzer (数据分析器)
│   ├── 分析考试结果
│   ├── 分析练习数据
│   └── 生成掌握报告
│
├── RecommendationEngine (推荐引擎)
│   ├── 薄弱环节分析
│   ├── 学习行为分析
│   ├── 知识图谱关联
│   └── 推荐生成
│
└── 数据层
    ├── StudentKnowledgeMastery (掌握度记录)
    ├── LearningRecommendation (推荐记录)
    ├── StudentExam (考试数据)
    ├── Exercise (练习数据)
    └── ActivityLog (行为日志)
```

## 总结

本推荐系统通过多维度分析学生学习数据，实现了个性化的学习推荐，帮助每个学生找到最适合自己的学习路径，提高学习效率和效果。

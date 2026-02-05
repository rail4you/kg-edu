# 推荐系统快速开始指南

## 1. 运行数据库迁移

```bash
# 进入后端目录
cd backend/kg_edu

# 运行迁移
mix ash.migrate

# 如果需要回滚
mix ash.migrate --rollback
```

## 2. 验证安装

在 IEx 中测试：

```elixir
# 启动 iex -S mix
iex> alias KgEdu.Knowledge.{LearningAnalyzer, RecommendationAPI}

# 测试数据分析功能
iex> {:ok, report} = LearningAnalyzer.get_mastery_report(student_id, course_id, tenant: "org_your_org")

# 测试推荐生成
iex> {:ok, recommendations} = RecommendationAPI.get_student_recommendations(student_id, tenant: "org_your_org")
```

## 3. 基本使用示例

### 场景1: 考试后自动分析

```elixir
# 在考试评分完成后调用
def grade_exam(student_exam_id) do
  # 原有评分逻辑
  # ...

  # 自动分析并生成推荐
  KgEdu.Knowledge.LearningAnalyzer.analyze_exam_results(
    student_exam_id,
    tenant: tenant,
    auto_generate_recommendations: true
  )
end
```

### 场景2: 前端获取推荐列表

```elixir
# 在 Phoenix Controller 中
def show_recommendations(conn, %{"student_id" => student_id}) do
  tenant = get_tenant(conn)

  {:ok, recommendations} = KgEdu.Knowledge.RecommendationAPI.get_student_recommendations(
    student_id,
    course_id: nil,  # 可选
    limit: 20,
    force_refresh: false,
    tenant: tenant
  )

  json(conn, recommendations)
end
```

### 场景3: 学生点击推荐

```elixir
# 标记为已查看
def mark_viewed(conn, %{"id" => id}) do
  tenant = get_tenant(conn)

  {:ok, _recommendation} = KgEdu.Knowledge.RecommendationAPI.mark_recommendation_viewed(
    id,
    tenant: tenant
  )

  json(conn, %{status: "ok"})
end

# 标记为已完成
def mark_completed(conn, %{"id" => id}) do
  tenant = get_tenant(conn)

  {:ok, _recommendation} = KgEdu.Knowledge.RecommendationAPI.mark_recommendation_completed(
    id,
    tenant: tenant
  )

  json(conn, %{status: "ok"})
end
```

## 4. 批量初始化历史数据

如果系统已有历史考试数据，可以批量分析：

```elixir
# 在 IEx 中运行
iex> KgEdu.Knowledge.LearningAnalyzer.batch_analyze_all_exams(
  tenant: "org_your_org",
  course_id: course_id  # 可选：指定课程
)
```

## 5. 常见问题排查

### Q: 推荐列表为空？

A: 检查以下几点：
1. 是否有考试或练习数据
2. 是否运行了数据分析
3. 学生是否有薄弱知识点（掌握度 < 60%）

```elixir
# 手动检查掌握度数据
iex> KgEdu.Knowledge.StudentKnowledgeMastery.get_all_student_masteries(
  student_id: student_id,
  tenant: tenant
)
```

### Q: 如何强制刷新推荐？

A: 使用 `force_refresh: true` 参数：

```elixir
KgEdu.Knowledge.RecommendationAPI.get_student_recommendations(
  student_id,
  force_refresh: true,
  tenant: tenant
)
```

### Q: 推荐优先级如何计算？

A: 优先级基于：
- 薄弱程度（掌握度越低，优先级越高）
- 知识点重要性（hard > important > normal）
- 学习频率（最近练习过的优先级降低）

## 6. 监控和日志

系统会记录关键操作日志：

```elixir
# 在日志中查看
[info] Generating recommendations for student xxx
[info] Analyzing weak points for student xxx
[info] Generated 10 recommendations for student xxx
```

## 7. 性能优化建议

### 异步处理推荐生成

```elixir
# 使用 Task 异步生成
Task.start(fn ->
  KgEdu.Knowledge.RecommendationEngine.generate_comprehensive_recommendations(
    student_id,
    course_id,
    tenant: tenant
  )
end)
```

### 设置定时任务

```elixir
# 在 application.ex 中添加定时任务
def start(_type, _args) do
  # 每天凌晨2点更新所有学生的推荐
  {:ok, _} = Quantum.ClockworkScheduler.add_schedule(
    :daily_recommendation_update,
    # Cron expression: 每天凌晨2点
    ~w[0 2 * * *],
    fn ->
      update_all_student_recommendations()
    end
  )
end
```

## 8. 测试推荐功能

创建测试脚本：

```elixir
# test_recommendations.exs
defmodule TestRecommendations do
  def run(student_id, course_id, tenant) do
    IO.puts("1. 获取学习分析报告...")
    {:ok, analysis} = KgEdu.Knowledge.RecommendationAPI.get_learning_analysis(
      student_id,
      course_id: course_id,
      tenant: tenant
    )
    IO.inspect(analysis, label: "学习分析")

    IO.puts("\n2. 获取推荐列表...")
    {:ok, recommendations} = KgEdu.Knowledge.RecommendationAPI.get_student_recommendations(
      student_id,
      course_id: course_id,
      force_refresh: true,
      tenant: tenant
    )
    IO.inspect(length(recommendations), label: "推荐数量")
    IO.inspect(Enum.take(recommendations, 3), label: "前3个推荐")

    IO.puts("\n✅ 测试完成！")
  end
end

# 运行测试
# iex> TestRecommendations.run("student-uuid", "course-uuid", "org_your_org")
```

## 9. 下一步

1. ✅ 运行数据库迁移
2. ✅ 验证基本功能
3. 📝 在考试和练习流程中集成
4. 🎨 前端界面开发
5. 📊 监控和优化性能

## 10. 获取帮助

- 查看完整文档: `RECOMMENDATION_SYSTEM.md`
- 查看系统总结: `RECOMMENDATION_SYSTEM_SUMMARY.md`
- 查看代码注释: 每个模块都有详细的 `@moduledoc`

祝使用愉快！🎉

# 学生学习统计功能

## 功能概述

为知识资源添加了学生学习进度统计功能，可以统计每个学生对知识点下各种学习资源的学习情况。

## 新增功能

### 1. 计算字段 `student_learning_stats`

**位置**: `KgEdu.Knowledge.Resource`

**描述**: 计算字段，用于统计单个学生对特定知识资源的学习情况

**参数**:
- `student_id`: 学生ID (UUID类型)

**返回数据结构**:
```elixir
%{
  resource_id: "知识资源ID",
  resource_name: "知识资源名称",
  student_id: "学生ID",
  videos: %{
    completed: 1,        # 已观看视频数量
    total: 4,           # 视频总数
    completion_ratio: 0.25  # 完成度 (1/4)
  },
  files: %{
    completed: 2,        # 已查看文件数量
    total: 5,           # 文件总数
    completion_ratio: 0.4   # 完成度 (2/5)
  },
  exercises: %{
    completed: 3,        # 已完成习题数量
    total: 8,           # 习题总数
    completion_ratio: 0.375 # 完成度 (3/8)
  },
  homeworks: %{
    completed: 1,        # 已提交作业数量
    total: 3,           # 作业总数
    completion_ratio: 0.33 # 完成度 (1/3)
  },
  overall: %{
    total_completed: 7,   # 总完成数量
    total_resources: 20,  # 总资源数
    completion_ratio: 0.35 # 总体完成度
  }
}
```

### 2. 查询动作 `get_course_learning_stats_by_student`

**位置**: `KgEdu.Knowledge.Resource`

**描述**: 获取整个课程中所有学生的学习统计信息，按学生分组显示

**参数**:
- `course_id`: 课程ID (UUID类型)

**返回**: 学生统计列表，每个学生包含上述完整的学习统计数据

## 使用方法

### 获取单个知识资源的学习统计

```elixir
# 需要提供学生ID和知识资源ID
student_id = "学生UUID"
resource_id = "知识资源UUID"

# 通过计算字段获取单个资源的学习统计
KgEdu.Knowledge.Resource.get_knowledge_resource(%{
  id: resource_id,
  load: [:student_learning_stats],
  student_learning_stats: %{student_id: student_id}
})
```

### 获取课程中所有学生的学习统计

```elixir
# 提供课程ID
course_id = "课程UUID"

# 获取整个课程中所有学生的学习统计，按学生分组
KgEdu.Knowledge.Resource.get_course_learning_stats_by_student(%{course_id: course_id})
```

### 示例用法

```elixir
# 示例课程ID
course_id = "15cbf640-c16b-46b9-a029-70a56f4f20f9"
student_id = "550e8400-e29b-41d4-a716-446655440000"
tenant = :org_default  # 租户上下文

# 获取课程学习统计
case KgEdu.Knowledge.Resource.get_course_learning_stats_by_student(
       %{course_id: course_id},
       tenant: tenant,
       authorize?: false,  # 可选：绕过权限检查
       actor: nil          # 可选：执行者
     ) do
  {:ok, stats} ->
    # stats 是学生统计列表
    IO.inspect(stats)

    # 遍历学生统计
    Enum.each(stats, fn stat ->
      IO.puts("学生 #{stat.student_id}: 总体完成度 #{Float.round(stat.overall.completion_ratio * 100, 1)}%")
    end)

  {:error, reason} ->
    IO.puts("Error: #{inspect(reason)}")
end

# 获取单个资源的学习统计
case KgEdu.Knowledge.Resource.get_knowledge_resource(
       %{id: resource_id},
       tenant: tenant,
       load: [:student_learning_stats],
       student_learning_stats: %{student_id: student_id}
     ) do
  {:ok, resource} ->
    IO.inspect(resource.student_learning_stats)
  {:error, reason} ->
    IO.puts("Error: #{inspect(reason)}")
end
```

## 数据来源

统计数据基于以下两个模块：

1. **知识资源数据** (`KgEdu.Knowledge.Resource`)
   - 资源总数统计
   - 关联的视频、文件、习题、作业数量

2. **活动日志数据** (`KgEdu.Activity.ActivityLog`)
   - `:video_view` - 视频观看记录
   - `:file_view` - 文件查看记录
   - `:exercise_submit` - 习题提交记录
   - `:homework_submit` - 作业提交记录

## 统计逻辑

1. **资源总数**: 通过知识资源的关系关联统计视频、文件、习题、作业的总数
2. **完成数量**: 通过活动日志统计学生对该资源的各种学习行为次数
3. **完成度**: 完成数量 / 总数量 (除零保护)

## 技术实现

### 计算字段实现
- 使用Ash Framework的`calculations` DSL
- 接受学生ID作为参数
- 返回包含完整统计信息的Map

### 查询动作实现
- 使用Ash Framework的`actions` DSL
- 先获取课程下所有知识资源
- 获取相关活动日志
- 按学生分组统计学习数据
- 计算完成度等指标

## 示例输出

```elixir
[
  %{
    student_id: "550e8400-e29b-41d4-a716-446655440000",
    course_id: "550e8400-e29b-41d4-a716-446655440001",
    videos: %{completed: 3, total: 10, completion_ratio: 0.3},
    files: %{completed: 5, total: 8, completion_ratio: 0.625},
    exercises: %{completed: 7, total: 15, completion_ratio: 0.467},
    homeworks: %{completed: 2, total: 5, completion_ratio: 0.4},
    overall: %{total_completed: 17, total_resources: 38, completion_ratio: 0.447}
  },
  %{
    student_id: "550e8400-e29b-41d4-a716-446655440002",
    course_id: "550e8400-e29b-41d4-a716-446655440001",
    videos: %{completed: 8, total: 10, completion_ratio: 0.8},
    files: %{completed: 7, total: 8, completion_ratio: 0.875},
    exercises: %{completed: 12, total: 15, completion_ratio: 0.8},
    homeworks: %{completed: 4, total: 5, completion_ratio: 0.8},
    overall: %{total_completed: 31, total_resources: 38, completion_ratio: 0.816}
  }
]
```

## 注意事项

1. **计算字段需要显式加载才能使用**
2. **活动日志数据必须正确记录才能准确统计**
3. **完成度计算包含除零保护**
4. **多租户环境支持**: 所有查询都需要提供 `tenant` 参数
5. **权限控制**: 所有查询都支持权限控制，可以使用 `authorize?: false` 绕过（仅测试用）
6. **租户上下文**: 在多租户环境中，确保提供正确的租户标识符（如 `:org_default`）

### 租户上下文使用

由于应用使用多租户架构，所有数据库操作都需要指定租户：

```elixir
# 正确的调用方式
tenant = :org_default  # 根据实际租户设置

KgEdu.Knowledge.Resource.get_course_learning_stats_by_student(
  %{course_id: course_id},
  tenant: tenant,          # 必需：租户上下文
  authorize?: false,       # 可选：权限控制
  actor: nil              # 可选：执行者
)
```

### 常见错误解决

如果遇到 `TenantRequired` 错误，请确保：
1. 调用函数时提供了 `tenant` 参数
2. 租户标识符是有效的原子（如 `:org_default`）
3. 租户在数据库中存在

## 扩展可能

- 添加时间范围过滤 (例如: 本周/本月的学习统计)
- 添加学习进度趋势分析
- 添加学习行为详细记录
- 添加学习效果评估指标
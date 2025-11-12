# 测试学生学习统计功能（包含租户上下文）

# 模拟租户上下文
defmodule LearningStatsTest do
  def run_test do
    IO.puts("=== 测试学生学习统计功能（包含租户上下文）===")

    # 设置测试数据
    course_id = "15cbf640-c16b-46b9-a029-70a56f4f20f9"
    tenant = :org_default  # 默认租户

    IO.puts("\n1. 测试获取课程学习统计...")

    # 调用学习统计功能
    case KgEdu.Knowledge.Resource.get_course_learning_stats_by_student(
           %{course_id: course_id},
           tenant: tenant,
           authorize?: false,
           actor: nil
         ) do
      {:ok, stats} ->
        IO.puts("✅ 成功获取学习统计")
        IO.inspect(stats, label: "学习统计结果")

        # 显示统计信息
        IO.puts("\n📊 学习统计摘要:")
        Enum.each(stats, fn stat ->
          IO.puts("学生 #{stat.student_id}:")
          IO.puts("  视频: #{stat.videos.completed}/#{stat.videos.total} (#{Float.round(stat.videos.completion_ratio * 100, 1)}%)")
          IO.puts("  文件: #{stat.files.completed}/#{stat.files.total} (#{Float.round(stat.files.completion_ratio * 100, 1)}%)")
          IO.puts("  习题: #{stat.exercises.completed}/#{stat.exercises.total} (#{Float.round(stat.exercises.completion_ratio * 100, 1)}%)")
          IO.puts("  作业: #{stat.homeworks.completed}/#{stat.homeworks.total} (#{Float.round(stat.homeworks.completion_ratio * 100, 1)}%)")
          IO.puts("  总体: #{stat.overall.total_completed}/#{stat.overall.total_resources} (#{Float.round(stat.overall.completion_ratio * 100, 1)}%)")
          IO.puts("")
        end)

      {:error, reason} ->
        IO.puts("❌ 获取学习统计失败: #{inspect(reason)}")

        # 检查错误类型
        case reason do
          %Ash.Error.Invalid{errors: errors} ->
            IO.puts("验证错误详情:")
            Enum.each(errors, fn error ->
              IO.puts("  - #{inspect(error)}")
            end)
          _ ->
            IO.puts("其他错误类型")
        end
    end

    IO.puts("\n2. 测试计算字段...")

    # 获取知识资源列表来测试计算字段
    case KgEdu.Knowledge.Resource.list_knowledges(
           %{},
           tenant: tenant,
           authorize?: false,
           actor: nil
         ) do
      {:ok, resources} ->
        if length(resources) > 0 do
          resource = List.first(resources)
          student_id = "550e8400-e29b-41d4-a716-446655440000"

          IO.puts("✅ 找到 #{length(resources)} 个知识资源")
          IO.puts("测试第一个资源的计算字段...")

          # 测试计算字段
          case KgEdu.Knowledge.Resource.get_knowledge_resource(
                 %{id: resource.id},
                 tenant: tenant,
                 authorize?: false,
                 actor: nil,
                 load: [:student_learning_stats],
                 student_learning_stats: %{student_id: student_id}
               ) do
            {:ok, resource_with_stats} ->
              IO.puts("✅ 成功获取计算字段")
              IO.inspect(resource_with_stats.student_learning_stats, label: "计算字段结果")

            {:error, reason} ->
              IO.puts("❌ 获取计算字段失败: #{inspect(reason)}")
          end
        else
          IO.puts("⚠️ 没有找到知识资源来测试计算字段")
        end

      {:error, reason} ->
        IO.puts("❌ 获取知识资源失败: #{inspect(reason)}")
    end

    IO.puts("\n=== 测试完成 ===")
    IO.puts("\n📝 使用说明:")
    IO.puts("1. 在多租户环境中，调用函数时需要提供 tenant 参数")
    IO.puts("2. 通常 tenant 是一个原子，如 :org_default")
    IO.puts("3. authorize?: false 可以绕过权限检查（仅用于测试）")
    IO.puts("4. actor: nil 表示没有特定的执行者")
  end
end

# 运行测试
LearningStatsTest.run_test()
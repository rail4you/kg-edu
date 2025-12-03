# 简单测试学习统计功能

# 设置变量
course_id = "15cbf640-c16b-46b9-a029-70a56f4f20f9"
tenant = :org_default  # 使用默认租户

IO.puts("测试课程ID: #{course_id}")
IO.puts("使用租户: #{tenant}")

# 正确的调用方式
IO.puts("\n调用学习统计功能...")

case KgEdu.Knowledge.Resource.get_course_learning_stats_by_student(
       %{course_id: course_id},
       tenant: tenant,
       authorize?: false,
       actor: nil
     ) do
  {:ok, stats} ->
    IO.puts("✅ 成功获取学习统计!")
    IO.puts("找到 #{length(stats)} 个学生的学习记录")

    if length(stats) > 0 do
      Enum.each(stats, fn stat ->
        IO.puts("学生 #{stat.student_id}: 总体完成度 #{Float.round(stat.overall.completion_ratio * 100, 1)}%")
      end)
    else
      IO.puts("没有找到学习记录，这可能是因为:")
      IO.puts("1. 课程中没有知识资源")
      IO.puts("2. 没有相关的活动日志记录")
      IO.puts("3. 租户中没有数据")
    end

  {:error, reason} ->
    IO.puts("❌ 错误: #{inspect(reason)}")

    # 提供错误排查建议
    case reason do
      %Ash.Error.Invalid{errors: errors} ->
        IO.puts("\n错误排查建议:")
        Enum.each(errors, fn error ->
          case error do
            %Ash.Error.Invalid.TenantRequired{} ->
              IO.puts("- 确保提供了有效的租户参数")
              IO.puts("- 检查租户 '#{tenant}' 是否存在")
            _ ->
              IO.puts("- 错误详情: #{inspect(error)}")
          end
        end)
      _ ->
        IO.puts("未知错误类型")
    end
end

IO.puts("\n测试完成!")
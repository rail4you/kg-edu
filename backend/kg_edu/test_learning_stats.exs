# 测试学生学习统计功能

defmodule TestLearningStats do
  def test_functionality do
    IO.puts("=== 测试学生学习统计功能 ===")

    # 测试1: 尝试获取课程学习统计
    IO.puts("\n1. 测试获取课程学习统计...")

    # 需要真实的课程ID，这里用示例UUID
    course_id = "00000000-0000-0000-0000-000000000000"

    case KgEdu.Knowledge.Resource.get_course_learning_stats_by_student(%{course_id: course_id}) do
      {:ok, stats} ->
        IO.inspect(stats, label: "✅ 成功获取学习统计")
      {:error, reason} ->
        IO.puts("❌ 获取学习统计失败: #{inspect(reason)}")
    end

    # 测试2: 尝试使用计算字段
    IO.puts("\n2. 测试计算字段...")
    case KgEdu.Knowledge.Resource.list_knowledges(%{}) do
      {:ok, resources} ->
        if length(resources) > 0 do
          resource = List.first(resources)
          student_id = "00000000-0000-0000-0000-000000000000"

          # 计算字段需要在查询时加载
          case KgEdu.Knowledge.Resource.get_knowledge_resource(%{
            id: resource.id,
            load: [:student_learning_stats],
            student_learning_stats: %{student_id: student_id}
          }) do
            {:ok, resource_with_stats} ->
              IO.inspect(resource_with_stats.student_learning_stats, label: "✅ 成功获取计算字段")
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
  end
end

# 运行测试
TestLearningStats.test_functionality()
# 测试返回值格式

IO.puts("测试学习统计功能的返回值格式...")

# 检查源码中的返回语句
IO.puts("\n检查 KgEdu.Knowledge.Resource.get_course_learning_stats_by_student 函数...")

# 读取源码并检查返回格式
case File.read("lib/kg_edu/knowledge/resource.ex") do
  {:ok, content} ->
    # 查找 get_course_learning_stats_by_student 函数定义
    lines = String.split(content, "\n")

    # 找到函数开始
    function_start = Enum.find_index(lines, fn line ->
      String.contains?(line, "get_course_learning_stats_by_student") and
      String.contains?(line, "action")
    end)

    if function_start do
      IO.puts("✅ 找到函数定义，位于第 #{function_start + 1} 行")

      # 检查函数内的返回语句
      function_lines =
        lines
        |> Enum.drop(function_start)
        |> Enum.take_while(fn line ->
          not String.contains?(line, "end)")
        end)

      return_statements =
        function_lines
        |> Enum.filter(fn line ->
          String.contains?(line, "{:ok,") or
          String.contains?(line, "{:error,") or
          String.trim(line) == "[]"
        end)

      IO.puts("找到的返回语句:")
      Enum.each(return_statements, &IO.puts/1)

      # 检查是否有直接返回空列表的语句
      direct_empty_return = Enum.any?(function_lines, fn line ->
        String.trim(line) == "[]"
      end)

      if direct_empty_return do
        IO.puts("\n❌ 发现问题：函数中有直接返回空列表的语句！")
      else
        IO.puts("\n✅ 没有发现直接返回空列表的语句")
      end

    else
      IO.puts("❌ 未找到函数定义")
    end

  {:error, reason} ->
    IO.puts("❌ 读取文件失败: #{inspect(reason)}")
end

IO.puts("\n检查完成。")
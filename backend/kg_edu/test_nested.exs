#!/usr/bin/env elixir

# Test what happens with deeper nesting
# Simulate: 知识点1 -> 知识点2 -> 知识点3 -> 知识点4 -> 知识点5

test_data = [
  %{
    title: "知识点1",
    level: :subject,
    depth: 1,
    subject: "知识点1",
    unit: nil,
    parent_title: nil,
    parent_unit_title: nil
  },
  %{
    title: "知识点2",
    level: :knowledge_unit,
    depth: 2,
    subject: "知识点1",
    unit: "知识点2",
    parent_title: "知识点1",
    parent_unit_title: nil
  },
  %{
    title: "知识点3",
    level: :knowledge_cell,
    depth: 3,
    subject: "知识点1",
    unit: "知识点2",
    parent_title: "知识点1",
    parent_unit_title: "知识点2"
  },
  %{
    title: "知识点4",
    level: :knowledge_cell,
    depth: 4,
    subject: "知识点1",
    unit: "知识点2",  # ← This should still be the same unit
    parent_title: "知识点1",
    parent_unit_title: "知识点2"
  },
  %{
    title: "知识点5",
    level: :knowledge_cell,
    depth: 5,
    subject: "知识点1",
    unit: "知识点2",
    parent_title: "知识点1",
    parent_unit_title: "知识点2"
  }
]

IO.puts("测试数据 (模拟5层嵌套):")
IO.puts("===========================================")
Enum.each(test_data, fn item ->
  type = case item.level do
    :subject -> '[SUBJECT]'
    :knowledge_unit -> '[UNIT]'
    :knowledge_cell -> '[CELL]'
  end
  IO.puts("#{type} Depth #{item.depth}: #{item.title}")
  IO.puts("  subject=#{inspect(item.subject)}, unit=#{inspect(item.unit)}")
end)

IO.puts("\n转换后的资源:")
IO.puts("===========================================")
case KgEdu.XmindParser.convert_to_knowledge_resources(test_data, "test-course") do
  {:ok, resources} ->
    Enum.each(resources, fn res ->
      IO.puts("- #{res.name} (#{res.knowledge_type}, depth #{res[:depth]})")
      IO.puts("  parent_subject=#{inspect(res[:parent_subject_name])}")
      IO.puts("  parent_unit=#{inspect(res[:parent_unit_name])}")
      IO.puts("  parent_cell=#{inspect(res[:parent_cell_name])}")
      IO.puts("")
    end)

    # Check if depth 4+ cells have parent_cell_name
    deep_cells = Enum.filter(resources, fn r -> r[:depth] >= 4 end)
    if Enum.empty?(deep_cells) do
      IO.puts("✗ 没有找到depth >= 4的知识点!")
    else
      IO.puts("✓ 找到 #{length(deep_cells)} 个depth >= 4的知识点:")
      Enum.each(deep_cells, fn cell ->
        IO.puts("  - #{cell.name} at depth #{cell[:depth]}")
        IO.puts("    parent_cell_name: #{inspect(cell[:parent_cell_name])}")
        if is_nil(cell[:parent_cell_name]) do
          IO.puts("    ✗ 问题: parent_cell_name是nil!")
        end
      end)
    end

  {:error, reason} ->
    IO.puts("转换错误: #{inspect(reason)}")
end

#!/usr/bin/env elixir

json = File.read!("content.json")

case KgEdu.XmindParser.parse_content_json(json) do
  {:ok, data} ->
    IO.puts("\n解析的原始数据:")
    IO.puts("===========================================")

    Enum.each(data, fn item ->
      type =
        case item.level do
          :subject -> '[SUBJECT]'
          :knowledge_unit -> '[UNIT]'
          :knowledge_cell -> '[CELL]'
          _ -> '[?]'
        end

      IO.puts("#{type} Depth #{item.depth}: #{item.title}")
      IO.puts("  subject=#{inspect(item.subject)}, unit=#{inspect(item.unit)}")

      IO.puts(
        "  parent_title=#{inspect(item.parent_title)}, parent_unit_title=#{inspect(item.parent_unit_title)}"
      )

      IO.puts("")
    end)

    # Now test conversion
    course_id = "test-course"

    case KgEdu.XmindParser.convert_to_knowledge_resources(data, course_id) do
      {:ok, resources} ->
        IO.puts("\n转换后的资源:")
        IO.puts("===========================================")

        Enum.each(resources, fn res ->
          IO.puts("- #{res.name} (#{res.knowledge_type})")
          IO.puts("  parent_subject=#{inspect(res[:parent_subject_name])}")
          IO.puts("  parent_unit=#{inspect(res[:parent_unit_name])}")
          IO.puts("  parent_cell=#{inspect(res[:parent_cell_name])}")
        end)

        # Check if 知识点4 is in the resources
        cell_4 = Enum.find(resources, fn r -> r.name == "知识点4" end)

        if cell_4 do
          IO.puts("\n✓ 知识点4 找到了!")
          IO.puts("  name: #{cell_4.name}")
          IO.puts("  knowledge_type: #{cell_4.knowledge_type}")
          IO.puts("  parent_unit_name: #{inspect(cell_4[:parent_unit_name])}")
          IO.puts("  parent_cell_name: #{inspect(cell_4[:parent_cell_name])}")
        else
          IO.puts("\n✗ 知识点4 没有找到!")
        end

      {:error, reason} ->
        IO.puts("转换错误: #{inspect(reason)}")
    end

  {:error, reason} ->
    IO.puts("解析错误: #{inspect(reason)}")
end

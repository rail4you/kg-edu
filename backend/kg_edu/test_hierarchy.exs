#!/usr/bin/env elixir

json_content = File.read!("content.json")

case KgEdu.XmindParser.parse_content_json(json_content) do
  {:ok, data} ->
    IO.puts("\n✓ 解析成功！共 #{length(data)} 个知识点\n")
    IO.puts("层级结构:")
    IO.puts("─────────────────────────────────────")

    # Group by subject
    by_subject = Enum.group_by(data, fn item ->
      if item.depth == 1, do: item.title, else: item.subject
    end)

    # Display hierarchy
    Enum.each(by_subject, fn {subject_name, items} ->
      IO.puts("\n📚 主题: #{subject_name}")

      subject_units = Enum.group_by(items, fn item ->
        if item.depth == 2, do: item.title, else: item.unit
      end)

      Enum.each(subject_units, fn
        {nil, [subject]} when subject.depth == 1 ->
          # Subject with no units
          :ok

        {unit_name, items} when is_binary(unit_name) ->
          if unit_name != "" and unit_name != nil do
            IO.puts("  ├─ 🔖 知识单元: #{unit_name}")

            Enum.each(items, fn item ->
              if item.depth >= 3 do
                indent = if item.depth == 3, do: "  │  ├─ 💡", else: "  │  │  └─ 💡"
                IO.puts("#{indent} 知识点: #{item.title}")
              end
            end)
          end

        {_, items} ->
          Enum.each(items, fn item ->
            if item.depth >= 3 do
              unit_name = item.unit || "(无单元)"
              IO.puts("  ├─ 🔖 知识单元: #{unit_name}")
              IO.puts("  │  └─ 💡 知识点: #{item.title}")
            end
          end)
      end)
    end)

    IO.puts("\n─────────────────────────────────────")
    IO.puts("\n统计:")
    subjects = Enum.count(data, &(&1.depth == 1))
    units = Enum.count(data, &(&1.depth == 2))
    cells = Enum.count(data, &(&1.depth >= 3))

    IO.puts("  主题 (Subjects): #{subjects}")
    IO.puts("  知识单元 (Units): #{units}")
    IO.puts("  知识点 (Cells): #{cells}")
    IO.puts("  ────────────────")
    IO.puts("  总计: #{length(data)}")

  {:error, reason} ->
    IO.puts("✗ Error: #{inspect(reason)}")
end

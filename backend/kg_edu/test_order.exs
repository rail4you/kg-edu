#!/usr/bin/env elixir

json = File.read!("content.json")

case KgEdu.XmindParser.parse_content_json(json) do
  {:ok, data} ->
    IO.puts("\n解析顺序 (处理顺序很重要!):")
    IO.puts("=" |> String.duplicate(60))
    data
    |> Enum.with_index()
    |> Enum.each(fn {item, idx} ->
      type = case item.level do
        :subject -> '[SUBJECT]'
        :knowledge_unit -> '[UNIT]'
        :knowledge_cell -> '[CELL]'
      end
      IO.puts("#{idx + 1}. #{type} Depth #{item.depth}: #{item.title}")
      IO.puts("   subject=#{inspect(item.subject)}, unit=#{inspect(item.unit)}")
    end)

    # Check if this order makes sense for importing
    IO.puts("\n这个顺序能正确导入吗?")
    IO.puts("=" |> String.duplicate(60))

    problems = Enum.flat_map(data, fn item ->
      # Check if parent exists before child
      if item.parent_title do
        parent_exists = Enum.any?(data, fn i ->
          i.title == item.parent_title and i.depth < item.depth
        end)
        if !parent_exists do
          ["Parent '#{item.parent_title}' not found before '#{item.title}'"]
        else
          []
        end
      else
        []
      end
    end)

    if Enum.empty?(problems) do
      IO.puts("✓ 所有parent都在child之前，顺序正确!")
    else
      IO.puts("✗ 发现问题:")
      Enum.each(problems, fn problem ->
        IO.puts("  - #{problem}")
      end)
    end

  {:error, reason} ->
    IO.puts("解析错误: #{inspect(reason)}")
end

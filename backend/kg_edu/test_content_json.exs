#!/usr/bin/env elixir

content = File.read!("content.json")
base64 = Base.encode64(content)

case KgEdu.XmindParser.parse_from_base64(base64) do
  {:ok, data} ->
    IO.puts("✓ Successfully parsed!")
    IO.puts("Total items: #{length(data)}\n")

    Enum.each(data, fn item ->
      type = case item.level do
        :subject -> '[SUBJECT]'
        :knowledge_unit -> '[UNIT]'
        :knowledge_cell -> '[CELL]'
        _ -> '[?]'
      end

      indent = String.duplicate("  ", item.depth)
      IO.puts("#{indent}#{type} Depth #{item.depth}: #{item.title}")
      IO.puts("#{indent}     subject=#{inspect(item.subject)}, unit=#{inspect(item.unit)}")
    end)

    IO.puts("\n✓ Parsing completed successfully!")

  {:error, reason} ->
    IO.puts("✗ Error: #{inspect(reason)}")
end

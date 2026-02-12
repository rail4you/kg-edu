#!/usr/bin/env elixir

# Read the JSON content directly
json_content = File.read!("content.json")

# Use the parser's JSON parsing function directly
# parse_content_json expects a binary string (JSON content)
case KgEdu.XmindParser.parse_content_json(json_content) do
  {:ok, data} ->
    IO.puts("✓ Successfully parsed!")
    IO.puts("Total items: #{length(data)}\n")

    Enum.each(data, fn item ->
      type =
        case item.level do
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

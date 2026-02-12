#!/usr/bin/env elixir

# Test script for XMind parser
xmind_file = "xmind.xmind"

xmind_content = File.read!(xmind_file)

base64_data = Base.encode64(xmind_content)

case KgEdu.XmindParser.parse_from_base64(base64_data) do
  {:ok, parsed_data} ->
    IO.puts("✓ Successfully parsed XMind file")
    IO.puts("Found #{length(parsed_data)} items\n")

    # Display the hierarchy
    IO.puts("Hierarchy:")

    Enum.each(parsed_data, fn item ->
      indent = String.duplicate("  ", item.depth)

      type_label =
        case item.level do
          :subject -> "[SUBJECT]"
          :knowledge_unit -> "[UNIT]"
          :knowledge_cell -> "[CELL]"
          _ -> "[UNKNOWN]"
        end

      IO.puts("#{indent}#{type_label} #{item.title}")
      IO.puts("#{indent}  └─ subject: #{item.subject}, unit: #{inspect(item.unit)}")
    end)

    # Test conversion
    course_id = "bf4ae662-0cc9-4d77-a969-c8ef8ce81e52"

    case KgEdu.XmindParser.convert_to_knowledge_resources(parsed_data, course_id) do
      {:ok, resources} ->
        IO.puts("\n✓ Successfully converted to #{length(resources)} knowledge resources")
        IO.puts("\nResources:")

        Enum.each(resources, fn res ->
          parent_info =
            cond do
              res[:parent_subject_name] -> "parent_subject: #{res[:parent_subject_name]}"
              res[:parent_unit_name] -> "parent_unit: #{res[:parent_unit_name]}"
              res[:parent_cell_name] -> "parent_cell: #{res[:parent_cell_name]}"
              true -> "no parent"
            end

          IO.puts("  - #{res.name} (#{res.knowledge_type}) [#{parent_info}]")
        end)

      {:error, reason} ->
        IO.puts("\n✗ Conversion failed: #{inspect(reason)}")
    end

  {:error, reason} ->
    IO.puts("✗ Parsing failed: #{inspect(reason)}")
end

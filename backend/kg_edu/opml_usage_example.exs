#!/usr/bin/env elixir

# Example usage of OPML import functionality
# This shows how to import OPML data into the knowledge graph

defmodule OpmlUsageExample do
  def run_import_example do
    # This would typically be done within your application context
    # with proper tenant and course setup

    IO.puts("=== OPML Import Example ===")
    IO.puts("")

    # Step 1: Read OPML file
    IO.puts("1. Reading OPML file...")
    {:ok, opml_content} = File.read("sample_knowledge.opml")
    IO.puts("   ✓ File read successfully (#{byte_size(opml_content)} bytes)")

    # Step 2: Parse OPML content
    IO.puts("2. Parsing OPML content...")
    case KgEdu.OpmlParser.parse_from_text(opml_content) do
      {:ok, knowledge_data} ->
        IO.puts("   ✓ Parsed successfully - #{length(knowledge_data)} knowledge items found")
        IO.puts("")

        # Step 3: Show sample of parsed data
        IO.puts("3. Sample of parsed knowledge items:")
        IO.puts("")

        knowledge_data
        |> Enum.take(5)
        |> Enum.with_index(1)
        |> Enum.each(fn {item, index} ->
          IO.puts("   #{index}. #{item.title}")
          IO.puts("      Subject: #{item.subject}")
          IO.puts("      Unit: #{item.unit || "None"}")
          IO.puts("      Description: #{item.description}")
          IO.puts("")
        end)

        if length(knowledge_data) > 5 do
          IO.puts("   ... and #{length(knowledge_data) - 5} more items")
        end

        IO.puts("")
        IO.puts("4. To import this data into your knowledge graph:")
        IO.puts("")
        IO.puts("   # You would typically do this in your application code:")
        IO.puts("   KgEdu.Knowledge.Resource.import_knowledge_from_opml(%{")
        IO.puts("     opml_data: opml_content,")
        IO.puts("     course_id: YOUR_COURSE_UUID,")
        IO.puts("   }, tenant: YOUR_TENANT)")
        IO.puts("")
        IO.puts("   This will:")
        IO.puts("   - Create subjects for top-level items with children")
        IO.puts("   - Create units for second-level items with children")
        IO.puts("   - Create knowledge cells for leaf items")
        IO.puts("   - Establish proper parent-child relationships")
        IO.puts("   - Skip duplicate items")

      {:error, reason} ->
        IO.puts("   ✗ Failed to parse OPML: #{reason}")
    end
  end
end

# Run the example
OpmlUsageExample.run_import_example()
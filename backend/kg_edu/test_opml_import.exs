#!/usr/bin/env elixir

# Test script for OPML import functionality
# Usage: mix run test_opml_import.exs

defmodule OpmlImportTest do
  def run do
    # Read the sample OPML file
    opml_file = "sample_knowledge.opml"

    case File.read(opml_file) do
      {:ok, opml_content} ->
        IO.puts("Successfully read OPML file: #{opml_file}")
        IO.puts("File size: #{byte_size(opml_content)} bytes")

        # Parse the OPML content
        case KgEdu.OpmlParser.parse_from_text(opml_content) do
          {:ok, knowledge_data} ->
            IO.puts("Successfully parsed OPML content!")
            IO.puts("Found #{length(knowledge_data)} knowledge items:")

            # Display first few items
            knowledge_data
            |> Enum.take(10)
            |> Enum.with_index(1)
            |> Enum.each(fn {item, index} ->
              IO.puts("#{index}. #{item.title}")
              IO.puts("   Subject: #{item.subject}")
              IO.puts("   Unit: #{item.unit || "None"}")
              IO.puts("   Description: #{item.description}")
              IO.puts("")
            end)

            if length(knowledge_data) > 10 do
              IO.puts("... and #{length(knowledge_data) - 10} more items")
            end

          {:error, reason} ->
            IO.puts("Failed to parse OPML: #{reason}")
        end

      {:error, reason} ->
        IO.puts("Failed to read OPML file: #{reason}")
    end
  end
end

# Run the test if this script is executed directly
if __ENV__.file == :stdin or Path.basename(__ENV__.file) == "test_opml_import.exs" do
  OpmlImportTest.run()
end
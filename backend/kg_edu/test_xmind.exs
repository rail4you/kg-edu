#!/usr/bin/env elixir

# Simple test script for XMind parser functionality

defmodule XMindTest do
  def run_test do
    IO.puts("Testing XMind parser...")

    # Test parsing the example XMind file
    case KgEdu.XmindParser.parse_from_file("xmind.xmind") do
      {:ok, xmind_data} ->
        IO.puts("✓ Successfully parsed XMind file")
        IO.inspect(xmind_data, label: "Parsed XMind data")

        # Test converting to knowledge resources
        course_id = "00000000-0000-0000-0000-000000000000"
        case KgEdu.XmindParser.convert_to_knowledge_resources(xmind_data, course_id) do
          {:ok, knowledge_resources} ->
            IO.puts("✓ Successfully converted to knowledge resources")
            IO.inspect(knowledge_resources, label: "Knowledge resources")

          {:error, reason} ->
            IO.puts("✗ Failed to convert XMind data: #{inspect(reason)}")
        end

      {:error, reason} ->
        IO.puts("✗ Failed to parse XMind file: #{inspect(reason)}")
    end
  end
end

# Start the application and run test
Application.ensure_all_started(:kg_edu)
XMindTest.run_test()

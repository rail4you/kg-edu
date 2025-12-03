#!/usr/bin/env elixir

# Simple verification script for the imported knowledge
defmodule SimpleVerify do
  @course_id "15cbf640-c16b-46b9-a029-70a56f4f20f9"
  @tenant "org_2af44c7b_081a_497a_9858_365fa90ad5d7"

  def verify_import do
    IO.puts("=== OPML Import Verification ===")
    IO.puts("Course ID: #{@course_id}")
    IO.puts("Tenant: #{@tenant}")
    IO.puts("")

    # Use the debug list action to get all knowledge resources for this course
    case KgEdu.Knowledge.Resource.debug_list_resources(%{course_id: @course_id}, tenant: @tenant) do
      {:ok, resources} ->
        IO.puts("✅ Successfully found #{length(resources)} knowledge resources!")
        IO.puts("")

        # Group by subject
        resources
        |> Enum.group_by(& &1.subject)
        |> Enum.each(fn {subject, items} ->
          IO.puts("📚 Subject: #{subject}")
          IO.puts("   Items: #{length(items)}")

          # Count by knowledge type
          subjects = Enum.count(items, &(&1.knowledge_type == :subject))
          units = Enum.count(items, &(&1.knowledge_type == :knowledge_unit))
          cells = Enum.count(items, &(&1.knowledge_type == :knowledge_cell))

          IO.puts("   - Subjects: #{subjects}")
          IO.puts("   - Units: #{units}")
          IO.puts("   - Knowledge cells: #{cells}")

          # Show sample items
          items
          |> Enum.take(2)
          |> Enum.each(fn item ->
            type_icon = case item.knowledge_type do
              :subject -> "🏛️"
              :knowledge_unit -> "📋"
              :knowledge_cell -> "📝"
            end
            IO.puts("     #{type_icon} #{item.name}")
          end)

          if length(items) > 2 do
            IO.puts("     ... and #{length(items) - 2} more")
          end
          IO.puts("")
        end)

        # Summary statistics
        total_subjects = Enum.count(resources, &(&1.knowledge_type == :subject))
        total_units = Enum.count(resources, &(&1.knowledge_type == :knowledge_unit))
        total_cells = Enum.count(resources, &(&1.knowledge_type == :knowledge_cell))

        IO.puts("📊 Import Summary:")
        IO.puts("   Total Knowledge Resources: #{length(resources)}")
        IO.puts("   - Subjects: #{total_subjects}")
        IO.puts("   - Units: #{total_units}")
        IO.puts("   - Knowledge Cells: #{total_cells}")
        IO.puts("")
        IO.puts("🎉 OPML import completed successfully!")

      {:error, error} ->
        IO.puts("❌ Error retrieving knowledge resources:")
        IO.puts("#{inspect(error)}")
    end
  end
end

SimpleVerify.verify_import()
#!/usr/bin/env elixir

# Script to verify the imported knowledge items
defmodule VerifyImport do
  @course_id "15cbf640-c16b-46b9-a029-70a56f4f20f9"
  @tenant "org_2af44c7b_081a_497a_9858_365fa90ad5d7"

  def run_verification do
    IO.puts("=== Verifying Imported Knowledge ===")
    IO.puts("Course ID: #{@course_id}")
    IO.puts("Tenant: #{@tenant}")
    IO.puts("")

    # Get all knowledge resources for this course
    case KgEdu.Knowledge.Resource.list_knowledges([course_id: @course_id], tenant: @tenant) do
      {:ok, resources} ->
        IO.puts("Found #{length(resources)} knowledge resources in course:")
        IO.puts("")

        # Group by subject to show structure
        resources
        |> Enum.group_by(& &1.subject)
        |> Enum.each(fn {subject, items} ->
          IO.puts("📚 Subject: #{subject}")
          IO.puts("   Total items: #{length(items)}")

          # Count by type
          subjects = Enum.count(items, &(&1.knowledge_type == :subject))
          units = Enum.count(items, &(&1.knowledge_type == :knowledge_unit))
          cells = Enum.count(items, &(&1.knowledge_type == :knowledge_cell))

          IO.puts("   - Subjects: #{subjects}")
          IO.puts("   - Units: #{units}")
          IO.puts("   - Knowledge cells: #{cells}")

          # Show hierarchy examples
          items
          |> Enum.take(3)
          |> Enum.each(fn item ->
            type_info = case item.knowledge_type do
              :subject -> "🏛️ Subject"
              :knowledge_unit -> "📋 Unit"
              :knowledge_cell -> "📝 Knowledge cell"
            end

            IO.puts("     #{type_info} #{item.name}")
            if item.unit do
              IO.puts("        Unit: #{item.unit}")
            end
          end)

          if length(items) > 3 do
            IO.puts("     ... and #{length(items) - 3} more items")
          end
          IO.puts("")
        end)

      {:error, reason} ->
        IO.puts("❌ Error retrieving knowledge resources: #{reason}")
    end
  end

  def show_hierarchy_summary do
    IO.puts("=== Hierarchy Summary ===")
    IO.puts("")

    case KgEdu.Knowledge.Resource.list_knowledges([course_id: @course_id], tenant: @tenant) do
      {:ok, resources} ->
        # Count subjects (top-level with children)
        subjects = Enum.filter(resources, fn resource ->
          length(resource.child_units) > 0 or length(resource.direct_cells) > 0
        end)

        IO.puts("📊 Import Statistics:")
        IO.puts("   Total Subjects: #{length(subjects)}")
        IO.puts("   Total Units: #{Enum.count(resources, &(&1.knowledge_type == :knowledge_unit))}")
        IO.puts("   Total Knowledge Cells: #{Enum.count(resources, &(&1.knowledge_type == :knowledge_cell))}")
        IO.puts("   Total Knowledge Resources: #{length(resources)}")
        IO.puts("")

        subjects
        |> Enum.take(3)
        |> Enum.each(fn subject ->
          IO.puts("🏛️ Subject: #{subject.name}")

          # Show units under this subject
          units = subject.child_units
          if length(units) > 0 do
            IO.puts("   Units (#{length(units)}):")
            units
            |> Enum.take(2)
            |> Enum.each(fn unit ->
              IO.puts("     📋 #{unit.name}")
            end)
            if length(units) > 2 do
              IO.puts("     ... and #{length(units) - 2} more units")
            end
          end

          # Show direct cells under this subject
          direct_cells = subject.direct_cells
          if length(direct_cells) > 0 do
            IO.puts("   Direct Knowledge Cells (#{length(direct_cells)}):")
            direct_cells
            |> Enum.take(2)
            |> Enum.each(fn cell ->
              IO.puts("     📝 #{cell.name}")
            end)
            if length(direct_cells) > 2 do
              IO.puts("     ... and #{length(direct_cells) - 2} more cells")
            end
          end
          IO.puts("")
        end)

      {:error, reason} ->
        IO.puts("❌ Error retrieving hierarchy: #{reason}")
    end
  end
end

# Run verification
VerifyImport.run_verification()
IO.puts("")
VerifyImport.show_hierarchy_summary()
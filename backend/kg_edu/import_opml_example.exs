#!/usr/bin/env elixir

# Script to import example OPML file into knowledge graph
# Usage: mix run import_opml_example.exs

defmodule OpmlImportScript do
  # Your specific values
  @course_id "15cbf640-c16b-46b9-a029-70a56f4f20f9"
  @tenant "org_2af44c7b_081a_497a_9858_365fa90ad5d7"

  def run_import do
    IO.puts("=== OPML Import Script ===")
    IO.puts("Course ID: #{@course_id}")
    IO.puts("Tenant: #{@tenant}")
    IO.puts("")

    # Choose which OPML file to import
    opml_files = [
      {"examples/mathematics.opml", "Mathematics"},
      {"examples/science.opml", "Science"},
      {"examples/business.opml", "Business"},
      {"examples/languages.opml", "Languages"}
    ]

    # For this example, let's import the Mathematics curriculum
    {opml_file, subject_name} = List.first(opml_files)

    IO.puts("Importing #{subject_name} curriculum from: #{opml_file}")
    IO.puts("")

    # Step 1: Read the OPML file
    case File.read(opml_file) do
      {:ok, opml_content} ->
        IO.puts("✓ Successfully read OPML file (#{byte_size(opml_content)} bytes)")

        # Step 2: Parse the OPML to show what will be imported
        case KgEdu.OpmlParser.parse_from_text(opml_content) do
          {:ok, knowledge_data} ->
            IO.puts("✓ Parsed #{length(knowledge_data)} knowledge items")
            IO.puts("")

            # Show summary of what will be imported
            show_import_summary(knowledge_data)

            # Step 3: Confirm and proceed with import
            IO.puts("Proceeding with import...")
            IO.puts("")

            import_result = KgEdu.Knowledge.Resource.import_knowledge_from_opml(%{
              opml_data: opml_content,
              course_id: @course_id,
            }, tenant: @tenant)

            case import_result do
              :ok ->
                IO.puts("🎉 SUCCESS: OPML import completed successfully!")
                IO.puts("All knowledge items have been imported into your knowledge graph.")

              {:error, reason} ->
                IO.puts("❌ ERROR: Import failed")
                IO.puts("Reason: #{inspect(reason)}")
            end

          {:error, reason} ->
            IO.puts("❌ ERROR: Failed to parse OPML file")
            IO.puts("Reason: #{reason}")
        end

      {:error, reason} ->
        IO.puts("❌ ERROR: Failed to read OPML file")
        IO.puts("Reason: #{reason}")
    end
  end

  defp show_import_summary(knowledge_data) do
    IO.puts("Import Summary:")
    IO.puts("")

    # Group by subject to show structure
    knowledge_data
    |> Enum.group_by(& &1.subject)
    |> Enum.each(fn {subject, items} ->
      IO.puts("📚 Subject: #{subject}")
      IO.puts("   Items to import: #{length(items)}")

      # Count units vs knowledge cells
      units = Enum.count(items, & &1.unit)
      cells = length(items) - units

      IO.puts("   - Units: #{units}")
      IO.puts("   - Knowledge cells: #{cells}")

      # Show first few items as examples
      items
      |> Enum.take(2)
      |> Enum.each(fn item ->
        unit_info = if item.unit, do: " (Unit: #{item.unit})", else: ""
        IO.puts("     • #{item.title}#{unit_info}")
      end)

      if length(items) > 2 do
        IO.puts("     ... and #{length(items) - 2} more items")
      end
      IO.puts("")
    end)
  end

  def run_all_imports do
    IO.puts("=== Import All Example OPML Files ===")
    IO.puts("Course ID: #{@course_id}")
    IO.puts("Tenant: #{@tenant}")
    IO.puts("")

    opml_files = [
      {"examples/mathematics.opml", "Mathematics"},
      {"examples/science.opml", "Science"},
      {"examples/business.opml", "Business"},
      {"examples/languages.opml", "Languages"}
    ]

    Enum.each(opml_files, fn {opml_file, subject_name} ->
      IO.puts("--- Importing #{subject_name} ---")

      case File.read(opml_file) do
        {:ok, opml_content} ->
          IO.puts("Reading #{opml_file}...")

          case KgEdu.OpmlParser.parse_from_text(opml_content) do
            {:ok, knowledge_data} ->
              IO.puts("Found #{length(knowledge_data)} items to import")

              import_result = KgEdu.Knowledge.Resource.import_knowledge_from_opml(%{
                opml_data: opml_content,
                course_id: @course_id,
              }, tenant: @tenant)

              case import_result do
                :ok ->
                  IO.puts("✅ #{subject_name} imported successfully")
                {:error, reason} ->
                  IO.puts("❌ #{subject_name} import failed: #{reason}")
              end

            {:error, reason} ->
              IO.puts("❌ Failed to parse #{subject_name}: #{reason}")
          end

        {:error, reason} ->
          IO.puts("❌ Failed to read #{subject_name}: #{reason}")
      end

      IO.puts("")
    end)
  end

  def interactive_choose do
    IO.puts("=== Interactive OPML Import ===")
    IO.puts("Course ID: #{@course_id}")
    IO.puts("Tenant: #{@tenant}")
    IO.puts("")

    opml_files = [
      {"examples/mathematics.opml", "Mathematics Curriculum"},
      {"examples/science.opml", "Science Curriculum"},
      {"examples/business.opml", "Business Studies Curriculum"},
      {"examples/languages.opml", "Language Learning Curriculum"},
      {"sample_knowledge.opml", "Computer Science Curriculum (Original)"}
    ]

    IO.puts("Available OPML files to import:")
    IO.puts("")

    opml_files
    |> Enum.with_index(1)
    |> Enum.each(fn {{file, description}, index} ->
      IO.puts("#{index}. #{file}")
      IO.puts("   #{description}")
      IO.puts("")
    end)

    IO.puts("Enter the number of the file to import (1-#{length(opml_files)}):")

    # For demonstration, let's just import the first one
    # In a real interactive script, you would read user input here
    choice = 1

    if choice >= 1 and choice <= length(opml_files) do
      {opml_file, description} = Enum.at(opml_files, choice - 1)

      IO.puts("Importing: #{description}")
      IO.puts("From: #{opml_file}")
      IO.puts("")

      case File.read(opml_file) do
        {:ok, opml_content} ->
          case KgEdu.OpmlParser.parse_from_text(opml_content) do
            {:ok, knowledge_data} ->
              IO.puts("Found #{length(knowledge_data)} knowledge items")
              show_import_summary(knowledge_data)

              IO.puts("Importing now...")

              import_result = KgEdu.Knowledge.Resource.import_knowledge_from_opml(%{
                opml_data: opml_content,
                course_id: @course_id,
              }, tenant: @tenant)

              case import_result do
                :ok ->
                  IO.puts("🎉 Import completed successfully!")
                {:error, reason} ->
                  IO.puts("❌ Import failed: #{reason}")
              end

            {:error, reason} ->
              IO.puts("❌ Failed to parse OPML: #{reason}")
          end

        {:error, reason} ->
          IO.puts("❌ Failed to read file: #{reason}")
      end
    else
      IO.puts("Invalid choice!")
    end
  end
end

# Uncomment the function you want to run:

# Option 1: Import single example (Mathematics)
OpmlImportScript.run_import()

# Option 2: Import all examples
# OpmlImportScript.run_all_imports()

# Option 3: Interactive choice (would need user input in real scenario)
# OpmlImportScript.interactive_choose()
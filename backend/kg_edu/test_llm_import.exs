#!/usr/bin/env elixir

# Simple script to test the LLM knowledge import functionality
# Usage: mix run test_llm_import.exs

# Load the application with dev environment
Mix.start()
Mix.env(:dev)  # Ensure we're in dev environment
Application.ensure_all_started(:kg_edu)

# Make sure we're using the dev repo configuration (matches config/dev.exs)
Application.put_env(:kg_edu, KgEdu.Repo, [
  username: "postgres",
  password: "postgres",
  hostname: "localhost",
  database: "kg_edu_dev",
  port: 5433,
  stacktrace: true,
  show_sensitive_data_on_connection_error: true,
  pool_size: 10
])

# Start the repo to ensure database connection
KgEdu.Repo.start_link()

# Setup ReqLLM configuration
KgEdu.ReqLLMSetup.setup()

# Verify database connection
case KgEdu.Repo.query("SELECT 1") do
  {:ok, _} ->
    IO.puts("✅ Database connection successful")

  {:error, reason} ->
    IO.puts("❌ Database connection failed: #{inspect(reason)}")
    IO.puts("Please ensure PostgreSQL is running on localhost:5433 with database 'kg_edu_dev'")
    System.halt(1)
end

alias KgEdu.Courses.Course
alias KgEdu.Knowledge.ImportFromLLM

IO.puts("🚀 Testing LLM Knowledge Import with dev database")
IO.puts("=" |> String.duplicate(50))

# Show configuration being used
IO.puts("📋 Configuration:")
IO.puts("  Database: kg_edu_dev")
IO.puts("  Host: localhost:5433")
IO.puts("  Environment: #{Mix.env()}")
IO.puts("")

# Use the specific course ID
course_id = "faf6950f-b50d-4c0a-b09f-fd989dfd13e1"
IO.puts("  Course ID: #{course_id}")
IO.puts("Looking up course with ID: #{course_id}")

case Course.get_course(course_id) do
  {:ok, course} ->
    IO.puts("✅ Found course: #{course.title}")
    IO.puts("📚 Course Description: #{course.description || "No description"}")
    IO.puts("👨‍🏫 Teacher ID: #{course.teacher_id}")

    # Chinese example text about physics
    chinese_text = """
    物理学是一门研究物质、能量及其相互作用的自然科学。物理学包含多个重要的分支学科，
    其中力学是最基础和重要的分支之一。

    力学这个学科主要研究物体的运动和力的关系。在力学中，经典力学是一个重要的理论体系，
    它包括牛顿力学和拉格朗日力学等方法。牛顿力学是经典力学的基础，由牛顿三大定律构成。

    在学习力学时，需要先掌握基础数学知识，特别是微积分。然后学习牛顿三大定律：
    第一定律（惯性定律）、第二定律（加速度定律）和第三定律（作用与反作用定律）。

    牛顿第二定律中的力、质量和加速度是三个核心概念。力是改变物体运动状态的原因，
    质量是物体惯性的量度，加速度是物体速度的变化率。

    除了经典力学，量子力学也是物理学的重要分支，它研究微观粒子的运动规律。
    量子力学与经典力学有很多不同之处，但它们都描述了物理世界的基本规律。
    """

    IO.puts("\n📝 Input Chinese Text:")
    IO.puts("-" |> String.duplicate(30))
    IO.puts(chinese_text)
    IO.puts("-" |> String.duplicate(30))

    IO.puts("\n🤖 Analyzing text with LLM...")

    # Import knowledge from text
    case ImportFromLLM.import_from_text(chinese_text, course.id) do
      {:ok, result} ->
        IO.puts("✅ Successfully imported knowledge!")
        
        IO.puts("\n📊 Resource Summary:")
        Enum.each(result[:resources] || [], fn resource ->
          type_icon = case resource.knowledge_type do
            :subject -> "📖"
            :knowledge_unit -> "📚"
            :knowledge_cell -> "📄"
          end
          IO.puts("  #{type_icon} #{resource.name} (#{resource.knowledge_type})")
          if resource.unit && resource.unit != "" do
            IO.puts("    Unit: #{resource.unit}")
          end
        end)

        # Display relations
        if length(result[:relations] || []) > 0 do
          IO.puts("\n🔗 Relations:")
          Enum.each(result[:relations] || [], fn relation ->
            if relation do
              IO.puts("  • #{relation.source_knowledge.name} → #{relation.target_knowledge.name} (#{relation.relation_type.name})")
            end
          end)
        end

      {:error, reason} ->
        IO.puts("❌ Import failed: #{inspect(reason)}")
        IO.puts("This might be due to:")
        IO.puts("  - Missing or invalid OPENROUTER_API_KEY")
        IO.puts("  - Network connectivity issues")
        IO.puts("  - LLM API rate limits")
        IO.puts("  - Invalid response format from LLM")
    end

  {:error, reason} ->
    IO.puts("❌ Failed to find course with ID #{course_id}: #{inspect(reason)}")
    IO.puts("Make sure this course exists in the database.")
    IO.puts("You can:")
    IO.puts("  1. Check if the course ID is correct")
    IO.puts("  2. Create a course with this ID first:")
    IO.puts("     In iex: KgEdu.Courses.Course.create_course(%{title: \"Test Course\", description: \"Test Description\", teacher_id: \"teacher-uuid\"})")
    IO.puts("  3. Use a different course ID that exists")
    IO.puts("  4. List existing courses:")

    # Try to list some courses to help the user
    case Course.list_courses() do
      {:ok, courses} ->
        IO.puts("   Found #{length(courses)} courses in database:")
        Enum.take(courses, 5) |> Enum.each(fn course ->
          IO.puts("     - #{course.title} (ID: #{course.id})")
        end)
        if length(courses) > 5 do
          IO.puts("     ... and #{length(courses) - 5} more")
        end

      {:error, list_error} ->
        IO.puts("   Could not list courses: #{inspect(list_error)}")
    end
end

IO.puts("\n🎉 Test completed!")

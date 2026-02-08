defmodule KgEdu.Demo.ImportFromLLM do
  @moduledoc """
  Demo script showing how to import knowledge and relations from Chinese text using LLM.

  Run with: iex -S mix phx.server
  Then: KgEdu.Demo.ImportFromLLM.run_demo()
  """

  alias KgEdu.Knowledge.ImportFromLLM
  alias KgEdu.Courses.Course

  def run_demo(course_id \\ "faf6950f-b50d-4c0a-b09f-fd989dfd13e1") do
    IO.puts("🚀 Starting LLM Knowledge Import Demo")
    IO.puts("=" |> String.duplicate(50))

    # Get the demo course by ID
    case get_course_by_id(course_id) do
      {:ok, course} ->
        IO.puts("✅ Using course: #{course.title} (ID: #{course.id})")

        # Chinese example text
        chinese_text = get_chinese_example_text()

        IO.puts("\n📝 Input Chinese Text:")
        IO.puts("-" |> String.duplicate(30))
        IO.puts(chinese_text)
        IO.puts("-" |> String.duplicate(30))

        IO.puts("\n🤖 Analyzing text with LLM...")

        # Import knowledge from text
        case ImportFromLLM.import_from_text(chinese_text, course.id) do
          {:ok, result} ->
            IO.puts("✅ Successfully imported knowledge!")
            display_import_results(result)

          {:error, reason} ->
            IO.puts("❌ Import failed: #{inspect(reason)}")
        end

      {:error, reason} ->
        IO.puts("❌ Failed to find course with ID #{course_id}: #{inspect(reason)}")
        IO.puts("Make sure the course exists in the database.")
    end

    IO.puts("\n🎉 Demo completed!")
  end

  defp get_course_by_id(course_id) do
    case Course.get_course(%{id: course_id}) do
      {:ok, course} -> {:ok, course}
      {:error, reason} -> {:error, reason}
    end
  end

  defp create_or_get_demo_course do
    case Course.get_course_by_title(%{title: "LLM导入演示课程"}) do
      {:ok, course} ->
        {:ok, course}

      {:error, _} ->
        Course.create_course(%{
          title: "LLM导入演示课程",
          description: "用于演示LLM知识导入功能的测试课程"
        })
    end
  end

  defp get_chinese_example_text do
    """
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
  end

  defp display_import_results(%{resources: resources, relations: relations}) do
    IO.puts("\n📚 Imported Knowledge Resources (#{length(resources)}):")
    IO.puts("-" |> String.duplicate(50))

    resources
    |> Enum.sort_by(&knowledge_type_order/1)
    |> Enum.each(fn resource ->
      type_icon = get_knowledge_type_icon(resource.knowledge_type)
      importance = get_importance_icon(resource.importance_level)

      IO.puts("#{type_icon} #{resource.name} #{importance}")
      IO.puts("   Type: #{resource.knowledge_type}")
      IO.puts("   Subject: #{resource.subject}")

      if resource.unit && resource.unit != "" do
        IO.puts("   Unit: #{resource.unit}")
      end

      IO.puts("   Description: #{resource.description}")
      IO.puts("")
    end)

    IO.puts("\n🔗 Imported Relations (#{length(relations)}):")
    IO.puts("-" |> String.duplicate(50))

    if Enum.empty?(relations) do
      IO.puts("No relations were created.")
    else
      Enum.each(relations, fn relation ->
        if relation do
          IO.puts("• #{relation.source_knowledge.name}")
          IO.puts("  → #{relation.relation_type.display_name}")
          IO.puts("  → #{relation.target_knowledge.name}")
          IO.puts("")
        end
      end)
    end

    IO.puts("\n📊 Summary:")
    IO.puts("• Knowledge Resources: #{length(resources)}")
    subject_count = Enum.count(resources, &(&1.knowledge_type == :subject))
    unit_count = Enum.count(resources, &(&1.knowledge_type == :knowledge_unit))
    cell_count = Enum.count(resources, &(&1.knowledge_type == :knowledge_cell))
    IO.puts("  - Subjects: #{subject_count}")
    IO.puts("  - Units: #{unit_count}")
    IO.puts("  - Knowledge Cells: #{cell_count}")
    IO.puts("• Relations: #{length(relations)}")
  end

  defp knowledge_type_order(resource) do
    case resource.knowledge_type do
      :subject -> 1
      :knowledge_unit -> 2
      :knowledge_cell -> 3
    end
  end

  defp get_knowledge_type_icon(:subject), do: "📖"
  defp get_knowledge_type_icon(:knowledge_unit), do: "📚"
  defp get_knowledge_type_icon(:knowledge_cell), do: "📄"

  defp get_importance_icon("hard"), do: "🔴"
  defp get_importance_icon("important"), do: "🟡"
  defp get_importance_icon("normal"), do: "⚪"
  defp get_importance_icon(_), do: "⚪"

  @doc """
  Test function with different Chinese text examples
  """
  def test_with_text(text, course_id \\ "faf6950f-b50d-4c0a-b09f-fd989dfd13e1") do
    case get_course_by_id(course_id) do
      {:ok, course} ->
        IO.puts("Testing with custom text:")
        IO.puts(text)
        IO.puts("\n" <> String.duplicate("=", 50))

        case ImportFromLLM.import_from_text(text, course.id) do
          {:ok, result} ->
            display_import_results(result)

          {:error, reason} ->
            IO.puts("❌ Import failed: #{inspect(reason)}")
        end

      {:error, reason} ->
        IO.puts("❌ Failed to find course: #{inspect(reason)}")
    end
  end

  @doc """
  Clean up demo data
  """
  def cleanup_demo do
    case Course.get_course_by_title(%{title: "LLM导入演示课程"}) do
      {:ok, course} ->
        IO.puts("🧹 Cleaning up demo data...")

        # This would require additional cleanup logic to delete all related resources and relations
        # For now, just show what would be cleaned up
        IO.puts("Would delete course: #{course.title}")
        IO.puts("Would delete related knowledge resources and relations")

      {:error, _} ->
        IO.puts("No demo course found to clean up.")
    end
  end
end

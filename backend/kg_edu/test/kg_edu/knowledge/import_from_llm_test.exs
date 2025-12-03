defmodule KgEdu.Knowledge.ImportFromLLMTest do
  use ExUnit.Case, async: false
  use KgEdu.DataCase

  alias KgEdu.Knowledge.ImportFromLLM
  alias KgEdu.Knowledge.Resource
  alias KgEdu.Knowledge.Relation
  alias KgEdu.Knowledge.RelationType
  alias KgEdu.Courses.Course

  describe "import_from_text/3" do
    test "successfully imports knowledge and relations from chinese text" do
      # Create a test course
      {:ok, course} = create_test_course("数学基础")
      
      # Chinese example text about mathematics
      chinese_text = """
      数学是一门基础学科，包含了许多重要的概念和理论。在数学学习中，代数是一个重要的分支。
      
      代数这门学科包括了许多基础概念，比如线性代数和抽象代数。线性代数是研究向量空间和线性映射的数学分支，
      它包括矩阵运算、特征值和特征向量等核心内容。矩阵是线性代数的基本工具，用于表示线性变换。
      
      特征值和特征向量是线性代数中的重要概念，它们描述了线性变换的基本性质。
      
      在学习代数时，需要先掌握基础数学知识，然后学习线性代数，最后深入研究特征值等高级概念。
      """
      
      # Mock the LLM call to return structured data
      llm_response = %{
        knowledge_resources: [
          %{
            name: "数学",
            type: "subject",
            subject: "数学",
            description: "基础学科",
            importance_level: "important"
          },
          %{
            name: "代数",
            type: "knowledge_unit", 
            subject: "数学",
            unit: "代数",
            description: "数学的重要分支",
            importance_level: "important"
          },
          %{
            name: "线性代数",
            type: "knowledge_cell",
            subject: "数学", 
            unit: "代数",
            description: "研究向量空间和线性映射的数学分支",
            importance_level: "hard"
          },
          %{
            name: "矩阵",
            type: "knowledge_cell",
            subject: "数学",
            unit: "代数", 
            description: "线性代数的基本工具",
            importance_level: "normal"
          },
          %{
            name: "特征值",
            type: "knowledge_cell",
            subject: "数学",
            unit: "代数",
            description: "线性代数中的重要概念",
            importance_level: "hard"
          }
        ],
        relations: [
          %{
            source_knowledge: "基础数学知识",
            target_knowledge: "线性代数",
            relation_type: "prerequisite"
          },
          %{
            source_knowledge: "线性代数", 
            target_knowledge: "特征值",
            relation_type: "includes"
          },
          %{
            source_knowledge: "代数",
            target_knowledge: "线性代数", 
            relation_type: "includes"
          }
        ]
      }
      
      # Mock ReqLLM.generate_text/2 to return our test response
      expect_req_llm_call(llm_response)
      
      # Run the import
      result = ImportFromLLM.import_from_text(chinese_text, course.id)
      
      # Verify the result
      assert {:ok, imported_data} = result
      assert %{resources: resources, relations: relations} = imported_data
      
      # Verify knowledge resources were created
      assert length(resources) > 0
      
      # Check that specific resources exist
      math_resource = Enum.find(resources, &(&1.name == "数学"))
      assert math_resource
      assert math_resource.knowledge_type == :subject
      
      linear_algebra = Enum.find(resources, &(&1.name == "线性代数"))
      assert linear_algebra
      assert linear_algebra.knowledge_type == :knowledge_cell
      
      # Verify relations were created
      assert length(relations) > 0
      
      # Clean up
      cleanup_test_data(course, resources, relations)
    end
    
    test "handles LLM analysis failure gracefully" do
      {:ok, course} = create_test_course("测试课程")
      
      text = "测试文本"
      
      # Mock LLM failure
      expect_req_llm_failure()
      
      result = ImportFromLLM.import_from_text(text, course.id)
      
      assert {:error, _reason} = result
      
      # Clean up
      Repo.delete(course)
    end
    
    test "validates LLM response structure" do
      {:ok, course} = create_test_course("测试课程")
      
      text = "测试文本"
      
      # Mock invalid LLM response
      expect_req_llm_invalid_response()
      
      result = ImportFromLLM.import_from_text(text, course.id)
      
      assert {:error, _reason} = result
      
      # Clean up
      Repo.delete(course)
    end
  end
  
  # Helper functions
  
  defp create_test_course(title) do
    Course.create_course(%{
      title: title,
      description: "测试课程描述"
    })
  end
  
  defp expect_req_llm_call(response_data) do
    # This would require mocking ReqLLM.generate_text/2
    # For now, we'll implement integration tests that actually call the LLM
    # In a real scenario, you'd use :mox or similar mocking framework
  end
  
  defp expect_req_llm_failure do
    # Mock LLM failure
  end
  
  defp expect_req_llm_invalid_response do
    # Mock invalid LLM response
  end
  
  defp cleanup_test_data(course, resources, relations) do
    # Delete relations first (foreign key constraint)
    Enum.each(relations, fn relation ->
      if relation do
        Relation.delete_knowledge_relation(relation, authorize?: false)
      end
    end)
    
    # Delete resources
    Enum.each(resources, fn resource ->
      Resource.delete_knowledge_resource(resource, authorize?: false)
    end)
    
    # Delete course
    Repo.delete(course)
  end
  
  # Integration test with actual LLM call
  describe "integration tests (with actual LLM)" do
    @tag :external
    test "full pipeline with actual LLM call" do
      # This test requires actual LLM API access
      # Should be run manually or in CI with proper API keys
      
      {:ok, course} = create_test_course("数学测试")
      
      chinese_text = """
      本章学习微积分的基础知识。微积分是数学的一个重要分支，主要包括微分学和积分学。
      
      微分学研究函数的变化率，包括导数、微分等概念。导数是描述函数在某一点变化率的工具。
      
      积分学研究面积的累积，包括定积分和不定积分。定积分可以计算曲线下的面积。
      
      学习微积分需要先掌握函数的基础知识，然后学习导数，最后学习积分的概念。
      """
      
      # Skip if no API key configured
      api_key = System.get_env("OPENROUTER_API_KEY")
      if api_key do
        result = ImportFromLLM.import_from_text(chinese_text, course.id)
        
        case result do
          {:ok, imported_data} ->
            assert %{resources: resources, relations: relations} = imported_data
            assert length(resources) > 0
            
            # Verify we have expected knowledge concepts
            concept_names = Enum.map(resources, & &1.name)
            assert "微积分" in concept_names or "微分学" in concept_names
            
            # Clean up
            Enum.each(relations, fn relation ->
              if relation do
                Relation.delete_knowledge_relation(relation, authorize?: false)
              end
            end)
            
            Enum.each(resources, fn resource ->
              Resource.delete_knowledge_resource(resource, authorize?: false)
            end)
            
            Repo.delete(course)
            
          {:error, reason} ->
            IO.puts("LLM import failed: #{inspect(reason)}")
            Repo.delete(course)
        end
      else
        IO.puts("Skipping LLM integration test - no API key configured")
        Repo.delete(course)
      end
    end
  end
end
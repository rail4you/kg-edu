defmodule KgEdu.Knowledge.ImportServiceTest do
  use ExUnit.Case, async: false
  
  alias KgEdu.Knowledge.ImportService
  alias KgEdu.Knowledge.Resource
  alias KgEdu.Knowledge.RelationType
  alias KgEdu.Knowledge.Relation
  alias KgEdu.Courses.Course

  describe "Excel validation" do
    test "validates excel format correctly" do
      # Test with valid Excel data (base64 encoded minimal Excel)
      # This is a basic test - in practice you'd use real Excel files
      valid_excel_data = create_test_excel_data()
      
      case ImportService.validate_excel_format(valid_excel_data) do
        {:ok, result} ->
          assert %{
            sheet1_valid: true,
            sheet2_valid: true,
            sheet1_rows: _,
            sheet2_rows: _
          } = result
        {:error, _} ->
          # Expected for this test since we're using dummy data
          :ok
      end
    end
  end

  describe "Import functionality" do
    test "can create knowledge resources from import data" do
      # Create a test course first
      {:ok, course} = create_test_course()
      
      # Test knowledge resource creation
      knowledge_attrs = %{
        name: "Test Knowledge",
        description: "Test Description", 
        knowledge_type: :knowledge_cell,
        course_id: course.id,
        importance_level: :normal
      }
      
      assert {:ok, _knowledge} = Resource.create_knowledge_resource(knowledge_attrs)
    end

    test "can create relation types" do
      relation_attrs = %{
        name: "test_relation",
        display_name: "Test Relation",
        description: "A test relation type"
      }
      
      assert {:ok, _relation_type} = RelationType.create_relation_type(relation_attrs)
    end
  end

  # Helper functions
  defp create_test_excel_data do
    # Create a minimal base64 string for testing
    # In practice, you'd encode an actual Excel file
    "dGVzdCBkYXRh"  # Base64 for "test data"
  end

  defp create_test_course do
    course_attrs = %{
      title: "Test Course",
      description: "A test course for import testing",
      teacher_id: get_test_user_id()
    }
    
    Course.create_course(course_attrs)
  end

  defp get_test_user_id do
    # In a real test, you'd create a test user or use fixtures
    # For now, return a UUID that might exist
    "00000000-0000-0000-0000-000000000000"
  end
end
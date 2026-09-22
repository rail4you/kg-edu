defmodule KgEdu.Knowledge.ImportServiceTest do
  use KgEdu.DataCase, async: false

  import KgEdu.AccountsFixtures

  alias KgEdu.Knowledge.ImportService
  alias KgEdu.Knowledge.Resource
  alias KgEdu.Knowledge.RelationType
  alias KgEdu.Courses.Course
  alias KgEdu.Test.ExcelTestHelper

  describe "Excel validation" do
    test "validates real excel format" do
      b64 =
        ExcelTestHelper.create_test_excel_base64([
          ["说明行"],
          ["一级知识点", "二级知识点", "三级知识点", "知识点名称", "描述", "重要性", "排序"],
          ["数学", "代数", "方程", "一元一次方程", "基础", "重要", 1],
          ["数学", "代数", "方程", "二元一次方程组", "进阶", "重要", 2]
        ])

      assert {:ok, %{sheet_valid: true, sheet_rows: 2}} =
               ImportService.validate_excel_format(b64)
    end

    test "rejects invalid excel data" do
      assert {:error, _} = ImportService.validate_excel_format("dGVzdCBkYXRh")
    end
  end

  describe "Import functionality" do
    test "can create knowledge resources from import data" do
      user = user_fixture()

      {:ok, course} =
        Course.create_course(
          %{title: "Test Course", description: "A test course for import testing", teacher_id: user.id},
          tenant: test_tenant()
        )

      knowledge_attrs = %{
        name: "Test Knowledge",
        description: "Test Description",
        knowledge_type: :subject,
        course_id: course.id,
        importance_level: "normal"
      }

      assert {:ok, _knowledge} =
               Resource.create_knowledge_resource(knowledge_attrs, tenant: test_tenant())
    end

    test "can create relation types" do
      relation_attrs = %{
        name: "test_relation_#{System.unique_integer([:positive])}",
        display_name: "Test Relation",
        description: "A test relation type"
      }

      assert {:ok, _relation_type} =
               RelationType.create_relation_type(relation_attrs, tenant: test_tenant())
    end
  end
end

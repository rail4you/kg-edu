defmodule KgEdu.Knowledge.ImportFromLLMTest do
  use KgEdu.DataCase, async: false

  import KgEdu.AccountsFixtures

  alias KgEdu.Knowledge.ImportFromLLM
  alias KgEdu.Courses.Course

  describe "import_from_text/3" do
    @tag :external
    test "successfully imports knowledge and relations from chinese text" do
      # 需 live LLM Key：mix test --include external
      user = user_fixture()

      {:ok, course} =
        Course.create_course(%{title: "数学基础", description: "测试课程描述", teacher_id: user.id},
          tenant: test_tenant()
        )

      chinese_text = """
      数学是一门基础学科，包含了许多重要的概念和理论。在数学学习中，代数是一个重要的分支。
      代数这门学科包括了许多基础概念，比如线性代数和抽象代数。线性代数是研究向量空间和线性映射的数学分支，
      它包括矩阵运算、特征值和特征向量等核心内容。矩阵是线性代数的基本工具，用于表示线性变换。
      """

      assert {:ok, imported_data} =
               ImportFromLLM.import_from_text(chinese_text, course.id, tenant: test_tenant())

      assert %{resources: resources, relations: relations} = imported_data
      assert length(resources) > 0

      math_resource = Enum.find(resources, &(&1.name == "数学"))
      assert math_resource
      assert math_resource.knowledge_type == :subject
      assert length(relations) > 0
    end

    test "handles LLM analysis failure gracefully" do
      # 无有效 Key 时 analyze 直接失败，不写库（离线可过）
      user = user_fixture()

      {:ok, course} =
        Course.create_course(%{title: "测试课程", description: "测试课程描述", teacher_id: user.id},
          tenant: test_tenant()
        )

      assert {:error, _reason} =
               ImportFromLLM.import_from_text("测试文本", course.id, tenant: test_tenant())
    end

    test "validates LLM response structure" do
      user = user_fixture()

      {:ok, course} =
        Course.create_course(%{title: "测试课程2", description: "测试课程描述", teacher_id: user.id},
          tenant: test_tenant()
        )

      assert {:error, _reason} =
               ImportFromLLM.import_from_text("测试文本", course.id, tenant: test_tenant())
    end
  end

  describe "integration tests (with actual LLM)" do
    @tag :external
    test "full pipeline with actual LLM call" do
      user = user_fixture()

      {:ok, course} =
        Course.create_course(%{title: "数学测试", description: "测试课程描述", teacher_id: user.id},
          tenant: test_tenant()
        )

      chinese_text = """
      本章学习微积分的基础知识。微积分是数学的一个重要分支，主要包括微分学和积分学。
      微分学研究函数的变化率，包括导数、微分等概念。导数是描述函数在某一点变化率的工具。
      """

      assert {:ok, imported_data} =
               ImportFromLLM.import_from_text(chinese_text, course.id, tenant: test_tenant())

      assert %{resources: resources} = imported_data
      assert length(resources) > 0
      concept_names = Enum.map(resources, & &1.name)
      assert "微积分" in concept_names or "微分学" in concept_names
    end
  end
end

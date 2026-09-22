defmodule KgEdu.Forms.FormsTest do
  @moduledoc """
  P3: 自定义表单 + 审批流（离线可测，不调 LLM）。
  """
  use KgEdu.DataCase, async: true

  import KgEdu.AccountsFixtures

  alias KgEdu.Forms.{FormDef, FormSubmission}
  alias KgEdu.Attendance.FaceCheckLog
  alias KgEdu.Knowledge.PracticeAttempt

  @schema [
    %{"key" => "reason", "label" => "请假事由", "type" => "textarea", "required" => true},
    %{"key" => "days", "label" => "天数", "type" => "number", "required" => true},
    %{"key" => "kind", "label" => "类型", "type" => "radio", "required" => false, "options" => ["事假", "病假"]}
  ]

  test "表单定义增删改查" do
    assert {:ok, form} =
             FormDef.create_form_def(
               %{title: "请假申请", category: "请假", schema: @schema},
               tenant: test_tenant()
             )

    assert {:ok, [_ | _]} = FormDef.list_form_defs(tenant: test_tenant())
    assert {:ok, updated} = FormDef.update_form_def(form, %{description: "v2"}, tenant: test_tenant())
    assert updated.description == "v2"
  end

  test "提交表单状态为待审核，审核流转" do
    {:ok, form} =
      FormDef.create_form_def(%{title: "报销申请", category: "报销", schema: @schema},
        tenant: test_tenant()
      )

    student = user_fixture()
    teacher = user_fixture()

    assert {:ok, sub} =
             FormSubmission.submit_form(
               %{form_id: form.id, submitter_id: student.id, values: %{"reason" => "出差", "days" => 3}},
               tenant: test_tenant()
             )

    assert sub.status == :submitted

    assert {:ok, approved} =
             FormSubmission.review_submission(sub, %{status: :approved, review_note: "同意", reviewer_id: teacher.id},
               tenant: test_tenant()
             )

    assert approved.status == :approved
  end

  test "审核状态非法被拒绝" do
    {:ok, form} =
      FormDef.create_form_def(%{title: "报修单", category: "报修", schema: @schema},
        tenant: test_tenant()
      )

    {:ok, sub} =
      FormSubmission.submit_form(%{form_id: form.id, values: %{"reason" => "灯坏了"}}, tenant: test_tenant())

    assert {:error, _} =
             FormSubmission.review_submission(sub, %{status: :submitted}, tenant: test_tenant())
  end

  test "人脸抓拍记录" do
    user = user_fixture()

    assert {:ok, log} =
             FaceCheckLog.log_face_check(
               %{user_id: user.id, scene: :video_start, result: :pass, note: "demo"},
               tenant: test_tenant()
             )

    assert log.scene == :video_start
    assert {:ok, [_ | _]} = FaceCheckLog.list_face_checks_by_user(%{user_id: user.id}, tenant: test_tenant())
  end

  test "实践记录创建" do
    assert {:ok, attempt} =
             PracticeAttempt.create_practice_attempt(
               %{scenario: :debate_arena, transcript: [%{"role" => "user", "content" => "正方观点"}]},
               tenant: test_tenant()
             )

    assert attempt.status == :draft
  end

  test "AI 填表无 Key 时返回 Key 错误（不触网）" do
    case KgEdu.Agent.ApiKeyProvider.get_key(:qwen) do
      nil ->
        assert {:error, reason} =
                 KgEdu.Agent.FormAiService.fill_from_text(@schema, "请假三天看病")

        assert reason =~ "Qwen API Key"

      _ ->
        :ok
    end
  end

  test "extract_json 提取代码块" do
    assert KgEdu.Agent.FormAiService.extract_json("```json\n{\"a\": 1}\n```") == "{\"a\": 1}"
    assert KgEdu.Agent.FormAiService.extract_json("{\"a\": 1}") == "{\"a\": 1}"
  end
end

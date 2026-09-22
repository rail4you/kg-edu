defmodule KgEdu.Insights.EngineTest do
  @moduledoc """
  P4: 数据智能引擎 — 意图识别、报表构建（读库但不调 LLM，离线可测）。
  """
  use KgEdu.DataCase, async: true

  import KgEdu.AccountsFixtures

  alias KgEdu.Insights.{Engine, ReportTemplate}

  test "未知问题返回引导" do
    assert {:ok, %{intent: "unknown", rows: [], columns: []}} =
             Engine.ask("今天天气怎么样", test_tenant(), days: 30)
  end

  test "签到率问答返回表格" do
    assert {:ok, result} = Engine.ask("某院系近1个月课程签到率", test_tenant(), days: 30)
    assert result.intent == "signin"
    assert result.columns == ["姓名", "院系", "签到次数"]
    assert is_list(result.rows)
    assert %{rate: _, total_users: _} = result.stats
  end

  test "上传量问答返回表格" do
    assert {:ok, result} = Engine.ask("各院系资源上传量统计", test_tenant(), days: 30)
    assert result.intent == "upload"
    assert result.columns == ["院系", "上传量"]
  end

  test "活动问答返回表格" do
    assert {:ok, result} = Engine.ask("本学期课堂活动开展情况", test_tenant(), days: 30)
    assert result.intent == "activity"
    assert result.columns == ["活动类型", "次数"]
  end

  test "build_table 未知数据集报错" do
    assert {:error, _} = Engine.build_table("nope", test_tenant(), days: 7)
  end

  test "build_table 支持字段投影与排序" do
    assert {:ok, %{columns: ["院系", "上传量"], rows: rows}} =
             Engine.build_table("upload", test_tenant(),
               days: 30,
               fields: ["院系", "上传量"],
               sort_by: "上传量",
               sort_dir: "desc"
             )

    counts = Enum.map(rows, & &1["上传量"])
    assert counts == Enum.sort(counts, :desc)
  end

  test "build_report 生成大纲与章节" do
    assert {:ok, report} = Engine.build_report("某学期课堂活动开展情况分析", test_tenant(), days: 30)
    assert report.title =~ "课堂活动"
    assert length(report.outline) == 3
    assert length(report.sections) == 3
    assert Enum.all?(report.sections, &Map.has_key?(&1, :chart))
    assert Enum.all?(report.sections, &Map.has_key?(&1, :table))
  end

  test "ReportTemplate 增删改查" do
    assert {:ok, t} =
             ReportTemplate.create_report_template(
               %{name: "签到月报", kind: :table, config: %{dataset: "signin", days: 30}},
               tenant: test_tenant()
             )

    assert {:ok, [_ | _]} = ReportTemplate.list_report_templates(tenant: test_tenant())
    assert {:ok, updated} = ReportTemplate.update_report_template(t, %{name: "签到月报v2"}, tenant: test_tenant())
    assert updated.name == "签到月报v2"
    assert :ok = ReportTemplate.delete_report_template(t, tenant: test_tenant())
  end
end

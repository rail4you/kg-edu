defmodule KgEdu.AI.AssistantTest do
  @moduledoc """
  需求 10：助教设置/工具池/插件执行（离线可测部分）。
  """
  use KgEdu.DataCase, async: true

  import KgEdu.AccountsFixtures

  alias KgEdu.AI.{AssistantSetting, AssistantTool, PluginRunner}

  test "设置开关 upsert（创建→更新）" do
    assert {:ok, saved} =
             AssistantSetting.save_assistant_settings(%{fallback_enabled: false}, tenant: test_tenant())

    assert saved.fallback_enabled == false
    assert saved.web_search_enabled == false

    assert {:ok, saved2} =
             AssistantSetting.save_assistant_settings(%{web_search_enabled: true}, tenant: test_tenant())

    assert saved2.web_search_enabled == true
    assert saved2.fallback_enabled == false
  end

  test "工具池增删改查" do
    assert {:ok, tool} =
             AssistantTool.create_assistant_tool(
               %{name: "邮件通知", kind: :plugin, plugin: "email", enabled: true},
               tenant: test_tenant()
             )

    assert {:ok, [_ | _]} = AssistantTool.list_assistant_tools(tenant: test_tenant())

    assert {:ok, disabled} =
             AssistantTool.update_assistant_tool(tool, %{enabled: false}, tenant: test_tenant())

    assert disabled.enabled == false
  end

  test "插件目录 11 种" do
    assert length(PluginRunner.catalog()) == 11
    names = Enum.map(PluginRunner.catalog(), & &1.name)
    assert "push" in names and "email" in names and "ppt_generate" in names
    assert "knowledge_rates" in names and "course_search" in names
  end

  test "未知插件报错" do
    assert {:error, _} = PluginRunner.run("nope", %{}, test_tenant())
  end

  test "chart 插件纯逻辑（不读库）" do
    assert {:ok, %{option: option}} =
             PluginRunner.run("chart", %{"title" => "t", "data" => [%{"name" => "a", "value" => 1}]}, test_tenant())

    assert option["series"] |> hd() |> Map.get("type") == "bar"
  end

  test "map 插件纯逻辑" do
    assert {:ok, %{url: url}} = PluginRunner.run("map", %{"query" => "北京"}, test_tenant())
    assert url =~ "openstreetmap"
  end

  test "push 缺 userId 报错" do
    assert {:error, _} = PluginRunner.run("push", %{"title" => "hi"}, test_tenant())
  end

  test "push 落库" do
    user = user_fixture()

    assert {:ok, %{message: _}} =
             PluginRunner.run("push", %{"title" => "开课提醒", "userId" => user.id}, test_tenant())
  end

  test "email 缺发件人报错" do
    assert {:error, _} = PluginRunner.run("email", %{"subject" => "hi"}, test_tenant())
  end

  test "course_search 返回课程列表" do
    assert {:ok, %{courses: courses}} = PluginRunner.run("course_search", %{"query" => ""}, test_tenant())
    assert is_list(courses)
  end

  test "knowledge_rates 缺 courseId 报错" do
    assert {:error, _} = PluginRunner.run("knowledge_rates", %{}, test_tenant())
  end

  test "web_parse 缺 url 报错" do
    assert {:error, _} = PluginRunner.run("web_parse", %{}, test_tenant())
  end
end

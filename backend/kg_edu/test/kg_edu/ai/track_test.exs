defmodule KgEdu.AI.TrackTest do
  @moduledoc """
  需求 12：学术追踪 — 关注 CRUD（离线）；OpenAlex 真调用标 :external。
  """
  use KgEdu.DataCase, async: true

  import KgEdu.AccountsFixtures

  alias KgEdu.AI.{ResearchFollow, ScholarService}

  test "关注增删改查" do
    user = user_fixture()

    assert {:ok, f} =
             ResearchFollow.follow_research(
               %{user_id: user.id, kind: :scholar, ref_id: "A123", label: "张三"},
               tenant: test_tenant()
             )

    assert {:ok, [_ | _]} =
             ResearchFollow.list_follows_by_user(%{user_id: user.id}, tenant: test_tenant())
  end

  @tag :external
  test "OpenAlex 兴趣检索（外部）" do
    assert {:ok, %{works: [_ | _], topics: _}} = ScholarService.search_works("graph neural networks", limit: 3)
  end
end

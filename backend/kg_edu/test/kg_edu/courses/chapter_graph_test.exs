defmodule KgEdu.Courses.ChapterGraphTest do
  @moduledoc """
  P2: 章节转图谱 — 章节不存在时直接返回错误（不调 LLM，可离线测）。
  """
  use KgEdu.DataCase, async: true

  import KgEdu.AccountsFixtures

  test "章节不存在返回错误" do
    assert {:error, _} =
             KgEdu.Courses.ChapterGraph.generate(Ash.UUID.generate(), test_tenant())
  end
end

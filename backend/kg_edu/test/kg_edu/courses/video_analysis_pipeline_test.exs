defmodule KgEdu.Courses.VideoAnalysisPipelineTest do
  @moduledoc """
  P2: 视频解析纯函数 — 分段、词云、知识点匹配（不触网、不读库）。
  """
  use ExUnit.Case, async: true

  alias KgEdu.Courses.VideoAnalysisPipeline

  defp s(begin_ms, end_ms, text), do: %{begin_ms: begin_ms, end_ms: end_ms, text: text}

  describe "group_sentences/2" do
    test "同窗口合并、跨窗口切分" do
      sentences = [
        s(0, 10_000, "第一句"),
        s(20_000, 30_000, "第二句"),
        s(200_000, 210_000, "第三句")
      ]

      assert [
               %{start_sec: 0, end_sec: 30, text: "第一句第二句"},
               %{start_sec: 200, end_sec: 210, text: "第三句"}
             ] = VideoAnalysisPipeline.group_sentences(sentences, 120)
    end

    test "空输入返回空" do
      assert [] = VideoAnalysisPipeline.group_sentences([])
    end
  end

  describe "top_terms/2" do
    test "中文高频词排前" do
      text = "牛顿定律很重要，牛顿定律是基础，牛顿定律要掌握，苹果落地"
      top = VideoAnalysisPipeline.top_terms(text, 5)

      hit = Enum.find(top, &(&1.word == "牛顿" or &1.word == "定律"))
      assert hit && hit.weight >= 3
    end

    test "停用词被过滤" do
      words = VideoAnalysisPipeline.top_terms("这个 那个 就是 牛顿定律", 10) |> Enum.map(& &1.word)
      refute "这个" in words
    end
  end

  describe "match_resources/2" do
    test "按名命中并取最早分段" do
      segments = [
        %{start_sec: 0, end_sec: 60, text: "今天讲牛顿定律"},
        %{start_sec: 120, end_sec: 180, text: "再讲牛顿定律和动量"}
      ]

      resources = [
        %{id: "r1", name: "牛顿定律"},
        %{id: "r2", name: "动量"},
        %{id: "r3", name: "不存在的词"}
      ]

      matched = VideoAnalysisPipeline.match_resources(segments, resources)
      by_id = Map.new(matched, fn {r, sec} -> {r.id, sec} end)

      assert by_id["r1"] == 0
      assert by_id["r2"] == 120
      refute Map.has_key?(by_id, "r3")
    end
  end
end

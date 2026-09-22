defmodule KgEdu.Agent.TtsServiceTest do
  @moduledoc """
  P0: TtsService 纯逻辑测试（不触网、不读库，只覆盖参数校验与音色表）。
  """
  use ExUnit.Case, async: true

  alias KgEdu.Agent.TtsService

  describe "voices/0" do
    test "返回 curated 音色表" do
      voices = TtsService.voices()

      assert length(voices) == 5
      assert Enum.all?(voices, &Map.has_key?(&1, :voice))
      assert Enum.all?(voices, &Map.has_key?(&1, :label))
      assert Enum.all?(voices, &Map.has_key?(&1, :gender))
      assert Enum.all?(voices, &Map.has_key?(&1, :language))

      names = Enum.map(voices, & &1.voice)
      assert "longxiaochun" in names
      assert "longanyang" in names
      # 至少一个多语言音色（演示项要求英/日/西语）
      assert Enum.any?(voices, &String.contains?(&1.language, "ja"))
    end
  end

  describe "synthesize/1 参数校验" do
    test "文本为空返回错误（不触网）" do
      assert {:error, "合成文本不能为空"} = TtsService.synthesize(text: "")
      assert {:error, "合成文本不能为空"} = TtsService.synthesize(text: nil)
      assert {:error, "合成文本不能为空"} = TtsService.synthesize(%{})
    end

    test "文本超长返回错误" do
      long = String.duplicate("啊", 2001)
      assert {:error, reason} = TtsService.synthesize(text: long)
      assert reason =~ "过长"
    end
  end
end

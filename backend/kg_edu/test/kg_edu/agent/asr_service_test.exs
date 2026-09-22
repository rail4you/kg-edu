defmodule KgEdu.Agent.AsrServiceTest do
  @moduledoc """
  P2: ASR 转写归一化（纯函数，不触网）。
  """
  use ExUnit.Case, async: true

  alias KgEdu.Agent.AsrService

  test "normalize timestamped sentences" do
    payload = %{
      "transcripts" => [
        %{
          "sentences" => [
            %{"begin_time" => 0, "end_time" => 1500, "text" => "你好"},
            %{"begin_time" => 1500, "end_time" => 3000, "text" => ""}
          ]
        }
      ]
    }

    assert [%{begin_ms: 0, end_ms: 1500, text: "你好"}] =
             AsrService.normalize_sentences(payload)
  end

  test "normalize plain text transcript" do
    assert [%{begin_ms: 0, end_ms: 0, text: "全文"}] =
             AsrService.normalize_sentences(%{"transcripts" => [%{"text" => "全文"}]})
  end

  test "normalize garbage returns empty" do
    assert [] = AsrService.normalize_sentences(%{"foo" => 1})
    assert [] = AsrService.normalize_sentences(%{})
  end

  test "transcribe without key returns key error (no network)" do
    # DB 无 Key 时直接返回 Key 错误；有 Key 时才会触网（测试库无 Key）
    case KgEdu.Agent.ApiKeyProvider.get_key(:qwen) do
      nil ->
        assert {:error, reason} = AsrService.transcribe_url("https://example.com/a.mp4")
        assert reason =~ "Qwen API Key"

      _ ->
        :ok
    end
  end
end

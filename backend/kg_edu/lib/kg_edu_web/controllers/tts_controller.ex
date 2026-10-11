defmodule KgEduWeb.TtsController do
  use KgEduWeb, :controller
  require Logger

  plug KgEduWeb.Plugs.RequireEditable when action in [:synthesize]

  @doc """
  GET /api/tts/voices — 音色列表（前端下拉）。
  """
  def voices(conn, _params) do
    json(conn, %{success: true, data: KgEdu.Agent.TtsService.voices()})
  end

  @doc """
  POST /api/tts/translate — 翻译文本（使用 DashScope qwen-mt-plus）。

  body: { text, target, source? }
  返回: { success: true, data: { translated, source, target } }
  """
  def translate(conn, params) do
    input = params["input"] || params

    case KgEdu.Agent.TtsService.translate(
           text: input["text"],
           target: input["target"],
           source: input["source"]
         ) do
      {:ok, %{translated: translated, source: source, target: target}} ->
        json(conn, %{success: true, data: %{translated: translated, source: source, target: target}})

      {:error, reason} ->
        json(conn, %{success: false, error: reason})
    end
  end

  @doc """
  POST /api/tts/synthesize — 文字转语音。

  body: { text, voice?, model?, speech_rate?, volume?, language?, instruction?, courseId? }
  返回: { success, url, file_id, size }
  """
  def synthesize(conn, params) do
    input = params["input"] || params
    tenant = extract_tenant(conn, params)

    if is_nil(tenant) do
      json(conn, %{success: false, error: "未设置租户上下文"})
    else
      opts = [
        text: input["text"],
        voice: input["voice"],
        model: input["model"],
        speech_rate: input["speech_rate"],
        volume: input["volume"],
        language: input["language"],
        instruction: input["instruction"],
        tenant: tenant,
        user_id: input["userId"],
        course_id: input["courseId"]
      ]

      case KgEdu.Agent.TtsService.synthesize(opts) do
        {:ok, %{url: url, file_id: file_id, size: size}} ->
          json(conn, %{success: true, url: url, file_id: file_id, size: size})

        {:error, reason} ->
          json(conn, %{success: false, error: reason})
      end
    end
  end

  # 与 GenerationController 一致的租户提取（orgSchema）
  defp extract_tenant(conn, params) do
    params["orgSchema"] ||
      params["tenant"] ||
      (params["forwardedProps"] || %{})["orgSchema"] ||
      get_req_header(conn, "x-org-schema") |> List.first() ||
      conn.assigns[:org_schema]
  end
end

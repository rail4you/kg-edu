defmodule KgEdu.Agent.FormAiService do
  @moduledoc """
  P3: 审批 AI 能力 — AI 填表（自然语言/图片 → 表单字段回填）与 AI 公式
  （按字段含义生成/解释表达式）。

  直调 DashScope OpenAI 兼容接口（文本 qwen-plus / 图片 qwen-vl-max），
  纯 HTTP，可控可测。
  """

  require Logger

  @chat_endpoint "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"

  @doc """
  按 schema 从自然语言描述中抽取值。返回 `{:ok, values}`（key → string）。
  """
  def fill_from_text(schema, text) when is_list(schema) and is_binary(text) do
    fields = Enum.map_join(schema, "\n", &"- #{&1["key"] || &1[:key]}（#{&1["label"] || &1[:label]}，类型#{&1["type"] || &1[:type]}）")

    call_llm(
      "qwen-plus",
      "你是表单填表助手。根据用户描述提取信息，只输出 JSON 对象（key 为字段英文名，value 为字符串），不要输出其他内容。\n字段：\n#{fields}",
      [%{"type" => "text", "text" => text}],
      schema
    )
  end

  @doc """
  从图片（公网 URL）中识别信息回填。返回 `{:ok, values}`。
  """
  def fill_from_image(schema, image_url) when is_list(schema) and is_binary(image_url) do
    fields = Enum.map_join(schema, "\n", &"- #{&1["key"] || &1[:key]}（#{&1["label"] || &1[:label]}）")

    call_llm(
      "qwen-vl-max",
      "你是表单填表助手。识别图片中的有效信息，只输出 JSON 对象（key 为字段英文名，value 为字符串），不要输出其他内容。\n字段：\n#{fields}",
      [%{"type" => "image_url", "image_url" => %{"url" => image_url}}],
      schema
    )
  end

  @doc """
  AI 公式：按字段含义与目标生成表达式并解释。返回 `{:ok, %{expression, explanation}}`。
  """
  def suggest_formula(fields, goal) when is_list(fields) and is_binary(goal) do
    desc = Enum.map_join(fields, "\n", &"- #{&1["key"] || &1[:key]}（#{&1["label"] || &1[:label]}，类型#{&1["type"] || &1[:type]}）")

    with {:ok, api_key} <- fetch_key(),
         body = %{
           "model" => "qwen-plus",
           "messages" => [
             %{
               "role" => "system",
               "content" =>
                 "你是表单公式助手。根据字段与计算目标，给出 expression（仅含字段英文名、数字、+ - * / ( ) 与 SUM/AVG 函数）与 explanation（中文解释），只输出 JSON：{\"expression\": \"...\", \"explanation\": \"...\"}。\n字段：\n#{desc}"
             },
             %{"role" => "user", "content" => goal}
           ]
         },
         {:ok, %{status: 200, body: %{"choices" => [%{"message" => %{"content" => content}} | _]}}} <-
           Req.post(@chat_endpoint, json: body, headers: auth(api_key)) do
      case Jason.decode(extract_json(content)) do
        {:ok, %{"expression" => expr} = map} ->
          {:ok, %{expression: expr, explanation: map["explanation"] || ""}}

        _ ->
          {:error, "AI 公式解析失败: #{String.slice(content, 0, 200)}"}
      end
    else
      {:ok, %{status: status, body: resp}} -> {:error, "AI 公式失败 (#{status}): #{truncate(resp)}"}
      {:error, error} -> {:error, "AI 公式异常: #{inspect(error)}"}
      {:error, _} = e -> e
    end
  end

  # ── Private ────────────────────────────────────────────────────────────

  defp call_llm(model, system, content_parts, schema) do
    with {:ok, api_key} <- fetch_key(),
         body = %{
           "model" => model,
           "messages" => [
             %{"role" => "system", "content" => system},
             %{"role" => "user", "content" => content_parts}
           ]
         },
         {:ok, %{status: 200, body: %{"choices" => [%{"message" => %{"content" => content}} | _]}}} <-
           Req.post(@chat_endpoint, json: body, headers: auth(api_key)) do
      case Jason.decode(extract_json(content)) do
        {:ok, values} when is_map(values) -> {:ok, keep_known_keys(values, schema)}
        _ -> {:error, "AI 填表解析失败: #{String.slice(content, 0, 200)}"}
      end
    else
      {:ok, %{status: status, body: resp}} -> {:error, "AI 填表失败 (#{status}): #{truncate(resp)}"}
      {:error, error} -> {:error, "AI 填表异常: #{inspect(error)}"}
      {:error, _} = e -> e
    end
  end

  defp keep_known_keys(values, schema) do
    keys = MapSet.new(Enum.map(schema, &to_string(&1["key"] || &1[:key])))

    values
    |> Enum.filter(fn {k, _} -> MapSet.member?(keys, to_string(k)) end)
    |> Map.new(fn {k, v} -> {to_string(k), to_string(v || "")} end)
  end

  @doc false
  def extract_json(text) do
    case Regex.run(~r/```(?:json)?\s*\n?(.*?)\n?```/s, text, capture: :all_but_first) do
      [inner] -> String.trim(inner)
      nil -> String.trim(text)
    end
  end

  defp fetch_key do
    case KgEdu.Agent.ApiKeyProvider.get_key(:qwen) do
      key when is_binary(key) and key != "" -> {:ok, key}
      _ -> {:error, "未配置 Qwen API Key（请在后台 api_key_configs 中配置 provider=qwen）"}
    end
  end

  defp auth(api_key),
    do: %{"authorization" => "Bearer #{api_key}", "content-type" => "application/json"}

  defp truncate(resp) when is_binary(resp), do: String.slice(resp, 0, 200)
  defp truncate(resp), do: resp |> inspect() |> String.slice(0, 200)
end

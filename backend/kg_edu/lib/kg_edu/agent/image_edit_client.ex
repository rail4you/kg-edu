defmodule KgEdu.Agent.ImageEditClient do
  @moduledoc """
  Qwen-Image-Edit 图像编辑客户端（DashScope）。

  用于 AI 精确抠图 + 背景合成：
    - ai_cutout/2：将图片中的人物精准抠出，放到指定背景（纯色/文字/图片）上
    - 输出为合成的场景图（PNG）

  API: POST /api/v1/services/aigc/multimodal-generation/generation
  参考: https://help.aliyun.com/zh/model-studio/qwen-image-edit-api
  """

  require Logger

  @base "https://dashscope.aliyuncs.com"
  @endpoint "/api/v1/services/aigc/multimodal-generation/generation"
  @default_model "qwen-image-2.0-pro"

  @doc """
  AI 抠图 + 背景合成。

  opts:
    - image_url:   人物原图 URL（必选）
    - bg_color:    背景色，默认 "#1e3a5f"（深蓝）
    - text:        背景文字（可选，渲染在顶部）
    - size:        输出尺寸 "宽*高"，默认 "768*1024"
    - prompt:      自定义提示词（覆盖默认）

  返回 `{:ok, image_url}`（DashScope 临时 URL，24h 有效）。
  """
  def ai_cutout(image_url, opts \\ []) do
    with {:ok, api_key} <- api_key() do
      bg_color = Keyword.get(opts, :bg_color, "#1e3a5f")
      text = Keyword.get(opts, :text)
      size = Keyword.get(opts, :size, "768*1024")

      prompt =
        Keyword.get_lazy(opts, :prompt, fn ->
          build_prompt(bg_color, text)
        end)

      body = %{
        "model" => Keyword.get(opts, :model, @default_model),
        "input" => %{
          "messages" => [
            %{
              "role" => "user",
              "content" => [
                %{"image" => image_url},
                %{"text" => prompt}
              ]
            }
          ]
        },
        "parameters" => %{
          "n" => 1,
          "negative_prompt" => "模糊, 变形, 多人, 低质量, 背景残留, 白边",
          "prompt_extend" => false,
          "watermark" => false,
          "size" => size
        }
      }

      case do_request(api_key, body, 0) do
        {:ok, url} -> {:ok, url}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  # 带 429 限流重试的请求
  defp do_request(api_key, body, attempt) when attempt < 4 do
    case Req.post(@base <> @endpoint,
           headers: %{"authorization" => "Bearer #{api_key}"},
           json: body,
           connect_options: [timeout: 15_000],
           receive_timeout: 180_000
         ) do
      {:ok, %Req.Response{status: 429} = resp} ->
        Logger.warning("[ImageEdit] rate limited (429), retry #{attempt + 1}")
        Process.sleep(5_000 * (attempt + 1))
        do_request(api_key, body, attempt + 1)

      other ->
        parse_response(other)
    end
  end

  defp do_request(_api_key, _body, _attempt) do
    {:error, "AI 抠图请求限流重试次数过多，请稍后再试"}
  end

  defp parse_response({:ok, %Req.Response{status: 200, body: body}}) when is_map(body) do
    case get_in(body, ["output", "choices"]) do
      [%{"message" => %{"content" => [%{"image" => url}]}}] when is_binary(url) ->
        {:ok, url}

      _ ->
        cond do
          is_binary(body["message"]) -> {:error, "AI 抠图失败: #{body["message"]}"}
          is_binary(body["code"]) -> {:error, "AI 抠图失败 (#{body["code"]}): #{body["message"]}"}
          true -> {:error, "AI 抠图失败: #{inspect(body)}"}
        end
    end
  end

  defp parse_response({:ok, %Req.Response{status: s, body: b}}) do
    {:error, "AI 抠图请求失败 (#{s}): #{inspect(b)}"}
  end

  defp parse_response({:error, reason}) do
    {:error, "AI 抠图请求异常: #{inspect(reason)}"}
  end

  @doc """
  AI 抠图 + 背景合成，并持久化到 OSS，返回可长期使用的 URL。
  """
  def ai_cutout_and_store(image_url, opts \\ []) do
    with {:ok, url} <- ai_cutout(image_url, opts) do
      download_and_store(url)
    end
  end

  # ── Prompt 构建 ─────────────────────────────────────────────────────

  defp build_prompt(bg_color, text) do
    bg_desc = describe_color(bg_color)

    base =
      "将图片中的人物精准抠出，完整保留人物形象、姿态和面部细节，人物边缘干净无残留。" <>
        "把人物放到#{bg_desc}纯色背景上，人物居中，画面主体为人物半身像。"

    if text && String.trim(text) != "" do
      base <> "画面顶部显示白色大字「#{text}」，文字清晰，不遮挡人物面部。"
    else
      base
    end
  end

  defp describe_color("#1e3a5f"), do: "深蓝色（#1e3a5f）"
  defp describe_color("#2f4f4f"), do: "墨绿色（#2f4f4f）"
  defp describe_color("#4a235a"), do: "暗紫色（#4a235a）"
  defp describe_color("#5b2c2c"), do: "暗红色（#5b2c2c）"
  defp describe_color("#3a3a3a"), do: "深灰色（#3a3a3a）"
  defp describe_color("#0e4d45"), do: "青绿色（#0e4d45）"
  defp describe_color("green"), do: "绿色"
  defp describe_color("blue"), do: "蓝色"
  defp describe_color("white"), do: "白色"
  defp describe_color("black"), do: "黑色"
  defp describe_color("red"), do: "红色"
  defp describe_color(other), do: "颜色 #{other}"

  # ── 下载到 OSS ──────────────────────────────────────────────────────

  defp download_and_store(url) do
    tmp_path = Path.join(System.tmp_dir!(), "ai_cutout_#{System.unique_integer([:positive])}.png")

    with {:ok, %Req.Response{status: 200, body: body}} <-
           Req.get(url,
             connect_options: [timeout: 10_000],
             receive_timeout: 120_000,
             follow_redirects: true
           ) do
      File.write!(tmp_path, body)

      case KgEdu.Agent.OssUpload.upload(tmp_path) do
        {:ok, stored_url} -> {:ok, stored_url}
        {:error, reason} -> {:error, "AI 抠图结果存储失败: #{reason}"}
      end
    else
      {:ok, %Req.Response{status: s}} -> {:error, "AI 抠图结果下载失败 (#{s})"}
      {:error, reason} -> {:error, "AI 抠图结果下载失败: #{inspect(reason)}"}
    end
  end

  defp api_key do
    key = KgEdu.Agent.ApiKeyProvider.get_key(:qwen) || System.get_env("DASHSCOPE_API_KEY")

    if is_binary(key) and key != "" do
      {:ok, key}
    else
      {:error, "未配置 DashScope API Key"}
    end
  end
end

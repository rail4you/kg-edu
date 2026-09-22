defmodule KgEdu.Courses.VideoAnalysisPipeline do
  @moduledoc """
  P2: 视频解析流水线 — ASR 转写 → 分段 → LLM 摘要 → 知识点匹配打点 → 词云。

  `run/2` 在 `KgEdu.TaskSupervisor` 下异步执行；纯函数部分可单测。
  """

  require Logger
  require Ash.Query

  @segment_window_sec 120
  @model "alibaba_cn:qwen-plus"

  def run(analysis_id, tenant) do
    opts = [tenant: tenant, authorize?: false]

    with {:ok, analysis} <- fetch_analysis(analysis_id, opts),
         :ok <- mark_status(analysis, :processing, opts),
         {:ok, video_url, course_id} <- resolve_video(analysis, opts),
         {:ok, sentences} <- KgEdu.Agent.AsrService.transcribe_url(video_url),
         {:ok, result} <- build_result(sentences, course_id, opts) do
      persist_done(analysis, result, opts)
    else
      {:error, reason} ->
        Logger.error("[VideoAnalysis] #{analysis_id} 失败: #{inspect(reason)}")
        set_failed(analysis_id, reason, opts)
        {:error, reason}
    end
  end

  # ── 纯函数（可单测） ───────────────────────────────────────────────

  @doc """
  按时间窗口合并 sentences → segments `[%{start_sec, end_sec, text}]`。
  sentence: `%{begin_ms, end_ms, text}`。
  """
  def group_sentences(sentences, window_sec \\ @segment_window_sec) do
    sentences
    |> Enum.chunk_while(
      nil,
      fn s, acc ->
        start_sec = div(s.begin_ms, 1000)

        case acc do
          nil ->
            {:cont, %{start_sec: start_sec, end_sec: div(s.end_ms, 1000), texts: [s.text]}}

          %{start_sec: base} = cur when start_sec - base < window_sec ->
            {:cont, %{cur | end_sec: div(s.end_ms, 1000), texts: cur.texts ++ [s.text]}}

          cur ->
            {:cont, emit(cur), %{start_sec: start_sec, end_sec: div(s.end_ms, 1000), texts: [s.text]}}
        end
      end,
      fn
        nil -> {:cont, nil}
        cur -> {:cont, emit(cur), nil}
      end
    )
    |> Enum.reject(&is_nil/1)
  end

  defp emit(%{start_sec: s, end_sec: e, texts: t}), do: %{start_sec: s, end_sec: e, text: Enum.join(t, "")}

  @doc """
  词频统计 → 词云 `[%{word, weight}]`。中英文混排：CJK 按 2-4 字滑动切词 + 拉丁单词。
  """
  def top_terms(text, limit \\ 30) do
    cjk =
      text
      |> String.replace(~r/[^\p{Han}a-zA-Z0-9]/u, " ")
      |> String.split()
      |> Enum.flat_map(&tokens/1)

    cjk
    |> Enum.reject(&(String.length(&1) < 2 or &1 in stopwords()))
    |> Enum.frequencies()
    |> Enum.sort_by(&elem(&1, 1), :desc)
    |> Enum.take(limit)
    |> Enum.map(fn {word, count} -> %{word: word, weight: count} end)
  end

  defp tokens(word) do
    if String.match?(word, ~r/^\p{Han}+$/u) and String.length(word) > 4 do
      word
      |> String.graphemes()
      |> Enum.chunk_every(2, 1, :discard)
      |> Enum.map(&Enum.join/1)
    else
      [word]
    end
  end

  defp stopwords do
    ~w(这个 那个 就是 可以 进行 一种 一个 我们 你们 他们 什么 怎么 为什么 如何 所以 但是 然后 因此 如果 虽然 的了 在是 我你他 她它 们这那 哪里 哪里 就是 更加 非常 比较 有的 有些 以及 及其 可以 能够 应该 需要 通过 作为 包括 比如 例如 the and for with are was were has have had will would can not but our your their this that these those from into over under)
    |> MapSet.new()
  end

  @doc """
  转写文本中命中课程知识点名 → `[{resource, first_sec}]`（取最早出现分段起点）。
  """
  def match_resources(segments, resources) do
    names =
      resources
      |> Enum.map(& &1.name)
      |> Enum.reject(&(is_nil(&1) or &1 == ""))
      |> Enum.sort_by(&String.length/1, :desc)

    Enum.flat_map(names, fn name ->
      case Enum.find(segments, &String.contains?(&1.text, name)) do
        nil -> []
        seg -> [{Enum.find(resources, &(&1.name == name)), seg.start_sec}]
      end
    end)
    |> Enum.reject(fn {r, _} -> is_nil(r) end)
    |> Enum.uniq_by(fn {r, _} -> r.id end)
  end

  # ── 流水线内部 ───────────────────────────────────────────────────

  defp fetch_analysis(id, opts) do
    case KgEdu.Courses.VideoAnalysis.get_video_analysis(id, opts) do
      {:ok, nil} -> {:error, "解析任务不存在"}
      {:ok, analysis} -> {:ok, analysis}
      {:error, reason} -> {:error, reason}
    end
  end

  defp mark_status(analysis, status, opts) do
    case update_analysis(analysis, %{status: status}, opts) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp resolve_video(%{video_type: "course_video", video_id: vid, course_id: cid}, opts) do
    case KgEdu.Courses.CourseVideo.get_course_video(vid, opts) do
      {:ok, nil} -> {:error, "课程视频不存在"}
      {:ok, %{video_url: url}} when is_binary(url) and url != "" -> {:ok, url, cid}
      {:ok, _} -> {:error, "课程视频无可转写 URL"}
      {:error, reason} -> {:error, reason}
    end
  end

  defp resolve_video(%{video_type: other}, _opts),
    do: {:error, "暂仅支持课程视频解析（video_type=#{other}）"}

  defp build_result(sentences, course_id, opts) do
    segments = group_sentences(sentences)
    full_text = Enum.map_join(segments, "\n", & &1.text)

    summary = llm_summary(full_text)

    seg_summaries =
      Enum.map(segments, fn seg ->
        %{start_sec: seg.start_sec, end_sec: seg.end_sec, title: seg_title(seg), summary: llm_segment(seg.text)}
      end)

    resources = list_course_resources(course_id, opts)
    matched = match_resources(segments, resources)
    wordcloud = build_wordcloud(full_text, matched)

    {:ok,
     %{
       summary: summary,
       segments: seg_summaries,
       transcript: String.slice(full_text, 0, 20_000),
       wordcloud: wordcloud,
       matched: matched
     }}
  end

  defp persist_done(analysis, result, opts) do
    with {:ok, _} <-
           update_analysis(
             analysis,
             %{
               status: :done,
               summary: result.summary,
               segments: result.segments,
               transcript: result.transcript,
               wordcloud: result.wordcloud
             },
             opts
           ),
         :ok <- create_marks(analysis, result.matched, opts) do
      {:ok, :done}
    end
  end

  defp create_marks(analysis, matched, opts) do
    Enum.each(matched, fn {resource, sec} ->
      KgEdu.Courses.VideoKnowledgeMark.create_mark(
        %{
          video_type: analysis.video_type,
          video_id: analysis.video_id,
          knowledge_resource_id: resource.id,
          point_sec: sec,
          label: resource.name
        },
        opts
      )
    end)

    :ok
  end

  defp set_failed(analysis_id, reason, opts) do
    case fetch_analysis(analysis_id, opts) do
      {:ok, analysis} ->
        update_analysis(analysis, %{status: :failed, error_message: inspect(reason) |> String.slice(0, 500)}, opts)

      _ ->
        {:error, reason}
    end
  end

  defp update_analysis(analysis, attrs, opts) do
    analysis
    |> Ash.Changeset.for_update(:update, attrs)
    |> Ash.update(opts)
  end

  defp list_course_resources(nil, _opts), do: []

  defp list_course_resources(course_id, opts) do
    case KgEdu.Knowledge.Resource.get_knowledge_resources_by_course(%{course_id: course_id}, opts) do
      {:ok, resources} -> resources
      _ -> []
    end
  end

  defp seg_title(%{text: text}) do
    text |> String.trim() |> String.slice(0, 24)
  end

  defp build_wordcloud(full_text, matched) do
    from_matched = Enum.map(matched, fn {r, _} -> %{word: r.name, weight: 10} end)
    from_terms = top_terms(full_text, 30)
    (from_matched ++ from_terms) |> Enum.uniq_by(& &1.word) |> Enum.take(40)
  end

  defp llm_summary(text) do
    case llm_text("你是课程视频分析助手。用 3-5 句话概括视频核心内容，只输出摘要正文。", String.slice(text, 0, 8000)) do
      {:ok, summary} -> summary
      {:error, _} -> text |> String.trim() |> String.slice(0, 300)
    end
  end

  defp llm_segment(text) do
    case llm_text("你是课程视频分析助手。用 1-2 句话总结以下片段，只输出总结正文。", String.slice(text, 0, 2000)) do
      {:ok, summary} -> summary
      {:error, _} -> text |> String.trim() |> String.slice(0, 120)
    end
  end

  defp llm_text(system, user) do
    KgEdu.Agent.ApiKeyProvider.ensure_key(:qwen)

    case ReqLLM.Generation.generate_text(@model, [%{role: "system", content: system}, %{role: "user", content: user}],
           max_tokens: 1024,
           temperature: 0.3,
           receive_timeout: 120_000
         ) do
      {:ok, response} -> {:ok, response |> ReqLLM.Response.text() |> String.trim()}
      {:error, error} -> {:error, error}
    end
  end
end

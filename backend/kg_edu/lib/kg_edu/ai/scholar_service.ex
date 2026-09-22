defmodule KgEdu.AI.ScholarService do
  @moduledoc """
  需求 12：学术追踪数据源 — OpenAlex（免 Key）：
  研究兴趣（论文检索→推荐方向）、学者（画像→分身语料）、期刊（venue 近期论文→digest）。
  """

  require Logger

  @base "https://api.openalex.org"
  @headers %{"User-Agent" => "KgEdu-ResearchTrack/1.0 (mailto:demo@ketangxing.com)", "Accept" => "application/json"}

  @doc "兴趣检索：论文列表 + 推荐方向（高频主题）。"
  def search_works(query, opts \\ []) do
    params = [search: query, "per-page": Keyword.get(opts, :limit, 10), select: work_fields(), sort: "cited_by_count:desc"]

    case get("/works", params) do
      {:ok, %{"results" => results}} ->
        works = Enum.map(results, &normalize_work/1)
        {:ok, %{works: works, topics: suggest_topics(works)}}

      {:error, _} = e ->
        e
    end
  end

  @doc "学者检索。"
  def search_authors(name, opts \\ []) do
    params = [search: name, "per-page": Keyword.get(opts, :limit, 5), select: "id,display_name,works_count,cited_by_count,topics,last_known_institutions"]

    case get("/authors", params) do
      {:ok, %{"results" => results}} ->
        {:ok, %{authors: Enum.map(results, &normalize_author/1)}}

      {:error, _} = e ->
        e
    end
  end

  @doc "学者画像：基本信息 + 代表作（供分身对话组装 persona）。"
  def author_profile(openalex_id) do
    with {:ok, author} <- get("/authors/#{short_id(openalex_id)}", select: "id,display_name,works_count,cited_by_count,topics,summary_stats"),
         {:ok, %{"results" => works}} <-
           get("/works",
             filter: "author.id:#{short_id(openalex_id)}",
             sort: "cited_by_count:desc",
             "per-page": 8,
             select: work_fields()
           ) do
      topics =
        (author["topics"] || [])
        |> Enum.take(5)
        |> Enum.map(& &1["display_name"])

      top_works = works |> Enum.map(&normalize_work/1) |> Enum.take(5)

      {:ok,
       %{
         id: author["id"],
         name: author["display_name"],
         works_count: author["works_count"],
         cited_by_count: author["cited_by_count"],
         topics: topics,
         top_works: top_works,
         persona: build_persona(author["display_name"], topics, top_works)
       }}
    else
      {:error, _} = e -> e
    end
  end

  @doc "期刊 digest：venue 检索 + 近期论文 → 要点/观点对比/趋势（LLM，无 Key 降级抽取式）。"
  def venue_digest(query, tenant, opts \\ []) do
    limit = Keyword.get(opts, :limit, 8)

    with {:ok, %{"results" => [venue | _]}} <-
           get("/sources", search: query, "per-page": 3, select: "id,display_name,works_count,cited_by_count"),
         source_id = short_id(venue["id"]),
         {:ok, %{"results" => works}} <-
           get("/works",
             filter: "primary_location.source.id:#{source_id}",
             sort: "publication_date:desc",
             "per-page": limit,
             select: work_fields()
           ) do
      papers = Enum.map(works, &normalize_work/1)

      {:ok,
       %{
         venue: %{id: venue["id"], name: venue["display_name"], works_count: venue["works_count"]},
         papers: papers,
         digest: digest_papers(venue["display_name"], papers)
       }}
    else
      {:ok, %{"results" => []}} -> {:error, "未找到期刊：#{query}"}
      {:error, _} = e -> e
    end
  end

  # ── Private ────────────────────────────────────────────────────────────

  defp get(path, params) do
    case Req.get(@base <> path, params: params, headers: @headers, receive_timeout: 30_000) do
      {:ok, %{status: 200, body: body}} when is_map(body) -> {:ok, body}
      {:ok, %{status: status}} -> {:error, "OpenAlex 查询失败 HTTP #{status}"}
      {:error, error} -> {:error, "OpenAlex 请求异常: #{inspect(error) |> String.slice(0, 150)}"}
    end
  end

  defp work_fields,
    do: "id,title,publication_year,authorships,cited_by_count,primary_location,abstract_inverted_index"

  defp normalize_work(w) do
    authors =
      (w["authorships"] || [])
      |> Enum.take(4)
      |> Enum.map(& &1["author"]["display_name"])

    %{
      id: w["id"],
      title: w["title"],
      year: w["publication_year"],
      authors: authors,
      cited_by_count: w["cited_by_count"] || 0,
      venue: get_in(w, ["primary_location", "source", "display_name"]),
      abstract: rebuild_abstract(w["abstract_inverted_index"])
    }
  end

  defp normalize_author(a) do
    %{
      id: a["id"],
      name: a["display_name"],
      works_count: a["works_count"],
      cited_by_count: a["cited_by_count"],
      topics: (a["topics"] || []) |> Enum.take(3) |> Enum.map(& &1["display_name"]),
      affiliation: get_in(a, ["last_known_institutions", Access.at(0), "display_name"])
    }
  end

  defp rebuild_abstract(nil), do: nil

  defp rebuild_abstract(index) when is_map(index) do
    positions =
      Enum.flat_map(index, fn {word, pos_list} -> Enum.map(pos_list, &{&1, word}) end)
      |> Enum.sort_by(&elem(&1, 0))
      |> Enum.map(&elem(&1, 1))

    positions |> Enum.join(" ") |> String.slice(0, 800)
  end

  defp suggest_topics(works) do
    works
    |> Enum.flat_map(fn w ->
      (w[:title] || "")
      |> String.split(~r/[^a-zA-Z]+/)
      |> Enum.map(&String.downcase/1)
    end)
    |> Enum.reject(&(String.length(&1) < 5 or &1 in ~w(using based novel study analysis learning network model models data deep neural large language with from for and the)))
    |> Enum.frequencies()
    |> Enum.sort_by(&elem(&1, 1), :desc)
    |> Enum.take(6)
    |> Enum.map(&elem(&1, 0))
  end

  defp build_persona(name, topics, top_works) do
    works_text =
      top_works
      |> Enum.map_join("\n", fn w -> "- 《#{w.title}》(#{w.year}，被引#{w.cited_by_count})" end)

    """
    你是学者“#{name}”的学术数字分身。用第一人称、学者口吻回答。
    研究方向：#{Enum.join(topics, "、")}。
    代表作：
    #{works_text}
    回答时紧密围绕上述方向与观点，不确定的内容明确说明超出你的研究范围。
    """
  end

  defp digest_papers(venue_name, papers) do
    brief =
      papers
      |> Enum.map_join("\n", fn p -> "- 《#{p.title}》(#{p.year})：#{p.abstract || "（无摘要）"}" end)
      |> String.slice(0, 6000)

    KgEdu.Agent.ApiKeyProvider.ensure_key(:qwen)

    case ReqLLM.Generation.generate_text(
           "alibaba_cn:qwen-plus",
           [
             %{role: "system", content: "你是学术追踪助手。只输出 JSON：{\"points\": [\"要点1\", ...], \"comparison\": \"观点对比…\", \"trends\": \"技术趋势…\"}。"},
             %{role: "user", content: "期刊《#{venue_name}》近期论文：\n#{brief}"}
           ],
           max_tokens: 2048,
           temperature: 0.3,
           receive_timeout: 120_000
         ) do
      {:ok, resp} ->
        content = resp |> ReqLLM.Response.text() |> String.trim()

        case content |> extract_json() |> Jason.decode() do
          {:ok, %{"points" => _} = digest} ->
            Map.merge(%{"points" => [], "comparison" => "", "trends" => ""}, digest)

          _ ->
            extractive_digest(papers)
        end

      {:error, _} ->
        extractive_digest(papers)
    end
  end

  defp extractive_digest(papers) do
    %{
      "points" => Enum.map(papers, & &1.title),
      "comparison" => "（LLM 不可用，展示标题列表供人工对比）",
      "trends" => "（LLM 不可用）"
    }
  end

  defp extract_json(text) do
    case Regex.run(~r/```(?:json)?\s*\n?(.*?)\n?```/s, text, capture: :all_but_first) do
      [inner] -> String.trim(inner)
      nil -> String.trim(text)
    end
  end

  defp short_id("https://openalex.org/" <> id), do: id
  defp short_id(id), do: id
end

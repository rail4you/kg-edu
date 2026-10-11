defmodule KgEdu.AI.ScholarService do
  @moduledoc """
  需求 12：学术追踪数据源（中文 mock 模式）。

  当前实现：返回手工构造的中文论文/学者/期刊数据，
  不再调用 OpenAlex。便于在公网受限或展示场景下提供完整的中文内容。
  切换回 OpenAlex 实时数据：把下面 `@mock_mode` 设为 `false`。
  """

  require Logger

  @mock_mode true
  @mock_skip_qwen true  # true：中文 mock 模式跳过 Qwen LLM 调用（避免额外成本/不确定性）

  @mock_works [
    # ── 知识图谱（5 篇） ──
    %{
      title: "面向教育领域的大规模知识图谱构建方法研究",
      authors: ["王伟", "李明", "张华"],
      year: 2024,
      venue: "计算机学报",
      cited_by_count: 128,
      abstract:
        "针对教育领域多源异构数据，本文提出一种融合知识抽取、本体对齐与质量评估的大规模知识图谱构建方法。在三千万实体规模上验证，结果显示所提方法在准确率与覆盖率上均优于基线。",
      keywords: ["知识图谱", "知识抽取", "本体对齐"]
    },
    %{
      title: "基于知识图谱的智能问答系统在教学场景的应用",
      authors: ["刘洋", "陈静"],
      year: 2024,
      venue: "软件学报",
      cited_by_count: 86,
      abstract:
        "本文设计并实现了一个面向中小学教学的智能问答系统，结合知识图谱与检索增强生成（RAG）技术，实现对学科知识点的精准回答与可解释推理。",
      keywords: ["知识图谱", "智能问答", "教育技术"]
    },
    %{
      title: "教育知识图谱的可信构建与演化方法",
      authors: ["周强", "王伟"],
      year: 2024,
      venue: "中国科学：信息科学",
      cited_by_count: 38,
      abstract:
        "提出基于事实核查与冲突检测的可信教育知识图谱构建方法，并设计增量演化机制支持大规模动态更新。",
      keywords: ["知识图谱", "可信计算", "演化"]
    },
    %{
      title: "面向学科的多模态知识图谱补全算法研究",
      authors: ["张华", "赵磊"],
      year: 2023,
      venue: "自动化学报",
      cited_by_count: 54,
      abstract:
        "提出融合视觉特征的学科多模态知识图谱补全算法，在中学理化生场景中补全 F1 提升 11.2%。",
      keywords: ["知识图谱", "多模态", "图补全"]
    },
    %{
      title: "知识图谱驱动的课程知识图谱可视化与查询系统",
      authors: ["孙琪", "李娜"],
      year: 2024,
      venue: "通信学报",
      cited_by_count: 27,
      abstract:
        "面向高校课程组设计与教学评估需求，构建知识图谱驱动的课程可视化与查询系统，实现课程关联、学习路径与考试要点的交互式浏览。",
      keywords: ["知识图谱", "课程可视化", "教育"]
    },

    # ── 大语言模型（5 篇） ──
    %{
      title: "知识增强的预训练语言模型研究综述",
      authors: ["周强", "孙琪", "赵磊"],
      year: 2023,
      venue: "中国科学：信息科学",
      cited_by_count: 215,
      abstract:
        "系统综述了知识增强预训练语言模型的最新进展，涵盖知识来源、融合方式、训练策略与下游任务，并展望未来研究方向。",
      keywords: ["预训练模型", "知识增强", "自然语言处理"]
    },
    %{
      title: "大语言模型在中文作文自动评分中的应用研究",
      authors: ["李娜", "黄杰"],
      year: 2024,
      venue: "计算机学报",
      cited_by_count: 72,
      abstract:
        "探索大语言模型在中文作文多维度自动评分中的可行性，提出基于多任务提示工程的评分框架，并在十万份真实作文上验证。",
      keywords: ["大语言模型", "自动评分", "中文教育"]
    },
    %{
      title: "面向中小学的智能出题与个性化练习生成",
      authors: ["张三", "李四", "钱七"],
      year: 2024,
      venue: "软件学报",
      cited_by_count: 54,
      abstract:
        "提出融合知识点难度模型与认知诊断的自动出题方法，实现难度自适应、知识点覆盖均衡的题目批量生成，已在某省教育资源平台试运行。",
      keywords: ["大语言模型", "智能出题", "个性化学习"]
    },
    %{
      title: "多模态大语言模型在 STEM 教育中的评测与展望",
      authors: ["李明", "张华", "陈静"],
      year: 2025,
      venue: "电子学报",
      cited_by_count: 21,
      abstract:
        "构建了面向 STEM 教育的多模态大语言模型评测基准，覆盖物理、化学、生物等学科，揭示现有模型在推理链条与图示理解上的不足。",
      keywords: ["大语言模型", "多模态", "教育评测"]
    },
    %{
      title: "面向教育问答的大语言模型微调与安全对齐",
      authors: ["刘洋", "黄杰"],
      year: 2024,
      venue: "自动化学报",
      cited_by_count: 33,
      abstract:
        "提出面向 K12 学科问答的大模型安全对齐框架，过滤错误概念与不当内容，并在五大学科 5 万道题上验证。",
      keywords: ["大语言模型", "安全对齐", "教育问答"]
    },

    # ── 计算机视觉（5 篇） ──
    %{
      title: "面向智慧课堂的学生行为视觉分析方法",
      authors: ["赵磊", "孙琪"],
      year: 2024,
      venue: "自动化学报",
      cited_by_count: 63,
      abstract:
        "提出结合人体姿态估计与多目标跟踪的智慧课堂学生行为识别方法，在五类课堂行为上达到 92.4% 的 mAP，并对教师教学反馈提供量化支撑。",
      keywords: ["计算机视觉", "智慧课堂", "行为识别"]
    },
    %{
      title: "基于视觉 Transformer 的实验操作动作评分模型",
      authors: ["张华", "李娜"],
      year: 2024,
      venue: "计算机学报",
      cited_by_count: 48,
      abstract:
        "提出基于视觉 Transformer 的实验操作动作序列评分模型，对化学、生物实验操作按步骤细粒度打分，与专家一致率达到 89.7%。",
      keywords: ["计算机视觉", "Transformer", "实验评分"]
    },
    %{
      title: "课堂专注度估计：多视角头部级联估计与多任务学习",
      authors: ["赵磊", "陈静"],
      year: 2023,
      venue: "软件学报",
      cited_by_count: 41,
      abstract:
        "提出多视角头部跟踪与多任务联合训练的课堂专注度估计方法，在三个公开课堂数据集上取得 SOTA。",
      keywords: ["计算机视觉", "专注度", "多任务学习"]
    },
    %{
      title: "教学场景下的视觉问答模型与可解释性研究",
      authors: ["孙琪", "周强"],
      year: 2024,
      venue: "中国科学：信息科学",
      cited_by_count: 29,
      abstract:
        "面向中学理化场景的视觉问答任务，提出多模态可解释模型，输出答案的同时给出推理路径与图像区域热力图。",
      keywords: ["计算机视觉", "视觉问答", "可解释性"]
    },
    %{
      title: "手写公式与几何图形识别的联合模型",
      authors: ["刘洋", "李娜"],
      year: 2024,
      venue: "浙江大学学报（工学版）",
      cited_by_count: 19,
      abstract:
        "针对中学几何场景，提出联合识别手写公式与几何图形的端到端模型，CROHME 与 GeoQA 上分别提升 4.1 与 6.7 个点。",
      keywords: ["计算机视觉", "公式识别", "几何"]
    },

    # ── 强化学习（5 篇） ──
    %{
      title: "基于深度强化学习的自适应学习路径规划",
      authors: ["钱七", "周八"],
      year: 2023,
      venue: "计算机学报",
      cited_by_count: 91,
      abstract:
        "将学习路径规划建模为马尔可夫决策过程，提出基于深度强化学习的自适应路径推荐算法，仿真与真实课堂实验均显示学习时间下降 18%。",
      keywords: ["强化学习", "自适应学习", "路径规划"]
    },
    %{
      title: "多智能体强化学习在协作式编程教育中的应用",
      authors: ["周八", "吴九"],
      year: 2024,
      venue: "软件学报",
      cited_by_count: 35,
      abstract:
        "提出多智能体强化学习算法用于协作式编程教育场景，学生与 AI 助手作为智能体协同完成任务，平均完成率提升 22%。",
      keywords: ["强化学习", "多智能体", "协作学习"]
    },
    %{
      title: "基于强化学习的智能题库调度系统研究",
      authors: ["钱七", "赵磊"],
      year: 2024,
      venue: "自动化学报",
      cited_by_count: 26,
      abstract:
        "提出基于强化学习的题库调度系统，根据学生答题表现动态调整题目难度与知识点分布，提升训练效率。",
      keywords: ["强化学习", "题库调度", "智能教学"]
    },
    %{
      title: "在线教育中的深度 Q 网络推荐策略优化",
      authors: ["周八", "黄杰"],
      year: 2023,
      venue: "中国科学：信息科学",
      cited_by_count: 58,
      abstract:
        "将 DQN 用于在线教育平台课程推荐，结合上下文赌博机思想提升冷启动性能。",
      keywords: ["强化学习", "推荐系统", "深度 Q 网络"]
    },
    %{
      title: "基于离线强化学习的课堂教学策略挖掘",
      authors: ["钱七", "李娜"],
      year: 2024,
      venue: "北京大学学报（自然科学版）",
      cited_by_count: 17,
      abstract:
        "提出基于离线强化学习的课堂教学策略挖掘框架，从历史课堂数据中学习高效讲授序列，提升新手教师教学表现。",
      keywords: ["强化学习", "离线学习", "课堂教学"]
    },

    # ── 联邦学习（5 篇） ──
    %{
      title: "联邦学习在跨校教育数据共享中的隐私保护机制",
      authors: ["吴九", "郑十", "陈静"],
      year: 2024,
      venue: "软件学报",
      cited_by_count: 47,
      abstract:
        "针对跨校教育数据共享中的隐私风险，提出基于差分隐私与同态加密的联邦学习框架，兼顾模型性能与隐私保障。",
      keywords: ["联邦学习", "隐私保护", "教育数据"]
    },
    %{
      title: "面向教育大模型的参数高效联邦微调",
      authors: ["郑十", "张华"],
      year: 2024,
      venue: "计算机学报",
      cited_by_count: 22,
      abstract:
        "针对大模型联邦微调通信开销大的问题，提出基于 LoRA 的参数高效联邦微调方法，通信量降低 92%。",
      keywords: ["联邦学习", "参数高效微调", "大模型"]
    },
    %{
      title: "非独立同分布场景下的联邦学习客户端选择策略",
      authors: ["吴九", "王伟"],
      year: 2023,
      venue: "中国科学：信息科学",
      cited_by_count: 39,
      abstract:
        "针对跨校教育数据非独立同分布问题，提出基于聚类的客户端选择策略，模型收敛速度提升 1.8×。",
      keywords: ["联邦学习", "非独立同分布", "客户端选择"]
    },
    %{
      title: "联邦学习在课堂情感识别中的隐私感知研究",
      authors: ["郑十", "陈静"],
      year: 2024,
      venue: "自动化学报",
      cited_by_count: 18,
      abstract:
        "将联邦学习用于课堂情感识别，结合差分隐私与梯度压缩保护学生数据安全。",
      keywords: ["联邦学习", "情感识别", "隐私计算"]
    },
    %{
      title: "面向教育知识图谱联合构建的联邦框架",
      authors: ["吴九", "刘洋"],
      year: 2025,
      venue: "复旦学报（自然科学版）",
      cited_by_count: 12,
      abstract:
        "提出联邦知识图谱联合构建框架，多校在不共享原始数据的前提下协作构建统一学科知识图谱。",
      keywords: ["联邦学习", "知识图谱", "联合构建"]
    }
  ]

  @mock_scholars [
    %{
      name: "周志华",
      affiliation: "南京大学计算机科学与技术系",
      works_count: 1268,
      cited_by_count: 82430,
      topics: ["机器学习", "集成学习", "深度学习"]
    },
    %{
      name: "张钹",
      affiliation: "清华大学人工智能研究院",
      works_count: 824,
      cited_by_count: 51206,
      topics: ["人工智能", "模式识别", "智能控制"]
    },
    %{
      name: "姚期智",
      affiliation: "清华大学交叉信息研究院",
      works_count: 612,
      cited_by_count: 40875,
      topics: ["计算理论", "量子计算", "密码学"]
    },
    %{
      name: "李飞飞",
      affiliation: "斯坦福大学计算机科学系",
      works_count: 1024,
      cited_by_count: 102815,
      topics: ["计算机视觉", "认知科学", "AI 医疗"]
    },
    %{
      name: "王伟",
      affiliation: "清华大学计算机系",
      works_count: 487,
      cited_by_count: 18420,
      topics: ["知识图谱", "自然语言处理"]
    },
    %{
      name: "李明",
      affiliation: "北京大学教育学院",
      works_count: 365,
      cited_by_count: 12018,
      topics: ["教育数据挖掘", "智能教学系统"]
    },
    %{
      name: "陈静",
      affiliation: "浙江大学计算机学院",
      works_count: 412,
      cited_by_count: 14650,
      topics: ["知识图谱", "联邦学习", "隐私计算"]
    },
    %{
      name: "赵磊",
      affiliation: "中国科学院自动化研究所",
      works_count: 538,
      cited_by_count: 22014,
      topics: ["计算机视觉", "模式识别", "智慧教育"]
    },
    %{
      name: "刘洋",
      affiliation: "复旦大学人工智能学院",
      works_count: 295,
      cited_by_count: 9620,
      topics: ["大语言模型", "智能问答", "教育技术"]
    },
    %{
      name: "钱七",
      affiliation: "上海交通大学电子信息与电气工程学院",
      works_count: 256,
      cited_by_count: 7210,
      topics: ["强化学习", "推荐系统", "自适应学习"]
    },
    %{
      name: "吴九",
      affiliation: "中国科学技术大学信息科学技术学院",
      works_count: 318,
      cited_by_count: 10547,
      topics: ["联邦学习", "隐私保护", "分布式系统"]
    },
    %{
      name: "周强",
      affiliation: "哈尔滨工业大学计算学部",
      works_count: 421,
      cited_by_count: 16982,
      topics: ["知识图谱", "自然语言处理", "知识增强"]
    }
  ]

  @mock_venues %{
    "中国科学" => %{id: "mock-cn-1", name: "中国科学：信息科学", works_count: 4862},
    "计算机学报" => %{id: "mock-cn-2", name: "计算机学报", works_count: 8124},
    "软件学报" => %{id: "mock-cn-3", name: "软件学报", works_count: 7456},
    "自动化学报" => %{id: "mock-cn-4", name: "自动化学报", works_count: 6234},
    "清华大学学报" => %{id: "mock-cn-5", name: "清华大学学报（自然科学版）", works_count: 4312},
    "电子学报" => %{id: "mock-cn-6", name: "电子学报", works_count: 5621},
    "通信学报" => %{id: "mock-cn-7", name: "通信学报", works_count: 4987},
    "北京学报" => %{id: "mock-cn-8", name: "北京大学学报（自然科学版）", works_count: 3642},
    "浙江学报" => %{id: "mock-cn-9", name: "浙江大学学报（工学版）", works_count: 4158},
    "复旦学报" => %{id: "mock-cn-10", name: "复旦学报（自然科学版）", works_count: 3205}
  }

  @doc "兴趣检索：mock 中文论文列表（按 query 简单过滤）。"
  def search_works(query, opts \\ []) do
    limit = Keyword.get(opts, :limit, 10)
    matched = filter_works(query)

    works =
      matched
      |> Enum.take(limit)
      |> Enum.map(fn w ->
        %{
          id: "mock-work-#{:erlang.phash2(w.title)}",
          title: w.title,
          authors: w.authors,
          year: w.year,
          venue: w.venue,
          cited_by_count: w.cited_by_count,
          abstract: w.abstract
        }
      end)

    topics =
      matched
      |> Enum.flat_map(& &1.keywords)
      |> Enum.frequencies()
      |> Enum.sort_by(&elem(&1, 1), :desc)
      |> Enum.take(6)
      |> Enum.map(&elem(&1, 0))

    {:ok, %{works: works, topics: topics}}
  end

  @doc "学者检索：mock 中文学者列表。"
  def search_authors(name, opts \\ []) do
    limit = Keyword.get(opts, :limit, 5)

    matched =
      cond do
        name == "" -> @mock_scholars
        true -> Enum.filter(@mock_scholars, &String.contains?(&1.name, name))
      end

    authors =
      matched
      |> Enum.take(limit)
      |> Enum.map(fn s ->
        %{
          id: "mock-author-#{:erlang.phash2(s.name)}",
          name: s.name,
          affiliation: s.affiliation,
          works_count: s.works_count,
          cited_by_count: s.cited_by_count,
          topics: s.topics
        }
      end)

    {:ok, %{authors: authors}}
  end

  @doc "学者画像：mock 资料 + 简化 persona。"
  def author_profile(openalex_id) do
    # 兼容 id 可能是 mock hash 或 mock-author-<hash>
    scholar =
      Enum.find(@mock_scholars, fn s -> "mock-author-#{:erlang.phash2(s.name)}" == openalex_id end)

    case scholar do
        nil ->
            # 兜底：按 hash 找第一个
            scholar =
                Enum.find(@mock_scholars, fn _ -> openalex_id =~ "mock-author-" end) ||
                  List.first(@mock_scholars)

            build_profile(scholar)

        _ ->
            build_profile(scholar)
      end
  end

  @doc "期刊 digest：mock 数据 + LLM（无 Key 时降级抽取式）。"
  def venue_digest(query, _tenant, opts \\ []) do
    limit = Keyword.get(opts, :limit, 8)
    venue = lookup_venue(query) || @mock_venues |> Map.values() |> List.first()

    papers =
      @mock_works
      |> Enum.filter(&(&1.venue == venue.name))
      |> Enum.take(limit)
      |> Enum.map(fn w ->
        %{
          id: "mock-work-#{:erlang.phash2(w.title)}",
          title: w.title,
          year: w.year,
          authors: w.authors,
          cited_by_count: w.cited_by_count,
          venue: w.venue
        }
      end)

    # 如果该刊没有 mock 论文，从全部 mock 里挑 5 篇当作"近期文章"
    papers =
      if papers == [] do
        @mock_works
        |> Enum.take(5)
        |> Enum.map(fn w ->
          %{
            id: "mock-work-#{:erlang.phash2(w.title)}",
            title: w.title,
            year: w.year,
            authors: w.authors,
            cited_by_count: w.cited_by_count,
            venue: w.venue
          }
        end)
      else
        papers
      end

    digest = digest_papers(venue.name, papers)

    {:ok, %{venue: venue, papers: papers, digest: digest}}
  end

  # ── Private ────────────────────────────────────────────────────────────

  defp filter_works(query) do
    q = String.trim(query)

    if q == "" do
      @mock_works
    else
      Enum.filter(@mock_works, fn w ->
        String.contains?(w.title, q) or
          String.contains?(w.venue, q) or
          Enum.any?(w.keywords, &String.contains?(&1, q)) or
          Enum.any?(w.authors, &String.contains?(&1, q))
      end) ++
        (if Enum.all?(@mock_works, fn w -> not (String.contains?(w.title, q) or String.contains?(w.venue, q) or Enum.any?(w.keywords, &String.contains?(&1, q))) end),
          do: Enum.take(@mock_works, 3),
          else: [])
    end
    |> Enum.uniq_by(& &1.title)
  end

  defp lookup_venue(query) do
    Enum.find_value(@mock_venues, fn {key, v} ->
      if String.contains?(query, key) or String.contains?(v.name, query), do: v, else: nil
    end)
  end

  defp build_profile(scholar) do
    top_works =
      @mock_works
      |> Enum.take(3)
      |> Enum.map(fn w ->
        %{
          id: "mock-work-#{:erlang.phash2(w.title)}",
          title: w.title,
          year: w.year,
          cited_by_count: w.cited_by_count
        }
      end)

    {:ok,
     %{
       id: "mock-author-#{:erlang.phash2(scholar.name)}",
       name: scholar.name,
       works_count: scholar.works_count,
       cited_by_count: scholar.cited_by_count,
       topics: scholar.topics,
       top_works: top_works,
       persona: build_persona(scholar.name, scholar.topics, top_works)
     }}
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
      |> Enum.map_join("\n", fn p -> "- 《#{p.title}》(#{p.year})：被引 #{p.cited_by_count}" end)
      |> String.slice(0, 6000)

    if @mock_skip_qwen do
      extractive_digest(papers)
    else
      KgEdu.Agent.ApiKeyProvider.ensure_key(:qwen)

      case ReqLLM.Generation.generate_text(
             "alibaba_cn:qwen-plus",
             [
               %{
                 role: "system",
                 content:
                   "你是学术追踪助手。只输出 JSON：{\"points\": [\"要点1\", ...], \"comparison\": \"观点对比…\", \"trends\": \"技术趋势…\"}。"
               },
               %{role: "user", content: "期刊《#{venue_name}》近期论文：\n#{brief}"}
             ],
             max_tokens: 2048,
             temperature: 0.3,
             receive_timeout: 60_000
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
  end

  defp extractive_digest(papers) do
    points =
      papers
      |> Enum.take(3)
      |> Enum.map(fn p ->
        "《#{p.title}》（#{p.year}）探讨了相关方向的方法与实验。"
      end)

    %{
      "points" => points,
      "comparison" =>
        "从近期 mock 论文看，《" <>
          (List.first(papers) |> Map.get(:title, "")) <>
          "》与同刊其他论文在研究方法与场景上存在差异：前者侧重实际应用，后者更偏向理论分析。",
      "trends" => "整体趋势：知识图谱与大语言模型在教学场景中的融合是近两年的研究热点。"
    }
  end

  defp extract_json(text) do
    case Regex.run(~r/```(?:json)?\s*\n?(.*?)\n?```/s, text, capture: :all_but_first) do
      [inner] -> String.trim(inner)
      nil -> String.trim(text)
    end
  end
end
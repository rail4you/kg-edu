defmodule KgEduWeb.SmartPortalController do
  @moduledoc """
  教师端智慧门户配置（每位教师多个）+ 学生端读取已分配门户。

  路由（scope "/api"）：
    GET    /smart-portal/config           默认门户模板（新建时预填，含 6 个 AI 实践）
    GET    /smart-portal/configs          教师门户列表（?teacherId=）
    POST   /smart-portal/configs          新建门户
    PUT    /smart-portal/configs/:id      更新门户
    DELETE /smart-portal/configs/:id      删除门户
    GET    /smart-portal/student          学生读取被分配到的门户（?studentId=）

  配置存于租户 schema 的 smart_portal_configs。
  """

  use KgEduWeb, :controller

  alias KgEdu.Knowledge.SmartPortalConfig

  # 6 个 AI 实践功能的默认角色设定（与前端 SCENARIOS 对齐）
  @practice_defaults %{
    "dialogue" => %{
      "title" => "情景对话 · 餐厅点餐",
      "preset" => "餐厅点餐",
      "inputKind" => "chat",
      "placeholder" => "先设定一个情境，如：在餐厅点餐",
      "rolePrompt" =>
        "你是餐厅服务员，正在接待一位顾客。请用热情、礼貌的语气接待，引导顾客点餐并介绍菜品，顾客点完后再确认订单。全程只用中文交流。"
    },
    "work_upload" => %{
      "title" => "上传作品",
      "preset" => "",
      "inputKind" => "upload",
      "placeholder" => "粘贴你的作品文本",
      "rolePrompt" =>
        "你是作品评审专家。学生通过粘贴文本提交作品（作文/设计说明/实验报告/代码等）。请直接依据所粘贴的文本内容进行评审，输出：1) 简要点评（完整性、规范性、创新性各一句）；2) 百分制评分；3) 三条具体可操作的改进建议。"
    },
    "thinking_ladder" => %{
      "title" => "思维阶梯",
      "preset" => "",
      "inputKind" => "chat",
      "placeholder" => "提出你想深入思考的问题",
      "rolePrompt" =>
        "你是思维教练。围绕学生提出的问题，用苏格拉底式追问引导其从现象到本质逐级深入，每次只问一个关键问题，并肯定其上一轮思考的进步。"
    },
    "debate_arena" => %{
      "title" => "思辨擂台",
      "preset" => "",
      "inputKind" => "chat",
      "placeholder" => "亮明你的论点，如：AI 应该取代教师",
      "rolePrompt" =>
        "你是思辨擂台反方辩手。学生给出论点后，你针锋相对地反驳，要求论据充分；每轮结束后点评其论证的逻辑漏洞。先请学生亮明论点。"
    },
    "code_editor" => %{
      "title" => "代码编辑",
      "preset" => "",
      "inputKind" => "code",
      "placeholder" => "粘贴你的代码",
      "rolePrompt" =>
        "你是代码评审专家。学生粘贴代码后，请指出 bug 与坏味道，从正确性、规范性、效率三方面评分（百分制），并给出优化后的完整代码（用代码块包裹）。"
    },
    "interactive_story" => %{
      "title" => "互动故事",
      "preset" => "",
      "inputKind" => "chat",
      "placeholder" => "选择题材或直接说开始",
      "rolePrompt" =>
        "你是互动故事讲述者。先请学生选一个题材（科幻/历史/悬疑），然后讲述故事，每讲一段就给出 2-3 个选项让学生决定剧情走向，并记录其选择偏好。"
    }
  }

  @practice_order ~w(dialogue work_upload thinking_ladder debate_arena code_editor interactive_story)

  @doc "默认智慧门户布局：6 个 AI 实践功能 + 课程/知识点/统计展示模块"
  def default_layout do
    practice_blocks =
      @practice_order
      |> Enum.with_index()
      |> Enum.map(fn {scenario, idx} ->
        d = Map.fetch!(@practice_defaults, scenario)

        %{
          "id" => "b_practice_#{scenario}",
          "type" => "ai-practice",
          "title" => d["title"],
          "span" => 12,
          "config" => %{
            "scenario" => scenario,
            "preset" => d["preset"],
            "inputKind" => d["inputKind"],
            "placeholder" => d["placeholder"],
            "rolePrompt" => d["rolePrompt"],
            "order" => idx
          }
        }
      end)

    %{
      "version" => 1,
      "blocks" =>
        [
          %{
            "id" => "b_welcome",
            "type" => "text",
            "title" => "AI 实践智慧门户",
            "span" => 24,
            "config" => %{
              "content" =>
                "完成以下任务即可；与 AI 角色对话或提交作品后，即可获得实时评估结果。",
              "align" => "left"
            }
          }
        ] ++
          practice_blocks ++
          [
            %{
              "id" => "b_courses",
              "type" => "course-list",
              "title" => "课程推荐",
              "span" => 12,
              "config" => %{"limit" => 6, "layout" => "card"}
            },
            %{
              "id" => "b_knowledge",
              "type" => "knowledge-points",
              "title" => "知识点",
              "span" => 12,
              "config" => %{"limit" => 12, "layout" => "tags"}
            },
            %{
              "id" => "b_stats",
              "type" => "stats",
              "title" => "数据概览",
              "span" => 24,
              "config" => %{"metrics" => ["courses", "students", "videos", "exercises"]}
            }
          ]
    }
  end

  # GET /api/smart-portal/config — 新建门户时的默认模板
  def get_template(conn, _params) do
    json(conn, %{success: true, data: template_map()})
  end

  # GET /api/smart-portal/configs?teacherId=...
  def list_configs(conn, params) do
    tenant = extract_tenant(conn, params)
    teacher_id = params["teacherId"] || params["teacher_id"]

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      is_nil(teacher_id) ->
        json(conn, %{success: false, error: "缺少 teacherId"})

      true ->
        case SmartPortalConfig.list_by_teacher(%{teacher_id: teacher_id}, tenant: tenant, authorize?: false) do
          {:ok, list} ->
            sorted = Enum.sort_by(list, & &1.updated_at, {:desc, DateTime})
            json(conn, %{success: true, data: Enum.map(sorted, &config_map/1)})

          {:error, e} ->
            json(conn, %{success: false, error: inspect(e)})
        end
    end
  end

  # POST /api/smart-portal/configs
  def create_config(conn, params) do
    tenant = extract_tenant(conn, params)
    data = params["data"] || params
    teacher_id = data["teacherId"] || data["teacher_id"]

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      is_nil(teacher_id) ->
        json(conn, %{success: false, error: "缺少 teacherId"})

      true ->
        attrs = Map.put(attrs_from(data), :teacher_id, teacher_id)

        case SmartPortalConfig.create_config(attrs, tenant: tenant, authorize?: false) do
          {:ok, record} -> json(conn, %{success: true, data: config_map(record)})
          {:error, e} -> json(conn, %{success: false, error: inspect(e)})
        end
    end
  end

  # PUT /api/smart-portal/configs/:id
  def update_config(conn, %{"id" => id} = params) do
    tenant = extract_tenant(conn, params)
    data = params["data"] || params

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      true ->
        case SmartPortalConfig.get_config(id, tenant: tenant, authorize?: false) do
          {:ok, record} ->
            case SmartPortalConfig.update_config(record, attrs_from(data), tenant: tenant, authorize?: false) do
              {:ok, updated} -> json(conn, %{success: true, data: config_map(updated)})
              {:error, e} -> json(conn, %{success: false, error: inspect(e)})
            end

          {:error, _} ->
            json(conn, %{success: false, error: "门户不存在"})
        end
    end
  end

  # DELETE /api/smart-portal/configs/:id
  def delete_config(conn, %{"id" => id} = params) do
    tenant = extract_tenant(conn, params)

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      true ->
        case SmartPortalConfig.get_config(id, tenant: tenant, authorize?: false) do
          {:ok, record} ->
            case SmartPortalConfig.delete_config(record, tenant: tenant, authorize?: false) do
              :ok -> json(conn, %{success: true})
              {:ok, _} -> json(conn, %{success: true})
              {:error, e} -> json(conn, %{success: false, error: inspect(e)})
            end

          {:error, _} ->
            json(conn, %{success: false, error: "门户不存在"})
        end
    end
  end

  # GET /api/smart-portal/student?studentId=...
  def get_student_config(conn, params) do
    tenant = extract_tenant(conn, params)
    student_id = params["studentId"] || params["student_id"]

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      true ->
        case find_assigned(student_id, tenant) do
          nil ->
            json(conn, %{success: true, data: default_config_map(false)})

          record ->
            json(conn, %{success: true, data: config_map(record) |> Map.put(:assigned, true)})
        end
    end
  end

  # --- helpers ---

  defp attrs_from(data) do
    %{
      name: data["name"] || "智慧门户",
      enabled: data["enabled"] != false,
      layout: normalize_layout(data["layout"]),
      student_ids: normalize_ids(data["studentIds"] || data["student_ids"])
    }
  end

  defp find_assigned(nil, _tenant), do: nil

  defp find_assigned(student_id, tenant) do
    case SmartPortalConfig.list_configs(tenant: tenant, authorize?: false) do
      {:ok, list} ->
        list
        |> Enum.filter(fn c ->
          c.enabled && is_binary(student_id) && student_id in (c.student_ids || [])
        end)
        |> Enum.sort_by(& &1.updated_at, {:desc, DateTime})
        |> List.first()

      _ ->
        nil
    end
  end

  defp template_map do
    %{
      name: "智慧门户",
      enabled: true,
      layout: default_layout(),
      student_ids: []
    }
  end

  defp default_config_map(assigned) do
    %{
      id: nil,
      teacher_id: nil,
      name: "智慧门户",
      enabled: true,
      layout: default_layout(),
      student_ids: [],
      assigned: assigned
    }
  end

  defp config_map(record) do
    %{
      id: record.id,
      teacher_id: record.teacher_id,
      name: record.name || "智慧门户",
      enabled: record.enabled,
      layout: record.layout || %{},
      student_ids: record.student_ids || [],
      assigned: false,
      inserted_at: record.inserted_at,
      updated_at: record.updated_at
    }
  end

  defp normalize_ids(nil), do: []

  defp normalize_ids(list) when is_list(list) do
    list
    |> Enum.map(&to_string/1)
    |> Enum.filter(&valid_uuid?/1)
    |> Enum.uniq()
  end

  defp normalize_ids(_), do: []

  defp valid_uuid?(v) do
    case Ecto.UUID.cast(v) do
      {:ok, _} -> true
      :error -> false
    end
  end

  defp normalize_layout(layout) when is_map(layout) do
    blocks = layout["blocks"] || layout[:blocks] || []
    version = layout["version"] || layout[:version] || 1

    blocks =
      blocks
      |> Enum.map(&normalize_block/1)
      |> Enum.reject(&is_nil/1)

    %{"version" => version, "blocks" => blocks}
  end

  defp normalize_layout(_), do: %{"version" => 1, "blocks" => []}

  defp normalize_block(block) when is_map(block) do
    %{
      "id" => block["id"] || block[:id] || to_string(System.unique_integer([:positive])),
      "type" => block["type"] || block[:type] || "text",
      "title" => block["title"] || block[:title] || "",
      "span" => clamp_span(block["span"] || block[:span]),
      "config" => block["config"] || block[:config] || %{}
    }
  end

  defp normalize_block(_), do: nil

  defp clamp_span(value) do
    case value do
      v when is_integer(v) and v >= 1 and v <= 24 ->
        v

      v when is_binary(v) ->
        case Integer.parse(v) do
          {n, _} when n >= 1 and n <= 24 -> n
          _ -> 24
        end

      _ ->
        24
    end
  end

  defp extract_tenant(conn, params) do
    params["orgSchema"] ||
      params["tenant"] ||
      (params["forwardedProps"] || %{})["orgSchema"] ||
      get_req_header(conn, "x-org-schema") |> List.first() ||
      conn.assigns[:org_schema]
  end
end

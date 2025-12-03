defmodule KgEdu.Knowledge.ImportFromLLM do
  @moduledoc """
  Import knowledge and knowledge relations from text using LLM analysis.
  """

  alias KgEdu.Knowledge.Resource
  alias KgEdu.Knowledge.Relation
  alias KgEdu.Knowledge.RelationType
  require Logger

  @doc """
  Import knowledge and relations from text using LLM analysis.

  ## Parameters
  - text: The input text to analyze
  - course_id: The course ID to associate knowledge with
  - opts: Options including actor for authorization

  ## Returns
  - {:ok, result} on success with created knowledge and relations
  - {:error, reason} on failure
  """
  def import_from_text(text, course_id, opts \\ []) do
    Logger.info("Starting LLM knowledge import for course #{course_id}")

    # Step 1: Analyze text with LLM
    case analyze_text_with_llm(text) do
      {:ok, llm_result} ->
        Logger.info("LLM analysis completed successfully")
        # Step 2: Create knowledge and relations in transaction
        create_knowledge_and_relations(llm_result, course_id, opts)

      {:error, reason} ->
        Logger.error("LLM analysis failed: #{inspect(reason)}")
        {:error, "Failed to analyze text with LLM: #{inspect(reason)}"}
    end
  end

  # Step 1: Analyze text with LLM
  defp analyze_text_with_llm(text) do
    prompt = build_knowledge_extraction_prompt(text)

    # Get ReqLLM configuration
    config = Application.get_env(:kg_edu, :reqllm)
    model = config[:model] || "openrouter:z-ai/glm-4.5"

    Logger.info("Sending text to LLM for analysis")
    ReqLLM.put_key(:openrouter_api_key, "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")
    case ReqLLM.generate_text(model, prompt) do
      {:ok, response} ->
        case parse_llm_response(response) do
          {:ok, result} ->
            Logger.info("Successfully parsed LLM response, result is #{inspect(result)}")
            {:ok, result}

          {:error, reason} ->
            Logger.error("Failed to parse LLM response: #{inspect(reason)}")
            {:error, "Failed to parse LLM response: #{inspect(reason)}"}
        end

      {:error, reason} ->
        Logger.error("LLM request failed: #{inspect(reason)}")
        {:error, "LLM request failed: #{inspect(reason)}"}
    end
  end

  defp build_knowledge_extraction_prompt(text) do
    """
    你是一个知识图谱专家。请分析以下文本，识别其中包含的知识点、学科、单元或知识细胞，以及它们之间的关系。

    文本内容：
    #{text}

    请按照以下JSON格式返回分析结果：

    {
      "knowledge_resources": [
        {
          "name": "知识点名称",
          "type": "subject|knowledge_unit|knowledge_cell",
          "subject": "所属学科名称（重要：所有类型都必须提供）",
          "unit": "所属单元名称（重要：knowledge_unit和knowledge_cell类型必须提供）",
          "description": "知识点描述",
          "importance_level": "困难|重要|正常"
        }
      ],
      "relations": [
        {
          "source_knowledge": "源知识点名称",
          "target_knowledge": "目标知识点名称",
          "relation_type": "关系类型名称（必须是关联关系、包含关系、顺序关系之一）"
        }
      ]
    }

    重要要求：
    1. 层级结构规则：
       - subject: 顶级学科，不需要unit
       - knowledge_unit: 学科下的单元，必须提供subject和unit
       - knowledge_cell: 单元下的具体知识点，必须提供subject和unit

    2. 父子关系：
       - 如果文本中没有明确提到单元名称，请根据内容逻辑创建合适的单元名称
       - 确保每个知识点都有明确的父子关系链条

    3. 分析要求：
       - 仔细分析文本中的层级结构（学科->单元->知识点）
       - 识别知识点之间的逻辑关系（关联关系、包含关系、顺序关系之一）
       - 为关系选择合适的类型名称
       - 确保所有名称在文本中能找到对应或能合理推断

    4. 格式要求：
       - 使用中文回复
       - 返回有效的JSON格式，用```json代码块包围
       - unit字段不能为空字符串，必须提供有意义的单元名称
    """
  end

  defp parse_llm_response(response) do
    case ReqLLM.Response.text(response) do
      text when is_binary(text) ->
        # Extract JSON from response
        case extract_json_from_text(text) do
          {:ok, json_string} ->
            case Jason.decode(json_string, keys: :atoms) do
              {:ok, data} ->
                # Validate structure
                validate_llm_result(data)

              {:error, reason} ->
                {:error, "Failed to decode JSON: #{inspect(reason)}"}
            end

          {:error, reason} ->
            {:error, reason}
        end

      _ ->
        {:error, "Invalid response format"}
    end
  end

  defp extract_json_from_text(text) do
    # Try to extract JSON from code blocks first
    case Regex.run(~r/```(?:json)?\s*\n?(.*?)\n?```/s, text, capture: :all_but_first) do
      [json_content] ->
        {:ok, String.trim(json_content)}

      nil ->
        # If no code blocks, try to find JSON object in the text
        case Regex.run(~r/\{.*\}/s, text) do
          [json_content] ->
            {:ok, String.trim(json_content)}

          nil ->
            {:error, "No JSON found in response"}
        end
    end
  end

  defp validate_llm_result(data) do
    cond do
      not is_map(data) ->
        {:error, "Response is not a valid object"}

      not is_list(data.knowledge_resources) ->
        {:error, "knowledge_resources must be an array"}

      not is_list(data.relations) ->
        {:error, "relations must be an array"}

      true ->
        # Validate each knowledge resource
        resource_errors = Enum.with_index(data.knowledge_resources)
        |> Enum.map(fn {resource, index} ->
          validate_knowledge_resource(resource, index)
        end)
        |> Enum.reject(&(&1 == :ok))

        # Validate each relation
        relation_errors = Enum.with_index(data.relations)
        |> Enum.map(fn {relation, index} ->
          validate_relation(relation, index)
        end)
        |> Enum.reject(&(&1 == :ok))

        errors = resource_errors ++ relation_errors

        if Enum.empty?(errors) do
          {:ok, data}
        else
          {:error, "Validation errors: #{inspect(errors)}"}
        end
    end
  end

  defp validate_knowledge_resource(resource, index) do
    cond do
      not is_binary(resource.name) or resource.name == "" ->
        {:error, "knowledge_resources[#{index}].name is required"}

      resource.type not in ["subject", "knowledge_unit", "knowledge_cell"] ->
        {:error, "knowledge_resources[#{index}].type must be one of: subject, knowledge_unit, knowledge_cell"}

      not is_binary(resource.subject) or resource.subject == "" ->
        {:error, "knowledge_resources[#{index}].subject is required"}

      resource.type == "knowledge_unit" and (not is_binary(resource.unit) or resource.unit == "") ->
        {:error, "knowledge_resources[#{index}].unit is required for knowledge_unit type"}

      resource.type == "knowledge_cell" and
          (not is_binary(resource.unit) or resource.unit == "") and
          (resource.subject == nil or resource.subject == "") ->
        {:error, "knowledge_resources[#{index}].unit or valid subject reference is required for knowledge_cell type"}

      true ->
        :ok
    end
  end

  defp validate_relation(relation, index) do
    cond do
      not is_binary(relation.source_knowledge) or relation.source_knowledge == "" ->
        {:error, "relations[#{index}].source_knowledge is required"}

      not is_binary(relation.target_knowledge) or relation.target_knowledge == "" ->
        {:error, "relations[#{index}].target_knowledge is required"}

      not is_binary(relation.relation_type) or relation.relation_type == "" ->
        {:error, "relations[#{index}].relation_type is required"}

      true ->
        :ok
    end
  end

  # Step 2: Create knowledge and relations in transaction
  defp create_knowledge_and_relations(llm_result, course_id, opts) do
    # Use Ecto.Repo.transaction to ensure atomicity
    repo = opts[:repo] || KgEdu.Repo

    repo.transaction(fn ->
      case create_knowledge_resources(llm_result.knowledge_resources, course_id, opts) do
        {:ok, resource_map} ->
          case create_relations(llm_result.relations, resource_map, opts) do
            {:ok, relations} ->
              {:ok, %{resources: Map.values(resource_map), relations: relations}}

            {:error, reason} ->
              repo.rollback(reason)
          end

        {:error, reason} ->
          repo.rollback(reason)
      end
    end)
  end

  defp create_knowledge_resources(knowledge_resources, course_id, opts) do
    # Create resources and build a name -> resource map
    Enum.reduce_while(knowledge_resources, {:ok, %{}}, fn resource_data, {:ok, acc} ->
      case create_single_knowledge_resource(resource_data, course_id, opts) do
        {:ok, resource} ->
          new_acc = Map.put(acc, resource.name, resource)
          {:cont, {:ok, new_acc}}

        {:error, reason} ->
          {:halt, {:error, reason}}
      end
    end)
  end

  defp create_single_knowledge_resource(resource_data, course_id, opts) do
    # Check if resource already exists
    case find_existing_resource(resource_data.name, course_id) do
      {:ok, existing_resource} ->
        Logger.info("Resource '#{resource_data.name}' already exists, reusing it")
        {:ok, existing_resource}

      {:error, :not_found} ->
        # Create new resource
        create_new_knowledge_resource(resource_data, course_id, opts)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp find_existing_resource(name, course_id) do
    case Resource.get_by_name_and_course(%{name: name, knowledge_type: :knowledge_cell, course_id: course_id}) do
      {:ok, resource} -> {:ok, resource}
      {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Query.NotFound{}]}} -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  defp create_new_knowledge_resource(resource_data, course_id, opts) do
    knowledge_type = parse_knowledge_type(resource_data.type)

    # Handle missing unit field for knowledge_cell by creating a default unit
    {unit, needs_default_unit} = case {knowledge_type, resource_data.unit} do
      {:knowledge_cell, nil} -> {"默认单元", true}
      {:knowledge_cell, ""} -> {"默认单元", true}
      {_, unit} when is_binary(unit) -> {unit, false}
      _ -> {"", false}
    end

    attrs = %{
      name: resource_data.name,
      subject: resource_data.subject,
      unit: unit,
      description: resource_data.description || "从文本导入的知识点: #{resource_data.name}",
      importance_level: parse_importance_level(resource_data.importance_level),
      knowledge_type: knowledge_type,
      course_id: course_id,
      parent_subject_id: nil,  # Will be set later if needed
      parent_unit_id: nil      # Will be set later if needed
    }

    # Set parent relationships based on type
    attrs = case knowledge_type do
      :knowledge_unit ->
        case find_or_create_parent_subject(resource_data.subject, course_id, opts) do
          {:ok, subject_id} -> Map.put(attrs, :parent_subject_id, subject_id)
          _ -> attrs
        end

      :knowledge_cell ->
        # Ensure parent subject exists
        attrs = case find_or_create_parent_subject(resource_data.subject, course_id, opts) do
          {:ok, subject_id} -> Map.put(attrs, :parent_subject_id, subject_id)
          _ -> attrs
        end

        # Handle parent unit
        if needs_default_unit do
          # Create default unit if needed
          case find_or_create_default_unit(resource_data.subject, course_id, opts) do
            {:ok, unit_id} -> Map.put(attrs, :parent_unit_id, unit_id)
            _ -> attrs
          end
        else
          # Find existing unit
          case find_parent_unit(unit, course_id) do
            {:ok, unit_id} -> Map.put(attrs, :parent_unit_id, unit_id)
            _ -> attrs
          end
        end

      _ ->
        attrs
    end

    case Resource.create_knowledge_resource(attrs, opts) do
      {:ok, resource} ->
        Logger.info("Created knowledge resource: #{resource.name}")
        {:ok, resource}

      {:error, reason} ->
        Logger.error("Failed to create knowledge resource: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp parse_knowledge_type("subject"), do: :subject
  defp parse_knowledge_type("knowledge_unit"), do: :knowledge_unit
  defp parse_knowledge_type("knowledge_cell"), do: :knowledge_cell
  defp parse_knowledge_type(_), do: :knowledge_cell

  defp parse_importance_level("hard"), do: "hard"
  defp parse_importance_level("important"), do: "important"
  defp parse_importance_level("normal"), do: "normal"
  defp parse_importance_level(_), do: "normal"

  defp find_parent_subject(subject_name, course_id) do
    case Resource.list_knowledges(
      authorize?: false,
      query: [
        filter: [
          name: subject_name,
          knowledge_type: :subject,
          course_id: course_id
        ],
        limit: 1
      ]
    ) do
      {:ok, [subject]} -> {:ok, subject.id}
      {:ok, []} -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  defp find_or_create_parent_subject(subject_name, course_id, opts) do
    case find_parent_subject(subject_name, course_id) do
      {:ok, subject_id} ->
        {:ok, subject_id}

      {:error, :not_found} ->
        # Create the subject
        subject_attrs = %{
          name: subject_name,
          subject: subject_name,
          knowledge_type: :subject,
          course_id: course_id,
          importance_level: "normal",
          description: "自动创建的学科: #{subject_name}"
        }

        case Resource.create_knowledge_resource(subject_attrs, opts) do
          {:ok, subject} ->
            Logger.info("Created parent subject: #{subject_name}")
            {:ok, subject.id}

          {:error, reason} ->
            Logger.error("Failed to create parent subject: #{inspect(reason)}")
            {:error, reason}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp find_or_create_default_unit(subject_name, course_id, opts) do
    unit_name = "#{subject_name}默认单元"

    case find_parent_unit(unit_name, course_id) do
      {:ok, unit_id} ->
        {:ok, unit_id}

      {:error, :not_found} ->
        # First ensure parent subject exists
        case find_or_create_parent_subject(subject_name, course_id, opts) do
          {:ok, subject_id} ->
            # Create the default unit
            unit_attrs = %{
              name: unit_name,
              subject: subject_name,
              unit: unit_name,
              knowledge_type: :knowledge_unit,
              course_id: course_id,
              parent_subject_id: subject_id,
              importance_level: "normal",
              description: "自动创建的默认单元"
            }

            case Resource.create_knowledge_resource(unit_attrs, opts) do
              {:ok, unit} ->
                Logger.info("Created default unit: #{unit_name}")
                {:ok, unit.id}

              {:error, reason} ->
                Logger.error("Failed to create default unit: #{inspect(reason)}")
                {:error, reason}
            end

          {:error, reason} ->
            {:error, reason}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp find_parent_unit(unit_name, course_id) do
    case Resource.list_knowledges(
      authorize?: false,
      query: [
        filter: [
          name: unit_name,
          knowledge_type: :knowledge_unit,
          course_id: course_id
        ],
        limit: 1
      ]
    ) do
      {:ok, [unit]} -> {:ok, unit.id}
      {:ok, []} -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  defp create_relations(relations, resource_map, opts) do
    Enum.reduce_while(relations, {:ok, []}, fn relation_data, {:ok, acc} ->
      case create_single_relation(relation_data, resource_map, opts) do
        {:ok, relation} ->
          {:cont, {:ok, [relation | acc]}}

        {:error, reason} ->
          {:halt, {:error, reason}}
      end
    end)
  end

  defp create_single_relation(relation_data, resource_map, opts) do
    # Find source and target resources
    with {:ok, source_resource} <- find_resource_in_map(relation_data.source_knowledge, resource_map),
         {:ok, target_resource} <- find_resource_in_map(relation_data.target_knowledge, resource_map),
         {:ok, relation_type} <- create_or_get_relation_type(relation_data.relation_type) do

      # Check if relation already exists
      case find_existing_relation(source_resource.id, target_resource.id, relation_type.id) do
        {:ok, []} ->
          # Create new relation
          relation_attrs = %{
            source_knowledge_id: source_resource.id,
            target_knowledge_id: target_resource.id,
            relation_type_id: relation_type.id
          }

          case Relation.create_relation_import(relation_attrs, opts) do
            {:ok, relation} ->
              Logger.info("Created relation: #{source_resource.name} -> #{target_resource.name} (#{relation_type.name})")
              {:ok, relation}

            {:error, reason} ->
              Logger.error("Failed to create relation: #{inspect(reason)}")
              {:error, reason}
          end

        {:ok, _existing_relation} ->
          Logger.info("Relation already exists, skipping")
          {:ok, nil}

        {:error, reason} ->
          {:error, reason}
      end
    else
      {:error, reason} ->
        {:error, reason}
    end
  end

  defp find_resource_in_map(name, resource_map) do
    case Map.get(resource_map, name) do
      nil -> {:error, "Resource not found: #{name}"}
      resource -> {:ok, resource}
    end
  end

  defp create_or_get_relation_type(relation_type_name) do
    case RelationType.get_relation_type_by_name(%{name: relation_type_name}) do
      {:ok, relation_type} ->
        {:ok, relation_type}

      {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Query.NotFound{}]}} ->
        # Create new relation type using upsert_relation_type action
        case RelationType.upsert_relation_type(%{
          name: relation_type_name,
          display_name: String.capitalize(relation_type_name) |> String.replace("_", " "),
          description: "从文本导入的关系类型: #{relation_type_name}"
        }, authorize?: false) do
          {:ok, relation_type} ->
            Logger.info("Created relation type: #{relation_type_name}")
            {:ok, relation_type}

          {:error, reason} ->
            Logger.error("Failed to create relation type '#{relation_type_name}': #{inspect(reason)}")
            {:error, reason}
        end

      {:error, reason} ->
        Logger.error("Failed to check relation type '#{relation_type_name}': #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp find_existing_relation(source_id, target_id, relation_type_id) do
    Relation.list_knowledge_relations(
      authorize?: false,
      query: [
        filter: [
          source_knowledge_id: source_id,
          target_knowledge_id: target_id,
          relation_type_id: relation_type_id
        ],
        limit: 1
      ]
    )
  end
end

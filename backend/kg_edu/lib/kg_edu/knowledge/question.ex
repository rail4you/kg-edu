defmodule KgEdu.Knowledge.Question do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource],
    primary_read_warning?: false

  require Ash.Query
  require Logger

  postgres do
    table("knowledge_questions")
    repo(KgEdu.Repo)

    references do
      reference(:knowledge_resource, on_delete: :delete)
    end
  end

  json_api do
    type("knowledge_question")
  end

  typescript do
    type_name("Question")
  end

  code_interface do
    # Basic CRUD
    define(:get_question, action: :by_id)
    define(:list_questions, action: :read)
    define(:create_question, action: :create)
    define(:update_question, action: :update_question)
    define(:delstroy_question, action: :destroy)

    # Question level queries
    define(:list_global_questions, action: :list_global_questions)
    define(:list_concept_questions, action: :list_concept_questions)
    define(:list_method_questions, action: :list_method_questions)

    # Flow queries
    define(:get_question_flow, action: :get_question_flow)
    define(:get_question_connections, action: :get_question_connections)

    # Knowledge resource queries
    define(:get_questions_by_knowledge, action: :by_knowledge_resource)

    # Link/Unlink actions
    define(:link_question_to_knowledge, action: :link_question_to_knowledge)
    define(:unlink_question_from_knowledge, action: :unlink_question_from_knowledge)

    # Import/Export
    define(:import_questions_from_xlsx, action: :import_questions_from_xlsx)
    define(:export_question_template, action: :export_question_template)

    # Batch actions
    define(:bulk_destroy_questions, action: :bulk_destroy_questions)

    # Move actions
    define(:move_question_up, action: :move_up)
    define(:move_question_down, action: :move_down)
  end

  actions do
    read :read do
      primary?(true)

      prepare(fn query, _context ->
        Ash.Query.sort(query, position: :asc, title: :asc)
      end)
    end

    # ============ Basic Queries ============
    read :by_id do
      description("Get a question by ID")
      get?(true)
      argument(:id, :uuid, allow_nil?: false)
      filter(expr(id == ^arg(:id)))
    end

    # ============ Question Level Queries ============
    read :list_global_questions do
      description("List all global level questions")
      argument(:course_id, :uuid, allow_nil?: true)

      filter(
        expr(
          question_level == :global and
            (is_nil(^arg(:course_id)) or course_id == ^arg(:course_id))
        )
      )

      prepare(fn query, _context ->
        Ash.Query.sort(query, position: :asc, title: :asc)
      end)
    end

    read :list_concept_questions do
      description("List all concept level questions")
      argument(:course_id, :uuid, allow_nil?: true)

      filter(
        expr(
          question_level == :concept and
            (is_nil(^arg(:course_id)) or course_id == ^arg(:course_id))
        )
      )

      prepare(fn query, _context ->
        Ash.Query.sort(query, position: :asc, title: :asc)
      end)
    end

    read :list_method_questions do
      description("List all method level questions")
      argument(:course_id, :uuid, allow_nil?: true)

      filter(
        expr(
          question_level == :method and
            (is_nil(^arg(:course_id)) or course_id == ^arg(:course_id))
        )
      )

      prepare(fn query, _context ->
        Ash.Query.sort(query, position: :asc, title: :asc)
      end)
    end

    # ============ Flow Queries ============
    read :get_question_flow do
      description("Get the complete question flow for a course")
      argument(:course_id, :uuid, allow_nil?: false)

      filter(expr(course_id == ^arg(:course_id)))

      prepare(fn query, _context ->
        query
        |> Ash.Query.sort(question_level: :asc, position: :asc)
        |> Ash.Query.load([:source_connections, :target_connections])
      end)
    end

    read :get_question_connections do
      description("Get connections for a specific question")
      argument(:question_id, :uuid, allow_nil?: false)

      prepare(fn query, _context ->
        query
        |> Ash.Query.filter(expr(id == ^arg(:question_id)))
        |> Ash.Query.load([:source_connections, :target_connections])
      end)
    end

    # ============ Create Actions ============
    create :create do
      description("Create a new question")

      accept([
        :title,
        :description,
        :course_id,
        :question_level,
        :position,
        :tags,
        :created_by_id,
        :difficulty
      ])

      validate(fn changeset, _context ->
        title = Ash.Changeset.get_attribute(changeset, :title)
        question_level = Ash.Changeset.get_attribute(changeset, :question_level)
        position = Ash.Changeset.get_attribute(changeset, :position)
        course_id = Ash.Changeset.get_attribute(changeset, :course_id)

        cond do
          is_nil(title) or title == "" ->
            {:error, "Title is required"}

          is_nil(question_level) ->
            {:error, "Question level is required"}

          is_nil(position) ->
            {:error, "Position is required"}

          is_nil(course_id) ->
            {:error, "Course ID is required"}

          true ->
            :ok
        end
      end)
    end

    # ============ Update Actions ============
    update :update_question do
      description("Update a question")

      accept([
        :title,
        :description,
        :position,
        :tags,
        :question_level,
        :course_id,
        :knowledge_resource_id,
        :difficulty
      ])
    end

    update :move_up do
      description("将问题在课程内向上移动一位")
      require_atomic?(false)

      change(fn changeset, context ->
        question = changeset.data
        course_id = question.course_id
        current_position = question.position || 0

        # 获取当前课程中 position 小于当前问题的最大 position 的问题
        sibling =
          KgEdu.Knowledge.Question
          |> Ash.Query.filter(course_id == ^course_id)
          |> Ash.Query.filter(position < ^current_position)
          |> Ash.Query.sort(position: :desc)
          |> Ash.Query.limit(1)
          |> Ash.read_one!(tenant: context.tenant, authorize?: false)

        if sibling do
          # 保存新的 position 值
          new_position = sibling.position

          # 更新兄弟问题的 position
          sibling
          |> Ash.Changeset.for_update(:update_question, %{position: current_position})
          |> Ash.update!(tenant: context.tenant, authorize?: false)

          # 返回修改后的 changeset
          Ash.Changeset.change_attribute(changeset, :position, new_position)
        else
          changeset
        end
      end)
    end

    update :move_down do
      description("将问题在课程内向下移动一位")
      require_atomic?(false)

      change(fn changeset, context ->
        question = changeset.data
        course_id = question.course_id
        current_position = question.position || 0

        # 获取当前课程中 position 大于当前问题的最小 position 的问题
        sibling =
          KgEdu.Knowledge.Question
          |> Ash.Query.filter(course_id == ^course_id)
          |> Ash.Query.filter(position > ^current_position)
          |> Ash.Query.sort(position: :asc)
          |> Ash.Query.limit(1)
          |> Ash.read_one!(tenant: context.tenant, authorize?: false)

        if sibling do
          # 保存新的 position 值
          new_position = sibling.position

          # 更新兄弟问题的 position
          sibling
          |> Ash.Changeset.for_update(:update_question, %{position: current_position})
          |> Ash.update!(tenant: context.tenant, authorize?: false)

          # 返回修改后的 changeset
          Ash.Changeset.change_attribute(changeset, :position, new_position)
        else
          changeset
        end
      end)
    end

    # ============ Link/Unlink Actions ============
    update :link_question_to_knowledge do
      description("Link a question to a knowledge resource")
      require_atomic?(false)

      argument :knowledge_resource_id, :uuid do
        allow_nil?(false)
        description("The knowledge resource ID to link to")
      end

      change(
        manage_relationship(:knowledge_resource_id, :knowledge_resource, type: :append_and_remove)
      )
    end

    update :unlink_question_from_knowledge do
      description("Unlink a question from its knowledge resource")
      require_atomic?(false)

      change(set_attribute(:knowledge_resource_id, nil))
    end

    # ============ Knowledge Resource Queries ============
    read :by_knowledge_resource do
      description("Get all questions for a specific knowledge resource")

      argument :knowledge_resource_id, :uuid do
        allow_nil?(false)
        description("Knowledge resource ID")
      end

      filter(expr(knowledge_resource_id == ^arg(:knowledge_resource_id)))

      prepare(fn query, _context ->
        Ash.Query.sort(query, question_level: :asc, position: :asc)
      end)
    end

    # ============ Destroy Actions ============
    destroy :destroy do
      description("Delete a question and its connections")
      accept([])

      change(fn changeset, context ->
        question_id = Ash.Changeset.get_attribute(changeset, :id)

        # Delete related connections first
        KgEdu.Knowledge.QuestionConnection
        |> Ash.Query.filter(source_question_id: question_id)
        |> Ash.bulk_destroy!(:destroy, %{}, tenant: context.tenant)

        KgEdu.Knowledge.QuestionConnection
        |> Ash.Query.filter(target_question_id: question_id)
        |> Ash.bulk_destroy!(:destroy, %{}, tenant: context.tenant)

        changeset
      end)
    end

    # ============ Batch Actions ============
    action :bulk_destroy_questions do
      description("Delete multiple questions by IDs")

      argument :question_ids, {:array, :uuid} do
        allow_nil?(false)
        description("List of question IDs to delete")
      end

      returns(:map)

      run(fn input, context ->
        question_ids = input.arguments.question_ids

        if Enum.empty?(question_ids) do
          {:ok, %{deleted_count: 0, message: "没有提供要删除的问题ID"}}
        else
          # 先删除相关的连接
          KgEdu.Knowledge.QuestionConnection
          |> Ash.Query.filter(
            expr(source_question_id in ^question_ids or target_question_id in ^question_ids)
          )
          |> Ash.bulk_destroy!(:destroy, %{}, tenant: context.tenant, authorize?: false)

          # 批量删除问题
          result =
            KgEdu.Knowledge.Question
            |> Ash.Query.filter(expr(id in ^question_ids))
            |> Ash.bulk_destroy!(:destroy, %{}, tenant: context.tenant, authorize?: false)

          case result do
            %Ash.BulkResult{status: :success, records: records} ->
              {:ok, %{deleted_count: length(records), message: "成功删除 #{length(records)} 个问题"}}

            %Ash.BulkResult{status: :partial_success, records: records, errors: errors} ->
              {:ok,
               %{
                 deleted_count: length(records),
                 errors: errors,
                 message: "部分删除成功，#{length(records)} 个问题已删除"
               }}

            %Ash.BulkResult{status: :error, errors: errors} ->
              {:error, %{message: "删除失败", errors: Enum.map(errors, &inspect/1)}}
          end
        end
      end)
    end

    # ============ Import/Export Actions ============
    action :import_questions_from_xlsx do
      description("Import questions from XLSX file")

      returns(:map)

      argument :excel_file, :string do
        allow_nil?(false)
        description("Base64 encoded XLSX file content")
      end

      argument :course_id, :uuid do
        allow_nil?(false)
        description("Course ID who is importing the questions")
      end

      argument :attributes, {:array, :atom} do
        allow_nil?(false)
      end

      run(fn input, context ->
        Logger.info("attributes are #{inspect(input.arguments.attributes)}")

        case KgEdu.Knowledge.Question.ImportFromExcel.parse_excel(
               input.arguments.excel_file,
               input.arguments.attributes,
               input.arguments.course_id,
               context.tenant
             ) do
          {:ok, result} when is_map(result) ->
            # 只返回必要的字段，避免序列化问题
            clean_result = %{
              success_count: result.success_count,
              failed_count: result.failed_count,
              errors: result.errors,
              questions:
                Enum.map(result.questions, fn q ->
                  %{
                    id: q.id,
                    title: q.title,
                    description: q.description,
                    question_level: q.question_level,
                    position: q.position,
                    course_id: q.course_id
                  }
                end)
            }

            # 如果有失败的记录，返回错误
            if result.failed_count > 0 do
              {:error,
               %{
                 message: "导入失败",
                 errors: result.errors,
                 failed_count: result.failed_count,
                 success_count: result.success_count
               }}
            else
              {:ok, clean_result}
            end

          {:ok, _} ->
            {:ok, %{success_count: 0, failed_count: 0, message: "No questions imported"}}

          {:error, reason} ->
            {:error, reason}
        end
      end)
    end

    action :export_question_template do
      description("Generate question template XLSX as base64")

      argument :created_by_id, :uuid do
        allow_nil?(false)
        description("User ID requesting the template")
      end

      run({KgEdu.Knowledge.Changes.ExportQuestionTemplate, []})
    end

    # ============ Batch Actions ============
    action :create_from_flow do
      description("Create questions from flow data")

      argument(:flow_data, :map, allow_nil?: false)
      argument(:course_id, :uuid, allow_nil?: false)

      run(fn input, context ->
        flow_data = input.arguments.flow_data
        course_id = input.arguments.course_id

        try do
          # Create questions from the flow data
          results =
            flow_data
            |> Enum.map(fn {level, questions} ->
              Enum.map(questions, fn question_data ->
                create_question_from_data(question_data, level, course_id, context.tenant)
              end)
            end)
            |> List.flatten()

          successful = Enum.count(results, fn {status, _} -> status == :ok end)
          failed = Enum.count(results, fn {status, _} -> status == :error end)

          if failed > 0 do
            {:error, "Created #{successful} questions, #{failed} failed"}
          else
            {:ok, "Successfully created #{successful} questions"}
          end
        rescue
          e ->
            {:error, "Failed to process flow data: #{Exception.message(e)}"}
        end
      end)
    end
  end

  policies do
    policy always() do
      authorize_if(always())
    end
  end

  multitenancy do
    strategy(:context)
  end

  attributes do
    uuid_primary_key(:id)

    attribute :title, :string do
      allow_nil?(false)
      public?(true)
      description("The question title displayed in the flow")
    end

    attribute :description, :string do
      allow_nil?(true)
      public?(true)
      description("Additional description or context for the question")
    end

    attribute :question_level, :atom do
      allow_nil?(false)
      constraints(one_of: [:global, :concept, :method])
      public?(true)
      description("The level of the question in the knowledge hierarchy")
    end

    attribute :position, :integer do
      allow_nil?(false)
      default(0)
      public?(true)
      description("Position within the question level for ordering")
    end

    attribute :tags, {:array, :string} do
      allow_nil?(true)
      default([])
      public?(true)
      description("Tags associated with the question")
    end

    attribute :created_by_id, :uuid do
      allow_nil?(true)
      public?(true)
    end

    attribute :difficulty, :integer do
      allow_nil?(true)
      default(1)
      public?(true)
      description("Question difficulty: 1 (easy), 2 (medium), 3 (hard)")
    end

    timestamps()
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      public?(true)
      allow_nil?(false)
    end

    belongs_to :created_by, KgEdu.Accounts.User do
      public?(true)
    end

    # Flow connections
    has_many :source_connections, KgEdu.Knowledge.QuestionConnection do
      public?(true)
      destination_attribute(:source_question_id)
      description("Connections from this question to other questions")
    end

    has_many :target_connections, KgEdu.Knowledge.QuestionConnection do
      public?(true)
      destination_attribute(:target_question_id)
      description("Connections to this question from other questions")
    end

    # Knowledge resource relationship
    belongs_to :knowledge_resource, KgEdu.Knowledge.Resource do
      public?(true)
      allow_nil?(true)
      description("Related knowledge resource")
    end
  end

  identities do
    identity(:unique_title_position_per_level, [:title, :question_level, :course_id])
  end

  # ============ Helper Functions ============

  defp create_question_from_data(question_data, level, course_id, tenant) do
    attrs = %{
      title: question_data["title"] || question_data[:title],
      description: question_data["description"] || question_data[:description],
      question_level: level,
      position: question_data["position"] || question_data[:position] || 0,
      tags: question_data["tags"] || question_data[:tags] || [],
      course_id: course_id
    }

    case KgEdu.Knowledge.Question.create_question(attrs, tenant: tenant) do
      {:ok, question} ->
        # Create connections if provided
        if question_data["connections"] || question_data[:connections] do
          create_question_connections(
            question,
            question_data["connections"] || question_data[:connections],
            tenant
          )
        end

        {:ok, question}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp create_question_connections(_question, _connections, _tenant) do
    # TODO: Implement connection creation
    # This would create QuestionConnection records with tenant context
    :ok
  end
end

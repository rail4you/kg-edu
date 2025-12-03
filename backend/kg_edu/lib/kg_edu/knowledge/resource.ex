defmodule KgEdu.Knowledge.Resource do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Ash.Query
  require Logger
  import Ecto.Query
  import Logger, only: [error: 1, info: 1]

  postgres do
    table "knowledge_resources"
    repo KgEdu.Repo

    references do
      reference :chapter, on_delete: :delete
      reference :exercises, on_delete: :delete
    end
  end

  multitenancy do
    strategy :context
  end

  json_api do
    type "knowledge_resource"
  end

  typescript do
    # Choose appropriate name
    type_name "Resource"
  end

  code_interface do
    # Basic CRUD
    define :get_knowledge_resource, action: :by_id
    define :list_knowledges, action: :read
    define :create_knowledge_resource, action: :create
    define :update_knowledge_resource, action: :update_knowledge_resource
    define :delete_knowledge_resource, action: :destroy
    define :bulk_destroy_knowledges, action: :bulk_destroy_knowledges
    define :delete_all_knowledges_by_course, action: :delete_all_knowledges_by_course
    define :delete_all_knowledge, args: [:course_id], action: :delete_all_knowledge

    # Course-related queries
    define :get_knowledge_resources_by_course, action: :by_course
    define :search_knowledge_resources, action: :search
    define :get_knowledge_resources_by_name_and_importance, action: :by_name_and_importance
    define :debug_list_resources, action: :debug_list

    # Hierarchy queries
    define :list_subjects, action: :list_subjects
    define :list_units_by_subject, action: :list_units_by_subject
    define :list_cells_by_unit, action: :list_cells_by_unit
    define :list_cells_by_subject, action: :list_cells_by_subject
    define :get_subject_with_units, action: :get_subject_with_units
    define :get_unit_with_cells, action: :get_unit_with_cells
    define :get_full_hierarchy, action: :get_full_hierarchy
    define :get_parent, action: :get_parent
    define :get_children, action: :get_children

    # Import actions
    define :import_knowledge_from_excel, action: :import_from_excel
    define :import_knowledge_from_llm, action: :import_from_llm
    define :import_knowledge_from_opml, action: :import_from_opml
    define :import_knowledge_from_xmind, action: :import_from_xmind
    define :upsert_subject, action: :upsert_subject
    define :upsert_unit, action: :upsert_unit
    define :get_by_name_and_course, action: :by_name_and_course
    define :get_by_any_name_and_course, action: :by_any_name_and_course
    define :bulk_update_importance_level, action: :bulk_update_importance_level
    define :get_course_learning_stats_by_student, action: :get_course_learning_stats_by_student
  end

  actions do
    defaults [:read]

    destroy :destroy do
      description "Destroy a knowledge resource and its dependent relations"
      require_atomic? false
      # Manually delete related records first
      change fn changeset, _context ->
        resource_id = Ash.Changeset.get_attribute(changeset, :id)
        knowledge_type = Ash.Changeset.get_attribute(changeset, :knowledge_type)

        # Cascade delete based on knowledge type
        case knowledge_type do
          :subject ->
            # Delete all units under this subject
            KgEdu.Knowledge.Resource.list_units_by_subject(%{subject_id: resource_id})
            |> case do
              {:ok, units} ->
                Enum.each(units, fn unit ->
                  KgEdu.Knowledge.Resource.delete_knowledge_resource(unit, authorize?: false)
                end)

              {:error, _} ->
                :ok
            end

            # Delete all direct knowledge cells under this subject
            KgEdu.Knowledge.Resource.list_cells_by_subject(%{subject_id: resource_id})
            |> case do
              {:ok, cells} ->
                Enum.each(cells, fn cell ->
                  KgEdu.Knowledge.Resource.delete_knowledge_resource(cell, authorize?: false)
                end)

              {:error, _} ->
                :ok
            end

          :knowledge_unit ->
            # Delete all knowledge cells under this unit
            KgEdu.Knowledge.Resource.list_cells_by_unit(%{unit_id: resource_id})
            |> case do
              {:ok, cells} ->
                Enum.each(cells, fn cell ->
                  KgEdu.Knowledge.Resource.delete_knowledge_resource(cell, authorize?: false)
                end)

              {:error, _} ->
                :ok
            end

          :knowledge_cell ->
            # Just delete itself (no cascading)
            :ok
        end

        # Delete incoming relations
        KgEdu.Knowledge.Relation.list_knowledge_relations(
          authorize?: false,
          query: [filter: [target_knowledge_id: resource_id]]
        )
        |> case do
          {:ok, relations} ->
            Enum.each(relations, fn relation ->
              KgEdu.Knowledge.Relation.delete_knowledge_relation(relation, authorize?: false)
            end)

          {:error, _} ->
            :ok
        end

        # Delete outgoing relations
        KgEdu.Knowledge.Relation.list_knowledge_relations(
          authorize?: false,
          query: [filter: [source_knowledge_id: resource_id]]
        )
        |> case do
          {:ok, relations} ->
            Enum.each(relations, fn relation ->
              KgEdu.Knowledge.Relation.delete_knowledge_relation(relation, authorize?: false)
            end)

          {:error, _} ->
            :ok
        end

        # Delete related files
        KgEdu.Courses.File.list_files(
          authorize?: false,
          query: [filter: [knowledge_resource_id: resource_id]]
        )
        |> case do
          {:ok, files} ->
            Enum.each(files, fn file ->
              KgEdu.Courses.File.delete_file(file, authorize?: false)
            end)

          {:error, _} ->
            :ok
        end

        # Delete related videos
        KgEdu.Courses.Video.list_videos(
          authorize?: false,
          query: [filter: [knowledge_resource_id: resource_id]]
        )
        |> case do
          {:ok, videos} ->
            Enum.each(videos, fn video ->
              KgEdu.Courses.Video.delete_video(video, authorize?: false)
            end)

          {:error, _} ->
            :ok
        end

        # Delete related homeworks
        KgEdu.Knowledge.Homework.list_homeworks(
          authorize?: false,
          query: [filter: [knowledge_resource_id: resource_id]]
        )
        |> case do
          {:ok, homeworks} ->
            Enum.each(homeworks, fn homework ->
              KgEdu.Knowledge.Homework.delete_homework(homework, authorize?: false)
            end)

          {:error, _} ->
            :ok
        end

        # Delete related questions
        KgEdu.Knowledge.Question.list_questions(
          authorize?: false,
          query: [filter: [knowledge_resource_id: resource_id]]
        )
        |> case do
          {:ok, questions} ->
            Enum.each(questions, fn question ->
              KgEdu.Knowledge.Question.delstroy_question(question, authorize?: false)
            end)

          {:error, _} ->
            :ok
        end

        changeset
      end
    end

    action :bulk_destroy_knowledges do
      description "Unenroll multiple students from a course"

      argument :course_id, :uuid do
        allow_nil? false
      end

      argument :knowledge_resource_ids, {:array, :uuid} do
        allow_nil? false
        description "List of student IDs to unenroll"
      end

      run fn input, context ->
        # Read all knowledge resources in tenant and filter manually
        case __MODULE__ |> Ash.read(tenant: context.tenant) do
          {:ok, resources} ->
            target_resources =
              resources
              |> Enum.filter(
                &(&1.course_id == input.arguments.course_id and
                    input.arguments.knowledge_resource_ids |> Enum.member?(&1.id))
              )

            # Destroy the filtered resources one by one
            case Enum.map(target_resources, fn resource ->
                   KgEdu.Knowledge.Resource.delete_knowledge_resource(resource,
                     tenant: context.tenant,
                     authorize?: false
                   )
                 end) do
              results ->
                case Enum.find(results, fn
                       {:error, _} -> true
                       _ -> false
                     end) do
                  nil -> :ok
                  {:error, reason} -> {:error, reason}
                end
            end

          {:error, reason} ->
            {:error, reason}
        end
      end
    end

    # action :delete_all_knowledges_by_course do
    #   description "Delete all knowledge resources for a course using cascade delete"

    #   argument :course_id, :uuid do
    #     allow_nil? false
    #     description "The course ID to delete all knowledge resources for"
    #   end

    #   run fn input, _context ->
    #     query =
    #       KgEdu.Knowledge.Resource
    #       |> Ash.Query.filter(expr(course_id == ^input.arguments.course_id))

    #     case Ash.bulk_destroy(query, :destroy, %{},
    #            return_errors?: true,
    #            strategy: [:stream, :atomic],
    #            return_records?: false) do
    #       %Ash.BulkResult{status: :success} ->
    #         :ok

    #       %Ash.BulkResult{status: :partial_success, errors: [_ | _] = errors} ->
    #         {:error, "Partial deletion completed with #{length(errors)} errors"}

    #       %Ash.BulkResult{status: :error, errors: errors} ->
    #         {:error, "Failed to delete knowledge resources: #{inspect(errors)}"}

    #       result ->
    #         {:error, "Unexpected result: #{inspect(result)}"}
    #     end
    #   end
    # end

    action :delete_all_knowledge do
      :ok
    end

    action :delete_all_knowledges_by_course do
      description "Delete all knowledge resources for a course using raw SQL"

      argument :course_id, :uuid do
        allow_nil? false
        description "The course ID to delete all knowledge resources for"
      end

      run fn input, context ->
        course_id = input.arguments.course_id

        # Read all knowledge resources in tenant and filter manually
        case __MODULE__ |> Ash.read(tenant: context.tenant) do
          {:ok, resources} ->
            target_resources =
              resources
              |> Enum.filter(&(&1.course_id == course_id))

            # Destroy the filtered resources one by one
            case Enum.map(target_resources, fn resource ->
                   KgEdu.Knowledge.Resource.delete_knowledge_resource(resource,
                     tenant: context.tenant,
                     authorize?: false
                   )
                 end) do
              results ->
                case Enum.find(results, fn
                       {:error, _} -> true
                       _ -> false
                     end) do
                  nil -> :ok
                  {:error, reason} -> {:error, reason}
                end
            end

          {:error, reason} ->
            {:error, "Failed to read knowledge resources: #{inspect(reason)}"}
        end
      end
    end

    # ============ Basic Queries ============
    read :by_id do
      description "Get a knowledge resource by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_course do
      description "Get knowledge resources for a specific course"
      argument :course_id, :uuid, allow_nil?: false
      filter expr(course_id == ^arg(:course_id))
    end

    read :search do
      description "Search knowledge resources by name"
      argument :query, :string, allow_nil?: false
      filter expr(contains(name, ^arg(:query)))
    end

    read :debug_list do
      description "Debug: List all knowledge resources for a course"
      argument :course_id, :uuid, allow_nil?: true

      prepare fn query, _context ->
        course_id_arg = Ash.Query.get_argument(query, :course_id)

        query
        |> then(fn q ->
          if course_id_arg, do: Ash.Query.filter(q, course_id == ^course_id_arg), else: q
        end)
        |> Ash.Query.sort(name: :asc)
      end
    end

    read :by_name_and_importance do
      description "Get knowledge resources by name (search) and importance level"
      argument :name, :string, allow_nil?: true
      argument :importance_level, :string, allow_nil?: true
      argument :course_id, :uuid, allow_nil?: true

      prepare fn query, _context ->
        name_arg = Ash.Query.get_argument(query, :name)
        importance_level_arg = Ash.Query.get_argument(query, :importance_level)
        course_id_arg = Ash.Query.get_argument(query, :course_id)

        query
        |> then(fn q ->
          if name_arg, do: Ash.Query.filter(q, contains(name, ^name_arg)), else: q
        end)
        |> then(fn q ->
          if importance_level_arg,
            do: Ash.Query.filter(q, importance_level == ^importance_level_arg),
            else: q
        end)
        |> then(fn q ->
          if course_id_arg, do: Ash.Query.filter(q, course_id == ^course_id_arg), else: q
        end)
      end
    end

    # ============ Hierarchy Queries - Level 1: Subjects ============
    read :list_subjects do
      description "List all subjects (top-level knowledge resources)"
      argument :course_id, :uuid, allow_nil?: true
      filter expr(knowledge_type == :subject and course_id == ^arg(:course_id))
    end

    read :get_subject_with_units do
      description "Get a subject with all its knowledge units loaded"
      get? true
      argument :subject_id, :uuid, allow_nil?: false

      filter expr(id == ^arg(:subject_id) and knowledge_type == :subject)

      prepare fn query, _context ->
        Ash.Query.load(query, child_units: [:child_cells])
      end
    end

    # ============ Hierarchy Queries - Level 2: Units ============
    read :list_units_by_subject do
      description "List all knowledge units for a specific subject"
      argument :subject_id, :uuid, allow_nil?: false

      filter expr(
               knowledge_type == :knowledge_unit and
                 parent_subject_id == ^arg(:subject_id)
             )

      prepare fn query, _context ->
        Ash.Query.sort(query, unit: :asc, name: :asc)
      end
    end

    read :get_unit_with_cells do
      description "Get a knowledge unit with all its cells loaded"
      get? true
      argument :unit_id, :uuid, allow_nil?: false

      filter expr(id == ^arg(:unit_id) and knowledge_type == :knowledge_unit)

      prepare fn query, _context ->
        Ash.Query.load(query, [:child_cells, :parent_subject])
      end
    end

    # ============ Hierarchy Queries - Level 3: Cells ============
    read :list_cells_by_unit do
      description "List all knowledge cells for a specific knowledge unit"
      argument :unit_id, :uuid, allow_nil?: false

      filter expr(
               knowledge_type == :knowledge_cell and
                 parent_unit_id == ^arg(:unit_id)
             )

      prepare fn query, _context ->
        Ash.Query.sort(query, name: :asc)
      end
    end

    read :list_cells_by_subject do
      description "List all knowledge cells directly under a subject (no unit)"
      argument :subject_id, :uuid, allow_nil?: false

      filter expr(
               knowledge_type == :knowledge_cell and
                 parent_subject_id == ^arg(:subject_id) and
                 is_nil(parent_unit_id)
             )

      prepare fn query, _context ->
        Ash.Query.sort(query, name: :asc)
      end
    end

    # ============ Hierarchy Navigation ============
    read :get_parent do
      description "Get the parent of a knowledge resource"
      get? true
      argument :id, :uuid, allow_nil?: false

      prepare fn query, _context ->
        query
        |> Ash.Query.filter(expr(id == ^arg(:id)))
        |> Ash.Query.load([:parent_subject, :parent_unit])
      end
    end

    read :get_children do
      description "Get all children of a knowledge resource"
      argument :id, :uuid, allow_nil?: false

      argument :type, :atom do
        constraints one_of: [:subject, :knowledge_unit, :knowledge_cell]
      end

      prepare fn query, context ->
        resource_type = Ash.Query.get_argument(query, :type)
        resource_id = Ash.Query.get_argument(query, :id)

        case resource_type do
          :subject ->
            # Return both units and cells that belong to this subject
            query
            |> Ash.Query.filter(
              expr(
                (parent_subject_id == ^resource_id and
                   knowledge_type == :knowledge_unit) or
                  (knowledge_type == :knowledge_cell and is_nil(parent_unit_id))
              )
            )

          :knowledge_unit ->
            # Return cells that belong to this unit
            query
            |> Ash.Query.filter(
              expr(
                knowledge_type == :knowledge_cell and
                  parent_unit_id == ^resource_id
              )
            )

          :knowledge_cell ->
            # Cells don't have children
            Ash.Query.filter(query, false)
        end
        |> Ash.Query.sort(knowledge_type: :asc, name: :asc)
      end
    end

    read :get_full_hierarchy do
      description "Get the full hierarchy for a course (subjects with units and cells)"
      argument :course_id, :uuid, allow_nil?: false

      filter expr(
               course_id == ^arg(:course_id) and
                 knowledge_type == :subject
             )

      prepare fn query, _context ->
        query
        |> Ash.Query.load(
          child_units: [
            :child_cells
          ],
          direct_cells: [],
          subject_cells: []
        )
        |> Ash.Query.sort(subject: :asc, name: :asc)
      end
    end

    # ============ Create Actions ============
    create :create do
      description "Create a new knowledge resource"

      accept [
        :name,
        :description,
        :course_id,
        :chapter_id,
        :subject,
        :unit,
        :parent_subject_id,
        :parent_unit_id,
        :importance_level,
        :knowledge_type
      ]

      validate fn changeset, _context ->
        knowledge_type = Ash.Changeset.get_attribute(changeset, :knowledge_type)
        parent_subject_id = Ash.Changeset.get_attribute(changeset, :parent_subject_id)
        parent_unit_id = Ash.Changeset.get_attribute(changeset, :parent_unit_id)

        case knowledge_type do
          :subject ->
            # Subjects should not have parents
            if not is_nil(parent_subject_id) || not is_nil(parent_unit_id) do
              {:error, "Subjects cannot have parent resources"}
            else
              :ok
            end

          :knowledge_unit ->
            # Units must have a parent subject, no parent unit
            cond do
              is_nil(parent_subject_id) ->
                {:error, "Knowledge units must have a parent subject"}

              not is_nil(parent_unit_id) ->
                {:error, "Knowledge units cannot have a parent unit"}

              true ->
                :ok
            end

          :knowledge_cell ->
            # Cells must have either a parent subject or parent unit (not both)
            cond do
              is_nil(parent_subject_id) and is_nil(parent_unit_id) ->
                {:error, "Knowledge cells must have either a parent subject or parent unit"}

              # not is_nil(parent_subject_id) and not is_nil(parent_unit_id) ->
              #   {:error, "Knowledge cells cannot have both a parent subject and parent unit"}
              true ->
                :ok
            end
        end
      end
    end

    # ============ Update Actions ============
    update :update_knowledge_resource do
      accept [:name, :importance_level, :description]
    end

    # ============ Import Actions ============
    read :by_name_and_course do
      description "Get a knowledge resource by name and course"
      get? true
      argument :name, :string, allow_nil?: false
      argument :knowledge_type, :atom, allow_nil?: true
      argument :course_id, :uuid, allow_nil?: false

      filter expr(
               name == ^arg(:name) and knowledge_type == ^arg(:knowledge_type) and
                 course_id == ^arg(:course_id)
             )
    end

    read :by_any_name_and_course do
      description "Get a knowledge resource by name and course"
      get? true
      argument :name, :string, allow_nil?: false
      # argument :knowledge_type, :atom, allow_nil?: true
      argument :course_id, :uuid, allow_nil?: false

      filter expr(
               name == ^arg(:name) and knowledge_type in [:subject, :unit, :knowledge_cell] and
                 course_id == ^arg(:course_id)
             )
    end

    create :upsert_subject do
      description "Create or update a subject"
      accept [:name, :course_id, :description, :importance_level]

      argument :name, :string, allow_nil?: false
      argument :course_id, :uuid, allow_nil?: false
      argument :description, :string, allow_nil?: true
      argument :importance_level, :atom, allow_nil?: true, default: :normal

      change set_attribute(:knowledge_type, :subject)
      change set_attribute(:subject, arg(:name))

      change fn changeset, _context ->
        name = Ash.Changeset.get_argument(changeset, :name)
        course_id = Ash.Changeset.get_argument(changeset, :course_id)

        # Check if subject already exists
        case KgEdu.Knowledge.Resource.by_name_and_course(name, course_id) do
          {:ok, existing_subject} ->
            # Update existing subject
            existing_subject
            |> Ash.Changeset.for_update(:update_knowledge_resource, %{
              description: Ash.Changeset.get_argument(changeset, :description),
              unit: Ash.Changeset.get_argument(changeset, :unit)
            })
            |> Ash.Changeset.set_attribute(
              :importance_level,
              Ash.Changeset.get_argument(changeset, :importance_level)
            )

          _ ->
            # Create new subject
            changeset
            |> Ash.Changeset.change_attribute(:name, name)
            |> Ash.Changeset.change_attribute(
              :description,
              Ash.Changeset.get_argument(changeset, :description)
            )
            |> Ash.Changeset.change_attribute(
              :importance_level,
              Ash.Changeset.get_argument(changeset, :importance_level)
            )
        end
      end
    end

    create :upsert_unit do
      description "Create or update a knowledge unit"
      accept [:name, :course_id, :parent_subject_id, :description, :importance_level]

      argument :name, :string, allow_nil?: false
      argument :course_id, :uuid, allow_nil?: false
      argument :parent_subject_id, :uuid, allow_nil?: false
      argument :description, :string, allow_nil?: true
      argument :importance_level, :atom, allow_nil?: true, default: :normal

      change set_attribute(:knowledge_type, :knowledge_unit)
      change set_attribute(:unit, arg(:name))
      change set_attribute(:parent_subject_id, arg(:parent_subject_id))

      change fn changeset, _context ->
        name = Ash.Changeset.get_argument(changeset, :name)
        course_id = Ash.Changeset.get_argument(changeset, :course_id)
        parent_subject_id = Ash.Changeset.get_argument(changeset, :parent_subject_id)

        # Check if unit already exists
        case KgEdu.Knowledge.Resource.by_name_and_course(name, course_id) do
          {:ok, existing_unit} ->
            # Update existing unit
            existing_unit
            |> Ash.Changeset.for_update(:update_knowledge_resource, %{
              description: Ash.Changeset.get_argument(changeset, :description),
              unit: Ash.Changeset.get_argument(changeset, :unit)
            })
            |> Ash.Changeset.set_attribute(
              :importance_level,
              Ash.Changeset.get_argument(changeset, :importance_level)
            )

          _ ->
            # Create new unit
            changeset
            |> Ash.Changeset.change_attribute(:name, name)
            |> Ash.Changeset.change_attribute(
              :description,
              Ash.Changeset.get_argument(changeset, :description)
            )
            |> Ash.Changeset.change_attribute(
              :importance_level,
              Ash.Changeset.get_argument(changeset, :importance_level)
            )
        end
      end
    end

    action :import_from_excel do
      description "Import knowledge resources from Excel file"

      argument :excel_data, :string, allow_nil?: false
      argument :course_id, :uuid, allow_nil?: false

      run fn input, context ->
        case KgEdu.ExcelParser.parse_from_base64(input.arguments.excel_data, 0) do
          {:ok, %{sheet: knowledge_data}} ->
            case process_knowledge_import(
                   knowledge_data,
                   input.arguments.course_id,
                   context.tenant
                 ) do
              {:ok, _} -> :ok
              {:error, reason} -> {:error, "Failed to parse Excel file: #{reason}"}
            end

          {:error, reason} ->
            {:error, "Failed to parse Excel file: #{reason}"}
        end
      end
    end

    action :import_from_llm do
      description "Import knowledge resources and relations from text using LLM analysis"

      argument :text, :string, allow_nil?: false
      argument :course_id, :uuid, allow_nil?: false

      run fn input, context ->
        case KgEdu.Knowledge.ImportFromLLM.import_from_text(
               input.arguments.text,
               input.arguments.course_id,
               actor: context.actor,
               authorize?: context.authorize?,
               tenant: context.tenant
             ) do
          {:ok, result} -> :ok
          {:error, reason} -> {:error, reason}
        end
      end
    end

    action :import_from_opml do
      description "Import knowledge resources from OPML XML data"

      argument :opml_data, :string, allow_nil?: false
      argument :course_id, :uuid, allow_nil?: false

      run fn input, context ->
        case KgEdu.OpmlParser.parse_from_text(input.arguments.opml_data) do
          {:ok, knowledge_data} ->
            case process_opml_import(knowledge_data, input.arguments.course_id, context.tenant) do
              {:ok, _} -> :ok
              {:error, reason} -> {:error, "Failed to process OPML data: #{reason}"}
            end

          {:error, reason} ->
            {:error, "Failed to parse OPML data: #{reason}"}
        end
      end
    end

    action :import_from_xmind do
      description "Import knowledge resources from XMind file"

      argument :xmind_data, :string, allow_nil?: false
      argument :course_id, :uuid, allow_nil?: false

      run fn input, context ->
        Logger.info("context: #{inspect(context)}")
        # Determine tenant context - use provided tenant or detect it as fallback
        tenant = context.tenant

        if is_nil(tenant) do
          {:error, "Course not found and tenant could not be determined"}
        else
          # First validate that the course exists in the determined tenant using raw SQL
          # Course exists, proceed with XMind import
          case KgEdu.XmindParser.parse_from_base64(input.arguments.xmind_data) do
            {:ok, xmind_data} ->
              case process_xmind_import(xmind_data, input.arguments.course_id, tenant) do
                {:ok, _} -> :ok
                {:error, reason} -> {:error, "Failed to process XMind data: #{reason}"}
              end

            {:error, reason} ->
              {:error, "Failed to parse XMind file: #{reason}"}
          end
        end
      end
    end

    action :bulk_update_importance_level do
      description "Bulk update importance levels for multiple knowledge resources in a course"

      argument :course_id, :uuid do
        allow_nil? false
        description "The course ID to validate knowledge resources belong to"
      end

      argument :knowledge_resource_ids, {:array, :uuid} do
        allow_nil? false
        description "List of knowledge resource IDs to update"
      end

      argument :importance_level, :atom do
        allow_nil? false
        constraints one_of: [:hard, :important, :normal]
        description "New importance level to set"
      end

      run fn input, context ->
        # Read all knowledge resources in tenant and filter manually
        case __MODULE__ |> Ash.read(tenant: context.tenant) do
          {:ok, resources} ->
            target_resources =
              resources
              |> Enum.filter(
                &(&1.course_id == input.arguments.course_id and
                    input.arguments.knowledge_resource_ids |> Enum.member?(&1.id))
              )

            # Update the filtered resources one by one
            case Enum.map(target_resources, fn resource ->
                   KgEdu.Knowledge.Resource.update_knowledge_resource(
                     resource,
                     %{
                       importance_level: input.arguments.importance_level
                     },
                     tenant: context.tenant
                   )
                 end) do
              results ->
                errors =
                  Enum.filter(results, fn
                    {:error, _} -> true
                    _ -> false
                  end)

                if length(errors) == 0 do
                  :ok
                else
                  {:error, "Failed to update #{length(errors)} resources: #{inspect(errors)}"}
                end
            end

          {:error, reason} ->
            {:error, "Failed to read knowledge resources: #{inspect(reason)}"}
        end
      end
    end

    action :get_course_learning_stats_by_student, :map do
      description "Get learning statistics for all knowledge resources in a course, grouped by student"

      argument :course_id, :uuid do
        allow_nil? false
        description "Course ID to get learning statistics for"
      end

      run fn input, context ->
        course_id = input.arguments.course_id
        tenant = context.tenant

        # Get all knowledge resources for the course with their relationships
        Logger.info("Getting knowledge resources for course_id: #{course_id}, tenant: #{tenant}")
        case get_knowledge_resources_by_course(%{course_id: course_id},
               tenant: tenant,
               authorize?: false,
               actor: nil,
               load: [:videos, :files, :homeworks, :exercises]
             ) do
          {:ok, knowledge_resources} ->
            Logger.info("Found #{length(knowledge_resources)} knowledge resources for course #{course_id}")

            # Collect all material IDs from all knowledge resources in the course
            all_video_ids =
              knowledge_resources
              |> Enum.flat_map(fn resource -> (resource.videos || []) |> Enum.map(& &1.id) end)

            all_file_ids =
              knowledge_resources
              |> Enum.flat_map(fn resource -> (resource.files || []) |> Enum.map(& &1.id) end)

            all_homework_ids =
              knowledge_resources
              |> Enum.flat_map(fn resource -> (resource.homeworks || []) |> Enum.map(& &1.id) end)

            all_exercise_ids =
              knowledge_resources
              |> Enum.flat_map(fn resource -> (resource.exercises || []) |> Enum.map(& &1.id) end)

            Logger.info("Course materials - Videos: #{length(all_video_ids)}, Files: #{length(all_file_ids)}, Homework: #{length(all_homework_ids)}, Exercises: #{length(all_exercise_ids)}")

            # Get all activity logs for this tenant
            case KgEdu.Activity.ActivityLog.list_activity_logs(
                   tenant: tenant,
                   authorize?: false,
                   actor: nil
                 ) do
              {:ok, all_logs} ->
                Logger.info("Found #{length(all_logs)} total activity logs")

                # Filter logs for materials belonging to this course's knowledge resources
                course_logs =
                  all_logs
                  |> Enum.filter(fn log ->
                    (log.resource_type in ["KgEdu.Courses.File", "File"] and log.resource_id in all_file_ids) or
                    (log.resource_type in ["KgEdu.Courses.Video", "Video"] and log.resource_id in all_video_ids) or
                    (log.resource_type in ["KgEdu.Knowledge.Homework", "Homework"] and log.resource_id in all_homework_ids) or
                    (log.resource_type in ["KgEdu.Knowledge.Exercise", "Exercise"] and log.resource_id in all_exercise_ids)
                  end)

                Logger.info("Found #{length(course_logs)} activity logs for course materials")

                # Group logs by student
                student_logs_map = Enum.group_by(course_logs, & &1.user_id)

                # Calculate totals for the course
                total_videos = length(all_video_ids)
                total_files = length(all_file_ids)
                total_exercises = length(all_exercise_ids)
                total_homeworks = length(all_homework_ids)

                # Generate stats for each student
                Logger.info("student_logs_map: #{inspect(student_logs_map)}")
                student_stats =
                  student_logs_map
                  |> Enum.map(fn {student_id, logs} ->
                    # Count completed activities by type (unique materials per student)
                    completed_videos =
                      logs
                      |> Enum.filter(&(&1.resource_type in ["KgEdu.Courses.Video", "Video"] and &1.action_type in [:video_view, :view]))
                      |> Enum.map(& &1.resource_id)
                      |> Enum.uniq()
                      |> length()

                    completed_files =
                      logs
                      |> Enum.filter(&(&1.resource_type in ["KgEdu.Courses.File", "File"] and &1.action_type in [:file_view, :view, :download]))
                      |> Enum.map(& &1.resource_id)
                      |> Enum.uniq()
                      |> length()

                    completed_exercises =
                      logs
                      |> Enum.filter(&(&1.resource_type in ["KgEdu.Knowledge.Exercise", "Exercise"] and &1.action_type in [:exercise_submit, :submit, :complete]))
                      |> Enum.map(& &1.resource_id)
                      |> Enum.uniq()
                      |> length()

                    completed_homework =
                      logs
                      |> Enum.filter(&(&1.resource_type in ["KgEdu.Knowledge.Homework", "Homework"] and &1.action_type in [:homework_submit, :submit, :complete]))
                      |> Enum.map(& &1.resource_id)
                      |> Enum.uniq()
                      |> length()

                    # Calculate completion ratios
                    video_completion = if total_videos > 0, do: completed_videos / total_videos, else: 0.0
                    file_completion = if total_files > 0, do: completed_files / total_files, else: 0.0
                    exercise_completion = if total_exercises > 0, do: completed_exercises / total_exercises, else: 0.0
                    homework_completion = if total_homeworks > 0, do: completed_homework / total_homeworks, else: 0.0

                    total_completed = completed_videos + completed_files + completed_exercises + completed_homework
                    total_resources = total_videos + total_files + total_exercises + total_homeworks
                    overall_completion = if total_resources > 0, do: total_completed / total_resources, else: 0.0

                    %{
                      student_id: student_id,
                      course_id: course_id,
                      videos: %{
                        completed: completed_videos,
                        total: total_videos,
                        completion_ratio: video_completion
                      },
                      files: %{
                        completed: completed_files,
                        total: total_files,
                        completion_ratio: file_completion
                      },
                      exercises: %{
                        completed: completed_exercises,
                        total: total_exercises,
                        completion_ratio: exercise_completion
                      },
                      homeworks: %{
                        completed: completed_homework,
                        total: total_homeworks,
                        completion_ratio: homework_completion
                      },
                      overall: %{
                        total_completed: total_completed,
                        total_resources: total_resources,
                        completion_ratio: overall_completion
                      }
                    }
                  end)

                Logger.info("student_stats result: #{inspect(student_stats)}")
                Logger.info("About to return {:ok, student_stats}")

                result = {:ok, student_stats}
                Logger.info("Final result: #{inspect(result)}")

                # Ash Framework generic actions must return {:ok, result}
                final_result = {:ok, student_stats}
                Logger.info("Final result (Ash format): #{inspect(final_result)}")
                final_result

              {:error, reason} ->
                Logger.error("Failed to get activity logs: #{inspect(reason)}")
                {:error, "Failed to get activity logs: #{inspect(reason)}"}
            end

          {:error, reason} ->
            Logger.error("Failed to get knowledge resources: #{inspect(reason)}")
            {:error, "Failed to get knowledge resources: #{inspect(reason)}"}
        end
      end
    end
  end

  policies do
    policy always() do
      authorize_if always()
    end
  end

  multitenancy do
    strategy :context
  end

  attributes do
    uuid_primary_key :id

    # Knowledge hierarchy type
    attribute :knowledge_type, :atom do
      allow_nil? false
      constraints one_of: [:subject, :knowledge_unit, :knowledge_cell]
      default :knowledge_cell
      public? true
      description "The type of knowledge resource in the hierarchy"
    end

    # Subject name (for grouping, required for subject type)
    attribute :subject, :string do
      allow_nil? true
      public? true
      description "Subject name (required for subject type resources)"
    end

    # Unit name (for grouping, required for knowledge_unit type)
    attribute :unit, :string do
      allow_nil? true
      public? true
      description "Unit name (required for knowledge_unit type resources)"
    end

    # Importance level (renamed from knowlege_type)
    attribute :importance_level, :string do
      allow_nil? false
      # constraints one_of: [:hard, :important, :normal]
      default ""
      public? true
      description "Importance level of this knowledge resource"
    end

    attribute :name, :string do
      allow_nil? false
      # constraints min_length: 3, max_length: 100
      public? true
    end

    attribute :description, :string do
      allow_nil? true
      # constraints max_length: 1000
      public? true
    end

    timestamps()
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      public? true
      allow_nil? false
    end

    belongs_to :chapter, KgEdu.Courses.Chapter do
      public? true
      allow_nil? true
      description "Chapter this knowledge resource belongs to"
    end

    belongs_to :created_by, KgEdu.Accounts.User do
      public? true
    end

    # ============ Hierarchy Relationships ============

    # Parent relationships
    belongs_to :parent_subject, __MODULE__ do
      public? true
      allow_nil? true
      description "Parent subject (for units and cells that belong to a subject)"
    end

    belongs_to :parent_unit, __MODULE__ do
      public? true
      allow_nil? true
      description "Parent unit (for cells that belong to a unit)"
    end

    # Children relationships
    has_many :child_units, __MODULE__ do
      public? true
      destination_attribute :parent_subject_id
      filter expr(knowledge_type == :knowledge_unit)
      description "Knowledge units that belong to this subject"
    end

    has_many :child_cells, __MODULE__ do
      public? true
      destination_attribute :parent_unit_id
      filter expr(knowledge_type == :knowledge_cell)
      description "Knowledge cells that belong to this unit"
    end

    has_many :direct_cells, __MODULE__ do
      public? true
      destination_attribute :parent_subject_id
      filter expr(knowledge_type == :knowledge_cell and is_nil(parent_unit_id))
      description "Knowledge cells that belong directly to this subject (no unit)"
    end

    has_many :subject_cells, __MODULE__ do
      public? true
      destination_attribute :parent_subject_id
      filter expr(knowledge_type == :knowledge_cell)
      description "All knowledge cells that belong to this subject (regardless of unit)"
    end

    # ============ Other Relationships ============

    has_many :outgoing_relations, KgEdu.Knowledge.Relation do
      public? true
      destination_attribute :source_knowledge_id
    end

    has_many :incoming_relations, KgEdu.Knowledge.Relation do
      public? true
      destination_attribute :target_knowledge_id
    end

    has_many :files, KgEdu.Courses.File do
      public? true
      destination_attribute :knowledge_resource_id
    end

    has_many :videos, KgEdu.Courses.Video do
      public? true
      destination_attribute :knowledge_resource_id
      description "Videos associated with this knowledge resource"
    end

    has_many :homeworks, KgEdu.Knowledge.Homework do
      public? true
      destination_attribute :knowledge_resource_id
      description "Homeworks related to this knowledge resource"
    end

    has_many :exercises, KgEdu.Knowledge.Exercise do
      public? true
      destination_attribute :knowledge_resource_id
      description "Exercises related to this knowledge resource"
    end
  end

  # identities do
  #   identity :unique_name_per_course, [:name, :course_id]
  # end

  # ============ Import Implementation ============

  def import_from_excel(input, context) do
    import_kg_from_excel(input.excel_base64, input.course_id, context)
  end

  def process_opml_import(knowledge_data, course_id, tenant) do
    # Track created subjects and units for parent relationships
    subjects = %{}
    units = %{}

    # Process each item from OPML data
    result =
      Enum.reduce_while(
        knowledge_data,
        {:ok, %{subjects: subjects, units: units, tenant: tenant}},
        fn item, {:ok, acc} ->
          case process_opml_item(item, course_id, acc) do
            {:ok, new_acc} -> {:cont, {:ok, new_acc}}
            {:error, reason} -> {:halt, {:error, reason}}
          end
        end
      )

    case result do
      {:ok, _} ->
        {:ok, "Successfully imported #{length(knowledge_data)} knowledge resources from OPML"}

      {:error, reason} ->
        {:error, reason}
    end
  end

  def process_xmind_import(xmind_data, course_id, tenant) do
    # Convert XMind data to knowledge resources format
    case KgEdu.XmindParser.convert_to_knowledge_resources(xmind_data, course_id) do
      {:ok, knowledge_resources} ->
        # Process each knowledge resource
        result =
          Enum.reduce_while(
            knowledge_resources,
            {:ok, %{created: 0, skipped: 0, subjects: %{}, units: %{}, tenant: tenant}},
            fn resource_attrs, {:ok, acc} ->
              case process_xmind_resource(resource_attrs, course_id, acc) do
                {:ok, new_acc} -> {:cont, {:ok, new_acc}}
                {:error, reason} -> {:halt, {:error, reason}}
              end
            end
          )

        case result do
          {:ok, %{created: created, skipped: skipped}} ->
            {:ok,
             "Successfully imported #{created} knowledge resources from XMind (skipped #{skipped} existing)"}

          {:error, reason} ->
            {:error, reason}
        end

      {:error, reason} ->
        {:error, "Failed to convert XMind data: #{reason}"}
    end
  end

  defp process_xmind_resource(resource_attrs, course_id, acc) do
    # Extract data from XMind resource
    subject_name = resource_attrs.subject || "General"
    unit_name = resource_attrs.unit
    knowledge_name = resource_attrs.name

    # Skip if knowledge name is missing
    if is_nil(knowledge_name) or knowledge_name == "" do
      {:ok, acc}
    else
      # Process or create subject if needed
      case create_or_get_subject(subject_name, course_id, acc) do
        {:ok, subject_id, new_acc} ->
          case create_or_get_unit(unit_name, course_id, subject_id, new_acc) do
            {:ok, unit_id, new_acc} ->
              # Check if resource already exists
              case get_by_name_and_course(
                     %{
                       name: knowledge_name,
                       knowledge_type: resource_attrs.knowledge_type,
                       course_id: course_id
                     },
                     tenant: acc.tenant,
                     authorize?: false
                   ) do
                {:ok, _existing} ->
                  # Resource already exists, skip it
                  final_acc = %{new_acc | skipped: new_acc.skipped + 1}
                  {:ok, final_acc}

                {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Query.NotFound{}]}} ->
                  # Resource doesn't exist, create it with proper parent relationships
                  resource_with_parents = %{
                    resource_attrs
                    | parent_subject_id: subject_id,
                      parent_unit_id: unit_id
                  }

                  case create_resource_record(resource_with_parents, acc.tenant,
                         authorize?: false
                       ) do
                    {:ok, _resource} ->
                      final_acc = %{new_acc | created: new_acc.created + 1}
                      {:ok, final_acc}

                    {:error, reason} ->
                      # Error creating resource, but continue processing others
                      Logger.error(
                        "Failed to create knowledge resource '#{knowledge_name}': #{inspect(reason)}"
                      )

                      final_acc = %{new_acc | skipped: new_acc.skipped + 1}
                      {:ok, final_acc}
                  end

                {:error, reason} ->
                  # Error checking existing resource, skip it
                  Logger.error("Error checking existing knowledge resource: #{inspect(reason)}")
                  final_acc = %{new_acc | skipped: new_acc.skipped + 1}
                  {:ok, final_acc}
              end

            {:error, reason} ->
              # Error creating unit, skip this resource
              Logger.error("Failed to create unit: #{inspect(reason)}")
              final_acc = %{new_acc | skipped: new_acc.skipped + 1}
              {:ok, final_acc}
          end

        {:error, reason} ->
          # Error creating subject, skip this resource
          Logger.error("Failed to create subject: #{inspect(reason)}")
          final_acc = %{acc | skipped: acc.skipped + 1}
          {:ok, final_acc}
      end
    end
  end

  defp process_opml_item(item, course_id, acc) do
    # Extract data from OPML item
    subject_name = Map.get(item, :subject, "General")
    unit_name = Map.get(item, :unit, nil)
    knowledge_name = Map.get(item, :title, "")
    description = Map.get(item, :description, "")

    # Skip if knowledge name is missing
    if is_nil(knowledge_name) or knowledge_name == "" do
      {:ok, acc}
    else
      # Process or create subject if needed
      with {:ok, subject_id, _} = create_or_get_subject(subject_name, course_id, acc),
           {:ok, unit_id, _} = create_or_get_unit(unit_name, course_id, subject_id, acc) do
        # Create the knowledge resource
        knowledge_attrs = %{
          subject: subject_name,
          unit: unit_name || "",
          name: knowledge_name,
          description: description,
          knowledge_type: :knowledge_cell,
          course_id: course_id,
          parent_subject_id: subject_id,
          parent_unit_id: unit_id
        }

        # Check if knowledge resource already exists
        case get_by_name_and_course(
               %{
                 name: knowledge_name,
                 knowledge_type: :knowledge_cell,
                 course_id: course_id
               },
               tenant: acc.tenant
             ) do
          {:ok, _existing} ->
            # Resource already exists, skip it
            {:ok, acc}

          {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Query.NotFound{}]}} ->
            # Resource doesn't exist, create it
            case create_resource_record(knowledge_attrs, acc.tenant) do
              {:ok, _knowledge} ->
                {:ok, acc}

              {:error, _reason} ->
                # Resource likely already exists or there's another issue, skip it
                {:ok, acc}
            end

          {:error, _reason} ->
            # Error checking existing resource, skip it
            {:ok, acc}
        end
      end
    end
  end

  def import_kg_from_excel(excel_base64, course_id, context) do
    case KgEdu.ExcelParser.parse_from_base64(excel_base64) do
      {:ok, %{sheet1: knowledge_data}} ->
        process_knowledge_import(knowledge_data, course_id, context)

      {:error, reason} ->
        {:error, "Failed to parse Excel file: #{reason}"}
    end
  end

  def process_knowledge_import(knowledge_data, course_id, tenant) do
    # Track created subjects and units for parent relationships
    subjects = %{}
    units = %{}

    # Process each row of knowledge data
    result =
      Enum.reduce_while(
        knowledge_data,
        {:ok, %{subjects: subjects, units: units, tenant: tenant}},
        fn row, {:ok, acc} ->
          case process_knowledge_row(row, course_id, acc) do
            {:ok, new_acc} -> {:cont, {:ok, new_acc}}
            {:error, reason} -> {:halt, {:error, reason}}
          end
        end
      )

    case result do
      {:ok, _} ->
        {:ok, "Successfully imported #{length(knowledge_data)} knowledge resources"}

      # IO.inspect("Successfully imported #{length(knowledge_data)} knowledge resources")
      # {:ok, :ok}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp process_knowledge_row(row, course_id, acc) when length(row) >= 5 do
    # Extract row data: course, subject, unit, name, description, important_level, knowledge_type (optional)
    [
      _course_name,
      subject_name,
      unit_name,
      knowledge_name,
      description
      # importance_level
      # _knowledge_type_rest
    ] = row

    # _knowledge_type = List.first(knowledge_type_rest) || nil

    # Skip row if knowledge name is missing
    if is_nil(knowledge_name) or knowledge_name == "" do
      {:ok, acc}
    else
      # Process or create subject if needed
      with {:ok, subject_id, _} = create_or_get_subject(subject_name, course_id, acc),
           {:ok, unit_id, _} = create_or_get_unit(unit_name, course_id, subject_id, acc) do
        # Create the knowledge resource

        # Create the knowledge resource
        knowledge_attrs = %{
          subject: subject_name,
          unit: unit_name,
          name: knowledge_name,
          description: description,
          # importance_level: parse_importance_level(importance_level),
          knowledge_type: :knowledge_cell,
          course_id: course_id,
          parent_subject_id: subject_id,
          parent_unit_id: unit_id
        }

        # Check if knowledge resource already exists
        case get_by_name_and_course(
               %{
                 name: knowledge_name,
                 knowledge_type: :knowledge_cell,
                 course_id: course_id
               },
               tenant: acc.tenant
             ) do
          {:ok, _existing} ->
            # Resource already exists, skip it
            {:ok, acc}

          {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Query.NotFound{}]}} ->
            # Resource doesn't exist, create it
            case create_resource_record(knowledge_attrs, acc.tenant) do
              {:ok, _knowledge} ->
                {:ok, acc}

              {:error, _reason} ->
                # Resource likely already exists or there's another issue, skip it
                {:ok, acc}
            end

          {:error, _reason} ->
            # Error checking existing resource, skip it
            {:ok, acc}
        end
      end
    end
  end

  defp process_knowledge_row(row, _course_id, _acc) do
    {:error, "Invalid row format: #{inspect(row)}. Expected at least 6 columns."}
  end

  defp create_or_get_subject(subject_name, course_id, acc) do
    case get_by_name_and_course(
           %{
             name: subject_name,
             knowledge_type: :subject,
             course_id: course_id
           },
           tenant: acc.tenant,
           authorize?: false
         ) do
      {:ok, subject} ->
        {:ok, subject.id, acc}

      {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Query.NotFound{}]}} ->
        # Create new subject
        subject_attrs = %{
          name: subject_name,
          subject: subject_name,
          knowledge_type: :subject,
          course_id: course_id,
          importance_level: :normal
        }

        case create_resource_record(subject_attrs, acc.tenant, authorize?: false) do
          {:ok, subject} ->
            new_acc = %{acc | subjects: Map.put(acc.subjects, subject_name, subject.id)}
            {:ok, subject.id, new_acc}

          {:error, reason} ->
            {:error, reason}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp create_or_get_unit(unit_name, course_id, subject_id, acc) do
    # Check if unit already exists
    if unit_name == nil or unit_name == "" do
      {:ok, nil, acc}
    else
      IO.inspect("Looking for unit '#{unit_name}' under subject ID #{subject_id}")

      case list_units_by_subject(%{subject_id: subject_id}, tenant: acc.tenant, authorize?: false) do
        {:ok, units} ->
          case Enum.find(units, fn unit -> unit.unit == unit_name end) do
            nil ->
              # Create new unit
              unit_attrs = %{
                name: unit_name,
                unit: unit_name,
                knowledge_type: :knowledge_unit,
                course_id: course_id,
                parent_subject_id: subject_id,
                importance_level: :normal
              }

              case create_resource_record(unit_attrs, acc.tenant, authorize?: false) do
                {:ok, unit} ->
                  new_acc = %{acc | units: Map.put(acc.units, {unit_name, subject_id}, unit.id)}
                  {:ok, unit.id, new_acc}

                {:error, reason} ->
                  {:error, reason}
              end

            existing_unit ->
              {:ok, existing_unit.id, acc}
          end

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  defp parse_importance_level(nil), do: :normal
  defp parse_importance_level("hard"), do: :hard
  defp parse_importance_level("important"), do: :important
  defp parse_importance_level("normal"), do: :normal
  defp parse_importance_level(_), do: :normal

  defp create_resource_record(attrs, tenant, opts \\ []) do
    # Use the code interface to create the resource with tenant context
    options = [tenant: tenant] ++ Keyword.take(opts, [:authorize?])
    create_knowledge_resource(attrs, options)
  end

  calculations do
    calculate :student_learning_stats, :map do
      argument :student_id, :uuid do
        allow_nil? false
      end

      calculation fn resource, args ->
        student_id = args[:student_id]
        tenant = Ash.Changeset.get_tenant(resource)

        case get_resource_learning_stats_via_materials(resource, student_id, tenant) do
          {:ok, stats} -> stats
          {:error, _reason} ->
            # Fallback to basic resource counts if calculation fails
            total_videos = length(resource.videos || [])
            total_files = length(resource.files || [])
            total_exercises = length(resource.exercises || [])
            total_homeworks = length(resource.homeworks || [])

            %{
              resource_id: resource.id,
              resource_name: resource.name,
              student_id: student_id,
              videos: %{
                completed: 0,
                total: total_videos,
                completion_ratio: 0
              },
              files: %{
                completed: 0,
                total: total_files,
                completion_ratio: 0
              },
              exercises: %{
                completed: 0,
                total: total_exercises,
                completion_ratio: 0
              },
              homeworks: %{
                completed: 0,
                total: total_homeworks,
                completion_ratio: 0
              },
              overall: %{
                total_completed: 0,
                total_resources: total_videos + total_files + total_exercises + total_homeworks,
                completion_ratio: 0
              }
            }
        end
      end
    end
  end

  # ============ Helper Functions ============

  defp detect_tenant_for_course(course_id) do
    # Get all tenant schemas that start with 'org_'
    case KgEdu.Repo.query(
           "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'org_%' ORDER BY schema_name"
         ) do
      {:ok, %{rows: schemas}} when is_list(schemas) ->
        # Convert UUID string to binary format for PostgreSQL using safe casting
        case Ecto.UUID.dump(course_id) do
          {:ok, uuid_binary} ->
            # Try each tenant schema to find which one contains the course
            Enum.reduce_while(schemas, nil, fn [schema], _acc ->
              tenant = String.to_atom(schema)
              # Use raw SQL query to check if course exists in this tenant schema
              course_query = """
              SELECT id FROM "#{schema}".courses WHERE id = $1
              """

              case KgEdu.Repo.query(course_query, [uuid_binary]) do
                {:ok, %{rows: []}} ->
                  # No course found in this tenant, continue searching
                  {:cont, nil}

                {:ok, %{rows: [[_course_id]]}} ->
                  # Course found in this tenant
                  {:halt, tenant}

                {:error, _reason} ->
                  # Error querying this tenant, continue searching
                  {:cont, nil}
              end
            end)

          :error ->
            # Invalid UUID format
            nil
        end

      {:error, _reason} ->
        nil

      _ ->
        nil
    end
  end

  defp validate_course_exists(course_id, tenant) do
    # Use raw SQL to validate course exists, bypassing Ash authorization
    case tenant do
      nil ->
        {:error, "No tenant context available"}

      tenant ->
        # Convert UUID string to binary format for PostgreSQL using safe casting
        case Ecto.UUID.dump(course_id) do
          {:ok, uuid_binary} ->
            course_query = """
            SELECT id FROM "#{tenant}".courses WHERE id = $1 LIMIT 1
            """

            case KgEdu.Repo.query(course_query, [uuid_binary]) do
              {:ok, %{rows: []}} -> {:error, "Course not found in tenant"}
              {:ok, %{rows: [[_course_id]]}} -> {:ok, true}
              {:error, reason} -> {:error, "Failed to validate course: #{inspect(reason)}"}
            end

          :error ->
            {:error, "Invalid UUID format for course_id"}
        end
    end
  end

  # Helper function to calculate learning stats via associated materials
  defp get_resource_learning_stats_via_materials(resource, student_id, tenant) do
    # Load relationships if not already loaded
    resource_with_relationships =
      case {resource.videos, resource.files, resource.homeworks, resource.exercises} do
        {%Ash.NotLoaded{}, _, _, _} ->
          case KgEdu.Knowledge.Resource.get_knowledge_resource(resource.id,
                 tenant: tenant,
                 authorize?: false,
                 actor: nil,
                 load: [:videos, :files, :homeworks, :exercises]) do
            {:ok, loaded_resource} -> loaded_resource
            {:error, _reason} -> resource
          end
        {_, %Ash.NotLoaded{}, _, _} ->
          case KgEdu.Knowledge.Resource.get_knowledge_resource(resource.id,
                 tenant: tenant,
                 authorize?: false,
                 actor: nil,
                 load: [:videos, :files, :homeworks, :exercises]) do
            {:ok, loaded_resource} -> loaded_resource
            {:error, _reason} -> resource
          end
        {_, _, %Ash.NotLoaded{}, _} ->
          case KgEdu.Knowledge.Resource.get_knowledge_resource(resource.id,
                 tenant: tenant,
                 authorize?: false,
                 actor: nil,
                 load: [:videos, :files, :homeworks, :exercises]) do
            {:ok, loaded_resource} -> loaded_resource
            {:error, _reason} -> resource
          end
        {_, _, _, %Ash.NotLoaded{}} ->
          case KgEdu.Knowledge.Resource.get_knowledge_resource(resource.id,
                 tenant: tenant,
                 authorize?: false,
                 actor: nil,
                 load: [:videos, :files, :homeworks, :exercises]) do
            {:ok, loaded_resource} -> loaded_resource
            {:error, _reason} -> resource
          end
        _ ->
          resource
      end

    # Get all material IDs associated with this knowledge resource
    video_ids = case resource_with_relationships.videos do
      %Ash.NotLoaded{} -> []
      videos -> videos |> Enum.map(& &1.id)
    end

    file_ids = case resource_with_relationships.files do
      %Ash.NotLoaded{} -> []
      files -> files |> Enum.map(& &1.id)
    end

    homework_ids = case resource_with_relationships.homeworks do
      %Ash.NotLoaded{} -> []
      homeworks -> homeworks |> Enum.map(& &1.id)
    end

    exercise_ids = case resource_with_relationships.exercises do
      %Ash.NotLoaded{} -> []
      exercises -> exercises |> Enum.map(& &1.id)
    end

    # Get activity logs for this student and these materials
    case KgEdu.Activity.ActivityLog.list_activity_logs(actor: nil, tenant: tenant) do
      {:ok, all_logs} ->
        # Filter logs for this student and associated materials
        student_logs =
          all_logs
          |> Enum.filter(&(&1.user_id == student_id))
          |> Enum.filter(fn log ->
            (log.resource_type in ["KgEdu.Courses.File", "File"] and log.resource_id in file_ids) or
            (log.resource_type in ["KgEdu.Courses.Video", "Video"] and log.resource_id in video_ids) or
            (log.resource_type in ["KgEdu.Knowledge.Homework", "Homework"] and log.resource_id in homework_ids) or
            (log.resource_type in ["KgEdu.Knowledge.Exercise", "Exercise"] and log.resource_id in exercise_ids)
          end)

        # Count completed activities by type
        completed_videos =
          student_logs
          |> Enum.filter(&(&1.resource_type in ["KgEdu.Courses.Video", "Video"] and &1.action_type in [:video_view, :view]))
          |> Enum.map(& &1.resource_id)
          |> Enum.uniq()
          |> length()

        completed_files =
          student_logs
          |> Enum.filter(&(&1.resource_type in ["KgEdu.Courses.File", "File"] and &1.action_type in [:file_view, :view, :download]))
          |> Enum.map(& &1.resource_id)
          |> Enum.uniq()
          |> length()

        completed_exercises =
          student_logs
          |> Enum.filter(&(&1.resource_type in ["KgEdu.Knowledge.Exercise", "Exercise"] and &1.action_type in [:exercise_submit, :submit, :complete]))
          |> Enum.map(& &1.resource_id)
          |> Enum.uniq()
          |> length()

        completed_homework =
          student_logs
          |> Enum.filter(&(&1.resource_type in ["KgEdu.Knowledge.Homework", "Homework"] and &1.action_type in [:homework_submit, :submit, :complete]))
          |> Enum.map(& &1.resource_id)
          |> Enum.uniq()
          |> length()

        # Calculate totals
        total_videos = length(video_ids)
        total_files = length(file_ids)
        total_exercises = length(exercise_ids)
        total_homework = length(homework_ids)

        total_completed = completed_videos + completed_files + completed_exercises + completed_homework
        total_resources = total_videos + total_files + total_exercises + total_homework

        overall_ratio = if total_resources > 0, do: total_completed / total_resources, else: 0.0

        stats = %{
          resource_id: resource.id,
          resource_name: resource.name,
          student_id: student_id,
          videos: %{
            completed: completed_videos,
            total: total_videos,
            completion_ratio: if(total_videos > 0, do: completed_videos / total_videos, else: 0.0)
          },
          files: %{
            completed: completed_files,
            total: total_files,
            completion_ratio: if(total_files > 0, do: completed_files / total_files, else: 0.0)
          },
          exercises: %{
            completed: completed_exercises,
            total: total_exercises,
            completion_ratio: if(total_exercises > 0, do: completed_exercises / total_exercises, else: 0.0)
          },
          homeworks: %{
            completed: completed_homework,
            total: total_homework,
            completion_ratio: if(total_homework > 0, do: completed_homework / total_homework, else: 0.0)
          },
          overall: %{
            total_completed: total_completed,
            total_resources: total_resources,
            completion_ratio: overall_ratio
          }
        }

        {:ok, stats}

      {:error, reason} ->
        Logger.error("Failed to fetch activity logs for learning stats: #{inspect(reason)}")
        {:error, reason}
    end
  end
end

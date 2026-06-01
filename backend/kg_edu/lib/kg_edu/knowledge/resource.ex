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
    table("knowledge_resources")
    repo(KgEdu.Repo)

    references do
      reference(:chapter, on_delete: :delete)
      reference(:exercises, on_delete: :delete)
      reference(:parent_subject, on_delete: :delete)
      reference(:parent_unit, on_delete: :delete)
      reference(:parent_knowledge_resource, on_delete: :delete)
    end
  end

  json_api do
    type("knowledge_resource")
  end

  typescript do
    # Choose appropriate name
    type_name("Resource")
  end

  code_interface do
    # Basic CRUD
    define(:get_knowledge_resource, action: :by_id)
    define(:list_knowledges, action: :read)
    define(:create_knowledge_resource, action: :create)
    define(:update_knowledge_resource, action: :update_knowledge_resource)
    define(:delete_knowledge_resource, action: :destroy)
    define(:bulk_destroy_knowledges, action: :bulk_destroy_knowledges)
    define(:delete_all_knowledges_by_course, action: :delete_all_knowledges_by_course)
    define(:delete_all_knowledge, args: [:course_id], action: :delete_all_knowledge)

    # Course-related queries
    define(:get_knowledge_resources_by_course, action: :by_course)
    define(:search_knowledge_resources, action: :search)
    define(:get_knowledge_resources_by_name_and_importance, action: :by_name_and_importance)
    define(:debug_list_resources, action: :debug_list)

    # Hierarchy queries
    define(:list_subjects, action: :list_subjects)
    define(:list_units_by_subject, action: :list_units_by_subject)
    define(:list_cells_by_unit, action: :list_cells_by_unit)
    define(:list_cells_by_subject, action: :list_cells_by_subject)
    define(:get_subject_with_units, action: :get_subject_with_units)
    define(:get_unit_with_cells, action: :get_unit_with_cells)
    define(:get_full_hierarchy, action: :get_full_hierarchy)
    define(:get_full_hierarchy_nested, action: :get_full_hierarchy_nested)
    define(:get_parent, action: :get_parent)
    define(:get_children, action: :get_children)

    # Tag actions
    define(:add_tag_to_knowledge, action: :add_tag)
    define(:remove_tag_from_knowledge, action: :remove_tag)

    # Import actions
    define(:import_knowledge_from_excel, action: :import_from_excel)
    define(:import_knowledge_from_llm, action: :import_from_llm)
    define(:import_knowledge_from_opml, action: :import_from_opml)
    define(:import_knowledge_from_xmind, action: :import_from_xmind)
    define(:upsert_subject, action: :upsert_subject)
    define(:upsert_unit, action: :upsert_unit)
    define(:get_by_name_and_course, action: :by_name_and_course)
    define(:get_by_any_name_and_course, action: :by_any_name_and_course)
    define(:bulk_update_importance_level, action: :bulk_update_importance_level)
    define(:get_course_learning_stats_by_student, action: :get_course_learning_stats_by_student)

    # Sort order actions
    define(:reorder_knowledge_resource, action: :reorder)
    define(:regenerate_sort_paths, args: [:course_id], action: :regenerate_sort_paths)
  end

  actions do
    defaults([:read])

    destroy :destroy do
      description("Destroy a knowledge resource and its dependent relations")
      # Note: Database CASCADE handles deletion of child resources automatically
      # No manual cascading needed - relies on postgres references with on_delete: :delete
    end

    action :bulk_destroy_knowledges do
      description("Unenroll multiple students from a course")

      argument :course_id, :uuid do
        allow_nil?(false)
      end

      argument :knowledge_resource_ids, {:array, :uuid} do
        allow_nil?(false)
        description("List of student IDs to unenroll")
      end

      run(fn input, context ->
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
      end)
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
      description(
        "Delete all knowledge resources for a course. Only deletes top-level subjects to avoid stale record errors, relying on database CASCADE to delete children."
      )

      argument :course_id, :uuid do
        allow_nil?(false)
        description("The course ID to delete all knowledge resources for")
      end

      run(fn input, context ->
        course_id = input.arguments.course_id
        tenant = context.tenant

        # Only delete top-level subjects (knowledge_type == :subject)
        # The database CASCADE will handle deleting all units, cells, and related records
        query =
          __MODULE__
          |> Ash.Query.filter(
            course_id == ^course_id and
              knowledge_type == :subject
          )

        case Ash.bulk_destroy(
               query,
               :destroy,
               %{},
               return_errors?: true,
               # Use stream strategy to delete one by one in transaction
               # This avoids issues with concurrent deletions
               strategy: [:stream, :atomic],
               tenant: tenant,
               authorize?: false
             ) do
          %Ash.BulkResult{status: :success} ->
            :ok

          %Ash.BulkResult{status: :partial_success, errors: [_ | _] = errors} ->
            {:error, "Partial deletion completed with #{length(errors)} errors"}

          %Ash.BulkResult{status: :error, errors: errors} ->
            {:error, "Failed to delete knowledge resources: #{inspect(errors)}"}

          result ->
            {:error, "Unexpected result: #{inspect(result)}"}
        end
      end)
    end

    # ============ Basic Queries ============
    read :by_id do
      description("Get a knowledge resource by ID")
      get?(true)
      argument(:id, :uuid, allow_nil?: false)
      filter(expr(id == ^arg(:id)))
    end

    read :by_course do
      description("Get knowledge resources for a specific course")
      argument(:course_id, :uuid, allow_nil?: false)
      filter(expr(course_id == ^arg(:course_id)))
    end

    read :search do
      description("Search knowledge resources by name")
      argument(:query, :string, allow_nil?: false)
      filter(expr(contains(name, ^arg(:query))))
    end

    read :debug_list do
      description("Debug: List all knowledge resources for a course")
      argument(:course_id, :uuid, allow_nil?: true)

      prepare(fn query, _context ->
        course_id_arg = Ash.Query.get_argument(query, :course_id)

        query
        |> then(fn q ->
          if course_id_arg, do: Ash.Query.filter(q, course_id == ^course_id_arg), else: q
        end)
        |> Ash.Query.sort(name: :asc)
      end)
    end

    read :by_name_and_importance do
      description("Get knowledge resources by name (search) and importance level")
      argument(:name, :string, allow_nil?: true)
      argument(:importance_level, :string, allow_nil?: true)
      argument(:course_id, :uuid, allow_nil?: true)

      prepare(fn query, _context ->
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
      end)
    end

    # ============ Hierarchy Queries - Level 1: Subjects ============
    read :list_subjects do
      description("List all subjects (top-level knowledge resources)")
      argument(:course_id, :uuid, allow_nil?: true)
      filter(expr(knowledge_type == :subject and course_id == ^arg(:course_id)))

      prepare(fn query, _context ->
        Ash.Query.sort(query, sort_path: :asc)
      end)
    end

    read :get_subject_with_units do
      description("Get a subject with all its knowledge units loaded")
      get?(true)
      argument(:subject_id, :uuid, allow_nil?: false)

      filter(expr(id == ^arg(:subject_id) and knowledge_type == :subject))

      prepare(fn query, _context ->
        query
        |> Ash.Query.load(child_units: [:child_cells])
      end)
    end

    # ============ Hierarchy Queries - Level 2: Units ============
    read :list_units_by_subject do
      description("List all knowledge units for a specific subject")
      argument(:subject_id, :uuid, allow_nil?: false)

      filter(
        expr(
          knowledge_type == :knowledge_unit and
            parent_subject_id == ^arg(:subject_id)
        )
      )

      prepare(fn query, _context ->
        Ash.Query.sort(query, sort_path: :asc)
      end)
    end

    read :get_unit_with_cells do
      description("Get a knowledge unit with all its cells loaded")
      get?(true)
      argument(:unit_id, :uuid, allow_nil?: false)

      filter(expr(id == ^arg(:unit_id) and knowledge_type == :knowledge_unit))

      prepare(fn query, _context ->
        Ash.Query.load(query, [:child_cells, :parent_subject])
      end)
    end

    # ============ Hierarchy Queries - Level 3: Cells ============
    read :list_cells_by_unit do
      description("List all knowledge cells for a specific knowledge unit")
      argument(:unit_id, :uuid, allow_nil?: false)

      filter(
        expr(
          knowledge_type == :knowledge_cell and
            parent_unit_id == ^arg(:unit_id)
        )
      )

      prepare(fn query, _context ->
        Ash.Query.sort(query, sort_path: :asc)
      end)
    end

    read :list_cells_by_subject do
      description("List all knowledge cells directly under a subject (no unit)")
      argument(:subject_id, :uuid, allow_nil?: false)

      filter(
        expr(
          knowledge_type == :knowledge_cell and
            parent_subject_id == ^arg(:subject_id) and
            is_nil(parent_unit_id)
        )
      )

      prepare(fn query, _context ->
        Ash.Query.sort(query, sort_path: :asc)
      end)
    end

    # ============ Hierarchy Navigation ============
    read :get_parent do
      description("Get the parent of a knowledge resource")
      get?(true)
      argument(:id, :uuid, allow_nil?: false)

      prepare(fn query, _context ->
        query
        |> Ash.Query.filter(expr(id == ^arg(:id)))
        |> Ash.Query.load([:parent_subject, :parent_unit])
      end)
    end

    read :get_children do
      description("Get all children of a knowledge resource")
      argument(:id, :uuid, allow_nil?: false)

      argument :type, :atom do
        constraints(one_of: [:subject, :knowledge_unit, :knowledge_cell])
      end

      prepare(fn query, context ->
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
      end)
    end

    read :get_full_hierarchy do
      description(
        "Get the full hierarchy for a course (subjects with units and cells, supporting nested cells up to unlimited depth)"
      )

      argument(:course_id, :uuid, allow_nil?: false)

      filter(
        expr(
          course_id == ^arg(:course_id) and
            knowledge_type == :subject
        )
      )

      prepare(fn query, _context ->
        query
        |> Ash.Query.load([:sort_path, :display_order])
        |> Ash.Query.load(
          child_units: [
            :sort_path,
            :display_order,
            child_cells: [
              :sort_path,
              :display_order,
              nested_child_cells: [
                :sort_path,
                :display_order,
                nested_child_cells: [
                  :sort_path,
                  :display_order,
                  nested_child_cells: [
                    :sort_path,
                    :display_order,
                    nested_child_cells: [
                      :sort_path,
                      :display_order,
                      nested_child_cells: [
                        :sort_path,
                        :display_order,
                        nested_child_cells: [
                          :sort_path,
                          :display_order
                        ]
                      ]
                    ]
                  ]
                ]
              ]
            ]
          ],
          direct_cells: [
            :sort_path,
            :display_order,
            nested_child_cells: [
              :sort_path,
              :display_order,
              nested_child_cells: [
                :sort_path,
                :display_order,
                nested_child_cells: [
                  :sort_path,
                  :display_order,
                  nested_child_cells: [
                    :sort_path,
                    :display_order,
                    nested_child_cells: [
                      :sort_path,
                      :display_order
                    ]
                  ]
                ]
              ]
            ]
          ],
          subject_cells: [
            :sort_path,
            :display_order,
            nested_child_cells: [
              :sort_path,
              :display_order,
              nested_child_cells: [
                :sort_path,
                :display_order,
                nested_child_cells: [
                  :sort_path,
                  :display_order,
                  nested_child_cells: [
                    :sort_path,
                    :display_order,
                    nested_child_cells: [
                      :sort_path,
                      :display_order
                    ]
                  ]
                ]
              ]
            ]
          ]
        )
        |> Ash.Query.sort(sort_path: :asc)
      end)
    end

    read :get_full_hierarchy_nested do
      description(
        "Get the full hierarchy with cells automatically nested (unlimited depth). This action builds nested structure server-side."
      )

      argument(:course_id, :uuid, allow_nil?: false)

      filter(
        expr(
          course_id == ^arg(:course_id) and
            knowledge_type == :subject
        )
      )

      prepare(fn query, _context ->
        query
        |> Ash.Query.load([:sort_path, :display_order])
        |> Ash.Query.load(
          child_units: [
            :sort_path,
            :display_order,
            child_cells: [
              :sort_path,
              :display_order,
              nested_child_cells: [
                :sort_path,
                :display_order,
                nested_child_cells: [
                  :sort_path,
                  :display_order,
                  nested_child_cells: [
                    :sort_path,
                    :display_order,
                    nested_child_cells: [
                      :sort_path,
                      :display_order,
                      nested_child_cells: [
                        :sort_path,
                        :display_order,
                        nested_child_cells: [
                          :sort_path,
                          :display_order
                        ]
                      ]
                    ]
                  ]
                ]
              ]
            ]
          ],
          direct_cells: [
            :sort_path,
            :display_order,
            nested_child_cells: [
              :sort_path,
              :display_order,
              nested_child_cells: [
                :sort_path,
                :display_order,
                nested_child_cells: [
                  :sort_path,
                  :display_order,
                  nested_child_cells: [
                    :sort_path,
                    :display_order,
                    nested_child_cells: [
                      :sort_path,
                      :display_order
                    ]
                  ]
                ]
              ]
            ]
          ],
          subject_cells: [
            :sort_path,
            :display_order,
            nested_child_cells: [
              :sort_path,
              :display_order,
              nested_child_cells: [
                :sort_path,
                :display_order,
                nested_child_cells: [
                  :sort_path,
                  :display_order,
                  nested_child_cells: [
                    :sort_path,
                    :display_order,
                    nested_child_cells: [
                      :sort_path,
                      :display_order
                    ]
                  ]
                ]
              ]
            ]
          ]
        )
        |> Ash.Query.sort(sort_path: :asc)
      end)
    end

    # ============ Create Actions ============
    create :create do
      description("Create a new knowledge resource")

      accept([
        :name,
        :en_name,
        :description,
        :tag,
        :dimension,
        :category,
        :teaching_goal,
        :course_id,
        :chapter_id,
        :subject,
        :unit,
        :parent_subject_id,
        :parent_unit_id,
        :parent_knowledge_resource_id,
        :importance_level,
        :knowledge_type,
        :sort_path,
        :display_order
      ])

      validate(fn changeset, _context ->
        knowledge_type = Ash.Changeset.get_attribute(changeset, :knowledge_type)
        parent_subject_id = Ash.Changeset.get_attribute(changeset, :parent_subject_id)
        parent_unit_id = Ash.Changeset.get_attribute(changeset, :parent_unit_id)

        parent_knowledge_resource_id =
          Ash.Changeset.get_attribute(changeset, :parent_knowledge_resource_id)

        case knowledge_type do
          :subject ->
            if not is_nil(parent_subject_id) || not is_nil(parent_unit_id) do
              {:error, "Subjects cannot have parent resources"}
            else
              :ok
            end

          :knowledge_unit ->
            cond do
              is_nil(parent_subject_id) ->
                {:error, "Knowledge units must have a parent subject"}

              not is_nil(parent_unit_id) ->
                {:error, "Knowledge units cannot have a parent unit"}

              true ->
                :ok
            end

          :knowledge_cell ->
            cond do
              is_nil(parent_subject_id) and is_nil(parent_unit_id) and
                  is_nil(parent_knowledge_resource_id) ->
                {:error, "Knowledge cells must have a parent (subject, unit, or another cell)"}

              (not is_nil(parent_subject_id) and not is_nil(parent_unit_id)) or
                (not is_nil(parent_subject_id) and not is_nil(parent_knowledge_resource_id)) or
                  (not is_nil(parent_unit_id) and not is_nil(parent_knowledge_resource_id)) ->
                {:error, "Knowledge cells can only have one parent (subject, unit, or cell)"}

              true ->
                :ok
            end
        end
      end)

      change(fn changeset, context ->
        sort_path = Ash.Changeset.get_attribute(changeset, :sort_path)
        display_order = Ash.Changeset.get_attribute(changeset, :display_order)

        if is_nil(sort_path) or sort_path == "" do
          course_id = Ash.Changeset.get_attribute(changeset, :course_id)
          knowledge_type = Ash.Changeset.get_attribute(changeset, :knowledge_type)
          parent_subject_id = Ash.Changeset.get_attribute(changeset, :parent_subject_id)
          parent_unit_id = Ash.Changeset.get_attribute(changeset, :parent_unit_id)
          parent_cell_id = Ash.Changeset.get_attribute(changeset, :parent_knowledge_resource_id)

          {new_sort_path, new_display_order} =
            calculate_sort_path_and_order(
              course_id,
              knowledge_type,
              parent_subject_id,
              parent_unit_id,
              parent_cell_id,
              context.tenant
            )

          changeset
          |> Ash.Changeset.change_attribute(:sort_path, new_sort_path)
          |> Ash.Changeset.change_attribute(:display_order, new_display_order)
        else
          changeset
        end
      end)
    end

    # ============ Update Actions ============
    update :update_knowledge_resource do
      accept([
        :name,
        :en_name,
        :importance_level,
        :description,
        :tag,
        :dimension,
        :category,
        :teaching_goal,
        :parent_knowledge_resource_id,
        :sort_path,
        :display_order
      ])
    end

    update :reorder do
      description("Reorder a knowledge resource within its level")
      require_atomic?(false)

      argument :new_display_order, :integer do
        allow_nil?(false)
        description("New display order position (1-based)")
      end

      change(fn changeset, context ->
        new_order = Ash.Changeset.get_argument(changeset, :new_display_order)
        resource = changeset.data

        # 从 sort_path 解析当前的 display_order（取最后 4 位数字）
        old_order =
          case resource.sort_path do
            nil ->
              1

            "" ->
              1

            path ->
              # 取最后 4 位字符并转换为整数
              path
              |> String.slice(-4..-1)
              |> String.to_integer()
          end

        if new_order == old_order do
          changeset
        else
          parent_path = get_parent_sort_path(resource)
          new_path = build_sort_path(parent_path, new_order)

          changeset
          |> Ash.Changeset.change_attribute(:display_order, new_order)
          |> Ash.Changeset.change_attribute(:sort_path, new_path)

          reorder_siblings(resource, old_order, new_order, context.tenant)
        end

        changeset
      end)
    end

    update :add_tag do
      description(
        "Append a tag to the knowledge resource's tag string (tags are separated by semicolons)"
      )

      require_atomic?(false)

      argument :tag, :string do
        description("The tag word to append")
        allow_nil?(false)
      end

      change(fn changeset, _context ->
        tag_to_add = Ash.Changeset.get_argument(changeset, :tag)

        # Clean the tag: trim whitespace and remove any semicolons
        cleaned_tag =
          tag_to_add
          |> String.trim()
          |> String.replace(";", "")

        if cleaned_tag == "" do
          changeset
        else
          # Get current tags or default to empty string
          current_tags = Ash.Changeset.get_attribute(changeset, :tag) || ""

          # Append the new tag
          new_tags =
            if current_tags == "" do
              cleaned_tag
            else
              # Check if tag already exists
              existing_tags =
                current_tags
                |> String.split(";", trim: true)
                |> Enum.map(&String.trim/1)
                |> MapSet.new()

              if cleaned_tag in existing_tags do
                # Tag already exists, don't add it again
                current_tags
              else
                "#{current_tags};#{cleaned_tag}"
              end
            end

          Ash.Changeset.change_attribute(changeset, :tag, new_tags)
        end
      end)
    end

    update :remove_tag do
      description("Remove a tag from the knowledge resource's tag string")
      require_atomic?(false)

      argument :tag, :string do
        description("The tag word to remove")
        allow_nil?(false)
      end

      change(fn changeset, _context ->
        tag_to_remove = Ash.Changeset.get_argument(changeset, :tag)

        # Clean the tag: trim whitespace and remove any semicolons
        cleaned_tag =
          tag_to_remove
          |> String.trim()
          |> String.replace(";", "")

        if cleaned_tag == "" do
          changeset
        else
          # Get current tags or default to empty string
          current_tags = Ash.Changeset.get_attribute(changeset, :tag) || ""

          if current_tags == "" do
            changeset
          else
            # Remove the tag if it exists
            new_tags =
              current_tags
              |> String.split(";", trim: true)
              |> Enum.map(&String.trim/1)
              |> Enum.reject(&(&1 == cleaned_tag))
              |> Enum.join(";")

            Ash.Changeset.change_attribute(changeset, :tag, new_tags)
          end
        end
      end)
    end

    # ============ Import Actions ============
    read :by_name_and_course do
      description("Get a knowledge resource by name and course")
      get?(true)
      argument(:name, :string, allow_nil?: false)
      argument(:knowledge_type, :atom, allow_nil?: true)
      argument(:course_id, :uuid, allow_nil?: false)

      filter(
        expr(
          name == ^arg(:name) and knowledge_type == ^arg(:knowledge_type) and
            course_id == ^arg(:course_id)
        )
      )
    end

    read :by_any_name_and_course do
      description("Get a knowledge resource by name and course")
      get?(true)
      argument(:name, :string, allow_nil?: false)
      # argument :knowledge_type, :atom, allow_nil?: true
      argument(:course_id, :uuid, allow_nil?: false)

      filter(
        expr(
          name == ^arg(:name) and knowledge_type in [:subject, :unit, :knowledge_cell] and
            course_id == ^arg(:course_id)
        )
      )
    end

    create :upsert_subject do
      description("Create or update a subject")
      accept([:name, :course_id, :description, :importance_level])

      argument(:name, :string, allow_nil?: false)
      argument(:course_id, :uuid, allow_nil?: false)
      argument(:description, :string, allow_nil?: true)
      argument(:importance_level, :atom, allow_nil?: true, default: :normal)

      change(set_attribute(:knowledge_type, :subject))
      change(set_attribute(:subject, arg(:name)))

      change(fn changeset, _context ->
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
      end)
    end

    create :upsert_unit do
      description("Create or update a knowledge unit")
      accept([:name, :course_id, :parent_subject_id, :description, :importance_level])

      argument(:name, :string, allow_nil?: false)
      argument(:course_id, :uuid, allow_nil?: false)
      argument(:parent_subject_id, :uuid, allow_nil?: false)
      argument(:description, :string, allow_nil?: true)
      argument(:importance_level, :atom, allow_nil?: true, default: :normal)

      change(set_attribute(:knowledge_type, :knowledge_unit))
      change(set_attribute(:unit, arg(:name)))
      change(set_attribute(:parent_subject_id, arg(:parent_subject_id)))

      change(fn changeset, _context ->
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
      end)
    end

    action :import_from_excel do
      description("Import knowledge resources from Excel file")

      argument(:excel_data, :string, allow_nil?: false)
      argument(:course_id, :uuid, allow_nil?: false)

      run(fn input, context ->
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
      end)
    end

    action :import_from_llm do
      description("Import knowledge resources and relations from text using LLM analysis")

      argument(:text, :string, allow_nil?: false)
      argument(:course_id, :uuid, allow_nil?: false)

      run(fn input, context ->
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
      end)
    end

    action :import_from_opml do
      description("Import knowledge resources from OPML XML data")

      argument(:opml_data, :string, allow_nil?: false)
      argument(:course_id, :uuid, allow_nil?: false)

      run(fn input, context ->
        case KgEdu.OpmlParser.parse_from_text(input.arguments.opml_data) do
          {:ok, knowledge_data} ->
            case process_opml_import(knowledge_data, input.arguments.course_id, context.tenant) do
              {:ok, _} -> :ok
              {:error, reason} -> {:error, "Failed to process OPML data: #{reason}"}
            end

          {:error, reason} ->
            {:error, "Failed to parse OPML data: #{reason}"}
        end
      end)
    end

    action :import_from_xmind do
      description("Import knowledge resources from XMind file")

      argument(:xmind_data, :string, allow_nil?: false)
      argument(:course_id, :uuid, allow_nil?: false)

      run(fn input, context ->
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
      end)
    end

    action :bulk_update_importance_level do
      description("Bulk update importance levels for multiple knowledge resources in a course")

      argument :course_id, :uuid do
        allow_nil?(false)
        description("The course ID to validate knowledge resources belong to")
      end

      argument :knowledge_resource_ids, {:array, :uuid} do
        allow_nil?(false)
        description("List of knowledge resource IDs to update")
      end

      argument :importance_level, :atom do
        allow_nil?(false)
        constraints(one_of: [:hard, :important, :normal])
        description("New importance level to set")
      end

      run(fn input, context ->
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
      end)
    end

    action :get_course_learning_stats_by_student, :map do
      description(
        "Get learning statistics for all knowledge resources in a course, grouped by student"
      )

      argument :course_id, :uuid do
        allow_nil?(false)
        description("Course ID to get learning statistics for")
      end

      run(fn input, context ->
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
            Logger.info(
              "Found #{length(knowledge_resources)} knowledge resources for course #{course_id}"
            )

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

            Logger.info(
              "Course materials - Videos: #{length(all_video_ids)}, Files: #{length(all_file_ids)}, Homework: #{length(all_homework_ids)}, Exercises: #{length(all_exercise_ids)}"
            )

            # Get enrolled students for this course
            case KgEdu.Courses.CourseEnrollment.list_enrollments_by_course(
                   %{course_id: course_id},
                   tenant: tenant,
                   authorize?: false,
                   actor: nil
                 ) do
              {:ok, enrollments} ->
                enrolled_student_ids = Enum.map(enrollments, & &1.member_id) |> Enum.uniq()

                Logger.info(
                  "Found #{length(enrolled_student_ids)} enrolled students for course #{course_id}"
                )

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
                        (log.resource_type in ["KgEdu.Courses.File", "File"] and
                           log.resource_id in all_file_ids) or
                          (log.resource_type in ["KgEdu.Courses.Video", "Video"] and
                             log.resource_id in all_video_ids) or
                          (log.resource_type in ["KgEdu.Knowledge.Homework", "Homework"] and
                             log.resource_id in all_homework_ids) or
                          (log.resource_type in ["KgEdu.Knowledge.Exercise", "Exercise"] and
                             log.resource_id in all_exercise_ids)
                      end)

                    Logger.info("Found #{length(course_logs)} activity logs for course materials")

                    # Group logs by student, only for enrolled students
                    student_logs_map =
                      course_logs
                      |> Enum.filter(fn log -> log.user_id in enrolled_student_ids end)
                      |> Enum.group_by(& &1.user_id)

                    # Calculate totals for the course
                    total_videos = length(all_video_ids)
                    total_files = length(all_file_ids)
                    total_exercises = length(all_exercise_ids)
                    total_homeworks = length(all_homework_ids)

                    # Generate stats for each student
                    Logger.info("student_logs_map: #{inspect(student_logs_map)}")

                    # Get all users for this tenant to look up student names and roles
                    {:ok, all_users} =
                      KgEdu.Accounts.User.get_users(
                        tenant: tenant,
                        authorize?: false,
                        actor: nil
                      )

                    user_map =
                      Enum.reduce(all_users, %{}, fn user, acc ->
                        Map.put(acc, user.id, %{name: user.name, role: user.role})
                      end)

                    # Build stats for all enrolled students (including those with no activity)
                    student_stats =
                      enrolled_student_ids
                      |> Enum.map(fn student_id ->
                        user_info = Map.get(user_map, student_id, %{name: "Unknown", role: nil})
                        student_name = user_info[:name] || "Unknown"
                        logs = Map.get(student_logs_map, student_id, [])

                        # Count completed activities by type (unique materials per student)
                        completed_videos =
                          logs
                          |> Enum.filter(
                            &(&1.resource_type in ["KgEdu.Courses.Video", "Video"] and
                                &1.action_type in [:video_view, :view])
                          )
                          |> Enum.map(& &1.resource_id)
                          |> Enum.uniq()
                          |> length()

                        completed_files =
                          logs
                          |> Enum.filter(
                            &(&1.resource_type in ["KgEdu.Courses.File", "File"] and
                                &1.action_type in [:file_view, :view, :download])
                          )
                          |> Enum.map(& &1.resource_id)
                          |> Enum.uniq()
                          |> length()

                        completed_exercises =
                          logs
                          |> Enum.filter(
                            &(&1.resource_type in ["KgEdu.Knowledge.Exercise", "Exercise"] and
                                &1.action_type in [:exercise_submit, :submit, :complete])
                          )
                          |> Enum.map(& &1.resource_id)
                          |> Enum.uniq()
                          |> length()

                        completed_homework =
                          logs
                          |> Enum.filter(
                            &(&1.resource_type in ["KgEdu.Knowledge.Homework", "Homework"] and
                                &1.action_type in [:homework_submit, :submit, :complete])
                          )
                          |> Enum.map(& &1.resource_id)
                          |> Enum.uniq()
                          |> length()

                        # Calculate completion ratios
                        video_completion =
                          if total_videos > 0, do: completed_videos / total_videos, else: 0.0

                        file_completion =
                          if total_files > 0, do: completed_files / total_files, else: 0.0

                        exercise_completion =
                          if total_exercises > 0,
                            do: completed_exercises / total_exercises,
                            else: 0.0

                        homework_completion =
                          if total_homeworks > 0,
                            do: completed_homework / total_homeworks,
                            else: 0.0

                        total_completed =
                          completed_videos + completed_files + completed_exercises +
                            completed_homework

                        total_resources =
                          total_videos + total_files + total_exercises + total_homeworks

                        overall_completion =
                          if total_resources > 0,
                            do: total_completed / total_resources,
                            else: 0.0

                        %{
                          studentId: student_id,
                          name: student_name,
                          courseId: course_id,
                          videos: %{
                            completed: completed_videos,
                            total: total_videos,
                            completionRatio: video_completion
                          },
                          files: %{
                            completed: completed_files,
                            total: total_files,
                            completionRatio: file_completion
                          },
                          exercises: %{
                            completed: completed_exercises,
                            total: total_exercises,
                            completionRatio: exercise_completion
                          },
                          homework: %{
                            completed: completed_homework,
                            total: total_homeworks,
                            completionRatio: homework_completion
                          },
                          overall: %{
                            totalCompleted: total_completed,
                            totalResources: total_resources,
                            completionRatio: overall_completion
                          }
                        }
                      end)

                    Logger.info("student_stats result: #{inspect(student_stats)}")

                    final_result = {:ok, student_stats}
                    final_result

                  {:error, reason} ->
                    Logger.error("Failed to get activity logs: #{inspect(reason)}")
                    {:error, "Failed to get activity logs: #{inspect(reason)}"}
                end

              {:error, reason} ->
                Logger.error("Failed to get enrollments: #{inspect(reason)}")
                {:error, "Failed to get enrollments: #{inspect(reason)}"}
            end

          {:error, reason} ->
            Logger.error("Failed to get knowledge resources: #{inspect(reason)}")
            {:error, "Failed to get knowledge resources: #{inspect(reason)}"}
        end
      end)
    end

    action :regenerate_sort_paths do
      description(
        "Regenerate sort_path for all knowledge resources in a course based on current hierarchy"
      )

      argument :course_id, :uuid do
        allow_nil?(false)
        description("Course ID to regenerate sort paths for")
      end

      run(fn input, context ->
        course_id = input.arguments.course_id
        tenant = context.tenant

        case regenerate_course_sort_paths(course_id, tenant) do
          :ok -> :ok
          {:error, reason} -> {:error, reason}
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

  multitenancy do
    strategy(:context)
  end

  attributes do
    uuid_primary_key(:id)

    # Knowledge hierarchy type
    attribute :knowledge_type, :atom do
      allow_nil?(false)
      constraints(one_of: [:subject, :knowledge_unit, :knowledge_cell])
      default(:knowledge_cell)
      public?(true)
      description("The type of knowledge resource in the hierarchy")
    end

    # Subject name (for grouping, required for subject type)
    attribute :subject, :string do
      allow_nil?(true)
      public?(true)
      description("Subject name (required for subject type resources)")
    end

    # Unit name (for grouping, required for knowledge_unit type)
    attribute :unit, :string do
      allow_nil?(true)
      public?(true)
      description("Unit name (required for knowledge_unit type resources)")
    end

    # Importance level (renamed from knowlege_type)
    attribute :importance_level, :string do
      allow_nil?(false)
      # constraints one_of: [:hard, :important, :normal]
      default("")
      public?(true)
      description("Importance level of this knowledge resource")
    end

    attribute :name, :string do
      allow_nil?(false)
      # constraints min_length: 3, max_length: 100
      public?(true)
    end

    attribute :en_name, :string do
      allow_nil?(true)
      public?(true)
      description("English name of the knowledge resource")
    end

    attribute :description, :string do
      allow_nil?(true)
      # constraints max_length: 1000
      public?(true)
    end

    attribute :tag, :string do
      allow_nil?(true)
      public?(true)
      description("Tag or label for categorizing the knowledge resource")
    end

    attribute :dimension, :string do
      allow_nil?(true)
      public?(true)
      description("Cognitive dimension or category of the knowledge resource")
    end

    attribute :category, :string do
      allow_nil?(true)
      public?(true)
      description("Category classification of the knowledge resource")
    end

    attribute :teaching_goal, :string do
      allow_nil?(true)
      public?(true)
      description("Teaching goal or objective for this knowledge resource")
    end

    attribute :sort_path, :string do
      allow_nil?(true)
      default("")
      public?(true)
      description("Sort path for hierarchical ordering, format: '01.02.03'")
    end

    attribute :display_order, :integer do
      allow_nil?(true)
      public?(true)
      description("Display order within the same level (1, 2, 3...)")
    end

    timestamps()
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      public?(true)
      allow_nil?(false)
    end

    belongs_to :chapter, KgEdu.Courses.Chapter do
      public?(true)
      allow_nil?(true)
      description("Chapter this knowledge resource belongs to")
    end

    belongs_to :created_by, KgEdu.Accounts.User do
      public?(true)
    end

    # ============ Hierarchy Relationships ============

    # Parent relationships
    belongs_to :parent_subject, __MODULE__ do
      public?(true)
      allow_nil?(true)
      description("Parent subject (for units and cells that belong to a subject)")
    end

    belongs_to :parent_unit, __MODULE__ do
      public?(true)
      allow_nil?(true)
      description("Parent unit (for cells that belong to a unit)")
    end

    # Generic parent knowledge resource (self-referential for hierarchical tree structure)
    belongs_to :parent_knowledge_resource, __MODULE__ do
      public?(true)
      allow_nil?(true)

      description(
        "Parent knowledge resource (generic hierarchical relationship for tree structure)"
      )
    end

    # Children relationships
    has_many :child_units, __MODULE__ do
      public?(true)
      destination_attribute(:parent_subject_id)
      filter(expr(knowledge_type == :knowledge_unit))
      description("Knowledge units that belong to this subject")
    end

    has_many :child_cells, __MODULE__ do
      public?(true)
      destination_attribute(:parent_unit_id)
      filter(expr(knowledge_type == :knowledge_cell))
      description("Knowledge cells that belong to this unit")
    end

    has_many :direct_cells, __MODULE__ do
      public?(true)
      destination_attribute(:parent_subject_id)
      filter(expr(knowledge_type == :knowledge_cell and is_nil(parent_unit_id)))
      description("Knowledge cells that belong directly to this subject (no unit)")
    end

    has_many :subject_cells, __MODULE__ do
      public?(true)
      destination_attribute(:parent_subject_id)
      filter(expr(knowledge_type == :knowledge_cell))
      description("All knowledge cells that belong to this subject (regardless of unit)")
    end

    # Nested child cells (cells that have this cell as parent via parent_knowledge_resource_id)
    has_many :nested_child_cells, __MODULE__ do
      public?(true)
      destination_attribute(:parent_knowledge_resource_id)
      filter(expr(knowledge_type == :knowledge_cell))

      description(
        "Knowledge cells that are nested under this cell (for hierarchical cell structure up to level 7)"
      )
    end

    # Generic child knowledge resources (self-referential for hierarchical tree structure)
    has_many :child_knowledge_resources, __MODULE__ do
      public?(true)
      destination_attribute(:parent_knowledge_resource_id)
      description("All child knowledge resources in the hierarchical tree")
    end

    # ============ Other Relationships ============

    has_many :outgoing_relations, KgEdu.Knowledge.Relation do
      public?(true)
      destination_attribute(:source_knowledge_id)
    end

    has_many :incoming_relations, KgEdu.Knowledge.Relation do
      public?(true)
      destination_attribute(:target_knowledge_id)
    end

    has_many :files, KgEdu.Courses.File do
      public?(true)
      destination_attribute(:knowledge_resource_id)
    end

    has_many :videos, KgEdu.Courses.Video do
      public?(true)
      destination_attribute(:knowledge_resource_id)
      description("Videos associated with this knowledge resource")
    end

    has_many :homeworks, KgEdu.Knowledge.Homework do
      public?(true)
      destination_attribute(:knowledge_resource_id)
      description("Homeworks related to this knowledge resource")
    end

    has_many :exercises, KgEdu.Knowledge.Exercise do
      public?(true)
      destination_attribute(:knowledge_resource_id)
      description("Exercises related to this knowledge resource")
    end

    has_many :knowledge_point_cognitives, KgEdu.Knowledge.KnowledgePointCognitive do
      public?(true)
      destination_attribute(:knowledge_resource_id)
      description("Cognitive resources for this knowledge point at different levels")
    end

    has_many :user_cases, KgEdu.Knowledge.UserCase do
      public?(true)
      destination_attribute(:knowledge_resource_id)
      description("User cases (examples) that illustrate this knowledge resource")
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
    knowledge_type = resource_attrs.knowledge_type

    # Skip if knowledge name is missing
    if is_nil(knowledge_name) or knowledge_name == "" do
      {:ok, acc}
    else
      # Process based on knowledge type
      case knowledge_type do
        :subject ->
          # For subjects, create or get the subject
          case create_or_get_subject(subject_name, course_id, acc) do
            {:ok, _subject_id, new_acc} ->
              # Subject already handled, just count it
              final_acc = %{new_acc | created: new_acc.created + 1}
              {:ok, final_acc}

            {:error, reason} ->
              Logger.error("Failed to create subject '#{subject_name}': #{inspect(reason)}")
              final_acc = %{acc | skipped: acc.skipped + 1}
              {:ok, final_acc}
          end

        :knowledge_unit ->
          # For units, create or get parent subject first, then create unit
          parent_subject_name = Map.get(resource_attrs, :parent_subject_name, subject_name)

          case create_or_get_subject(parent_subject_name, course_id, acc) do
            {:ok, subject_id, new_acc} ->
              case create_or_get_unit(knowledge_name, course_id, subject_id, new_acc) do
                {:ok, _unit_id, final_acc} ->
                  final_acc = %{final_acc | created: final_acc.created + 1}
                  {:ok, final_acc}

                {:error, reason} ->
                  Logger.error("Failed to create unit '#{knowledge_name}': #{inspect(reason)}")
                  final_acc = %{new_acc | skipped: new_acc.skipped + 1}
                  {:ok, final_acc}
              end

            {:error, reason} ->
              Logger.error(
                "Failed to create parent subject for unit '#{knowledge_name}': #{inspect(reason)}"
              )

              final_acc = %{acc | skipped: acc.skipped + 1}
              {:ok, final_acc}
          end

        :knowledge_cell ->
          # For cells, handle different parent types
          {parent_subject_id, parent_unit_id, parent_cell_id, new_acc} =
            cond do
              # Has parent cell (nested cell, depth 3+)
              Map.has_key?(resource_attrs, :parent_cell_name) ->
                parent_cell_name = resource_attrs.parent_cell_name

                # First ensure parent subject/unit exist
                case create_or_get_subject(subject_name, course_id, acc) do
                  {:ok, subject_id, acc1} ->
                    acc2 =
                      if unit_name && unit_name != "" do
                        case create_or_get_unit(unit_name, course_id, subject_id, acc1) do
                          {:ok, _unit_id, acc} -> acc
                          {:error, _} -> acc1
                        end
                      else
                        acc1
                      end

                    # Find parent cell by name
                    case get_by_name_and_course(
                           %{
                             name: parent_cell_name,
                             knowledge_type: :knowledge_cell,
                             course_id: course_id
                           },
                           tenant: acc2.tenant,
                           authorize?: false
                         ) do
                      {:ok, parent_cell} ->
                        {nil, nil, parent_cell.id, acc2}

                      {:error, _} ->
                        Logger.warning(
                          "Parent cell '#{parent_cell_name}' not found for '#{knowledge_name}', creating without parent"
                        )

                        {nil, nil, nil, acc2}
                    end

                  {:error, _} ->
                    {nil, nil, nil, acc}
                end

              # Has parent unit
              Map.has_key?(resource_attrs, :parent_unit_name) ->
                parent_unit_name = resource_attrs.parent_unit_name

                case create_or_get_subject(subject_name, course_id, acc) do
                  {:ok, subject_id, acc1} ->
                    # Create or get the parent unit with correct subject_id
                    case create_or_get_unit(parent_unit_name, course_id, subject_id, acc1) do
                      {:ok, unit_id, acc2} ->
                        {nil, unit_id, nil, acc2}

                      {:error, _} ->
                        Logger.warning(
                          "Parent unit '#{parent_unit_name}' not found for '#{knowledge_name}', creating without parent unit"
                        )

                        # Fallback: create cell directly under subject
                        {subject_id, nil, nil, acc1}
                    end

                  {:error, _} ->
                    {nil, nil, nil, acc}
                end

              # Has parent subject (direct child of subject)
              Map.has_key?(resource_attrs, :parent_subject_name) ->
                parent_subject_name = resource_attrs.parent_subject_name

                case create_or_get_subject(parent_subject_name, course_id, acc) do
                  {:ok, subject_id, new_acc} ->
                    {subject_id, nil, nil, new_acc}

                  {:error, _} ->
                    {nil, nil, nil, acc}
                end

              # No parent info specified, infer from context
              true ->
                if unit_name && unit_name != "" do
                  # Assume it's under a unit
                  case create_or_get_subject(subject_name, course_id, acc) do
                    {:ok, subject_id, acc1} ->
                      case create_or_get_unit(unit_name, course_id, subject_id, acc1) do
                        {:ok, unit_id, acc2} ->
                          {nil, unit_id, nil, acc2}

                        {:error, _} ->
                          {subject_id, nil, nil, acc1}
                      end

                    {:error, _} ->
                      {nil, nil, nil, acc}
                  end
                else
                  # Assume it's directly under subject
                  case create_or_get_subject(subject_name, course_id, acc) do
                    {:ok, subject_id, new_acc} ->
                      {subject_id, nil, nil, new_acc}

                    {:error, _} ->
                      {nil, nil, nil, acc}
                  end
                end
            end

          # Check if resource already exists
          case get_by_name_and_course(
                 %{
                   name: knowledge_name,
                   knowledge_type: :knowledge_cell,
                   course_id: course_id
                 },
                 tenant: new_acc.tenant,
                 authorize?: false
               ) do
            {:ok, _existing} ->
              # Resource already exists, skip it
              final_acc = %{new_acc | skipped: new_acc.skipped + 1}
              {:ok, final_acc}

            {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Query.NotFound{}]}} ->
              # Create the resource with resolved parent IDs
              resource_attrs = %{
                name: knowledge_name,
                subject: subject_name,
                unit: unit_name || "",
                knowledge_type: :knowledge_cell,
                course_id: course_id,
                description: "",
                importance_level: :normal,
                parent_subject_id: parent_subject_id,
                parent_unit_id: parent_unit_id,
                parent_knowledge_resource_id: parent_cell_id
              }

              case create_resource_record(resource_attrs, new_acc.tenant, authorize?: false) do
                {:ok, _resource} ->
                  final_acc = %{new_acc | created: new_acc.created + 1}
                  {:ok, final_acc}

                {:error, reason} ->
                  Logger.error(
                    "Failed to create knowledge cell '#{knowledge_name}': #{inspect(reason)}"
                  )

                  final_acc = %{new_acc | skipped: new_acc.skipped + 1}
                  {:ok, final_acc}
              end

            {:error, reason} ->
              Logger.error("Error checking existing knowledge resource: #{inspect(reason)}")
              final_acc = %{new_acc | skipped: new_acc.skipped + 1}
              {:ok, final_acc}
          end
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
        process_knowledge_import(knowledge_data, course_id, context.tenant)

      {:error, reason} ->
        {:error, "Failed to parse Excel file: #{reason}"}
    end
  end

  # ============================================================
  # Excel 导入核心函数 - 正确的层级映射
  # ============================================================
  # 层级映射：
  # - level 0 (A列，一级知识点) → knowledge_type: :subject
  # - level 1 (B列，二级知识点) → knowledge_type: :knowledge_unit，parent_subject_id
  # - level 2 (C列，三级知识点) → knowledge_type: :knowledge_cell，parent_subject_id + parent_unit_id
  # - level 3+ (D-G列，四级知识点) → parent_knowledge_resource_id = 上一级 cell id
  # ============================================================

  def process_knowledge_import(knowledge_data, course_id, tenant) do
    subjects = %{}
    units = %{}
    knowledge_cells = %{}

    # 注意：knowledge_data 已经是处理过的数据，跳过了表头行（前4行）
    data_rows = knowledge_data |> Enum.filter(fn row -> length(row) >= 1 end)

    IO.inspect("Processing #{length(data_rows)} data rows")
    IO.inspect("Tenant: #{tenant}, Course ID: #{course_id}")

    # 初始化累加器，追踪每一层级的当前父级 ID
    initial_acc = %{
      subjects: subjects, 
      units: units, 
      knowledge_cells: knowledge_cells, 
      tenant: tenant, 
      course_id: course_id, 
      current_subject_id: nil, 
      current_unit_id: nil, 
      level_3_id: nil, 
      level_4_id: nil, 
      level_5_id: nil, 
      level_6_id: nil, 
      level_7_id: nil,
      # 新增：用于存储每个知识点名称到ID的映射，便于后续处理关系
      name_to_id: %{}
    }

    result = Enum.reduce_while(data_rows, {:ok, initial_acc}, fn row, {:ok, acc} ->
      case process_import_row(row, acc) do
        {:ok, new_acc} -> {:cont, {:ok, new_acc}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)


    case result do
      {:ok, acc_after_create} ->
        # 知识点创建完成后，处理关系（前置/后置/关联）
        IO.inspect("Processing relations after all knowledge resources created...")
        case process_all_relations(data_rows, acc_after_create) do
          {:ok, _} ->
            {:ok, "Successfully imported #{length(data_rows)} knowledge resources"}
          {:error, reason} ->
            {:error, reason}
        end
      {:error, reason} ->
        {:error, reason}
    end
  end

  # 处理导入行 - 决定知识点类型和层级关系
  defp process_import_row(row, acc) do
    col0 = safe_get(row, 0)  # A列 - 一级知识点
    col1 = safe_get(row, 1)  # B列 - 二级知识点
    col2 = safe_get(row, 2)  # C列 - 三级知识点
    col3 = safe_get(row, 3)  # D列 - 四级知识点
    col4 = safe_get(row, 4)  # E列 - 五级知识点
    col5 = safe_get(row, 5)  # F列 - 六级知识点
    col6 = safe_get(row, 6)  # G列 - 七级知识点
    col7 = safe_get(row, 7)  # H列 - 前置知识点
    col8 = safe_get(row, 8)  # I列 - 后置知识点
    col9 = safe_get(row, 9)  # J列 - 关联知识点
    col10 = safe_get(row, 10) # K列 - 标签
    col11 = safe_get(row, 11) # L列 - 认知维度
    col12 = safe_get(row, 12) # M列 - 分类
    col13 = safe_get(row, 13) # N列 - 教学目标
    col14 = safe_get(row, 14) # O列 - 知识点说明

    levels = [col0, col1, col2, col3, col4, col5, col6]
    {knowledge_name, level_index} = find_deepest_level(levels)

    if is_nil(knowledge_name) or knowledge_name == "" do
      {:ok, acc}
    else
      IO.inspect("Processing: #{knowledge_name} at level #{level_index}")

      case level_index do
        0 -> create_subject_level(row, col0, acc)
        1 -> create_unit_level(row, col1, acc)
        level when level >= 2 -> create_cell_level(row, knowledge_name, level_index, acc)
      end
    end
  end

  # 创建一级知识点 (subject)
  defp create_subject_level(row, col0, acc) do
    name = safe_strip(col0)
    if is_nil(name) or name == "" do
      {:ok, acc}
    else
      # 重置所有子层级 ID
      acc = %{acc | 
        current_subject_id: nil, 
        current_unit_id: nil, 
        level_3_id: nil, level_4_id: nil, level_5_id: nil, 
        level_6_id: nil, level_7_id: nil
      }

      attrs = %{
        course_id: acc.course_id,
        name: name
      }

      case find_or_create_resource(name, :subject, attrs, acc) do
        {:ok, resource_id, new_acc} when not is_nil(resource_id) ->
          # 更新 name_to_id 映射
          trimmed_name = name |> safe_strip()
          new_acc = %{new_acc | 
            current_subject_id: resource_id,
            name_to_id: Map.put(new_acc.name_to_id, trimmed_name, resource_id)
          }
          {:ok, new_acc}
        _ ->
          {:ok, acc}
      end
    end
  end

  # 创建二级知识点 (knowledge_unit)，挂到 subject 下
  defp create_unit_level(row, col1, acc) do
    name = safe_strip(col1)
    if is_nil(name) or name == "" or is_nil(acc.current_subject_id) do
      {:ok, acc}
    else
      # 重置四级及以下层级 ID（level_3 会在创建后被 create_cell_level 更新）
      acc = %{acc | 
        current_unit_id: nil, 
        level_4_id: nil, level_5_id: nil, 
        level_6_id: nil, level_7_id: nil
      }

      # 传入 name 作为独立的参数
      attrs = %{
        course_id: acc.course_id,
        parent_subject_id: acc.current_subject_id
      }

      case find_or_create_resource(name, :knowledge_unit, attrs, acc) do
        {:ok, resource_id, new_acc} when not is_nil(resource_id) ->
          # 更新 name_to_id 映射
          trimmed_name = name |> safe_strip()
          new_acc = %{new_acc | 
            current_unit_id: resource_id,
            name_to_id: Map.put(new_acc.name_to_id, trimmed_name, resource_id)
          }
          {:ok, new_acc}
        _ ->
          {:ok, acc}
      end
    end
  end

  # 创建知识点单元格 (knowledge_cell)，支持多级嵌套
  defp create_cell_level(row, name, level_index, acc) do
    name = safe_strip(name)
    if is_nil(name) or name == "" do
      {:ok, acc}
    else
      # 确保有 subject_id 才能创建
      if is_nil(acc.current_subject_id) do
        IO.puts("WARN: Skipping '#{name}' - no subject context")
        {:ok, acc}
      else
        # 确定父级 ID
        # knowledge_cell 只能有一个父级：subject, unit, 或上一个 cell
        {parent_id, attrs_extra} = case level_index do
          2 -> 
            # 三级知识点 - 如果有 current_unit_id 就挂到 unit 下，否则挂到 subject 下
            if acc.current_unit_id do
              {acc.current_unit_id, %{
                parent_unit_id: acc.current_unit_id,
                parent_subject_id: nil  # 不能同时设置
              }}
            else
              {acc.current_subject_id, %{
                parent_subject_id: acc.current_subject_id,
                parent_unit_id: nil  # 不能同时设置
              }}
            end
          3 ->
            # 四级知识点 - 挂到三级 cell 下
            {acc.level_3_id, %{
              parent_subject_id: nil,
              parent_unit_id: nil,
              parent_knowledge_resource_id: acc.level_3_id
            }}
          4 ->
            # 五级知识点 - 挂到四级 cell 下
            {acc.level_4_id, %{
              parent_subject_id: nil,
              parent_unit_id: nil,
              parent_knowledge_resource_id: acc.level_4_id
            }}
          5 ->
            # 六级知识点 - 挂到五级 cell 下
            {acc.level_5_id, %{
              parent_subject_id: nil,
              parent_unit_id: nil,
              parent_knowledge_resource_id: acc.level_5_id
            }}
          6 ->
            # 七级知识点 - 挂到六级 cell 下
            {acc.level_6_id, %{
              parent_subject_id: nil,
              parent_unit_id: nil,
              parent_knowledge_resource_id: acc.level_6_id
            }}
          _ ->
            {nil, %{}}
        end

        if is_nil(parent_id) do
          IO.puts("WARN: Cannot create nested cell '#{name}' at level #{level_index} - no parent")
          {:ok, acc}
        else
          attrs = %{
            course_id: acc.course_id,
            description: safe_strip(safe_get(row, 14)),
            tag: safe_strip(safe_get(row, 10)),
            dimension: safe_strip(safe_get(row, 11)),
            category: safe_strip(safe_get(row, 12)),
            teaching_goal: safe_strip(safe_get(row, 13))
          } |> Map.merge(attrs_extra)

          # 对于 level 2 (直接挂到 unit 的 cell)，先尝试按 parent_unit_id + name 查找
          # 这样可以避免不同 unit 下同名 cell 被错误复用
          case find_or_create_resource(name, :knowledge_cell, attrs, acc, level_index) do
            {:ok, resource_id, new_acc} when not is_nil(resource_id) ->
              # 更新对应层级的 ID 供下一行使用
              new_acc = case level_index do
                2 -> %{new_acc | level_3_id: resource_id}
                3 -> %{new_acc | level_4_id: resource_id}
                4 -> %{new_acc | level_5_id: resource_id}
                5 -> %{new_acc | level_6_id: resource_id}
                6 -> %{new_acc | level_7_id: resource_id}
                _ -> new_acc
              end
              # 更新 name_to_id 映射（用 trim 后的 name 作为 key）
              trimmed_name = name |> safe_strip()
              new_acc = %{new_acc | name_to_id: Map.put(new_acc.name_to_id, trimmed_name, resource_id)}
              {:ok, new_acc}
            _ ->
              {:ok, acc}
          end
        end
      end
    end
  end

  # ============================================================
  # 知识点关系导入处理
  # ============================================================
  
  # 处理所有行的关系数据
  defp process_all_relations(data_rows, acc) do
    name_to_id = acc.name_to_id
    tenant = acc.tenant
    course_id = acc.course_id
    
    IO.inspect("Name to ID mapping: #{inspect(Map.keys(name_to_id))}")
    
    # 确保 relation_types 存在
    ensure_relation_types_exist(tenant)
    
    # 收集所有关系
    relations_to_create = []
    
    Enum.each(data_rows, fn row ->
      col0 = safe_get(row, 0)
      col1 = safe_get(row, 1)
      col2 = safe_get(row, 2)
      col3 = safe_get(row, 3)
      col4 = safe_get(row, 4)
      col5 = safe_get(row, 5)
      col6 = safe_get(row, 6)
      col7 = safe_get(row, 7)  # H列 - 前置知识点
      col8 = safe_get(row, 8)  # I列 - 后置知识点
      col9 = safe_get(row, 9)  # J列 - 关联知识点
      
      levels = [col0, col1, col2, col3, col4, col5, col6]
      {knowledge_name, _level_index} = find_deepest_level(levels)
      
      unless is_nil(knowledge_name) or knowledge_name == "" do
        current_name = safe_strip(knowledge_name)
        current_id = Map.get(name_to_id, current_name)
        
        unless is_nil(current_id) do
          # 处理前置知识点 (H列) - 作为 source，前置是 target，关系类型: prerequisite
          unless is_nil(col7) or col7 == "" do
            process_relation_column(col7, current_id, "prerequisite", name_to_id, tenant)
          end
          
          # 处理后置知识点 (I列) - 作为 source，后置是 target，关系类型: postrequisite
          unless is_nil(col8) or col8 == "" do
            process_relation_column(col8, current_id, "postrequisite", name_to_id, tenant)
          end
          
          # 处理关联知识点 (J列) - 关系类型: related
          unless is_nil(col9) or col9 == "" do
            process_relation_column(col9, current_id, "related", name_to_id, tenant)
          end
        end
      end
    end)
    
    {:ok, "Relations processed successfully"}
  end
  
  # 处理单列关系数据（可能有多个知识点，用分号分隔）
  defp process_relation_column(column_value, source_id, relation_type_name, name_to_id, tenant) do
    # 分割多个知识点（支持中英文分号）
    names = String.split(column_value, ~r{[;；]})
    |> Enum.map(&String.trim/1)
    |> Enum.filter(fn n -> n != "" end)
    
    Enum.each(names, fn target_name ->
      target_name = String.trim(target_name)
      target_id = Map.get(name_to_id, target_name)
      
      unless is_nil(target_id) or target_id == source_id do
        # 获取 relation_type
        case KgEdu.Knowledge.RelationType.get_relation_type_by_name(%{name: relation_type_name}, tenant: tenant) do
          {:ok, relation_type} ->
            create_knowledge_relation_if_not_exists(source_id, target_id, relation_type.id, tenant)
          {:error, _} ->
            # 如果找不到 relation_type，跳过
            IO.puts("WARN: Relation type '#{relation_type_name}' not found, skipping relation")
            :ok
        end
      end
    end)
    
    :ok
  end
  
  # 创建知识点关系（如果不存在）
  defp create_knowledge_relation_if_not_exists(source_id, target_id, relation_type_id, tenant) do
    # 检查是否已存在
    case KgEdu.Knowledge.Relation
    |> Ash.Query.filter(
      source_knowledge_id == ^source_id and
      target_knowledge_id == ^target_id and
      relation_type_id == ^relation_type_id
    )
    |> Ash.read_one(tenant: tenant, authorize?: false) do
      {:ok, nil} ->
        # 不存在，创建新关系
        case KgEdu.Knowledge.Relation.create_relation_import(
          %{source_knowledge_id: source_id, target_knowledge_id: target_id, relation_type_id: relation_type_id},
          tenant: tenant,
          authorize?: false
        ) do
          {:ok, _} ->
            IO.puts("INFO: Created relation #{source_id} -> #{target_id}")
            :ok
          {:error, reason} ->
            IO.puts("WARN: Failed to create relation: #{inspect(reason)}")
            :ok
        end
      {:ok, _existing} ->
        # 已存在，跳过
        :ok
      {:error, reason} ->
        IO.puts("WARN: Error checking relation existence: #{inspect(reason)}")
        :ok
    end
  end
  
  # 确保必要的 relation_types 存在（使用 upsert 方案）
  defp ensure_relation_types_exist(tenant) do
    relation_types = [
      %{name: "prerequisite", display_name: "前置知识点", description: "学习本知识点前需要掌握的知识"},
      %{name: "postrequisite", display_name: "后置知识点", description: "学习本知识点后会自然掌握的下一阶段知识"},
      %{name: "related", display_name: "关联知识点", description: "与本知识点有密切联系的知识"}
    ]
    
    Enum.each(relation_types, fn rt ->
      # 直接使用 upsert，Ash 会自动处理：如果 name 已存在则更新，不存在则创建
      case KgEdu.Knowledge.RelationType.upsert_relation_type(rt, tenant: tenant, authorize?: false) do
        {:ok, _relation_type} ->
          IO.puts("INFO: Upserted relation type '#{rt.name}'")
        {:error, reason} ->
          IO.puts("WARN: Failed to upsert relation type '#{rt.name}': #{inspect(reason)}")
      end
    end)
    
    :ok
  end

  # 通用查找或创建资源
  # level_index 用于在 level 2 时增加 parent_unit_id 过滤条件，避免不同单元下同名 cell 被复用
  defp find_or_create_resource(name, knowledge_type, attrs, acc, level_index \\ nil) do
    trimmed_name = name |> safe_strip()
    if trimmed_name == "" or is_nil(trimmed_name) do
      {:ok, nil, acc}
    else
      course_id = Map.get(attrs, :course_id) || acc.course_id
      parent_unit_id = Map.get(attrs, :parent_unit_id)

      # 构建查询条件
      # 对于 level 2 的 cell，需要同时匹配 parent_unit_id，避免不同单元下同名 cell 被复用
      query = case level_index do
        2 when knowledge_type == :knowledge_cell and not is_nil(parent_unit_id) ->
          __MODULE__
          |> Ash.Query.filter(
            name == ^trimmed_name and 
            knowledge_type == ^knowledge_type and 
            course_id == ^course_id and
            parent_unit_id == ^parent_unit_id
          )
        _ ->
          __MODULE__
          |> Ash.Query.filter(
            name == ^trimmed_name and 
            knowledge_type == ^knowledge_type and 
            course_id == ^course_id
          )
      end
      
      case Ash.read_one(query, tenant: acc.tenant, authorize?: false) do
        {:ok, existing} when not is_nil(existing) ->
          IO.puts("DEBUG Found existing #{knowledge_type}: #{existing.name} (id: #{existing.id})")
          {:ok, existing.id, acc}

        _ ->
          # 创建新资源
          importance_level = parse_importance_from_tags(Map.get(attrs, :tag))

          resource_attrs = %{
            name: trimmed_name,
            knowledge_type: knowledge_type,
            course_id: course_id,
            parent_subject_id: Map.get(attrs, :parent_subject_id),
            parent_unit_id: Map.get(attrs, :parent_unit_id),
            parent_knowledge_resource_id: Map.get(attrs, :parent_knowledge_resource_id),
            importance_level: importance_level,
            tag: Map.get(attrs, :tag),
            dimension: Map.get(attrs, :dimension),
            category: Map.get(attrs, :category),
            teaching_goal: Map.get(attrs, :teaching_goal),
            description: Map.get(attrs, :description)
          }

          case create_resource_record(resource_attrs, acc.tenant, authorize?: false) do
            {:ok, resource} ->
              IO.puts("DEBUG Created #{knowledge_type}: #{resource.name} (id: #{resource.id})")
              {:ok, resource.id, acc}

            {:error, reason} ->
              IO.puts("DEBUG Create #{knowledge_type} error: #{inspect(reason)}")
              {:ok, nil, acc}
          end
      end
    end
  end

  # 辅助函数
  defp safe_get(list, index) do
    if index < length(list), do: Enum.at(list, index), else: nil
  end

  defp safe_strip(nil), do: nil
  defp safe_strip(val) when is_binary(val), do: String.trim(val)
  defp safe_strip(val), do: val

  defp find_deepest_level(levels) do
    filled_levels =
      levels
      |> Enum.with_index()
      |> Enum.filter(fn {name, _idx} ->
        name = safe_strip(name)
        name != nil and name != ""
      end)

    case filled_levels do
      [] -> {nil, -1}
      [{last, idx}] -> 
        {safe_strip(last), idx}
      multiple ->
        {last, idx} = List.last(multiple)
        {safe_strip(last), idx}
    end
  end

  defp parse_importance_from_tags(nil), do: :normal
  defp parse_importance_from_tags(tags) do
    tags = String.downcase(tags || "")
    cond do
      String.contains?(tags, "难点") -> :hard
      String.contains?(tags, "重点") or String.contains?(tags, "考点") -> :important
      true -> :normal
    end
  end

  # 处理关系 (后续可以扩展)
  defp process_relations(_knowledge_id, nil, nil, nil, acc), do: acc
  defp process_relations(_knowledge_id, _, _, _, acc) do
    acc
  end

  defp safe_get(list, index) do
    if index < length(list), do: Enum.at(list, index), else: nil
  end

  defp safe_strip(nil), do: nil
  defp safe_strip(val) when is_binary(val), do: String.trim(val)
  defp safe_strip(val), do: val

  defp find_deepest_level(levels) do
    filled_levels =
      levels
      |> Enum.with_index()
      |> Enum.filter(fn {name, _idx} ->
        name = safe_strip(name)
        name != nil and name != ""
      end)

    case filled_levels do
      [] -> {nil, -1}
      [_last] = one -> 
        last = elem(List.first(one), 0)
        idx = elem(List.first(one), 1)
        {safe_strip(last), idx}
      multiple ->
        last = elem(List.last(multiple), 0)
        idx = elem(List.last(multiple), 1)
        {safe_strip(last), idx}
    end
  end

  defp get_or_create_subject_for_level(nil, acc), do: {:ok, nil, acc}
  defp get_or_create_subject_for_level(subject_name, acc) do
    subject_name = safe_strip(subject_name)
    if subject_name == "" or is_nil(subject_name), do: {:ok, nil, acc}, else: do_get_or_create_subject(subject_name, acc)
  end

  defp do_get_or_create_subject(subject_name, acc) do
    course_id = acc.course_id
    
    # 确保 subject_name 被正确 trim
    trimmed_name = subject_name |> safe_strip()
    
    IO.puts("DEBUG do_get_or_create_subject: trimmed_name=#{trimmed_name}, tenant=#{acc.tenant}, course_id=#{course_id}")
    
    # Use Ash.read with tenant instead of get_by_name_and_course
    read_result = __MODULE__ |> Ash.read(tenant: acc.tenant, authorize?: false)
    IO.puts("DEBUG Ash.read result: #{inspect(read_result)}")
    
    case read_result do
      {:ok, resources} ->
        found = Enum.find(resources, fn r ->
          String.trim(r.name) == trimmed_name and r.knowledge_type == :subject and r.course_id == course_id
        end)
        IO.puts("DEBUG found subject: #{inspect(found)}")
        
        case found do
          nil ->
            # Subject doesn't exist, create it
            subject_attrs = %{
              name: trimmed_name,
              subject: trimmed_name,
              knowledge_type: :subject,
              course_id: course_id,
              importance_level: :normal
            }
            IO.puts("DEBUG Creating subject: #{inspect(subject_attrs)}")

            case create_resource_record(subject_attrs, acc.tenant, authorize?: false) do
              {:ok, subject} ->
                IO.puts("DEBUG Created subject: #{subject.id}")
                new_acc = %{acc | subjects: Map.put(acc.subjects, trimmed_name, subject.id)}
                {:ok, subject.id, new_acc}

              {:error, reason} ->
                IO.puts("DEBUG Create subject error: #{inspect(reason)}")
                {:ok, nil, acc}  # Skip on error
            end

          subject ->
            IO.puts("DEBUG Found existing subject: #{subject.id}")
            {:ok, subject.id, acc}
        end
      {:error, err} ->
        IO.puts("DEBUG Ash.read error: #{inspect(err)}")
        {:ok, nil, acc}
    end
  end

  defp get_or_create_unit(nil, _subject_id, acc), do: {:ok, nil, acc}
  defp get_or_create_unit("", _subject_id, acc), do: {:ok, nil, acc}
  defp get_or_create_unit(nil, _subject_id, acc), do: {:ok, nil, acc}
  defp get_or_create_unit(unit_name, subject_id, acc) when is_binary(unit_name) do
    # 确保 unit_name 被正确 trim
    trimmed_name = unit_name |> safe_strip()
    
    # 如果 trim 后为空，返回 nil
    if trimmed_name == "" do
      {:ok, nil, acc}
    else
      unit_key = {trimmed_name, subject_id}

      if Map.has_key?(acc.units, unit_key) do
        {:ok, Map.get(acc.units, unit_key), acc}
      else
        unit_attrs = %{
          name: trimmed_name,
          unit: trimmed_name,
          knowledge_type: :knowledge_unit,
          course_id: acc.course_id,
          parent_subject_id: subject_id,
          importance_level: :normal
        }


        case create_resource_record(unit_attrs, acc.tenant, authorize?: false) do
          {:ok, unit} ->
            new_acc = %{acc | units: Map.put(acc.units, unit_key, unit.id)}
            {:ok, unit.id, new_acc}
          {:error, _reason} ->
            {:ok, nil, acc}
        end
      end
    end
  end
  defp get_or_create_unit(_, _, acc), do: {:ok, nil, acc}

  defp create_or_update_knowledge_resource(
         name,
         description,
         tags,
         cognitive_dimension,
         classification,
         teaching_objective,
         level_index,
         subject_id,
         unit_id,
         acc
       ) do
    name = safe_strip(name)
    description = safe_strip(description)

    # Parse importance level from tags
    importance_level = parse_importance_from_tags(safe_strip(tags))

    # 根据 level_index 决定使用哪个 parent
    # level 0 (A列，一级知识点): 作为 knowledge_cell 创建，直接关联到 subject
    # level 1 (B列，二级知识点): parent_subject_id = subject_id, parent_unit_id = nil
    # level >=2 (C列及以下，三级知识点): parent_subject_id = subject_id, parent_unit_id = nil
    {parent_subject_id, parent_unit_id, parent_knowledge_id} = cond do
      level_index == 0 -> {subject_id, nil, nil}  # 一级知识点也作为 cell 创建
      level_index == 1 -> {subject_id, nil, nil}  # 二级知识点
      level_index >= 2 -> {subject_id, nil, nil}  # 三级及以上
      true -> {nil, nil, nil}
    end

    knowledge_attrs = %{
      name: name,
      description: description,
      subject: "",
      unit: nil,
      knowledge_type: :knowledge_cell,
      course_id: acc.course_id,
      parent_subject_id: parent_subject_id,
      parent_unit_id: parent_unit_id,
      parent_knowledge_resource_id: parent_knowledge_id,
      importance_level: importance_level,
      tag: tags,
      dimension: cognitive_dimension,
      category: classification,
      teaching_goal: teaching_objective
    }

    # Check if exists
    case get_by_name_and_course(
           %{name: name, knowledge_type: :knowledge_cell, course_id: acc.course_id},
           tenant: acc.tenant
         ) do
      {:ok, existing} ->
        {:ok, existing.id, acc}

      {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Query.NotFound{}]}} ->
        case create_resource_record(knowledge_attrs, acc.tenant) do
          {:ok, knowledge} ->
            {:ok, knowledge.id, acc}

          {:error, reason} ->
            IO.inspect("Failed to create knowledge: #{inspect(reason)}")
            {:error, reason}
        end

      {:error, reason} ->
        IO.inspect("Error checking knowledge existence: #{inspect(reason)}")
        {:ok, nil, acc}
    end
  end

  defp parse_importance_from_tags(nil), do: :normal
  defp parse_importance_from_tags(tags) do
    tags = String.downcase(tags)
    cond do
      String.contains?(tags, "难点") -> :hard
      String.contains?(tags, "重点") -> :important
      true -> :normal
    end
  end

  defp process_relations(_knowledge_id, nil, nil, nil, acc), do: acc
  defp process_relations(_knowledge_id, _, _, _, acc) do
    # TODO: Implement relation creation after knowledge resources are created
    # This requires a two-pass approach or deferred relation processing
    acc
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
        allow_nil?(false)
      end

      calculation(fn resource, args ->
        student_id = args[:student_id]
        tenant = Ash.Changeset.get_tenant(resource)

        case get_resource_learning_stats_via_materials(resource, student_id, tenant) do
          {:ok, stats} ->
            stats

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
      end)
    end

    calculate :display_number, :string do
      description("Display number converted from sort_path, e.g., '01.02.03' -> '1.2.3'")
      public?(true)

      calculation(fn resource, _args ->
        case resource.sort_path do
          "" ->
            ""

          nil ->
            ""

          path ->
            path
            |> String.split(".")
            |> Enum.map(&String.to_integer/1)
            |> Enum.join(".")
        end
      end)
    end

    calculate :level_number, :integer do
      description("Depth level of this resource in the hierarchy")
      public?(true)

      calculation(fn resource, _args ->
        case resource.sort_path do
          "" -> 1
          nil -> 1
          path -> path |> String.split(".") |> length()
        end
      end)
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
                 load: [:videos, :files, :homeworks, :exercises]
               ) do
            {:ok, loaded_resource} -> loaded_resource
            {:error, _reason} -> resource
          end

        {_, %Ash.NotLoaded{}, _, _} ->
          case KgEdu.Knowledge.Resource.get_knowledge_resource(resource.id,
                 tenant: tenant,
                 authorize?: false,
                 actor: nil,
                 load: [:videos, :files, :homeworks, :exercises]
               ) do
            {:ok, loaded_resource} -> loaded_resource
            {:error, _reason} -> resource
          end

        {_, _, %Ash.NotLoaded{}, _} ->
          case KgEdu.Knowledge.Resource.get_knowledge_resource(resource.id,
                 tenant: tenant,
                 authorize?: false,
                 actor: nil,
                 load: [:videos, :files, :homeworks, :exercises]
               ) do
            {:ok, loaded_resource} -> loaded_resource
            {:error, _reason} -> resource
          end

        {_, _, _, %Ash.NotLoaded{}} ->
          case KgEdu.Knowledge.Resource.get_knowledge_resource(resource.id,
                 tenant: tenant,
                 authorize?: false,
                 actor: nil,
                 load: [:videos, :files, :homeworks, :exercises]
               ) do
            {:ok, loaded_resource} -> loaded_resource
            {:error, _reason} -> resource
          end

        _ ->
          resource
      end

    # Get all material IDs associated with this knowledge resource
    video_ids =
      case resource_with_relationships.videos do
        %Ash.NotLoaded{} -> []
        videos -> videos |> Enum.map(& &1.id)
      end

    file_ids =
      case resource_with_relationships.files do
        %Ash.NotLoaded{} -> []
        files -> files |> Enum.map(& &1.id)
      end

    homework_ids =
      case resource_with_relationships.homeworks do
        %Ash.NotLoaded{} -> []
        homeworks -> homeworks |> Enum.map(& &1.id)
      end

    exercise_ids =
      case resource_with_relationships.exercises do
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
              (log.resource_type in ["KgEdu.Courses.Video", "Video"] and
                 log.resource_id in video_ids) or
              (log.resource_type in ["KgEdu.Knowledge.Homework", "Homework"] and
                 log.resource_id in homework_ids) or
              (log.resource_type in ["KgEdu.Knowledge.Exercise", "Exercise"] and
                 log.resource_id in exercise_ids)
          end)

        # Count completed activities by type
        completed_videos =
          student_logs
          |> Enum.filter(
            &(&1.resource_type in ["KgEdu.Courses.Video", "Video"] and
                &1.action_type in [:video_view, :view])
          )
          |> Enum.map(& &1.resource_id)
          |> Enum.uniq()
          |> length()

        completed_files =
          student_logs
          |> Enum.filter(
            &(&1.resource_type in ["KgEdu.Courses.File", "File"] and
                &1.action_type in [:file_view, :view, :download])
          )
          |> Enum.map(& &1.resource_id)
          |> Enum.uniq()
          |> length()

        completed_exercises =
          student_logs
          |> Enum.filter(
            &(&1.resource_type in ["KgEdu.Knowledge.Exercise", "Exercise"] and
                &1.action_type in [:exercise_submit, :submit, :complete])
          )
          |> Enum.map(& &1.resource_id)
          |> Enum.uniq()
          |> length()

        completed_homework =
          student_logs
          |> Enum.filter(
            &(&1.resource_type in ["KgEdu.Knowledge.Homework", "Homework"] and
                &1.action_type in [:homework_submit, :submit, :complete])
          )
          |> Enum.map(& &1.resource_id)
          |> Enum.uniq()
          |> length()

        # Calculate totals
        total_videos = length(video_ids)
        total_files = length(file_ids)
        total_exercises = length(exercise_ids)
        total_homework = length(homework_ids)

        total_completed =
          completed_videos + completed_files + completed_exercises + completed_homework

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
            completion_ratio:
              if(total_exercises > 0, do: completed_exercises / total_exercises, else: 0.0)
          },
          homeworks: %{
            completed: completed_homework,
            total: total_homework,
            completion_ratio:
              if(total_homework > 0, do: completed_homework / total_homework, else: 0.0)
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

  # ============ Helper Functions ============

  @doc """
  Build a nested cell hierarchy from flat cells based on parent_knowledge_resource_id.
  This function takes a list of cells and returns them structured as a nested tree.
  """
  def build_nested_cell_hierarchy(cells) when is_list(cells) do
    # Separate root cells (those WITHOUT parent_knowledge_resource_id) from nested cells
    {root_cells, nested_cells} =
      Enum.split_with(cells, fn cell ->
        is_nil(cell.parent_knowledge_resource_id)
      end)

    # Build a map of nested cells by their parent_id
    nested_by_parent =
      Enum.group_by(nested_cells, fn cell ->
        cell.parent_knowledge_resource_id
      end)

    # Recursively build the tree
    build_tree(root_cells, nested_by_parent)
  end

  defp build_tree(cells, children_map) do
    Enum.map(cells, fn cell ->
      children = Map.get(children_map, cell.id, [])
      nested_children = build_tree(children, children_map)

      # Add nestedChildCells to the cell map (using camelCase for consistency)
      cell
      |> Map.put(:nestedChildCells, nested_children)
    end)
  end

  @doc """
  Automatically nest cells by creation order when parent_knowledge_resource_id is not set.
  This is useful for flat hierarchies where cells should be nested based on their creation order.
  """
  def auto_nest_cells_by_order(cells, opts \\ []) do
    level_3_count = Keyword.get(opts, :level_3_count, 2)

    # Sort by creation time
    sorted_cells = Enum.sort_by(cells, & &1.inserted_at)

    # Split into level 3 (root) and nested cells
    {level_3_cells, nested_cells} = Enum.split(sorted_cells, level_3_count)

    # Build parent-child relationships
    build_nested_structure_by_order(level_3_cells, nested_cells, level_3_cells)
  end

  defp build_nested_structure_by_order(parents, remaining_cells, all_cells) do
    if Enum.empty?(remaining_cells) do
      parents
    else
      # Assign each remaining cell to a parent
      {new_parents, still_remaining} =
        Enum.reduce(remaining_cells, {parents, []}, fn cell, {acc_parents, acc_remaining} ->
          # Find parent: use previous cell or cycle through level_3 cells
          parent_index = min(length(all_cells) - length(acc_remaining) - 1, length(all_cells) - 1)
          parent = Enum.at(all_cells, parent_index)

          if parent do
            # Create nested relationship
            updated_parents = update_nested_children(acc_parents, parent.id, cell)
            {updated_parents, acc_remaining}
          else
            {acc_parents, [cell | acc_remaining]}
          end
        end)

      build_nested_structure_by_order(new_parents, still_remaining, all_cells)
    end
  end

  defp update_nested_children(parents, parent_id, child) do
    Enum.map(parents, fn
      %{id: ^parent_id} = parent ->
        existing_children = Map.get(parent, :nestedChildren, [])
        Map.put(parent, :nestedChildren, existing_children ++ [child])

      parent ->
        parent
    end)
  end

  defp calculate_sort_path_and_order(
         course_id,
         knowledge_type,
         parent_subject_id,
         parent_unit_id,
         parent_cell_id,
         tenant
       ) do
    parent_path =
      case {knowledge_type, parent_subject_id, parent_unit_id, parent_cell_id} do
        {:subject, _, _, _} ->
          ""

        {:knowledge_unit, subject_id, _, _} ->
          case get_knowledge_resource(%{id: subject_id}, tenant: tenant, authorize?: false) do
            {:ok, parent} -> parent.sort_path || ""
            _ -> ""
          end

        {:knowledge_cell, _, unit_id, _} when not is_nil(unit_id) ->
          case get_knowledge_resource(%{id: unit_id}, tenant: tenant, authorize?: false) do
            {:ok, parent} -> parent.sort_path || ""
            _ -> ""
          end

        {:knowledge_cell, _, _, cell_id} when not is_nil(cell_id) ->
          case get_knowledge_resource(%{id: cell_id}, tenant: tenant, authorize?: false) do
            {:ok, parent} -> parent.sort_path || ""
            _ -> ""
          end

        {:knowledge_cell, subject_id, _, _} when not is_nil(subject_id) ->
          case get_knowledge_resource(%{id: subject_id}, tenant: tenant, authorize?: false) do
            {:ok, parent} -> parent.sort_path || ""
            _ -> ""
          end

        _ ->
          ""
      end

    next_order =
      get_next_display_order(
        course_id,
        knowledge_type,
        parent_subject_id,
        parent_unit_id,
        parent_cell_id,
        tenant
      )

    new_path = build_sort_path(parent_path, next_order)

    {new_path, next_order}
  end

  defp get_next_display_order(
         course_id,
         knowledge_type,
         parent_subject_id,
         parent_unit_id,
         parent_cell_id,
         tenant
       ) do
    query =
      __MODULE__
      |> Ash.Query.filter(course_id == ^course_id)
      |> Ash.Query.filter(knowledge_type == ^knowledge_type)
      |> then(fn q ->
        case {knowledge_type, parent_subject_id, parent_unit_id, parent_cell_id} do
          {:subject, _, _, _} ->
            Ash.Query.filter(q, is_nil(parent_subject_id))

          {:knowledge_unit, subject_id, _, _} ->
            Ash.Query.filter(q, parent_subject_id == ^subject_id)

          {:knowledge_cell, _, unit_id, _} when not is_nil(unit_id) ->
            Ash.Query.filter(
              q,
              parent_unit_id == ^unit_id and is_nil(parent_knowledge_resource_id)
            )

          {:knowledge_cell, _, _, cell_id} when not is_nil(cell_id) ->
            Ash.Query.filter(q, parent_knowledge_resource_id == ^cell_id)

          {:knowledge_cell, subject_id, _, _} when not is_nil(subject_id) ->
            Ash.Query.filter(
              q,
              parent_subject_id == ^subject_id and is_nil(parent_unit_id) and
                is_nil(parent_knowledge_resource_id)
            )

          _ ->
            q
        end
      end)

    case Ash.read(query, tenant: tenant, authorize?: false) do
      {:ok, resources} ->
        max_order =
          resources
          |> Enum.map(&(&1.display_order || 0))
          |> Enum.max(fn -> 0 end)

        max_order + 1

      _ ->
        1
    end
  end

  defp build_sort_path(parent_path, order) do
    # 使用 4 位数字格式，与导入时的格式保持一致（如 "0001", "00010002"）
    order_str = String.pad_leading(Integer.to_string(order), 4, "0")

    if parent_path == "" or is_nil(parent_path) do
      order_str
    else
      "#{parent_path}#{order_str}"
    end
  end

  defp get_parent_sort_path(resource) do
    case resource.sort_path do
      "" ->
        ""

      nil ->
        ""

      path ->
        # sortPath 格式为 "000100020002"，每级 4 位字符
        # 父级路径是去掉最后 4 位字符
        if String.length(path) > 4 do
          String.slice(path, 0..-5)
        else
          ""
        end
    end
  end

  defp reorder_siblings(resource, old_order, new_order, tenant) do
    parent_path = get_parent_sort_path(resource)

    query =
      __MODULE__
      |> Ash.Query.filter(course_id == ^resource.course_id)
      |> Ash.Query.filter(knowledge_type == ^resource.knowledge_type)
      |> then(fn q ->
        case {resource.parent_subject_id, resource.parent_unit_id,
              resource.parent_knowledge_resource_id} do
          {nil, nil, nil} ->
            Ash.Query.filter(q, is_nil(parent_subject_id))

          {subject_id, nil, nil} when not is_nil(subject_id) ->
            Ash.Query.filter(
              q,
              parent_subject_id == ^subject_id and is_nil(parent_unit_id) and
                is_nil(parent_knowledge_resource_id)
            )

          {_, unit_id, nil} when not is_nil(unit_id) ->
            Ash.Query.filter(
              q,
              parent_unit_id == ^unit_id and is_nil(parent_knowledge_resource_id)
            )

          {_, _, cell_id} when not is_nil(cell_id) ->
            Ash.Query.filter(q, parent_knowledge_resource_id == ^cell_id)

          _ ->
            q
        end
      end)
      |> Ash.Query.filter(id != ^resource.id)

    case Ash.read(query, tenant: tenant, authorize?: false) do
      {:ok, siblings} ->
        siblings_to_update =
          if new_order < old_order do
            Enum.filter(siblings, fn s ->
              (s.display_order || 0) >= new_order and (s.display_order || 0) < old_order
            end)
          else
            Enum.filter(siblings, fn s ->
              (s.display_order || 0) > old_order and (s.display_order || 0) <= new_order
            end)
          end

        Enum.each(siblings_to_update, fn sibling ->
          shift = if new_order < old_order, do: 1, else: -1
          new_sibling_order = (sibling.display_order || 0) + shift
          new_sibling_path = build_sort_path(parent_path, new_sibling_order)

          update_knowledge_resource(
            sibling,
            %{
              display_order: new_sibling_order,
              sort_path: new_sibling_path
            },
            tenant: tenant,
            authorize?: false
          )
        end)

      _ ->
        :ok
    end
  end

  defp regenerate_course_sort_paths(course_id, tenant) do
    case get_knowledge_resources_by_course(%{course_id: course_id},
           tenant: tenant,
           authorize?: false
         ) do
      {:ok, resources} ->
        subjects =
          Enum.filter(resources, &(&1.knowledge_type == :subject))
          |> Enum.sort_by(& &1.inserted_at)

        Enum.with_index(subjects, 1)
        |> Enum.each(fn {subject, idx} ->
          path = build_sort_path("", idx)

          update_knowledge_resource(subject, %{sort_path: path, display_order: idx},
            tenant: tenant,
            authorize?: false
          )

          regenerate_unit_sort_paths(subject, path, resources, tenant)
        end)

        :ok

      {:error, reason} ->
        {:error, "Failed to get resources: #{inspect(reason)}"}
    end
  end

  defp regenerate_unit_sort_paths(subject, parent_path, all_resources, tenant) do
    units =
      Enum.filter(
        all_resources,
        &(&1.knowledge_type == :knowledge_unit and &1.parent_subject_id == subject.id)
      )
      |> Enum.sort_by(& &1.inserted_at)

    Enum.with_index(units, 1)
    |> Enum.each(fn {unit, idx} ->
      path = build_sort_path(parent_path, idx)

      update_knowledge_resource(unit, %{sort_path: path, display_order: idx},
        tenant: tenant,
        authorize?: false
      )

      regenerate_cell_sort_paths(unit, path, all_resources, tenant)
    end)
  end

  defp regenerate_cell_sort_paths(parent, parent_path, all_resources, tenant) do
    cells =
      case parent.knowledge_type do
        :knowledge_unit ->
          Enum.filter(
            all_resources,
            &(&1.knowledge_type == :knowledge_cell and &1.parent_unit_id == parent.id and
                is_nil(&1.parent_knowledge_resource_id))
          )

        :knowledge_cell ->
          Enum.filter(
            all_resources,
            &(&1.knowledge_type == :knowledge_cell and
                &1.parent_knowledge_resource_id == parent.id)
          )

        _ ->
          []
      end
      |> Enum.sort_by(& &1.inserted_at)

    Enum.with_index(cells, 1)
    |> Enum.each(fn {cell, idx} ->
      path = build_sort_path(parent_path, idx)

      update_knowledge_resource(cell, %{sort_path: path, display_order: idx},
        tenant: tenant,
        authorize?: false
      )

      regenerate_cell_sort_paths(cell, path, all_resources, tenant)
    end)
  end
end

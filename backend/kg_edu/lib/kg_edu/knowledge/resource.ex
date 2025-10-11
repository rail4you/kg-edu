defmodule KgEdu.Knowledge.Resource do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "knowledge_resources"
    repo KgEdu.Repo
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

    # Course-related queries
    define :get_knowledge_resources_by_course, action: :by_course
    define :search_knowledge_resources, action: :search

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
  end

  actions do
    defaults [:read, :update, :destroy]

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
          direct_cells: []
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
      description "Update a knowledge resource"
      accept [:name, :description, :unit]
    end
  end

  policies do
    policy always() do
      authorize_if always()
    end
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
    attribute :importance_level, :atom do
      allow_nil? false
      constraints one_of: [:hard, :important, :normal]
      default :normal
      public? true
      description "Importance level of this knowledge resource"
    end

    attribute :name, :string do
      allow_nil? false
      constraints min_length: 3, max_length: 100
      public? true
    end

    attribute :description, :string do
      allow_nil? true
      constraints max_length: 1000
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
  end

  identities do
    identity :unique_name_per_course, [:name, :course_id]
  end
end

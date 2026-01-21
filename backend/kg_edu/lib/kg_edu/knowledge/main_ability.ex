defmodule KgEdu.Knowledge.MainAbility do
  @moduledoc """
  Main Ability resource (主能力).
  Represents a high-level ability/skill that students should learn in a course.
  A course has multiple main abilities, and each main ability has multiple sub-abilities.
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "main_abilities"
    repo KgEdu.Repo
  end

  multitenancy do
    strategy :context
  end

  json_api do
    type "main_ability"
  end

  typescript do
    type_name "MainAbility"
  end

  code_interface do
    define :create_main_ability, action: :create
    define :update_main_ability, action: :update
    define :destroy_main_ability, action: :destroy
    define :get_main_ability, action: :read, get_by: [:id]
    define :list_main_abilities, action: :read
    define :get_main_abilities_by_course, action: :by_course
    define :get_main_ability_by_name, action: :by_name
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      primary? true
      accept [:name, :description, :course_id]
    end

    update :update do
      primary? true
      accept [:name, :description]
    end

    read :by_course do
      description "Get all main abilities for a specific course"
      argument :course_id, :uuid do
        allow_nil? false
      end

      filter expr(course_id == ^arg(:course_id))
    end

    read :by_name do
      description "Get a main ability by name within a course"
      argument :name, :string do
        allow_nil? false
      end

      argument :course_id, :uuid do
        allow_nil? false
      end

      get? true
      filter expr(name == ^arg(:name) and course_id == ^arg(:course_id))
    end
  end

  policies do
    policy always() do
      authorize_if always()
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :name, :string do
      allow_nil? false
      public? true
      description "The name of the main ability"
    end

    attribute :description, :string do
      allow_nil? true
      public? true
      description "The description of the main ability"
    end

    timestamps()
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      public? true
      allow_nil? false
      description "The course this main ability belongs to"
    end

    has_many :sub_abilities, KgEdu.Knowledge.SubAbility do
      public? true
      destination_attribute :main_ability_id
      description "Sub-abilities that belong to this main ability"
    end
  end

  aggregates do
    count :sub_abilities_count, :sub_abilities do
      public? true
      description "Count of sub-abilities for this main ability"
    end
  end
end

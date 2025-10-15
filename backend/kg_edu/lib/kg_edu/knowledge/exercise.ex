defmodule KgEdu.Knowledge.Exercise do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]


  typescript do
    type_name "Exercise"
  end


  postgres do
    table "exercises"
    repo KgEdu.Repo
  end

  json_api do
    type "exercise"
  end

  code_interface do
    define :get_exercise, action: :by_id
    define :list_exercises, action: :read
    define :get_exercises_by_knowledge, action: :by_knowledge
    define :get_exercises_by_course, action: :by_course
    define :create_exercise, action: :create
    define :update_exercise, action: :update_exercise
    define :delete_exercise, action: :destroy
    define :generate_ai_exercise, action: :generate_ai_exercise
    define :get_recent_ai_exercises, action: :recent_ai_exercises
    define :link_exercise_to_knowledge, action: :link_exercise_to_knowledge
    define :unlink_exercise_from_knowledge, action: :unlink_exercise_from_knowledge
  end

  actions do
    defaults [:read, :update, :destroy]

    read :by_id do
      description "Get an exercise by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_knowledge do
      description "Get exercises for a specific knowledge resource"
      argument :knowledge_resource_id, :uuid, allow_nil?: false
      filter expr(knowledge_resource_id == ^arg(:knowledge_resource_id))
    end

    read :by_course do
      description "Get exercises for a specific course"
      argument :course_id, :uuid, allow_nil?: false
      filter expr(course_id == ^arg(:course_id))
    end

    read :recent_ai_exercises do
      description "Get recent AI-generated exercises"
      argument :course_id, :uuid, allow_nil?: true
      argument :limit, :integer, allow_nil?: true, default: 10

      filter expr(ai_type == :ai_generated)

      prepare fn query, _context ->
        query
        |> Ash.Query.sort(inserted_at: :desc)
        |> Ash.Query.limit(10)
      end
    end

    create :create do
      description "Create a new exercise"
      accept [:title, :question_content, :answer, :question_type, :options, :knowledge_resource_id, :course_id, :ai_type]
      # change {KgEdu.Knowledge.Exercise.Changes.ValidateOptions, []}
    end

    update :update_exercise do
      description "Update an exercise"
      accept [:title, :question_content, :answer, :question_type, :options, :knowledge_resource_id, :ai_type]
      # change {KgEdu.Knowledge.Exercise.Changes.ValidateOptions, []}
    end

    update :link_exercise_to_knowledge do
      description "Link an exercise to a knowledge resource"
      require_atomic? false

      argument :knowledge_resource_id, :uuid do
        allow_nil? false
        description "The knowledge resource ID to link to"
      end

      change manage_relationship(:knowledge_resource_id, :knowledge_resource, type: :append_and_remove)
    end

    update :unlink_exercise_from_knowledge do
      description "Unlink an exercise from its knowledge resource"
      require_atomic? false

      change set_attribute(:knowledge_resource_id, nil)
    end

    create :generate_ai_exercise do
      description "Generate an AI exercise based on course, knowledge, chapter, and exercise type"
      argument :course_name, :string do
        allow_nil? false
        description "Name of the course"
      end

      argument :knowledge_name, :string do
        allow_nil? false
        description "Name of the knowledge resource"
      end

      argument :chapter_name, :string do
        allow_nil? true
        description "Name of the chapter"
      end

      argument :exercise_type, :atom do
        allow_nil? false
        constraints one_of: [:multiple_choice, :essay, :fill_in_blank]
        description "Type of exercise to generate"
      end

      argument :number, :integer do
        allow_nil? false
        default 1
        description "Number of exercises to generate"
      end

      accept [:course_id]
      
      change set_attribute(:ai_type, :ai_generated)

      change {KgEdu.Knowledge.Exercise.Changes.GenerateAIExercise, []}
    end
  end

  policies do
    policy always() do
      authorize_if always()
    end
    # policy action_type([:read, :create, :update]) do
    #   description "All authenticated users can read exercises"
    #   authorize_if actor_present()
    # end
  end

  attributes do
    uuid_primary_key :id

    attribute :title, :string do
      allow_nil? false
      constraints min_length: 3, max_length: 200
      public? true
    end

    attribute :question_content, :string do
      allow_nil? false
      # constraints min_length: 10, max_length: 2000
      public? true
    end

    attribute :answer, :string do
      allow_nil? false
      constraints min_length: 1, max_length: 2000
      public? true
    end

    attribute :question_type, :atom do
      allow_nil? false
      constraints one_of: [:multiple_choice, :essay, :fill_in_blank]
      public? true
    end

    attribute :options, :map do
      allow_nil? true
      description "Options for multiple choice questions. Stored as map with A, B, C, D keys and selected values."
      public? true
    end

    attribute :ai_type, :atom do
      allow_nil? true
      constraints one_of: [:ai_generated]
      public? true
      description "Type of AI generation for this exercise"
    end

    timestamps()
  end

  relationships do
    belongs_to :knowledge_resource, KgEdu.Knowledge.Resource do
      public? true
      allow_nil? true
    end

    belongs_to :course, KgEdu.Courses.Course do
      public? true
      allow_nil? false
    end

    belongs_to :created_by, KgEdu.Accounts.User do
      public? true
    end
  end

  identities do
    identity :unique_title_per_course, [:title, :course_id]
  end
end

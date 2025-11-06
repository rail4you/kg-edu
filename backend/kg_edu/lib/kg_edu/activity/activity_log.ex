defmodule KgEdu.Activity.ActivityLog do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Activity,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Logger

  typescript do
    type_name "ActivityLog"
  end

  postgres do
    table "activity_logs"
    repo KgEdu.Repo
  end

  multitenancy do
    strategy :context
  end

  json_api do
    type "activity_log"
  end

  code_interface do
    define :log_file_view, action: :log_file_view
    define :log_video_view, action: :log_video_view
    define :log_exercise_submit, action: :log_exercise_submit
    define :log_homework_submit, action: :log_homework_submit
    define :get_activity_log, action: :by_id
    define :list_activity_logs, action: :read
    define :list_activity_logs_by_user, action: :by_user
    define :list_activity_logs_by_action_type, action: :by_action_type
    define :list_activity_logs_by_resource_type, action: :by_resource_type
    define :list_activity_logs_by_time_range, action: :by_time_range
    define :get_view_count_distribution, action: :view_count_distribution
  end

  actions do
    defaults [:read]

    read :by_id do
      description "Get an activity log by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_user do
      description "Get activity logs for a specific user"
      argument :user_id, :uuid, allow_nil?: false
      filter expr(user_id == ^arg(:user_id))
    end

    read :by_action_type do
      description "Get activity logs by action type"
      argument :action_type, :atom, allow_nil?: false
      filter expr(action_type == ^arg(:action_type))
    end

    read :by_resource_type do
      description "Get activity logs by resource type"
      argument :resource_type, :string, allow_nil?: false
      filter expr(resource_type == ^arg(:resource_type))
    end

    read :by_time_range do
      description "Get activity logs within a time range"
      argument :start_date, :date, allow_nil?: false
      argument :end_date, :date, allow_nil?: false

      filter expr(inserted_at >= ^arg(:start_date) and inserted_at <= ^arg(:end_date))
    end

    read :view_count_distribution do
      description "Get view count distribution by resource type"

      filter expr(action_type in [:file_view, :video_view])
    end

    create :log_file_view do
      description "Log when a user views a file"

      argument :user_id, :uuid do
        allow_nil? false
        description "User ID who viewed the file"
      end

      argument :file_id, :uuid do
        allow_nil? false
        description "File ID that was viewed"
      end

      argument :metadata, :map do
        allow_nil? true
        default %{}
        description "Additional metadata about the view"
      end

      change set_attribute(:action_type, :file_view)
      change set_attribute(:resource_type, "File")
      change set_attribute(:resource_id, arg(:file_id))
      change set_attribute(:user_id, arg(:user_id))
      change set_attribute(:metadata, arg(:metadata))

      change fn changeset, _context ->
        # Log the activity
        user_id = Ash.Changeset.get_attribute(changeset, :user_id)
        file_id = Ash.Changeset.get_attribute(changeset, :resource_id)

        Logger.info("File view logged: user_id=#{user_id}, file_id=#{file_id}")
        changeset
      end
    end

    create :log_video_view do
      description "Log when a user views a video"

      argument :user_id, :uuid do
        allow_nil? false
        description "User ID who viewed the video"
      end

      argument :video_id, :uuid do
        allow_nil? false
        description "Video ID that was viewed"
      end

      argument :metadata, :map do
        allow_nil? true
        default %{}
        description "Additional metadata about the view (e.g., watch time)"
      end

      change set_attribute(:action_type, :video_view)
      change set_attribute(:resource_type, "Video")
      change set_attribute(:resource_id, arg(:video_id))
      change set_attribute(:user_id, arg(:user_id))
      change set_attribute(:metadata, arg(:metadata))

      change fn changeset, _context ->
        # Log the activity
        user_id = Ash.Changeset.get_attribute(changeset, :user_id)
        video_id = Ash.Changeset.get_attribute(changeset, :resource_id)

        Logger.info("Video view logged: user_id=#{user_id}, video_id=#{video_id}")
        changeset
      end
    end

    create :log_exercise_submit do
      description "Log when a user submits an exercise answer"

      argument :user_id, :uuid do
        allow_nil? false
        description "User ID who submitted the exercise"
      end

      argument :exercise_id, :uuid do
        allow_nil? false
        description "Exercise ID that was submitted"
      end

      argument :answer, :string do
        allow_nil? false
        description "The answer submitted by the user"
      end

      argument :metadata, :map do
        allow_nil? true
        default %{}
        description "Additional metadata about the submission"
      end

      change set_attribute(:action_type, :exercise_submit)
      change set_attribute(:resource_type, "Exercise")
      change set_attribute(:resource_id, arg(:exercise_id))
      change set_attribute(:user_id, arg(:user_id))

      change fn changeset, _context ->
        answer = Ash.Changeset.get_argument(changeset, :answer)
        metadata = Ash.Changeset.get_argument(changeset, :metadata) || %{}

        # Store answer in metadata
        updated_metadata = Map.put(metadata, "answer", answer)

        changeset
        |> Ash.Changeset.change_attribute(:metadata, updated_metadata)
      end

      change fn changeset, _context ->
        # Log the activity
        user_id = Ash.Changeset.get_attribute(changeset, :user_id)
        exercise_id = Ash.Changeset.get_attribute(changeset, :resource_id)

        Logger.info("Exercise submission logged: user_id=#{user_id}, exercise_id=#{exercise_id}")
        changeset
      end
    end

    create :log_homework_submit do
      description "Log when a user submits homework"

      argument :user_id, :uuid do
        allow_nil? false
        description "User ID who submitted the homework"
      end

      argument :homework_id, :uuid do
        allow_nil? false
        description "Homework ID that was submitted"
      end

      argument :answer, :string do
        allow_nil? false
        description "The answer submitted by the user"
      end

      argument :metadata, :map do
        allow_nil? true
        default %{}
        description "Additional metadata about the submission"
      end

      change set_attribute(:action_type, :homework_submit)
      change set_attribute(:resource_type, "Homework")
      change set_attribute(:resource_id, arg(:homework_id))
      change set_attribute(:user_id, arg(:user_id))

      change fn changeset, _context ->
        answer = Ash.Changeset.get_argument(changeset, :answer)
        metadata = Ash.Changeset.get_argument(changeset, :metadata) || %{}

        # Store answer in metadata
        updated_metadata = Map.put(metadata, "answer", answer)

        changeset
        |> Ash.Changeset.change_attribute(:metadata, updated_metadata)
      end

      change fn changeset, _context ->
        # Log the activity
        user_id = Ash.Changeset.get_attribute(changeset, :user_id)
        homework_id = Ash.Changeset.get_attribute(changeset, :resource_id)

        Logger.info("Homework submission logged: user_id=#{user_id}, homework_id=#{homework_id}")
        changeset
      end
    end
  end

  policies do
    policy always() do
      authorize_if always()
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :user_id, :uuid do
      allow_nil? false
      public? true
      description "User who performed the action"
    end

    attribute :action_type, :atom do
      allow_nil? false
      public? true
      constraints one_of: [:file_view, :video_view, :exercise_submit, :homework_submit]
      description "Type of action performed"
    end

    attribute :resource_type, :string do
      allow_nil? false
      public? true
      description "Type of resource (File, Video, Exercise, Homework)"
    end

    attribute :resource_id, :uuid do
      allow_nil? false
      public? true
      description "ID of the resource that was acted upon"
    end

    attribute :metadata, :map do
      allow_nil? true
      default %{}
      public? true
      description "Additional metadata (answers, timestamps, etc.)"
    end

    create_timestamp :inserted_at do
      public? true
    end
  end

  relationships do
    belongs_to :user, KgEdu.Accounts.User do
      public? true
      allow_nil? false
      description "The user who performed this action"
    end
  end

  calculations do
    calculate :action_description, :string do
      calculation expr(
        cond do
          action_type == :file_view -> "Viewed file"
          action_type == :video_view -> "Viewed video"
          action_type == :exercise_submit -> "Submitted exercise"
          action_type == :homework_submit -> "Submitted homework"
          true -> "Unknown action"
        end
      )
    end
  end
end

defmodule KgEdu.Courses.CourseVideo do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Courses,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  postgres do
    table "course_videos"
    repo KgEdu.Repo
  end

  json_api do
    type "course_video"
  end

  typescript do
    type_name "CourseVideo"
  end

  code_interface do
    define :create_course_video, action: :create
    define :update_course_video, action: :update
    define :delete_course_video, action: :destroy
    define :get_course_video, action: :read, get_by: [:id]
    define :list_course_videos, action: :read
    define :list_course_videos_by_course, action: :by_course
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [:name, :media_type, :video_url, :image_url, :course_id]

      validate &validate_media_payload/2
    end

    update :update do
      accept [:name, :media_type, :video_url, :image_url, :course_id]
      require_atomic? false

      validate &validate_media_payload/2
    end

    read :by_course do
      description "Get course videos for a specific course"

      argument :course_id, :uuid do
        allow_nil? false
      end

      filter expr(course_id == ^arg(:course_id))
    end
  end

  policies do
    # Default policy - allow everything for now
    policy always() do
      authorize_if always()
    end
  end

  multitenancy do
    strategy :context
  end

  attributes do
    uuid_primary_key :id do
      public? true
    end

    attribute :name, :atom do
      allow_nil? false
      public? true
      description "The name/title of the course video"
      constraints one_of: [:课程视频, :课程体系, :课程结构, :课程地图]
    end

    attribute :media_type, :atom do
      allow_nil? false
      public? true
      default :video
      description "The media type of the course asset"
      constraints one_of: [:video, :image]
    end

    attribute :video_url, :string do
      allow_nil? true
      public? true
      description "The URL of the video file"
    end

    attribute :image_url, :string do
      allow_nil? true
      public? true
      description "The thumbnail image URL for the video"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      allow_nil? false
      public? true
      description "The course this video belongs to"
    end
  end

  defp validate_media_payload(changeset, _context) do
    media_type = Ash.Changeset.get_attribute(changeset, :media_type) || :video
    video_url = Ash.Changeset.get_attribute(changeset, :video_url)
    image_url = Ash.Changeset.get_attribute(changeset, :image_url)

    cond do
      media_type == :video and blank?(video_url) ->
        {:error,
         %Ash.Error.Changes.InvalidAttribute{
           field: :video_url,
           message: "视频类型必须提供视频地址"
         }}

      media_type == :image and blank?(image_url) ->
        {:error,
         %Ash.Error.Changes.InvalidAttribute{
           field: :image_url,
           message: "图片类型必须提供图片地址"
         }}

      true ->
        :ok
    end
  end

  defp blank?(value), do: value in [nil, ""]
end

defmodule KgEdu.Courses.Video do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Courses,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  # Helper function to get course_id from chapter
  defp get_course_id_from_chapter(nil), do: {:error, "Chapter ID is required to determine course"}

  defp get_course_id_from_chapter(chapter_id) do
    case Ash.get(KgEdu.Courses.Chapter, chapter_id, load: [:course]) do
      {:ok, chapter} when not is_nil(chapter.course) ->
        {:ok, chapter.course.id}

      {:ok, nil} ->
        {:error, "Chapter not found"}

      {:ok, chapter} when is_nil(chapter.course) ->
        {:error, "Chapter is not associated with a course"}

      {:error, _reason} ->
        {:error, "Failed to get chapter"}
    end
  end

  postgres do
    table "videos"
    repo KgEdu.Repo
    
    references do
      reference :chapter, on_delete: :delete
    end
  end

  typescript do
    type_name "Video"
  end

  json_api do
    type "video"
  end

  typescript_rpc do
    resource KgEdu.Courses.Video do
      rpc_action :list_videos, :read
      rpc_action :create_video, :create
      rpc_action :get_video, :read
      rpc_action :update_video, :update_video
      rpc_action :delete_video, :destroy
      rpc_action :get_videos_by_chapter, :by_chapter
      rpc_action :get_videos_by_knowledge_resource, :by_knowledge_resource
    end
  end

  code_interface do
    define :create_video, action: :create
    define :upload_video, action: :upload_phoenix
    define :update_video, action: :update
    define :delete_video, action: :destroy
    define :get_video, action: :read, get_by: [:id]
    define :get_video_by_upload_id, action: :read, get_by: [:upload_id]
    define :list_videos, action: :read
    define :get_videos_by_chapter, action: :by_chapter
    define :get_videos_by_knowledge_resource, action: :by_knowledge_resource
    define :link_video_to_knowledge, action: :link_video_to_knowledge
    define :unlink_video_from_knowledge, action: :unlink_video_from_knowledge
    define :link_video_to_chapter, action: :link_video_to_chapter
    define :unlink_video_from_chapter, action: :unlink_video_from_chapter
  end

  actions do
    defaults [:read, :update, :destroy]

    read :by_chapter do
      description "Get all videos for a specific chapter"
      argument :chapter_id, :uuid do
        allow_nil? false
      end

      filter expr(chapter_id == ^arg(:chapter_id))
      prepare fn query, _context ->
        Ash.Query.sort(query, title: :asc)
      end
    end

    read :by_knowledge_resource do
      description "Get all videos for a specific knowledge resource"
      argument :knowledge_resource_id, :uuid do
        allow_nil? false
      end

      filter expr(knowledge_resource_id == ^arg(:knowledge_resource_id))
      prepare fn query, _context ->
        Ash.Query.sort(query, title: :asc)
      end
    end

    create :upload_phoenix do
      description "Upload a video using Phoenix upload plug and create video record"

      argument :upload, :map do
        allow_nil? false
        description "Phoenix upload plug data"
      end

      argument :chapter_id, :uuid do
        allow_nil? true
        description "Chapter ID to associate the video with (optional)"
      end

      argument :title, :string do
        allow_nil? true
        description "Video title"
      end

      change manage_relationship(:chapter_id, :chapter, type: :append_and_remove)

      change fn changeset, _context ->
        upload = Ash.Changeset.get_argument(changeset, :upload)
        chapter_id = Ash.Changeset.get_argument(changeset, :chapter_id)

        case upload do
          nil ->
            Ash.Changeset.add_error(changeset, "Video upload is required")

          %Plug.Upload{path: temp_path, filename: original_filename, content_type: content_type} ->
            # Get course_id from chapter if provided, otherwise use default
            case get_course_id_from_chapter(chapter_id) do
              {:ok, course_id} ->
                # Store video using Waffle
                case KgEduWeb.CourseVideoUploader.store({upload, course_id}) do
                  {:ok, file_url} ->
                    # Get video file size
                    case File.stat(temp_path) do
                      {:ok, stat} ->

                        playback_url = KgEduWeb.CourseVideoUploader.url({file_url, course_id})
                        # Generate thumbnail URL using OSS image processing
                        thumbnail_url = "#{playback_url}?x-oss-process=video/snapshot,t_7000,f_jpg,w_800,h_600,m_fast"

                        # Get the full URL for playback_id

                        title = Ash.Changeset.get_argument(changeset, :title) || Path.basename(original_filename, Path.extname(original_filename))

                        changeset
                        |> Ash.Changeset.change_attribute(:title, title)
                        |> Ash.Changeset.change_attribute(:playback_id, playback_url)
                        |> Ash.Changeset.change_attribute(:asset_id, playback_url)
                        |> Ash.Changeset.change_attribute(:thumbnail, thumbnail_url)
                        |> Ash.Changeset.change_attribute(:duration, 10.00) # Will be updated later if needed

                      {:error, _reason} ->
                        Ash.Changeset.add_error(changeset, "Failed to get video file size")
                    end

                  {:error, reason} ->
                    Ash.Changeset.add_error(changeset, "Failed to store video: #{inspect(reason)}")
                end

              {:error, reason} ->
                Ash.Changeset.add_error(changeset, reason)
            end

          _ ->
            Ash.Changeset.add_error(changeset, "Invalid upload format")
        end
      end
    end

    create :create do
      description "Create a new video"
      accept [:title, :asset_id, :playback_id, :duration, :thumbnail, :upload_id, :chapter_id, :knowledge_resource_id]

      # validate fn changeset, _context ->
      #   chapter_id = Ash.Changeset.get_attribute(changeset, :chapter_id)
      #   knowledge_resource_id = Ash.Changeset.get_attribute(changeset, :knowledge_resource_id)
      #   upload_id = Ash.Changeset.get_attribute(changeset, :upload_id)

      #   # At least one of chapter_id or knowledge_resource_id must be provided, or upload_id must be present
      #   if is_nil(chapter_id) && is_nil(knowledge_resource_id) && is_nil(upload_id) do
      #     {:error, "Video must be associated with either a chapter or a knowledge resource, or have an upload_id"}
      #   else
      #     :ok
      #   end
      # end
    end

    update :update_video do
      description "Update a video"
      accept [:title, :asset_id, :playback_id, :duration, :thumbnail, :upload_id, :chapter_id, :knowledge_resource_id]
      require_atomic? false

      # validate fn changeset, _context ->
      #   chapter_id = Ash.Changeset.get_attribute(changeset, :chapter_id)
      #   knowledge_resource_id = Ash.Changeset.get_attribute(changeset, :knowledge_resource_id)
      #   upload_id = Ash.Changeset.get_attribute(changeset, :upload_id)

      #   # At least one of chapter_id or knowledge_resource_id must be provided, or upload_id must be present
      #   if is_nil(chapter_id) && is_nil(knowledge_resource_id) && is_nil(upload_id) do
      #     {:error, "Video must be associated with either a chapter or a knowledge resource, or have an upload_id"}
      #   else
      #     :ok
      #   end
      # end
    end

    update :link_video_to_knowledge do
      description "Link a video to a knowledge resource"
      require_atomic? false

      argument :knowledge_resource_id, :uuid do
        allow_nil? false
        description "The knowledge resource ID to link to"
      end

      change manage_relationship(:knowledge_resource_id, :knowledge_resource, type: :append_and_remove)
    end

    update :unlink_video_from_knowledge do
      description "Unlink a video from its knowledge resource"
      require_atomic? false

      change set_attribute(:knowledge_resource_id, nil)
    end

    update :link_video_to_chapter do
      description "Link a video to a chapter"
      require_atomic? false

      argument :chapter_id, :uuid do
        allow_nil? false
        description "The chapter ID to link to"
      end

      change set_attribute(:chapter_id, arg(:chapter_id))
    end

    update :unlink_video_from_chapter do
      description "Unlink a video from its chapter"
      require_atomic? false

      change set_attribute(:chapter_id, nil)
    end
  end

  policies do
    policy always() do
      authorize_if always()
    end
  end

  attributes do
    uuid_primary_key :id do
      public? true
    end

    attribute :title, :string do
      allow_nil? true
      # constraints min_length: 1, max_length: 200
      public? true
      description "Video title"
    end

    attribute :upload_id, :string do
      allow_nil? true
      constraints max_length: 200
      public? true
      description "Upload ID from video hosting service"
    end

    attribute :asset_id, :string do
      allow_nil? false
      # constraints min_length: 1, max_length: 200
      public? true
      description "Video asset ID (from video hosting service)"
    end

    attribute :playback_id, :string do
      allow_nil? false
      # constraints min_length: 1, max_length: 200
      public? true
      description "Video playback ID (from video hosting service)"
    end

    attribute :duration, :float do
      allow_nil? true
      public? true
      description "Video duration in seconds"
    end

    attribute :thumbnail, :string do
      allow_nil? true
      # constraints max_length: 500
      public? true
      description "Thumbnail URL for the video"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :chapter, KgEdu.Courses.Chapter do
      public? true
      allow_nil? true
      description "The chapter this video belongs to"
    end

    belongs_to :knowledge_resource, KgEdu.Knowledge.Resource do
      public? true
      allow_nil? true
      description "The knowledge resource this video belongs to"
    end
  end

  identities do
    identity :unique_upload_id, [:upload_id]
    identity :unique_asset_id, [:asset_id]
    identity :unique_playback_id, [:playback_id]
  end
end

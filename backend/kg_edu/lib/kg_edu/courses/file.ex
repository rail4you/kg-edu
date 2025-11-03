defmodule KgEdu.Courses.File do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Courses,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshTypescript.Resource]
  import Logger

  typescript do
    type_name "File"
  end


  # File storage helper function
  defp store_file(base64_string) do
    # Decode base64 string to binary data
    case Base.decode64(base64_string) do
      {:ok, binary_data} ->
        # Create uploads directory if it doesn't exist
        upload_dir = Path.join([File.cwd!(), "priv", "static", "uploads"])
        File.mkdir_p!(upload_dir)

        # Generate unique filename
        unique_filename = "file_#{System.system_time(:millisecond)}.bin"
        file_path = Path.join(upload_dir, unique_filename)

        # Write file to disk
        case File.write(file_path, binary_data) do
          :ok ->
            # Return the relative path for web access
            relative_path = Path.join("uploads", unique_filename)
            {:ok, relative_path}

          {:error, reason} ->
            {:error, "Failed to store file: #{inspect(reason)}"}
        end

      :error ->
        {:error, "Invalid base64 string"}
    end
  end

  # File reading helper function
  defp read_file(relative_path) do
    # Convert relative path to absolute path
    absolute_path = Path.join([File.cwd!(), "priv", "static", relative_path])

    case File.read(absolute_path) do
      {:ok, binary_data} ->
        {:ok, binary_data}

      {:error, :enoent} ->
        {:error, "File not found"}

      {:error, reason} ->
        {:error, "Failed to read file: #{inspect(reason)}"}
    end
  end

  postgres do
    table "files"
    repo KgEdu.Repo
  end

  multitenancy do
    strategy :context
  end

  code_interface do
    define :create_file, action: :create
    define :upload_file, action: :upload
    define :upload_phoenix_file, action: :upload_phoenix
    define :update_file, action: :update
    define :delete_file, action: :destroy
    define :get_file, action: :read, get_by: [:id]
    define :list_files, action: :read
    define :list_files_by_course, action: :by_course
    define :list_files_by_purpose, action: :by_purpose
    define :list_files_by_knowledge_resource, action: :by_knowledge_resource
    define :generate_example_files, action: :generate_examples
    define :download_file, action: :download_file
    define :link_file_to_knowledge, action: :link_file_to_knowledge
    define :unlink_file_from_knowledge, action: :unlink_file_from_knowledge
    define :log_file_view_activity, action: :log_file_view
  end

  actions do
    defaults [:read, :update, :destroy]
    create :create do
      description "Create a new file record"
      accept [:filename, :path, :size, :file_type, :purpose, :course_id, :knowledge_resource_id]
    end

    action :download_file do
      description "Download file content by file ID"

      argument :id, :uuid do
        allow_nil? false
      end

      run fn args, _context ->
        file_id = args.id

        case Ash.get(KgEdu.Courses.File, file_id, actor: nil, authorize?: false) do
          {:ok, nil} ->
            {:error, "File not found"}

          {:ok, file} ->
            case read_file(file.path) do
              {:ok, binary_data} ->
                # Return the file data as a result with metadata
                file_result = %{
                  id: file.id,
                  filename: file.filename,
                  file_type: file.file_type,
                  size: file.size,
                  binary_data: binary_data
                }
                {:ok, file_result}

              {:error, reason} ->
                {:error, reason}
            end

          {:error, reason} ->
            {:error, "Failed to find file: #{inspect(reason)}"}
        end
      end
    end

    create :upload_phoenix do
      description "Upload a file using Phoenix upload plug and create file record"

      argument :upload, :map do
        allow_nil? false
        description "Phoenix upload plug data"
      end

      argument :course_id, :uuid do
        allow_nil? false
        description "Course ID to associate the file with"
      end

      argument :purpose, :string do
        allow_nil? true
        default "course_file"
      end

      change manage_relationship(:course_id, :course, type: :append_and_remove)

      change fn changeset, _context ->
        upload = Ash.Changeset.get_argument(changeset, :upload)
        course_id = Ash.Changeset.get_argument(changeset, :course_id)

        case upload do
          nil ->
            Ash.Changeset.add_error(changeset, "File upload is required")

          %Plug.Upload{path: temp_path, filename: original_filename, content_type: content_type} ->
            # Store file using Waffle
            case KgEduWeb.CourseFileUploader.store({upload, course_id}) do
              {:ok, file_url} ->
                # Get file size
                case File.stat(temp_path) do
                  {:ok, stat} ->
                    Logger.info("Stored file at #{file_url} with size #{stat.size}")
                    file_url = KgEduWeb.CourseFileUploader.url({file_url, course_id})
                    changeset
                    |> Ash.Changeset.change_attribute(:filename, original_filename)
                    |> Ash.Changeset.change_attribute(:path, file_url)
                    |> Ash.Changeset.change_attribute(:size, stat.size)
                    |> Ash.Changeset.change_attribute(:file_type, content_type)
                    |> Ash.Changeset.change_attribute(
                      :purpose,
                      Ash.Changeset.get_argument(changeset, :purpose)
                    )

                  {:error, _reason} ->
                    Ash.Changeset.add_error(changeset, "Failed to get file size")
                end

              {:error, reason} ->
                Ash.Changeset.add_error(changeset, "Failed to store file: #{inspect(reason)}")
            end

          _ ->
            Ash.Changeset.add_error(changeset, "Invalid upload format")
        end
      end
    end

    create :upload do
      description "Upload a file and create file record"

      argument :file, :string do
        allow_nil? false
      end

      argument :filename, :string do
        allow_nil? true
        default "uploaded_file"
      end

      argument :file_type, :string do
        allow_nil? true
        default "application/octet-stream"
      end

      argument :purpose, :string do
        allow_nil? true
        default "course_file"
      end

      argument :knowledge_resource_id, :uuid do
        allow_nil? true
      end

      # change manage_relationship(:course_id, :course, type: :append_and_remove)
      change manage_relationship(:knowledge_resource_id, :knowledge_resource,
               type: :append_and_remove
             )

      change fn changeset, _context ->
        case Ash.Changeset.get_argument(changeset, :file) do
          nil ->
            Ash.Changeset.add_error(changeset, "File is required")

          base64_string ->
            # Store file to disk
            case store_file(base64_string) do
              {:ok, relative_path} ->
                # Decode base64 to get file size
                case Base.decode64(base64_string) do
                  {:ok, binary_data} ->
                    file_size = byte_size(binary_data)
                    # Try to determine file type from the binary data
                    filename =
                      Ash.Changeset.get_argument(changeset, :filename) ||
                        "file_#{System.system_time(:millisecond)}.bin"

                    file_type =
                      Ash.Changeset.get_argument(changeset, :file_type) ||
                        "application/octet-stream"

                    changeset
                    |> Ash.Changeset.change_attribute(:filename, filename)
                    |> Ash.Changeset.change_attribute(:path, relative_path)
                    |> Ash.Changeset.change_attribute(:size, file_size)
                    |> Ash.Changeset.change_attribute(:file_type, file_type)
                    |> Ash.Changeset.change_attribute(
                      :purpose,
                      Ash.Changeset.get_argument(changeset, :purpose)
                    )

                  :error ->
                    Ash.Changeset.add_error(changeset, "Invalid base64 string")
                end

              {:error, reason} ->
                Ash.Changeset.add_error(changeset, reason)
            end
        end
      end
    end

    read :by_course do
      description "Get files for a specific course"

      argument :course_id, :uuid do
        allow_nil? false
      end

      filter expr(course_id == ^arg(:course_id))
    end

    read :by_purpose do
      description "Get files by purpose (course_image, course_file)"

      argument :purpose, :string do
        allow_nil? false
      end

      filter expr(purpose == ^arg(:purpose))
    end

    read :by_knowledge_resource do
      description "Get files for a specific knowledge resource"

      argument :knowledge_resource_id, :uuid do
        allow_nil? false
      end

      filter expr(knowledge_resource_id == ^arg(:knowledge_resource_id))
    end

    create :generate_examples do
      description "Generate example files for a knowledge resource"

      argument :knowledge_resource_id, :uuid do
        allow_nil? false
      end

      change fn changeset, _context ->
        resource_id = Ash.Changeset.get_argument(changeset, :knowledge_resource_id)

        case KgEdu.Courses.FileExample.generate_example_files_for_knowledge_resource(resource_id) do
          {:ok, files} ->
            Ash.Changeset.add_result(changeset, {:ok, files})

          {:error, reason} ->
            Ash.Changeset.add_error(
              changeset,
              "Failed to generate example files: #{inspect(reason)}"
            )
        end
      end
    end

    update :link_file_to_knowledge do
      description "Link a file to a knowledge resource"
      require_atomic? false

      argument :knowledge_resource_id, :uuid do
        allow_nil? false
        description "The knowledge resource ID to link to"
      end

      change manage_relationship(:knowledge_resource_id, :knowledge_resource, type: :append_and_remove)
    end

    update :unlink_file_from_knowledge do
      description "Unlink a file from its knowledge resource"
      require_atomic? false

      change set_attribute(:knowledge_resource_id, nil)
    end

    action :log_file_view do
      description "Log file view activity"

      argument :user_id, :uuid do
        allow_nil? false
        description "User ID who viewed the file"
      end

      argument :metadata, :map do
        allow_nil? true
        default %{}
        description "Additional metadata about the view"
      end

      run fn input, context ->
        file_id = input.arguments[:file_id] || input.arguments[:id] || Ash.Changeset.get_attribute(input.context, :id)
        user_id = input.arguments[:user_id]
        metadata = input.arguments[:metadata] || %{}

        if file_id && user_id do
          KgEdu.Activity.ActivityLog.log_file_view(%{
            user_id: user_id,
            file_id: file_id,
            metadata: metadata
          })
        end

        :ok
      end
    end
  end

  policies do
    # Teachers can manage files for their courses
    # policy [action(:read), action(:create), action(:update), action(:destroy)] do
    #   description "Teachers can manage files for their courses"
    #   authorize_if expr(course.teacher_id == ^actor(:id) and actor.role == :teacher)
    # end

    # # Admin can manage all files
    # policy [action(:upload), action(:read), action(:create), action(:update), action(:destroy)] do
    #   description "Admin can manage all files"
    #   authorize_if expr(actor.role == :admin)
    # end

    # # Students can read files for courses they're enrolled in
    # policy action(:read) do
    #   description "Students can read files for enrolled courses"

    #   authorize_if expr(
    #                  actor.role == :user and
    #                    exists(course.course_enrollments, member_id == ^actor(:id))
    #                )
    # end

    # Default policy - forbid everything else
    policy always() do
      authorize_if always()
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :filename, :string do
      allow_nil? false
      public? true
    end

    attribute :asset_id, :string do
      allow_nil? true
      public? true
    end

    attribute :playback_id, :string do
      allow_nil? true
      public? true
    end

    attribute :path, :string do
      allow_nil? false
      public? true
    end

    attribute :size, :integer do
      allow_nil? false
      public? true
    end

    attribute :file_type, :string do
      allow_nil? false
      public? true
    end

    attribute :purpose, :string do
      allow_nil? false
      public? true
      default "course_file"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      public? true
      allow_nil? true
    end

    belongs_to :knowledge_resource, KgEdu.Knowledge.Resource do
      allow_nil? true
      public? true
    end
  end
end

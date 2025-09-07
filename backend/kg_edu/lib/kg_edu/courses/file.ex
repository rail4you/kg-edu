defmodule KgEdu.Courses.File do
  use Ash.Resource,
    otp_app: :kg_edu,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer]

  postgres do
    table "files"
    repo KgEdu.Repo
  end

  code_interface do
    define :create_file, action: :create
    define :upload_file, action: :upload
    define :update_file, action: :update
    define :delete_file, action: :destroy
    define :get_file, action: :read, get_by: [:id]
    define :list_files, action: :read
    define :list_files_by_course, action: :by_course
    define :list_files_by_purpose, action: :by_purpose
  end

  actions do
    defaults [:create, :read, :update, :destroy]

    create :upload do
      description "Upload a file and create file record"

      argument :file, :struct do
        allow_nil? false
        constraints instance_of: Plug.Upload
      end

      argument :course_id, :uuid do
        allow_nil? false
      end

      argument :purpose, :string do
        allow_nil? true
        default "course_file"
      end

      change manage_relationship(:course_id, :course, type: :append_and_remove)

      change fn changeset, _context ->
        case Ash.Changeset.get_argument(changeset, :file) do
          nil ->
            Ash.Changeset.add_error(changeset, "File is required")

          file_upload ->
            # Generate file metadata
            filename = file_upload.filename
            file_size = file_upload |> File.stat!() |> Map.get(:size)
            file_type = MIME.from_path(filename)

            # Store file using Waffle
            case KgEdu.FileUpload.store_file({file_upload.path, changeset}) do
              {:ok, stored_filename} ->
                # Get the file path from Waffle
                file_path = KgEdu.FileUpload.url({stored_filename, changeset}, :original)

                changeset
                |> Ash.Changeset.change_attribute(:filename, filename)
                |> Ash.Changeset.change_attribute(:path, file_path)
                |> Ash.Changeset.change_attribute(:size, file_size)
                |> Ash.Changeset.change_attribute(:file_type, file_type)
                |> Ash.Changeset.change_attribute(
                  :purpose,
                  Ash.Changeset.get_argument(changeset, :purpose)
                )

              {:error, reason} ->
                Ash.Changeset.add_error(changeset, "Failed to store file: #{inspect(reason)}")
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
  end

  policies do
    # Teachers can manage files for their courses
    policy [action(:read), action(:create), action(:update), action(:destroy)] do
      description "Teachers can manage files for their courses"
      authorize_if expr(course.teacher_id == ^actor(:id) and actor.role == :teacher)
    end

    # Admin can manage all files
    policy [action(:upload), action(:read), action(:create), action(:update), action(:destroy)] do
      description "Admin can manage all files"
      authorize_if expr(actor.role == :admin)
    end

    # Students can read files for courses they're enrolled in
    policy action(:read) do
      description "Students can read files for enrolled courses"

      authorize_if expr(
                     actor.role == :user and
                       exists(course.course_enrollments, member_id == ^actor(:id))
                   )
    end

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
      allow_nil? false
    end
  end
end

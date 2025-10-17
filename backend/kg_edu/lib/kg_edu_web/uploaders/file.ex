defmodule KgEduWeb.CourseFileUploader do
  use Waffle.Definition
  use Waffle.Ecto.Definition

  @versions [:original]
  @acl :public_read
  # Validate file extensions - allow common file types
  # def validate({file, _}) do
  #   file_extension = file.file_name |> Path.extname() |> String.downcase()

  #   allowed_extensions = ~w(.jpg .jpeg .png .gif .pdf .doc .docx .txt .mp4 .mp3 .zip .rar)

  #   case Enum.member?(allowed_extensions, file_extension) do
  #     true -> :ok
  #     false -> {:error, "invalid file type"}
  #   end
  # end

  # Define filename with course_id prefix
  def filename(version, {file, course_id}) do
    "#{course_id}_#{file.file_name}"
  end

  # Define storage directory with course_id
  def storage_dir(version, {file, course_id}) do
    "uploads/courses/#{course_id}"
  end

  # Default URL for missing files
  def default_url(version, _scope) do
    "/images/placeholder/file.png"
  end

  # Set file content type
  def s3_object_headers(version, {file, course_id}) do
    [content_type: MIME.from_path(file.file_name)]
  end
end

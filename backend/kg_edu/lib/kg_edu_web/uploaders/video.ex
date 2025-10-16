defmodule KgEduWeb.CourseVideoUploader do
  use Waffle.Definition
  use Waffle.Ecto.Definition

  @versions [:original]
  @acl :public_read

  # Validate file extensions - allow video file types
  def validate({file, _}) do
    file_extension = file.file_name |> Path.extname() |> String.downcase()
    
    allowed_extensions = ~w(.mp4 .avi .mov .wmv .flv .webm .mkv .m4v .3gp)
    
    case Enum.member?(allowed_extensions, file_extension) do
      true -> :ok
      false -> {:error, "invalid video file type"}
    end
  end

  # Define filename with course_id prefix
  def filename(version, {file, course_id}) do
    "#{course_id}_#{file.file_name}"
  end

  # Define storage directory with course_id
  def storage_dir(version, {file, course_id}) do
    "uploads/courses/#{course_id}/videos"
  end

  # Default URL for missing videos
  def default_url(_version, _scope) do
    "/images/placeholder/video.png"
  end

  # Set file content type
  def s3_object_headers(version, {file, course_id}) do
    [content_type: MIME.from_path(file.file_name)]
  end
end
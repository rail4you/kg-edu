defmodule KgEdu.FileUpload do
  use Waffle.Definition

  @versions [:original]

  # Whitelist file extensions:
  def validate({file, _}) do
    ~w(.jpg .jpeg .gif .png .pdf .doc .docx .txt .zip .rar .mp4 .mov .avi .mp3 .wav .webm .webp)
    |> Enum.member?(String.downcase(Path.extname(file.file_name)))
  end

  # Override the persisted filenames:
  def filename(version, {file, _scope}) do
    file_name = Path.rootname(file.file_name)
    "#{version}_#{file_name}"
  end

  # Override the storage directory:
  def storage_dir(_version, {_file, scope}) do
    "uploads/files/#{scope.id}"
  end

  # Store file using Waffle
  def store_file({path, scope}) do
    # Create a temporary Plug.Upload struct
    upload = %Waffle.File{
      path: path,
      file_name: Path.basename(path),
    }

    case store({upload, scope}) do
      {:ok, filename} ->
        {:ok, filename}

      {:error, reason} ->
        {:error, reason}
    end
  end
end

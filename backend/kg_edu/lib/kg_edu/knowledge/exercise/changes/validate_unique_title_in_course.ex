defmodule KgEdu.Knowledge.Exercise.Changes.ValidateUniqueTitleInCourse do
  @moduledoc """
  Validates that the exercise title is unique within the same course.
  """
  use Ash.Resource.Change

  require Logger

  @impl true
  def change(changeset, _opts, context) do
    title = Ash.Changeset.get_attribute(changeset, :title)
    course_id = Ash.Changeset.get_attribute(changeset, :course_id)

    if title && course_id do
      # Check if there's an existing exercise with the same title in the same course
      case check_duplicate(title, course_id, changeset, context.tenant) do
        :ok ->
          changeset

        {:error, message} ->
          Ash.Changeset.add_error(changeset, field: :title, message: message)
      end
    else
      changeset
    end
  end

  defp check_duplicate(title, course_id, changeset, tenant) do
    # Get the current exercise id if updating (to exclude self)
    current_id = Ash.Changeset.get_data(changeset, :id)

    case Ash.read(KgEdu.Knowledge.Exercise, tenant: tenant) do
      {:ok, exercises} ->
        duplicate =
          exercises
          |> Enum.filter(fn e -> e.course_id == course_id end)
          |> Enum.any?(fn e ->
            String.downcase(e.title) == String.downcase(title) &&
            (is_nil(current_id) || e.id != current_id)
          end)

        if duplicate do
          {:error, "该课程中已存在相同标题的习题"}
        else
          :ok
        end

      {:error, reason} ->
        Logger.warning("Failed to check duplicate title: #{inspect(reason)}")
        :ok
    end
  end
end

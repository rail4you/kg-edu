defmodule KgEdu.Knowledge.Exercise.Changes.ValidateOptions do
  @moduledoc """
  Validates exercise options using the ExerciseOptions struct.
  """
  use Ash.Resource.Change

  def change(changeset, _opts, _context) do
    case Ash.Changeset.get_attribute(changeset, :options) do
      nil -> changeset
      options when is_map(options) -> validate_options(changeset, options)
      _ -> add_error(changeset, "Options must be a map")
    end
  end

  defp validate_options(changeset, options) do
    exercise_options = KgEdu.Knowledge.ExerciseOptions.from_map(options)
    
    if KgEdu.Knowledge.ExerciseOptions.valid?(exercise_options) do
      validated_options = KgEdu.Knowledge.ExerciseOptions.to_map(exercise_options)
      Ash.Changeset.change_attribute(changeset, :options, validated_options)
    else
      add_error(changeset, "Invalid options configuration")
    end
  end

  defp add_error(changeset, message) do
    Ash.Changeset.add_error(changeset, %Ash.Error.Changes.InvalidAttribute{
      field: :options,
      message: message
    })
  end
end
defmodule KgEdu.Activity.Changes.LogHomeworkSubmit do
  @moduledoc """
  A change that logs homework submission activities.
  """
  use Ash.Resource.Change

  require Logger

  def change(changeset, opts, context) do
    user_id = get_user_id(changeset, context, opts)
    homework_id = get_homework_id(changeset, opts)
    answer = get_answer(changeset, opts)
    
    if user_id && homework_id && answer do
      metadata = Map.get(opts, :metadata, %{})
      
      # Log the activity asynchronously to avoid blocking the main action
      Task.start(fn ->
        KgEdu.Activity.ActivityLog.log_homework_submit(%{
          user_id: user_id,
          homework_id: homework_id,
          answer: answer,
          metadata: metadata
        })
      end)
    end
    
    changeset
  end

  defp get_user_id(changeset, context, opts) do
    # Try to get user_id from options first
    case Keyword.get(opts, :user_id) do
      nil ->
        # Try to get from context
        case Map.get(context, :user) do
          %{id: user_id} -> user_id
          _ -> 
            # Try to get from actor
            case Map.get(context, :actor) do
              %{id: user_id} -> user_id
              _ -> nil
            end
        end
      user_id -> user_id
    end
  end

  defp get_homework_id(changeset, opts) do
    # Try to get homework_id from options first
    case Keyword.get(opts, :homework_id) do
      nil ->
        # Try to get from changeset data or attributes
        Ash.Changeset.get_attribute(changeset, :id) || 
        Ash.Changeset.get_attribute(changeset, :homework_id)
      homework_id -> homework_id
    end
  end

  defp get_answer(changeset, opts) do
    # Try to get answer from options first
    case Keyword.get(opts, :answer) do
      nil ->
        # Try to get from changeset arguments or attributes
        Ash.Changeset.get_argument(changeset, :answer) ||
        Ash.Changeset.get_attribute(changeset, :answer)
      answer -> answer
    end
  end
end
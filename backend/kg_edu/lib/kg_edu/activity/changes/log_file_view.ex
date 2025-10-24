defmodule KgEdu.Activity.Changes.LogFileView do
  @moduledoc """
  A change that logs file view activities.
  """
  use Ash.Resource.Change

  require Logger

  def change(changeset, opts, context) do
    user_id = get_user_id(changeset, context, opts)
    file_id = get_file_id(changeset, opts)
    
    if user_id && file_id do
      metadata = Map.get(opts, :metadata, %{})
      
      # Log the activity asynchronously to avoid blocking the main action
      Task.start(fn ->
        KgEdu.Activity.ActivityLog.log_file_view(%{
          user_id: user_id,
          file_id: file_id,
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

  defp get_file_id(changeset, opts) do
    # Try to get file_id from options first
    case Keyword.get(opts, :file_id) do
      nil ->
        # Try to get from changeset data or attributes
        Ash.Changeset.get_attribute(changeset, :id) || 
        Ash.Changeset.get_attribute(changeset, :file_id)
      file_id -> file_id
    end
  end
end
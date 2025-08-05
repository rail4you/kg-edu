defmodule KgEdu.Accounts.User.Changes.LogUserRegistration do
  @moduledoc """
  A change that logs user registration data for auditing purposes.
  """
  use Ash.Resource.Change

  require Logger

  def change(changeset, _opts, _context) do
    log_registration_data(changeset)
    changeset
  end

  defp log_registration_data(changeset) do
    email = Ash.Changeset.get_attribute(changeset, :email)
    
    case email do
      nil ->
        Logger.warning("User registration attempted without email")
        
      email ->
        # Log basic registration info
        Logger.info("User registration started: Email=#{email}")
        
        # Get user ID if available (after creation)
        user_id = case Map.get(changeset, :data) do
          %{id: id} when not is_nil(id) -> id
          _ -> nil
        end
        
        case user_id do
          nil ->
            Logger.info("User registration in progress: Email=#{email}")
            
          user_id ->
            Logger.info("User registration completed: ID=#{user_id}, Email=#{email}")
            
            # Log detailed metadata
            Logger.info("Registration metadata: %{
              user_id: #{inspect(user_id)},
              email: #{inspect(email)},
              timestamp: #{inspect(DateTime.utc_now())}
            }")
        end
    end
  end
end
defmodule KgEdu.Accounts.User.Changes.UpdateStudent do
  @moduledoc """
  Change module for updating student information.
  Handles password hashing if a new password is provided.
  """

  use Ash.Resource.Change

  def change(changeset, _opts, _context) do
    changeset
    |> hash_password_if_provided()
  end

  defp hash_password_if_provided(changeset) do
    password = Ash.Changeset.get_argument(changeset, :password)
    
    case password do
      nil ->
        # No password provided, don't change it
        changeset
        
      "" ->
        # Empty password, don't change it
        changeset
        
      password ->
        # New password provided, hash it
        hashed = Bcrypt.hash_pwd_salt(password)
        Ash.Changeset.change_attribute(changeset, :hashed_password, hashed)
    end
  end
end
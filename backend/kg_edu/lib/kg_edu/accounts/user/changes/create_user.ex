defmodule KgEdu.Accounts.User.Changes.CreateUser do
  @moduledoc """
  Change module for creating users with specified parameters.
  Accepts member_id, name, email, password, and role.
  Automatically hashes the password and stores the data.
  """

  use Ash.Resource.Change

  @doc """
  Create a user with the given parameters.

  ## Parameters
  - member_id: The user's member ID
  - name: The user's name (optional)
  - email: The user's email (optional)
  - password: The user's password (will be hashed)
  - role: The user's role (defaults to :user)

  ## Returns
  {:ok, user} or {:error, reason}
  """
  def change(changeset, opts, context) do
    # Extract arguments from opts or context
    member_id = Ash.Changeset.get_argument(changeset, :member_id) || Keyword.get(opts, :member_id)
    name = Ash.Changeset.get_argument(changeset, :name) || Keyword.get(opts, :name)
    email = Ash.Changeset.get_argument(changeset, :email) || Keyword.get(opts, :email)
    password = Ash.Changeset.get_argument(changeset, :password) || Keyword.get(opts, :password)
    role = Ash.Changeset.get_argument(changeset, :role) || Keyword.get(opts, :role, :user)

    changeset
    |> Ash.Changeset.change_attributes(%{
      member_id: member_id,
      name: name,
      email: email,
      role: role
    })
    |> hash_password()
  end

  defp hash_password(changeset) do
    case changeset do
      %{valid?: false} ->
        changeset

      changeset ->
        password = Ash.Changeset.get_argument(changeset, :password)
        hashed = Bcrypt.hash_pwd_salt(password)
        Ash.Changeset.change_attribute(changeset, :hashed_password, hashed)
    end
  end

  defp hash_password(_changeset, nil) do
    {:error, "Password is required"}
  end
end

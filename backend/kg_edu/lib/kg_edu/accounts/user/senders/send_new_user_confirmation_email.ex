defmodule KgEdu.Accounts.User.Senders.SendNewUserConfirmationEmail do
  @moduledoc """
  Placeholder sender for email confirmation (disabled for student ID authentication).
  """

  use AshAuthentication.Sender

  @impl true
  def send(_user, _token, _) do
    # Email confirmation is disabled for student ID authentication
    :ok
  end
end

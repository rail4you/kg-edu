defmodule KgEdu.Accounts.User.Senders.SendPasswordResetEmail do
  @moduledoc """
  Sends a password reset email
  """

  use AshAuthentication.Sender
  use KgEduWeb, :verified_routes

  import Swoosh.Email

  alias KgEdu.Mailer

  @impl true
  def send(user, token, _) do
    require Logger
    
    case user.email do
      nil ->
        Logger.info("Password reset requested for student_id: #{user.student_id}, but no email address available")
        :ok
        
      email ->
        new()
        # TODO: Replace with your email
        |> from({"noreply", "noreply@example.com"})
        |> to(to_string(email))
        |> subject("Reset your password")
        |> html_body(body(token: token))
        |> Mailer.deliver!()
    end
  end

  defp body(params) do
    url = url(~p"/password-reset/#{params[:token]}")

    """
    <p>Click this link to reset your password:</p>
    <p><a href="#{url}">#{url}</a></p>
    """
  end
end

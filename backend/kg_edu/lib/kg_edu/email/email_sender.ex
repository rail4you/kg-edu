defmodule KgEdu.Email.EmailSender do
  @moduledoc """
  Email sending service for sending emails via external API.
  Uses the email agent API configured in :email_api
  """

  require Logger

  @email_api_endpoint Application.compile_env(:kg_edu, :email_api)[:endpoint] ||
                        "http://localhost:5000/agent/email"

  @doc """
  Send an email message using the receiver's email config.

  ## Parameters
    - email_message: The EmailMessage resource containing sender_user_id, receiver_user_id, subject, and body
    - opts: Keyword list including :tenant

  ## Returns
    - {:ok, :sent} - Email was sent successfully
    - {:error, reason} - Email failed to send
  """
  def send_email(email_message, opts \\ []) do
    tenant = Keyword.get(opts, :tenant)

    Logger.info("[EMAIL_SENDER] send_email called with tenant: #{inspect(tenant)}")
    Logger.info("[EMAIL_SENDER] email_message: #{inspect(email_message)}")

    # Get sender user info
    sender_user_id = email_message.sender_user_id
    receiver_user_id = email_message.receiver_user_id

    Logger.info("[EMAIL_SENDER] sender_user_id: #{inspect(sender_user_id)}")
    Logger.info("[EMAIL_SENDER] receiver_user_id: #{inspect(receiver_user_id)}")

    # Get sender and receiver user details
    with {:ok, sender} <- get_user(sender_user_id, tenant),
         {:ok, receiver} <- get_user(receiver_user_id, tenant) do
      Logger.info("[EMAIL_SENDER] sender: #{inspect(sender)}")
      Logger.info("[EMAIL_SENDER] receiver: #{inspect(receiver)}")
      # Try to get email config from receiver first, then sender
      email_config_result =
        case get_receiver_email_config(receiver_user_id, tenant) do
          {:ok, config} ->
            {:ok, :receiver, config}

          {:error, :no_email_config} ->
            # Receiver has no config, try sender's config
            case get_sender_email_config(sender_user_id, tenant) do
              {:ok, config} -> {:ok, :sender, config}
              error -> error
            end

          error ->
            error
        end

      case email_config_result do
        {:ok, config_source, email_config} ->
          # Sender info (person who is sending the email)
          sender_email = sender.email || "noreply@kgedu.com"
          sender_name = sender.name || "KgEdu User"

          # Receiver info (person who will receive the email)
          receiver_email = receiver.email || "noreply@kgedu.com"
          receiver_name = receiver.name || "KgEdu User"

          # Use the available email config for authentication
          auth_email = email_config.email_address
          auth_password = email_config.api_key

          Logger.info(
            "[EMAIL_SENDER] Using #{config_source}'s email config for SMTP authentication"
          )

          # Create display name showing who the email is from
          display_name = "#{sender_name} <#{sender_email}>"

          # Send the email via API using available config for authentication
          send_email_via_api(
            sender_email: sender_email,
            sender_name: sender_name,
            display_name: display_name,
            auth_email: auth_email,
            auth_password: auth_password,
            receiver_email: receiver_email,
            receiver_name: receiver_name,
            subject: email_message.subject,
            body: email_message.body
          )

        {:error, reason} ->
          Logger.error(
            "Failed to get email config for both sender and receiver: #{inspect(reason)}"
          )

          {:error, reason}
      end
    else
      {:error, reason} = error ->
        Logger.error("Failed to send email: #{inspect(reason)}")
        error
    end
  end

  # Send email via external API
  defp send_email_via_api(attrs) do
    # Extract attributes from keyword list
    sender_email = Keyword.get(attrs, :sender_email)
    sender_name = Keyword.get(attrs, :sender_name)
    display_name = Keyword.get(attrs, :display_name)
    auth_email = Keyword.get(attrs, :auth_email)
    auth_password = Keyword.get(attrs, :auth_password)
    receiver_email = Keyword.get(attrs, :receiver_email)
    receiver_name = Keyword.get(attrs, :receiver_name)
    subject = Keyword.get(attrs, :subject)
    body = Keyword.get(attrs, :body)

    Logger.info("""
    [SENDING EMAIL VIA API]
    From: #{sender_name} <#{sender_email}>
    To: #{receiver_name} <#{receiver_email}>
    Auth Account: #{auth_email}
    Subject: #{subject}
    Endpoint: #{@email_api_endpoint}
    """)

    # Email body with sender info
    email_body = body

    # Build the request payload
    # Use sender's email for SMTP authentication
    payload = %{
      senderEmail: auth_email,
      senderPassword: auth_password,
      senderName: display_name,
      recipients: [
        %{
          name: receiver_name,
          email: receiver_email
        }
      ],
      subject: subject,
      message: email_body,
      isHtml: false
    }

    # Make HTTP POST request using Req
    Logger.info("Making HTTP request to email API...")

    case Req.post(@email_api_endpoint, json: payload) do
      {:ok, response} when response.status == 200 ->
        Logger.info("Email API response: #{inspect(response.body)}")

        # Parse response (Req auto-decodes JSON to map)
        case response.body do
          %{"success" => true} ->
            Logger.info("✓ Email sent successfully via API")
            {:ok, :sent}

          %{"success" => false, "message" => error_msg} ->
            Logger.error("✗ Email API returned error: #{error_msg}")
            {:error, error_msg}

          _ ->
            Logger.error("✗ Unexpected API response format")
            {:error, :unexpected_response}
        end

      {:ok, response} ->
        Logger.error("✗ Email API returned HTTP #{response.status}: #{inspect(response.body)}")
        {:error, {:http_error, response.status, response.body}}

      {:error, error} ->
        Logger.error("✗ HTTP request failed: #{inspect(error)}")
        {:error, {:http_error, error}}
    end
  end

  # Get user by ID
  defp get_user(user_id, tenant) do
    case KgEdu.Accounts.User.get_user(user_id,
           tenant: tenant,
           authorize?: false,
           actor: nil
         ) do
      {:ok, user} ->
        Logger.info("[EMAIL_SENDER] get_user success, user: #{inspect(user, pretty: true)}")
        {:ok, user}

      {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Query.NotFound{}]}} ->
        Logger.error("[EMAIL_SENDER] User not found: #{user_id}")
        {:error, :user_not_found}

      {:error, reason} ->
        Logger.error("[EMAIL_SENDER] Error getting user #{user_id}: #{inspect(reason)}")
        {:error, reason}
    end
  end

  # Get receiver's email config
  defp get_receiver_email_config(receiver_user_id, tenant) do
    # Read all email configs in tenant and filter manually
    case KgEdu.Email.EmailConfig
         |> Ash.read(tenant: tenant, authorize?: false) do
      {:ok, configs} ->
        case Enum.find(configs, fn config -> config.user_id == receiver_user_id end) do
          nil -> {:error, :no_email_config}
          email_config -> {:ok, email_config}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  # Get sender's email config
  defp get_sender_email_config(sender_user_id, tenant) do
    # Read all email configs in tenant and filter manually
    case KgEdu.Email.EmailConfig
         |> Ash.read(tenant: tenant, authorize?: false) do
      {:ok, configs} ->
        case Enum.find(configs, fn config -> config.user_id == sender_user_id end) do
          nil -> {:error, :no_email_config}
          email_config -> {:ok, email_config}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end
end

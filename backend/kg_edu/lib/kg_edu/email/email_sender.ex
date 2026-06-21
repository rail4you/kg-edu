defmodule KgEdu.Email.EmailSender do
  @moduledoc """
  Email sending via Swoosh SMTP directly.
  Uses per-user SMTP credentials from EmailConfig resource.
  """

  require Logger

  def send_email(email_message, opts \\ []) do
    tenant = Keyword.get(opts, :tenant)
    Logger.info("[EMAIL] send_email tenant=#{inspect(tenant)} message_id=#{email_message.id}")

    sender_user_id = email_message.sender_user_id
    receiver_user_id = email_message.receiver_user_id

    with {:ok, sender} <- get_user(sender_user_id, tenant),
         {:ok, receiver} <- get_user(receiver_user_id, tenant),
         {:ok, _source, email_config} <- get_best_email_config(sender_user_id, receiver_user_id, tenant) do

      smtp_user = email_config.email_address
      smtp_password = email_config.api_key
      sender_email = blank_to(sender.email, smtp_user)
      sender_name = blank_to(sender.name, email_config.sender_name || "KgEdu User")
      receiver_email = blank_to(receiver.email, "")
      receiver_name = blank_to(receiver.name, "KgEdu User")

      if receiver_email == "" do
        Logger.error("[EMAIL] Receiver #{receiver_user_id} has no email address")
        {:error, :receiver_no_email}
      else
        deliver(sender_name, sender_email, receiver_name, receiver_email,
          email_message.subject, email_message.body, smtp_user, smtp_password)
      end
    end
  end

  # ── SMTP delivery ────────────────────────────────────────────────────

  defp deliver(from_name, from_email, to_name, to_email, subject, body, smtp_user, smtp_password) do
    Logger.info("[EMAIL] SMTP: #{from_email} -> #{to_email} subject=\"#{subject}\"")

    smtp_cfg = detect_smtp(from_email)

    email =
      Swoosh.Email.new()
      |> Swoosh.Email.from({from_name, from_email})
      |> Swoosh.Email.to([{to_name, to_email}])
      |> Swoosh.Email.subject(subject)
      |> Swoosh.Email.text_body(body)

    mailer_cfg = [
      adapter: Swoosh.Adapters.SMTP,
      relay: smtp_cfg.relay,
      port: smtp_cfg.port,
      username: smtp_user,
      password: smtp_password,
      ssl: smtp_cfg.ssl,
      tls: smtp_cfg.tls,
      auth: smtp_cfg.auth,
      retries: 1,
      no_mx_lookups: false
    ]

    case KgEdu.Mailer.deliver(email, mailer_cfg) do
      {:ok, _} ->
        Logger.info("[EMAIL] ✅ Sent to #{to_email}")
        {:ok, :sent}
      {:error, reason} ->
        Logger.error("[EMAIL] ❌ Failed: #{inspect(reason)}")
        {:error, reason}
    end
  end

  # ── SMTP provider detection ──────────────────────────────────────────

  defp detect_smtp(email) when is_binary(email) and email != "" do
    domain = email |> String.split("@") |> List.last() |> String.downcase()
    smtp_for(domain)
  end
  defp detect_smtp(_), do: smtp_for("qq.com")

  defp smtp_for("qq.com"), do: %{relay: "smtp.qq.com", port: 465, ssl: true, tls: :always, auth: :always}
  defp smtp_for(d) when d in ["163.com", "126.com"], do: %{relay: "smtp.#{d}", port: 465, ssl: true, tls: :always, auth: :always}
  defp smtp_for("gmail.com"), do: %{relay: "smtp.gmail.com", port: 587, ssl: false, tls: :always, auth: :always}
  defp smtp_for(d) when d in ["outlook.com", "hotmail.com"], do: %{relay: "smtp-mail.outlook.com", port: 587, ssl: false, tls: :always, auth: :always}
  defp smtp_for(domain), do: %{relay: "smtp.#{domain}", port: 587, ssl: false, tls: :always, auth: :always}

  # ── Helpers ──────────────────────────────────────────────────────────

  defp blank_to(nil, fallback), do: fallback
  defp blank_to("", fallback), do: fallback
  defp blank_to(%Ash.CiString{string: s}, fallback), do: blank_to(s, fallback)
  defp blank_to(val, _fallback), do: val

  defp get_user(user_id, tenant) do
    case KgEdu.Accounts.User.get_user(user_id, tenant: tenant, authorize?: false, actor: nil) do
      {:ok, nil} -> {:error, :user_not_found}
      {:ok, user} -> {:ok, user}
      {:error, reason} -> {:error, reason}
    end
  end

  defp get_email_config(user_id, tenant) do
    case Ash.read(KgEdu.Email.EmailConfig, tenant: tenant, authorize?: false) do
      {:ok, configs} ->
        case Enum.find(configs, fn c -> c.user_id == user_id end) do
          nil -> {:error, :no_email_config}
          config -> {:ok, config}
        end
      {:error, reason} -> {:error, reason}
    end
  end

  defp get_best_email_config(sender_id, receiver_id, tenant) do
    case get_email_config(sender_id, tenant) do
      {:ok, config} -> {:ok, :sender, config}
      {:error, :no_email_config} ->
        case get_email_config(receiver_id, tenant) do
          {:ok, config} -> {:ok, :receiver, config}
          error -> error
        end
      error -> error
    end
  end
end

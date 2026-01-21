# Test script to send email via the system
tenant = "org_2af44c7b_081a_497a_9858_365fa90ad5d7"
sender_id = "9afac447-4725-4842-9b26-e2f0de338b7f"
receiver_id = "c3d75e36-0cfe-44a9-8875-d7b560c2256b"

IO.puts("Sending email with tenant: #{tenant}")
IO.puts("From: #{sender_id}")
IO.puts("To: #{receiver_id}")

case KgEdu.Email.EmailMessage.send_email(
  %{
    sender_user_id: sender_id,
    receiver_user_id: receiver_id,
    subject: "Test Email from IEx",
    body: "This is a test email sent via IEx to check the email sending system."
  },
  tenant: tenant
) do
  {:ok, email_message} ->
    IO.puts("\n✓ Email message created successfully!")
    IO.puts("  ID: #{email_message.id}")
    IO.puts("  Status: #{email_message.status}")
    IO.puts("  Subject: #{email_message.subject}")
    IO.puts("  Sent At: #{inspect(email_message.sent_at)}")
    IO.puts("  Error Message: #{inspect(email_message.error_message)}")

  {:error, error} ->
    IO.puts("\n✗ Failed to send email:")
    IO.puts("  Error: #{inspect(error)}")
end

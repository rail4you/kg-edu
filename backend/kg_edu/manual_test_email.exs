# Manual test to check EmailSender
IO.puts("\n=== Manual EmailSender Test ===\n")

# Get the existing email message
email_message_id = "cd8fcdc3-6b8f-49b6-ad0c-23f8bb3c2b44"
tenant = "org_2af44c7b_081a_497a_9858_365fa90ad5d7"

case KgEdu.Email.EmailMessage.get_email_message(email_message_id,
       tenant: tenant,
       authorize?: false
     ) do
  {:ok, email_msg} ->
    IO.puts("Found email message:")
    IO.puts("  Subject: #{email_msg.subject}")
    IO.puts("  Status: #{email_msg.status}")
    IO.puts("  Sender: #{email_msg.sender_user_id}")
    IO.puts("  Receiver: #{email_msg.receiver_user_id}")

    IO.puts("\nCalling EmailSender.send_email...")

    result = KgEdu.Email.EmailSender.send_email(email_msg, tenant: tenant)

    IO.puts("\nResult:")
    IO.puts(inspect(result, pretty: true))

    # Now try to update the message
    case result do
      {:ok, :sent} ->
        IO.puts("\n✓ Email sent successfully via API")
        IO.puts("Updating message status to sent...")

        case email_msg
             |> Ash.Changeset.for_update(:mark_as_sent)
             |> Ash.update(authorize?: false, tenant: tenant) do
          {:ok, updated} ->
            IO.puts("✓ Message updated to sent")
            IO.puts("  Sent at: #{updated.sent_at}")

          {:error, error} ->
            IO.puts("✗ Failed to update message:")
            IO.puts(inspect(error, pretty: true))
        end

      {:error, reason} ->
        IO.puts("\n✗ EmailSender returned error:")
        IO.puts(inspect(reason, pretty: true))

        IO.puts("\nUpdating message status to failed...")

        case email_msg
             |> Ash.Changeset.for_update(:mark_as_failed, %{error_message: inspect(reason)})
             |> Ash.update(authorize?: false, tenant: tenant) do
          {:ok, updated} ->
            IO.puts("✓ Message updated to failed")
            IO.puts("  Error: #{updated.error_message}")

          {:error, error} ->
            IO.puts("✗ Failed to update message:")
            IO.puts(inspect(error, pretty: true))
        end
    end

  {:error, error} ->
    IO.puts("✗ Failed to get email message:")
    IO.puts(inspect(error, pretty: true))
end

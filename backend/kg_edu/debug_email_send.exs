# Debug script to test EmailSender with detailed logging
email_message_id = "1057e54d-7308-4bef-b467-000e1325f40b"
tenant = "org_2af44c7b_081a_497a_9858_365fa90ad5d7"

IO.puts("\n=== Debugging EmailSender ===\n")

# Get the email message
case KgEdu.Email.EmailMessage.get_email_message(email_message_id,
       tenant: tenant,
       authorize?: false
     ) do
  {:ok, email_msg} ->
    IO.puts("✓ Got email message:")
    IO.puts("  ID: #{email_msg.id}")
    IO.puts("  Subject: #{email_msg.subject}")
    IO.puts("  Status: #{email_msg.status}")

    IO.puts("\n=== Testing EmailSender.send_email ===\n")

    # Test EmailSender with timeout
    task =
      Task.async(fn ->
        KgEdu.Email.EmailSender.send_email(email_msg, tenant: tenant)
      end)

    case Task.yield(task, 10000) do
      {:ok, result} ->
        IO.puts("✓ EmailSender completed:")
        IO.puts(inspect(result, pretty: true))

        case result do
          {:ok, :sent} ->
            IO.puts("\n✓ Email sent via API successfully")

            # Update the message
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
            IO.puts("\n✗ EmailSender failed:")
            IO.puts("  Reason: #{inspect(reason)}")

            # Update the message
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

      nil ->
        # Task didn't complete in time
        IO.puts("✗ EmailSender timed out after 10 seconds")
        Task.shutdown(task)
        IO.puts("This suggests the HTTP request is hanging")
    end

  {:error, error} ->
    IO.puts("✗ Failed to get email message:")
    IO.puts(inspect(error, pretty: true))
end

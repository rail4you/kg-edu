# Quick test - manually update the most recent email to see what happens
email_id = "6ad29d30-67f5-440c-9465-09b6b454f0fe"
tenant = "org_2af44c7b_081a_497a_9858_365fa90ad5d7"

IO.puts("\n=== Manual Email Test ===\n")

# Get the email message
case KgEdu.Email.EmailMessage.get_email_message(email_id, tenant: tenant, authorize?: false) do
  {:ok, email_msg} ->
    IO.puts("✓ Got email message:")
    IO.puts("  Subject: #{email_msg.subject}")
    IO.puts("  Status: #{email_msg.status}")

    IO.puts("\nUpdating to 'failed' with test error message...")

    # Try to manually update to failed
    case email_msg
         |> Ash.Changeset.for_update(:mark_as_failed, %{error_message: "Test manual update"})
         |> Ash.update(authorize?: false, tenant: tenant) do
      {:ok, updated} ->
        IO.puts("✓ Successfully updated:")
        IO.puts("  Status: #{updated.status}")
        IO.puts("  Error: #{updated.error_message}")
        IO.puts("  Failed at: #{updated.failed_at}")

      {:error, error} ->
        IO.puts("✗ Update failed:")
        IO.puts(inspect(error, pretty: true))
    end

  {:error, error} ->
    IO.puts("✗ Failed to get email:")
    IO.puts(inspect(error, pretty: true))
end

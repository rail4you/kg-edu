# Test script for Email System
# This script demonstrates how to use the email system

# To run this script in IEx:
# 1. Start IEx: iex -S mix phx.server
# 2. Import the file: import_file("test_email_system.exs")
# 3. Run the test: EmailTest.run_test()

defmodule EmailTest do
  @moduledoc """
  Test module for the Email system.
  Demonstrates creating email configs and sending email messages.
  """

  alias KgEdu.Email.EmailConfig
  alias KgEdu.Email.EmailMessage
  alias KgEdu.Accounts.User

  @doc """
  Run a complete test of the email system.
  """
  def run_test(tenant \\ :org_test) do
    IO.puts("\n=== Email System Test ===\n")

    # Step 1: Create or find test users
    {:ok, sender} = get_or_create_user("sender@test.com", "Sender User", tenant)
    {:ok, receiver} = get_or_create_user("receiver@test.com", "Receiver User", tenant)

    IO.puts("✓ Sender user: #{sender.id} (#{sender.name})")
    IO.puts("✓ Receiver user: #{receiver.id} (#{receiver.name})")

    # Step 2: Create email config for receiver
    case EmailConfig.by_user(%{user_id: receiver.id}, tenant: tenant, authorize?: false) do
      {:ok, []} ->
        IO.puts("\n→ Creating email config for receiver...")

        case EmailConfig.create_email_config(%{
          user_id: receiver.id,
          email_address: "619126989@qq.com",
          sender_name: receiver.name,
          api_key: "uzrnvmdhsozcbajj"
        }, tenant: tenant, authorize?: false) do
          {:ok, email_config} ->
            IO.puts("✓ Email config created: #{email_config.id}")
            IO.puts("  - Email: #{email_config.email_address}")
            IO.puts("  - Sender Name: #{email_config.sender_name}")
            IO.puts("  - API Key: #{String.slice(email_config.api_key, -4..-1)} (hidden)")

          {:error, reason} ->
            IO.puts("✗ Failed to create email config: #{inspect(reason)}")
            :error
        end

      {:ok, [existing_config | _]} ->
        IO.puts("\n✓ Email config already exists: #{existing_config.id}")
        IO.puts("  - Email: #{existing_config.email_address}")

      {:error, reason} ->
        IO.puts("\n✗ Failed to query email config: #{inspect(reason)}")
        :error
    end

    # Step 3: Send an email
    IO.puts("\n→ Sending email message...")

    case EmailMessage.send_email(%{
      sender_user_id: sender.id,
      receiver_user_id: receiver.id,
      subject: "Test Email from Ash Framework",
      body: "Hello! This is a test email sent via the KgEdu email system using the real email API.\n\nBest regards,\n#{sender.name}"
    }, tenant: tenant, authorize?: false) do
      {:ok, email_message} ->
        IO.puts("✓ Email message created: #{email_message.id}")
        IO.puts("  - Subject: #{email_message.subject}")
        IO.puts("  - Status: #{email_message.status}")
        IO.puts("\n✓ Email sending process initiated via API!")
        IO.puts("  The email will be sent to: 619126989@qq.com")
        IO.puts("  Check the logs for API response details.")

        # Wait a moment and check the status
        Process.sleep(2000)

        case EmailMessage.get_email_message(email_message.id, tenant: tenant, authorize?: false) do
          {:ok, updated_message} ->
            IO.puts("\n  Final status: #{updated_message.status}")
            if updated_message.status == :sent do
              IO.puts("  ✓ Email was successfully sent via API!")
            else
              IO.puts("  ! Email status: #{updated_message.status}")
              if updated_message.error_message do
                IO.puts("  ! Error: #{updated_message.error_message}")
              end
            end

          {:error, _} ->
            IO.puts("  Could not retrieve updated message status")
        end

      {:error, reason} ->
        IO.puts("✗ Failed to send email: #{inspect(reason)}")
        :error
    end

    # Step 4: List sent and received messages
    IO.puts("\n→ Listing sent messages...")

    case EmailMessage.list_sent_messages(%{sender_user_id: sender.id}, tenant: tenant, authorize?: false) do
      {:ok, sent_messages} ->
        IO.puts("✓ Sender has sent #{length(sent_messages)} message(s)")

      {:error, _} ->
        IO.puts("✗ Could not retrieve sent messages")
    end

    IO.puts("\n→ Listing received messages...")

    case EmailMessage.list_received_messages(%{receiver_user_id: receiver.id}, tenant: tenant, authorize?: false) do
      {:ok, received_messages} ->
        IO.puts("✓ Receiver has #{length(received_messages)} message(s)")

      {:error, _} ->
        IO.puts("✗ Could not retrieve received messages")
    end

    IO.puts("\n=== Test Complete ===\n")
  end

  # Helper function to get or create a test user
  defp get_or_create_user(email, name, tenant) do
    case User.get_user(%{email: email}, tenant: tenant, authorize?: false) do
      {:ok, user} ->
        {:ok, user}

      {:error, :not_found} ->
        User.create_user(%{
          email: email,
          name: name,
          member_id: String.replace(email, "@", "_"),
          password: "Password123!"
        }, tenant: tenant, authorize?: false)

      {:error, reason} ->
        {:error, reason}
    end
  end
end

# Instructions:
IO.puts("\nEmail system test module loaded!")
IO.puts("To run the test, execute:")
IO.puts("  EmailTest.run_test(:org_test)")
IO.puts("\nMake sure to:")
IO.puts("  1. Replace :org_test with your actual tenant atom")
IO.puts("  2. Have the email API service running at localhost:5000")
IO.puts("  3. Update the test email credentials if needed")
IO.puts("")

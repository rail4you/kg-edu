# Test EmailSender directly to see what error occurs
email_message = %{
  sender_user_id: "9afac447-4725-4842-9b26-e2f0de338b7f",
  receiver_user_id: "c3d75e36-0cfe-44a9-8875-d7b560c2256b",
  subject: "Direct Test",
  body: "Testing EmailSender directly"
}

tenant = "org_2af44c7b_081a_497a_9858_365fa90ad5d7"

IO.puts("Testing EmailSender.send_email directly...")
IO.puts("Tenant: #{tenant}")
IO.puts("Sender: #{email_message.sender_user_id}")
IO.puts("Receiver: #{email_message.receiver_user_id}")

result = KgEdu.Email.EmailSender.send_email(email_message, tenant: tenant)

IO.puts("\nResult:")
IO.puts(inspect(result))

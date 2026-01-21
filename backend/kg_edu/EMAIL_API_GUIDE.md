# Email System with Real API Integration

## Overview

The email system now integrates with a real email API service running at `localhost:5000/agent/email`. This service supports QQ (qq.com) and 163 (163.com) email providers.

## Updated Components

### EmailSender Service (`lib/kg_edu/email/email_sender.ex`)

The `EmailSender` module now makes real HTTP POST requests to the email API endpoint instead of just logging.

**Key Changes:**
- Removed mock implementation
- Added real HTTP client using Erlang's `:httpc`
- Sends JSON payload to the email API
- Handles API responses and errors properly

**API Endpoint:** `http://localhost:5000/agent/email`

## How It Works

### Email Flow

1. **User sends email** → `EmailMessage.send_email/2` is called
2. **Fetch configs** → Gets sender user details and receiver's email config
3. **Prepare payload** → Builds JSON request with email details
4. **Send to API** → Makes HTTP POST to localhost:5000
5. **Handle response** → Updates email message status based on API response
6. **Track status** → Message status changes from `:sending` → `:sent` or `:failed`

### API Request Format

The EmailSender sends this JSON payload to the API:

```json
{
  "senderEmail": "619126989@qq.com",
  "senderPassword": "uzrnvmdhsozcbajj",
  "senderName": "Sender Name",
  "recipients": [
    {
      "name": "Receiver Name",
      "email": "receiver@qq.com"
    }
  ],
  "subject": "Email Subject",
  "message": "Email body content",
  "isHtml": false
}
```

### API Response Handling

- **Success** (`{"success": true}`) → Message status set to `:sent`
- **Error** (`{"success": false, "message": "..."}`) → Message status set to `:failed` with error message
- **HTTP Error** → Message status set to `:failed` with HTTP status

## Usage Examples

### 1. Create Email Config

```elixir
# For QQ email
KgEdu.Email.EmailConfig.create_email_config(%{
  user_id: user_id,
  email_address: "619126989@qq.com",
  sender_name: "User Name",
  api_key: "uzrnvmdhsozcbajj"  # This is the email password/API key
}, tenant: :org_your_tenant)

# For 163 email
KgEdu.Email.EmailConfig.create_email_config(%{
  user_id: user_id,
  email_address: "user@163.com",
  sender_name: "User Name",
  api_key: "your-password-or-api-key"
}, tenant: :org_your_tenant)
```

### 2. Send an Email

```elixir
KgEdu.Email.EmailMessage.send_email(%{
  sender_user_id: sender_id,
  receiver_user_id: receiver_id,
  subject: "Test Email",
  body: "Hello, this is a test email sent via the real API!"
}, tenant: :org_your_tenant)
```

### 3. Check Email Status

```elixir
# Get the message
{:ok, message} = KgEdu.Email.EmailMessage.get_email_message(
  message_id,
  tenant: :org_your_tenant
)

# Check status
case message.status do
  :sent -> IO.puts("Email sent successfully!")
  :failed -> IO.puts("Email failed: #{message.error_message}")
  :pending -> IO.puts("Email is pending...")
  :sending -> IO.puts("Email is being sent...")
end
```

## Testing

### Using the Test Script

1. **Start IEx** with the application:
   ```bash
   iex -S mix phx.server
   ```

2. **Import the test script**:
   ```elixir
   import_file("test_email_system.exs")
   ```

3. **Run the test** (make sure email API is running):
   ```elixir
   EmailTest.run_test(:org_test)
   ```

The test will:
- Create test users
- Create an email config with QQ email credentials
- Send a real test email via the API
- Display the status and results

### Manual Testing with cURL

You can also test the email API directly:

```bash
curl -X POST http://localhost:5000/agent/email \
  -H "Content-Type: application/json" \
  -d '{
    "senderEmail": "619126989@qq.com",
    "senderPassword": "uzrnvmdhsozcbajj",
    "senderName": "Test Sender",
    "recipients": [
      {"name": "Test Recipient", "email": "619126989@qq.com"}
    ],
    "subject": "Test Email",
    "message": "This is a test email",
    "isHtml": false
  }'
```

## Configuration

### Email Config Schema

Each user can have one email config with:
- `email_address` - The email address (must be qq.com or 163.com)
- `sender_name` - Display name for the sender
- `api_key` - Email password or API key for authentication

### Supported Email Providers

The email API currently supports:
- **QQ Mail** (qq.com)
- **163 Mail** (163.com)

Other email providers will return an error from the API.

## Logging

The email system logs detailed information:

**Sending Email:**
```
[SENDING EMAIL VIA API]
From: Sender Name <sender@qq.com>
To: Receiver Name <receiver@qq.com>
Subject: Email Subject
Endpoint: http://localhost:5000/agent/email
```

**Success:**
```
✓ Email sent successfully via API
Email API response: {"success": true, "message": "Email sent successfully"}
```

**Error:**
```
✗ Email API returned error: Email domain 'gmail.com' is not supported
```

## Error Handling

The system handles various error scenarios:

1. **Missing Email Config** → Returns `{:error, :no_email_config}`
2. **User Not Found** → Returns `{:error, :user_not_found}`
3. **API Returns Error** → Updates message status to `:failed` with error message
4. **HTTP Request Failed** → Updates message status to `:failed` with HTTP error
5. **Unsupported Email Domain** → API returns error, message marked as `:failed`

## Production Considerations

### API Endpoint Configuration

Currently, the endpoint is hardcoded to `localhost:5000`. For production:

1. Add configuration to `config/dev.exs`, `config/prod.exs`:
   ```elixir
   config :kg_edu, :email_api_endpoint,
     dev: "http://localhost:5000/agent/email",
     prod: "http://email-service:5000/agent/email"
   ```

2. Update `EmailSender` to read from config:
   ```elixir
   @email_api_endpoint Application.get_env(:kg_edu, :email_api_endpoint)[:dev]
   ```

### Security

- API keys (email passwords) are stored in the database
- Consider using encryption for sensitive credentials
- The `api_key` field is marked as `sensitive? true` in the schema
- Ensure HTTPS is used in production

### Docker/Container Environment

If running in Docker, ensure the email API service is:
- On the same network
- Accessible via service name (e.g., `http://email-api:5000`)
- Properly configured for inter-service communication

## Troubleshooting

### Email not sending

1. **Check if email API is running:**
   ```bash
   curl http://localhost:5000/agent/email
   ```

2. **Check application logs** for detailed error messages

3. **Verify email config exists** for the receiver

4. **Confirm email domain** is supported (qq.com or 163.com)

5. **Test API directly** with cURL to isolate the issue

### Common Errors

- **`{:error, :no_email_config}`** → Receiver doesn't have an email config
- **`{:error, :user_not_found}`** → Sender or receiver user doesn't exist
- **Message status `:failed`** → Check the `error_message` field for details

## Summary

The email system now sends **real emails** through the external API service while maintaining:
- ✅ Tenant isolation
- ✅ One email config per user
- ✅ Status tracking (pending, sending, sent, failed)
- ✅ Comprehensive error handling
- ✅ Detailed logging
- ✅ Support for QQ and 163 email providers

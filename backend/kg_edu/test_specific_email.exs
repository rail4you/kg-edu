# Test email sending with specific credentials
require Logger

Logger.info("Testing email with credentials:")
Logger.info("  From: 619126989@qq.com")
Logger.info("  To: 619126989@qq.com")

# Direct HTTP POST to agent API
payload = %{
  senderEmail: "619126989@qq.com",
  senderPassword: "uzrnvmdhsozcbajj",
  senderName: "四图 <619126989@qq.com>",
  recipients: [
    %{
      name: "白老师",
      email: "619126989@qq.com"
    }
  ],
  subject: "Test Email",
  message: "This is a test email from opencode debug",
  isHtml: false
}

Logger.info("Payload: #{inspect(payload)}")

case Req.post("http://localhost:5000/agent/email", json: payload) do
  {:ok, response} ->
    Logger.info("Response status: #{response.status}")
    Logger.info("Response body: #{inspect(response.body)}")

  {:error, error} ->
    Logger.error("Error: #{inspect(error)}")
end

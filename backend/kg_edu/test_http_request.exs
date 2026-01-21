# Test HTTP request to email API
url = 'http://localhost:5000/agent/email'
payload = %{
  senderEmail: "619126989@qq.com",
  senderPassword: "uzrnvmdhsozcbajj",
  senderName: "stu1",
  recipients: [
    %{name: "白老师1", email: "619126989@qq.com"}
  ],
  subject: "HTTP Test",
  message: "Testing HTTP from Elixir",
  isHtml: false
}

json_payload = Jason.encode!(payload)

IO.puts("Testing HTTP request to email API...")
IO.puts("URL: #{url}")
IO.puts("Payload: #{json_payload}")

# Test with :httpc
result = :httpc.request(
  :post,
  {
    url,
    [{'Content-Type', 'application/json'}],
    'application/json',
    json_payload |> to_charlist()
  },
  [],
  body_format: :binary
)

IO.puts("\nResult:")
IO.puts(inspect(result, pretty: true))

case result do
  {:ok, {{'HTTP/1.1', status, reason}, _headers, body}} ->
    IO.puts("\nStatus: #{status}")
    IO.puts("Reason: #{reason}")
    IO.puts("Body: #{body}")

    case Jason.decode(body) do
      {:ok, decoded} ->
        IO.puts("\nDecoded:")
        IO.puts(inspect(decoded, pretty: true))
      {:error, json_error} ->
        IO.puts("\nJSON decode error: #{inspect(json_error)}")
    end

  {:error, reason} ->
    IO.puts("\nHTTP error: #{inspect(reason)}")
end

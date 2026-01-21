# Test HTTP directly to verify :httpc works
IO.puts("\n=== Testing HTTP Request ===\n")

# Start :inets manually
IO.puts("Starting :inets...")
case Application.ensure_all_started(:inets) do
  {:ok, _} -> IO.puts("✓ :inets started")
  {:error, reason} -> IO.puts("✗ Failed to start :inets: #{inspect(reason)}")
end

# Test HTTP request
url = 'http://localhost:5000/agent/email'
payload = %{
  senderEmail: "619126989@qq.com",
  senderPassword: "uzrnvmdhsozcbajj",
  senderName: "Direct Test",
  recipients: [%{name: "Test", email: "619126989@qq.com"}],
  subject: "Direct HTTP Test",
  message: "Testing HTTP from Elixir",
  isHtml: false
}

json = Jason.encode!(payload)

IO.puts("\nMaking HTTP POST request to #{url}...")

result = :httpc.request(
  :post,
  {
    url,
    [{'Content-Type', 'application/json'}],
    'application/json',
    json |> to_charlist()
  },
  [],
  body_format: :binary
)

IO.puts("\nResult:")
IO.puts(inspect(result, pretty: true))

case result do
  {:ok, {{'HTTP/1.1', 200, 'OK'}, _headers, body}} ->
    IO.puts("\n✓ HTTP request successful!")
    IO.puts("Response body: #{body}")

  {:ok, {{'HTTP/1.1', status, reason}, _headers, body}} ->
    IO.puts("\n⚠ HTTP request returned status #{status}: #{reason}")
    IO.puts("Body: #{body}")

  {:error, reason} ->
    IO.puts("\n✗ HTTP request failed:")
    IO.puts(inspect(reason, pretty: true))
end

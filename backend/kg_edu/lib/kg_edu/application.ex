defmodule KgEdu.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    # Load env files: prefer the agent-server .env (Qwen key), then local .env.
    # Walk up from the app root until we find the sibling agent-server folder.
    env_sources = build_env_sources()
    Dotenvy.source(env_sources, required: false)

    # The Pi agent at /api/assistant/ag-ui reads its Qwen key from
    # ~/.pi/agent/models.json. Mirror that source so the Jido agent can
    # authenticate with the same credentials when QWEN_API_KEY is missing.
    sync_qwen_key_from_pi_agent()

    # Setup ReqLLM configuration
    KgEdu.ReqLLMSetup.setup()

    children = [
      KgEduWeb.Telemetry,
      KgEdu.Repo,
      {DNSCluster, query: Application.get_env(:kg_edu, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: KgEdu.PubSub},
      # Start a worker by calling: KgEdu.Worker.start_link(arg)
      # {KgEdu.Worker, arg},
      # Start to serve requests, typically the last entry
      KgEduWeb.Endpoint,
      {AshAuthentication.Supervisor, [otp_app: :kg_edu]}
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: KgEdu.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    KgEduWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  defp build_env_sources do
    app_root = Application.app_dir(:kg_edu)
    cwd = File.cwd!()

    agent_env =
      Enum.find_value([app_root, cwd], fn dir ->
        walk_up_to_sibling(Path.expand(dir), "agent-server", ".env", 6)
      end)

    [agent_env, Path.join(app_root, ".env"), ".env"]
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
  end

  defp walk_up_to_sibling(dir, sibling, file, depth) do
    candidate = Path.expand(Path.join([dir, sibling, file]))

    cond do
      File.exists?(candidate) -> candidate
      depth <= 0 -> nil
      true -> walk_up_to_sibling(Path.expand(Path.join(dir, "..")), sibling, file, depth - 1)
    end
  end

  # The Pi agent (kg-edu-vite-antd) stores provider credentials in
  # ~/.pi/agent/models.json. When QWEN_API_KEY is not set in any of our
  # env sources, fall back to that file so the Jido agent shares the
  # working key with /api/assistant/ag-ui.
  defp sync_qwen_key_from_pi_agent do
    if empty_env?("QWEN_API_KEY") do
      case read_pi_agent_qwen_key() do
        {:ok, key} ->
          System.put_env("QWEN_API_KEY", key)
          Application.put_env(:req_llm, :alibaba_cn_api_key, key)
          Application.put_env(:req_llm, :alibaba_api_key, key)

          IO.puts(
            "[kg_edu] Loaded QWEN_API_KEY from ~/.pi/agent/models.json " <>
              "(len=#{String.length(key)})"
          )

        :error ->
          :ok
      end
    end
  end

  defp empty_env?(name) do
    case System.get_env(name) do
      nil -> true
      "" -> true
      _ -> false
    end
  end

  defp read_pi_agent_qwen_key do
    path = Path.expand("~/.pi/agent/models.json")

    with true <- File.exists?(path),
         {:ok, raw} <- File.read(path),
         {:ok, decoded} <- safe_decode(raw),
         %{"providers" => %{"qwen" => %{"apiKey" => key}}} <- decoded,
         key when is_binary(key) and byte_size(key) > 0 <- key do
      {:ok, key}
    else
      _ -> :error
    end
  end

  defp safe_decode(raw) do
    {:ok, Jason.decode!(raw)}
  rescue
    _ -> :error
  end
end

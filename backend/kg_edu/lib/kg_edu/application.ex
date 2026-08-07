defmodule KgEdu.Application do
  use Application

  @impl true
  def start(_type, _args) do
    # Load env files for non-key configuration
    env_sources = build_env_sources()
    Dotenvy.source(env_sources, required: false)

    # Ensure DASHSCOPE_API_KEY is available for ReqLLM (from env, models.json, or DB fallback)
    ensure_dashscope_key()

    # Seed the api_key_configs table from ~/.pi/agent/models.json
    # if the database has no key yet (first-time setup fallback).
    Task.start(fn ->
      Process.sleep(2_000)
      seed_api_keys_from_pi_agent()
    end)

    # Setup ReqLLM configuration (provider registry, no keys needed here)
    KgEdu.ReqLLMSetup.setup()

    children = [
      KgEduWeb.Telemetry,
      KgEdu.Repo,
      {DNSCluster, query: Application.get_env(:kg_edu, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: KgEdu.PubSub},
      KgEduWeb.Endpoint,
      {AshAuthentication.Supervisor, [otp_app: :kg_edu]},
      KgEdu.Agent.SessionContext,
      {KgEdu.Oban, name: KgEdu.Oban}
    ]

    KgEdu.Agent.JobManager.start()

    opts = [strategy: :one_for_one, name: KgEdu.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    KgEduWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  # ── DashScope key bootstrapping ────────────────────────────────────────

  defp ensure_dashscope_key do
    # Already set? Done.
    if is_binary(System.get_env("DASHSCOPE_API_KEY")) and
         System.get_env("DASHSCOPE_API_KEY") != "" do
      :ok
    else
      # 1. Try QWEN_API_KEY env var
      qwen_key = System.get_env("QWEN_API_KEY")

      if is_binary(qwen_key) and qwen_key != "" do
        System.put_env("DASHSCOPE_API_KEY", qwen_key)
        IO.puts("[kg_edu] DASHSCOPE_API_KEY set from QWEN_API_KEY")
      else
        # 2. Try ~/.pi/agent/models.json
        case read_pi_agent_qwen_key() do
          {:ok, key} ->
            System.put_env("DASHSCOPE_API_KEY", key)
            IO.puts("[kg_edu] DASHSCOPE_API_KEY set from ~/.pi/agent/models.json")

          :error ->
            # 3. DB will be loaded at request time by ApiKeyProvider.ensure_key()
            :ok
        end
      end
    end
  end

  # ── Key seeding ────────────────────────────────────────────────────────

  defp seed_api_keys_from_pi_agent do
    # Only seed if the database has no qwen key yet
    case KgEdu.SystemConfig.ApiKeyConfig.get_config(%{provider: "qwen"}) do
      {:ok, []} ->
        case read_pi_agent_qwen_key() do
          {:ok, key} ->
            KgEdu.SystemConfig.ApiKeyConfig.set_config(%{
              provider: :qwen,
              api_key: key
            })

            IO.puts("[kg_edu] Seeded Qwen API key from ~/.pi/agent/models.json")

          :error ->
            :ok
        end

      _ ->
        :ok
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

  # ── Env sources ────────────────────────────────────────────────────────

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
end

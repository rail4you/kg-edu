# Usage:
#   mix run qwen_skills_demo.exs "请计算 (12 + 7) * 3"
#   mix run qwen_skills_demo.exs "2025年6月1日到2025年6月20日相隔多少天？"
#   mix run qwen_skills_demo.exs "2025年12月25日往后推7天是什么日期？"
#
# Demonstrates dynamic skill + tool loading with NodeToolFactory.
# The demo auto-detects which skills are needed based on available
# priv/skills/*/SKILL.md files and loads ALL of them.

question =
  System.argv()
  |> List.first() ||
    "请计算 (12 + 7) * 3 的结果"

{:ok, _} = Application.ensure_all_started(:kg_edu)
{:ok, _} = Jido.start()

# ── Discover all skills ──────────────────────────────────────────────────
skills_dir = Application.app_dir(:kg_edu, "priv/skills")
skill_dirs = File.ls!(skills_dir) |> Enum.filter(&File.dir?(Path.join(skills_dir, &1)))
IO.puts("[demo] 📁 Discovered skill dirs: #{inspect(skill_dirs)}")

{:ok, _registry_pid} = Jido.AI.Skill.Registry.start_link()

# Load ALL skills and generate ALL dynamic tools
all_tools = []
all_skill_specs = []

{dynamic_tools, skill_specs} =
  Enum.reduce(skill_dirs, {[], []}, fn skill_name, {tools_acc, specs_acc} ->
    skill_path = Path.join([skills_dir, skill_name, "SKILL.md"])

    if File.exists?(skill_path) do
      {:ok, spec} = Jido.AI.Skill.Loader.load(skill_path)
      :ok = Jido.AI.Skill.Registry.register(spec)
      IO.puts("[demo] ✅ Loaded skill: #{spec.name} (tools: #{inspect(spec.allowed_tools)})")

      results = KgEdu.JidoAgents.ScriptToolFactory.create_from_skill(skill_path)
      new_tools = KgEdu.JidoAgents.ScriptToolFactory.modules_for_agent(results)

      if new_tools != [] do
        IO.puts("[demo]    → Auto-generated: #{Enum.map_join(new_tools, ", ", & &1.name())}")
      end

      {tools_acc ++ new_tools, [spec | specs_acc]}
    else
      {tools_acc, specs_acc}
    end
  end)

IO.puts("[demo] 📦 Total dynamic tools: #{length(dynamic_tools)} " <>
  "(#{Enum.map_join(dynamic_tools, ", ", & &1.name())})")

# ── Build system prompt with all skill bodies ──────────────────────────────
skill_prompt =
  skill_specs
  |> Enum.reverse()
  |> Jido.AI.Skill.Prompt.render(
    include_body: true,
    header: "## Available Skills"
  )

system_prompt = """
You are a helpful assistant with access to math and date tools.
You MUST use tool calls for all calculations and date operations.
Never attempt mental math or mental date arithmetic.
Call tools one at a time.
Show your work step by step.

#{skill_prompt}
"""

IO.puts("[demo] ✅ System prompt: #{String.length(system_prompt)} chars\n")

# ── Start agent ──────────────────────────────────────────────────────────
agent_mod = KgEdu.JidoAgents.QwenSkillsAgent
jido_instance = Jido.default_instance()
{:ok, pid} = Jido.AgentServer.start(jido: jido_instance, agent: agent_mod)

IO.puts("[demo] ✅ Agent started: pid=#{inspect(pid)}")
IO.puts(">>> 问: #{question}\n")

# ── Run the query with request-scoped tool override ───────────────────────
# `tools:` option replaces the compiled-in tools for this request ONLY
case agent_mod.ask_sync(pid, question, timeout: 90_000, tools: dynamic_tools) do
  {:ok, answer} when is_binary(answer) ->
    IO.puts("<<< 答: #{answer}\n")

    # Extract tool calls from agent state
    {:ok, server_state} = GenServer.call(pid, :get_state)

    tool_results =
      server_state.agent.state[:__strategy__][:tool_results] ||
        server_state.agent.state[:tool_results] || []

    if tool_results != [] do
      IO.puts("═══ Tool Calls ═══")

      Enum.each(tool_results, fn entry ->
        name = entry[:name] || entry["name"] || "unknown"
        args = entry[:arguments] || entry["arguments"] || %{}
        result = entry[:result] || entry["result"]
        content = entry[:content] || entry["content"]

        IO.puts("  🔧 #{name}(#{inspect(args)})")

        if content && is_binary(content) do
          json = Jason.decode!(content)
          IO.puts("     → #{inspect(json, pretty: true) |> String.replace("\n", "\n     ")}")
        end
      end)

      IO.puts("")
    else
      IO.puts("⚠️  未检测到工具调用\n")
    end

  {:ok, result} ->
    IO.puts("=== Agent Result ===\n#{inspect(result, limit: :infinity, printable_limit: 4096)}\n")

  {:error, reason} ->
    IO.puts("=== Error ===\n#{inspect(reason, limit: :infinity, printable_limit: 4096)}\n")
    System.halt(1)
end

IO.puts("""
══════════════════════════════════
 架构: 零包装 JS 工具调用
══════════════════════════════════
 priv/skills/*/SKILL.md  →  ScriptToolFactory  →  Module.create/3  →  System.cmd(runtime)
 每个 .js 工具自动生成 Action 模块，无需手写 .ex 包装文件
══════════════════════════════════
""")

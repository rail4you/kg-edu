defmodule KgEdu.Chat do
  @moduledoc """
  Chat interface using Jido.AI's ReAct runtime.

  Provides both streaming (`stream_answer/3`) and synchronous (`run_answer/3`)
  modes. Replaces the old `Jido.AgentServer` + `ask_sync` pattern with direct
  `Jido.AI.Reasoning.ReAct` calls, matching the approach used in dayu-ai.

  ## Streaming (SSE-friendly)

      {:ok, events} = KgEdu.Chat.stream_answer("math", "计算 12 + 7")
      # events is an Enumerable of ReAct.Event structs

  ## Synchronous

      result = KgEdu.Chat.run_answer("qa", "介绍一下 Elixir 语言")
      result.result  # => final answer text
      result.trace   # => list of all events
  """

  alias Jido.AI.Reasoning.ReAct

  @doc """
  Returns a lazy Enumerable of ReAct events for the given agent/tools combination.

  Each event is a `Jido.AI.Reasoning.ReAct.Event` struct with `kind`:
    - `:tool_started` — tool execution begins
    - `:tool_completed` — tool execution finished
    - `:llm_delta` — streaming token received
    - `:request_completed` — run finished
    - `:request_failed` — run failed

  ## Options

    * `:model` - Model alias or string (default: `:fast`, resolved to `alibaba_cn:qwen-plus`)
    * `:system_prompt` - System prompt for the agent
    * `:tools` - List of action modules (e.g. `[KgEdu.JidoAgents.Actions.Add]`)
    * `:skills` - List of skill modules (e.g. `[KgEdu.JidoAgents.Skills.Math]`)
    * `:max_iterations` - Max ReAct iterations (default: 10)
    * `:tool_concurrency` - Max concurrent tool executions (default: 4)
  """
  def stream_answer(message, opts \\ []) when is_binary(message) do
    config = build_config(opts)
    ReAct.stream(message, config)
  end

  @doc """
  Runs ReAct to completion and returns an aggregated result map.

  Shortcut for `stream_answer/2` + `ReAct.collect_stream/1`.

  ## Options

    * `:model` - Model alias or string (default: `:fast`)
    * `:system_prompt` - System prompt for the agent
    * `:tools` - List of action modules
    * `:skills` - List of skill modules
    * `:max_iterations` - Max ReAct iterations (default: 10)
  """
  def run_answer(message, opts \\ []) when is_binary(message) do
    message
    |> stream_answer(opts)
    |> ReAct.collect_stream()
  end

  # ── config builder ──────────────────────────────────────────────────────

  defp build_config(opts) do
    system_prompt = Keyword.get(opts, :system_prompt, default_system_prompt())
    tools = resolve_tools(opts)
    model = Keyword.get(opts, :model, :fast)
    max_iterations = Keyword.get(opts, :max_iterations, 10)
    streaming = Keyword.get(opts, :streaming, true)
    capture_deltas? = Keyword.get(opts, :capture_deltas?, true)
    emit_telemetry? = Keyword.get(opts, :emit_telemetry?, false)
    emit_signals? = Keyword.get(opts, :emit_signals?, false)
    tool_concurrency = Keyword.get(opts, :tool_concurrency, 4)

    %{
      model: model,
      system_prompt: system_prompt,
      tools: tools,
      max_iterations: max_iterations,
      streaming: streaming,
      capture_deltas?: capture_deltas?,
      emit_telemetry?: emit_telemetry?,
      emit_signals?: emit_signals?,
      tool_concurrency: tool_concurrency
    }
  end

  defp resolve_tools(opts) do
    tools = Keyword.get(opts, :tools, [])
    skills = Keyword.get(opts, :skills, [])

    skill_tools =
      Enum.flat_map(skills, fn skill_mod ->
        case Kernel.function_exported?(skill_mod, :actions, 0) do
          true -> skill_mod.actions()
          false -> []
        end
      end)

    tools ++ skill_tools
  end

  defp default_system_prompt do
    "You are a helpful assistant specialized in educational knowledge graph content. " <>
      "Answer concisely in the user's language. Use the available tools when needed."
  end

  # ── pre-built agent configs ─────────────────────────────────────────────

  @doc """
  Returns the config for a Q&A agent (no tools).
  """
  def qa_config(opts \\ []) do
    Keyword.merge(
      [
        model: :qwen,
        system_prompt: "You are a helpful assistant. Answer concisely in the user's language.",
        tools: []
      ],
      opts
    )
  end

  @doc """
  Returns the config for a Math agent (add / multiply tools).

  Uses `tool_concurrency: 1` to avoid the LLM calling `multiply` before
  `add` has returned a result (parallel tool calls with data dependencies).
  """
  def math_config(opts \\ []) do
    Keyword.merge(
      [
        model: :capable,
        system_prompt:
          "You are a helpful assistant. Always use the available tools when arithmetic is needed. " <>
            "Call tools one at a time \u2014 do NOT call multiple arithmetic tools in parallel.",
        tools: [
          KgEdu.JidoAgents.Actions.Add,
          KgEdu.JidoAgents.Actions.Multiply
        ],
        tool_concurrency: 1
      ],
      opts
    )
  end

  @doc """
  Returns the config for a Node.js-backed Math agent.
  """
  def node_math_config(opts \\ []) do
    Keyword.merge(
      [
        model: :qwen,
        system_prompt:
          "You are a helpful assistant. Always use the available tools when arithmetic is needed. " <>
            "Call tools one at a time \u2014 do NOT call multiple arithmetic tools in parallel.",
        tools: [
          KgEdu.JidoAgents.Actions.AddNode,
          KgEdu.JidoAgents.Actions.MultiplyNode
        ],
        tool_concurrency: 1
      ],
      opts
    )
  end
end

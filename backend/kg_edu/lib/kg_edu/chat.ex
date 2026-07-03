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
    KgEdu.Agent.ApiKeyProvider.ensure_key()
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
    tool_timeout_ms = Keyword.get(opts, :tool_timeout_ms, 15_000)
    tool_context = Keyword.get(opts, :tool_context, %{})

    %{
      model: model,
      system_prompt: system_prompt,
      tools: tools,
      max_iterations: max_iterations,
      streaming: streaming,
      capture_deltas?: capture_deltas?,
      emit_telemetry?: emit_telemetry?,
      emit_signals?: emit_signals?,
      tool_concurrency: tool_concurrency,
      tool_timeout_ms: tool_timeout_ms,
      tool_context: tool_context
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
  Returns the config for the Education agent (full tool set).

  Includes tools for: courses, knowledge resources, exercises, exams,
  exercise generation, PPTX and DOCX generation.
  """
  def edu_config(opts \\ []) do
    Keyword.merge(
      [
        model: :qwen,
        system_prompt: edu_system_prompt(),
        tools: [
          KgEdu.Agent.Tools.GetCourses,
          KgEdu.Agent.Tools.GetCoursesByMajor,
          KgEdu.Agent.Tools.GetCoursesBySemester,
          KgEdu.Agent.Tools.GetChapters,
          KgEdu.Agent.Tools.GetChapterById,
          KgEdu.Agent.Tools.GetKnowledgeResources,
          KgEdu.Agent.Tools.GetExercises,
          KgEdu.Agent.Tools.GenerateExercises,
          KgEdu.Agent.Tools.GetExams,
          KgEdu.Agent.Tools.DocumentTools.PPTX,
          KgEdu.Agent.Tools.DocumentTools.DOCX,
          KgEdu.Agent.Tools.GenerateCompetencyGraph,
          KgEdu.Agent.Tools.GenerateCurriculum
        ],
        max_iterations: 10,
        tool_timeout_ms: 120_000
      ],
      opts
    )
  end

  defp edu_system_prompt do
    """
    你是KgEdu平台的教育AI助手。

    你的职责：
    - 管理课程和教学资源
    - 创建和管理练习题与试卷
    - 生成教学材料（PPT/PPTX课件、DOCX教案文档）

    重要规则：
    1. 用户询问课程时，必须先调用GetCourses获取课程列表。GetCourses返回的结果中包含课程ID（格式：课程名 (ID: uuid)）。
    2. 创建文档（如教案）时，必须先获取courseId。没有courseId无法保存。
    3. 用户提到PPT/PPTX/幻灯片/课件时，必须调用GeneratePowerPointWithShapeCrawler工具。绝不要只是文字描述PPT内容。
    4. 按课程章节生成PPT的标准流程（务必严格按步骤执行）：
       a) GetCourses → 找到目标课程，记住其 title 和 id
       b) GetChapters(courseId: "上一步的课程id") → 从返回结果中找到目标章节，记住其 id
       c) GeneratePowerPointWithShapeCrawler(courseName: "课程名", courseId: "课程id", chapterId: "章节id")
       d) 生成成功后直接展示下载链接。如果工具返回错误提示，根据提示修正参数后重试，最多重试2次。
    5. 如果用户没明确说课程名，先调用GetCourses获取列表后再操作。
    6. 【禁止展示ID】工具返回的ID字段仅用于内部调用，向用户展示时不要输出任何UUID。
    7. 回答简洁，直接给出结果，无需多余解释。
    8. 每个工具最多调用一次，如果工具返回了有效结果，直接使用该结果，不要重复调用同一工具。
    9. 【重要】不要输出思考过程。直接调用工具，只展示最终结果（如PPT下载链接）。不要在调用工具前输出"我需要先..."、"让我..."等思考文字。
    """
    |> String.trim()
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

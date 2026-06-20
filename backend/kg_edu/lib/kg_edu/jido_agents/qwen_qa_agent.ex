defmodule KgEdu.JidoAgents.QwenQaAgent do
  @moduledoc """
  Minimal Q&A agent backed by Qwen Plus through DashScope's OpenAI-compatible
  endpoint (`https://dashscope.aliyuncs.com/compatible-mode/v1`).

  Uses `Jido.AI.Agent` (ReAct strategy) on top of `req_llm`'s built-in
  `:alibaba_cn` provider. The API key is read from `QWEN_API_KEY`
  (configured in `agent-server/.env` and re-exported via `application.ex`).

  ## Usage

      {:ok, pid} = Jido.AgentServer.start(agent: KgEdu.JidoAgents.QwenQaAgent)
      {:ok, result} = KgEdu.JidoAgents.QwenQaAgent.ask_sync(pid, "介绍一下 Elixir 语言")

  Pattern from: https://github.com/agentjido/jido_ai/tree/main/examples
  """

  use Jido.AI.Agent,
    name: "qwen_qa_agent",
    description: "Simple Q&A agent using Qwen Plus via DashScope",
    model: :qwen,
    system_prompt: "You are a helpful assistant. Answer concisely in the user's language.",
    tools: [],
    max_iterations: 10
end

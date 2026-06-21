defmodule KgEdu.Agent.SessionContext do
  @moduledoc """
  Lightweight session-scoped context for agent tool calls.

  Stores tenant, userId, and other request-level data that tools
  need to access. Uses a simple Agent process — no ETS, no complex
  memory system. Started once at application boot.

  ## Usage

      # ChatController sets context before streaming:
      SessionContext.put(tenant: "org_xxx", user_id: "user-123")

      # Tools read context:
      tenant = SessionContext.get(:tenant)
  """

  use Agent

  @doc "Start the context store."
  def start_link(_opts \\ []) do
    Agent.start_link(fn -> %{} end, name: __MODULE__)
  end

  @doc "Set multiple context values at once."
  def put(kvs) when is_list(kvs) do
    Agent.update(__MODULE__, fn state ->
      Map.merge(state, Map.new(kvs))
    end)
  end

  @doc "Get a single context value."
  def get(key) do
    Agent.get(__MODULE__, &Map.get(&1, key))
  end

  @doc "Get all context."
  def all do
    Agent.get(__MODULE__, & &1)
  end
end

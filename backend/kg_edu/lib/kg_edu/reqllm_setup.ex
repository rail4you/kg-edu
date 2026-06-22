defmodule KgEdu.ReqLLMSetup do
  @moduledoc """
  Module to setup ReqLLM configuration on application start.
  API keys are loaded dynamically by KgEdu.Agent.ApiKeyProvider.
  """

  def setup do
    # ReqLLM provider registry is configured in config.exs.
    # Actual keys are injected at runtime by ApiKeyProvider.
    :ok
  end
end

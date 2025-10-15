defmodule KgEdu.ReqLLMSetup do
  @moduledoc """
  Module to setup ReqLLM configuration on application start.
  """
  
  def setup do
    config = Application.get_env(:kg_edu, :reqllm)
    
    if config && config[:api_key] do
      ReqLLM.put_key(:openrouter_api_key, config[:api_key])
    else
      IO.warn("ReqLLM API key not configured. Please set OPENROUTER_API_KEY environment variable.")
    end
  end
end
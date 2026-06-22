defmodule KgEdu.Agent.ApiKeyProvider do
  @moduledoc """
  Central module for AI API keys.  All AI functions read keys from the
  database through this module so that super admins can change them at
  runtime without restarting the service.
  """

  @doc """
  Read the API key for the given provider from the `api_key_configs` table.
  Returns the key string or nil.
  """
  def get_key(provider) do
    provider_str = to_string(provider)

    case KgEdu.SystemConfig.ApiKeyConfig.get_config(%{provider: provider_str}) do
      {:ok, [%{api_key: key} | _]} when is_binary(key) and key != "" ->
        key

      _ ->
        nil
    end
  end

  @doc """
  Load the API key for the given provider from DB and make it available
  to ReqLLM via both Application config and System env. Called at request
  time so key changes in DB take effect immediately without restart.
  """
  def ensure_key(provider \\ :qwen) do
    case get_key(provider) do
      key when is_binary(key) and key != "" ->
        provider_str = to_string(provider)
        config_key = :"#{provider_str}_api_key"
        env_var = env_var_for(provider_str)

        Application.put_env(:req_llm, config_key, key)
        System.put_env(env_var, key)
        :ok

      _ ->
        :ok
    end
  end

  defp env_var_for("qwen"), do: "DASHSCOPE_API_KEY"
  defp env_var_for(_), do: nil

  @doc """
  Notify that keys should be re-read (called after a super admin updates).
  For the stateless version, this is a no-op since we read from DB every time.
  """
  def refresh do
    :ok
  end
end

defmodule KgEdu.JidoAgents.NodeScriptHelper do
  @moduledoc """
  Shared helper for Node.js-backed actions.

  Each per-tool wrapper (`AddNode`, `MultiplyNode`) is a thin `Jido.Action`
  that delegates execution to this helper, avoiding duplicated shell-out code.

  ## How it works

      1. Resolves `priv/skills/math/tools/<tool_name>.js`
      2. Passes validated params as CLI args (sorted by atom key name)
      3. Calls the output formatting callback with stdout
  """

  @scripts_dir :kg_edu |> Application.app_dir() |> Path.join("priv/skills/math/tools")

  @doc """
  Runs a Node.js script and returns `{:ok, result_map}` or `{:error, reason}`.
  """
  def run_script(tool_name, params, output_fun) when is_function(output_fun, 1) do
    script = Path.join(@scripts_dir, "#{tool_name}.js")

    if File.exists?(script) do
      args = build_args(params)

      case System.cmd("node", [script | args]) do
        {output, 0} ->
          {:ok, output_fun.(String.trim(output))}

        {error, _exit_code} ->
          {:error, "Node.js script '#{tool_name}' failed: #{String.trim(error)}"}
      end
    else
      {:error, "Node.js script not found: #{script}"}
    end
  end

  defp build_args(params) do
    params
    |> Map.drop([:__struct__])
    |> Enum.sort_by(fn {k, _} -> to_string(k) end)
    |> Enum.map(fn {_, v} -> to_string(v) end)
  end
end

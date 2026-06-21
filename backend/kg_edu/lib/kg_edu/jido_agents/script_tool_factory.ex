defmodule KgEdu.JidoAgents.ScriptToolFactory do
  @moduledoc """
  Dynamically creates Jido.Action modules for script-backed tools.

  Supports Node.js (.js), Python (.py), and other runtimes. Instead of writing
  one Elixir module per script, this factory generates the modules at runtime
  using `Module.create/3`.

  Each generated module satisfies the Jido.Action contract (name/0, description/0,
  schema/0, run/2) and delegates execution to the script via `System.cmd/3`.

  ## Two Execution Modes

  **JSON mode** (when `<tool>.schema.json` exists):
  - Params are serialized as JSON string, passed as single argv arg
  - stdout is parsed as JSON
  - Best for tools with named, typed parameters (string, integer, etc.)

  **Legacy mode** (no schema file — backward compat):
  - Params are sorted by key, converted to strings, passed as positional args
  - stdout is parsed as integer
  - Used by simple math tools (add, multiply)

  ## Usage

      # Generate action modules from a SKILL.md's allowed-tools
      modules = ScriptToolFactory.create_from_skill("priv/skills/math/SKILL.md")
      modules |> Enum.map(& &1.name())  # => ["add", "multiply"]

      # For date skill (JSON mode with string params):
      modules = ScriptToolFactory.create_from_skill("priv/skills/date/SKILL.md")
      {:ok, %{result: %{"days" => 30}}} = date_diff.run(%{date1: "2025-01-01", date2: "2025-01-31"}, %{})
  """

  @default_schema_ast (quote do
                         Zoi.object(%{
                           a: Zoi.integer() |> Zoi.nullish() |> Zoi.default(0),
                           b: Zoi.integer() |> Zoi.nullish() |> Zoi.default(0)
                         })
                       end)

  @doc """
  Creates Jido.Action modules for all tools declared in a SKILL.md file.

  Returns a list of {:ok, module} tuples.
  """
  @spec create_from_skill(Path.t()) :: [{:ok, module()} | {:error, term()}]
  def create_from_skill(skill_path) when is_binary(skill_path) do
    with {:ok, spec} <- Jido.AI.Skill.Loader.load(skill_path),
         skill_dir = Path.dirname(skill_path),
         tools_dir = Path.join(skill_dir, "tools") do
      spec.allowed_tools
      |> Enum.map(fn tool_name ->
        create_tool(tool_name, tools_dir, skill_dir)
      end)
    end
  end

  @doc """
  Creates a single Jido.Action module for a named script tool.

  Supports Node.js (`.js`) and Python (`.py`). The runtime is auto-detected
  from the script extension. Falls back to Node.js for backward compat.

  The generated module:
  - Name: `Elixir.KgEdu.JidoAgents.Actions.Dynamic.<ToolName>`
  - Description: derived from tool metadata or default
  - Schema: from companion `.schema.json` file or default
  - Run: delegates to the script via `System.cmd/3`

  Returns `{:ok, module}` or `{:error, reason}`.
  """
  @spec create_tool(String.t(), Path.t(), Path.t()) :: {:ok, module()} | {:error, term()}
  def create_tool(tool_name, tools_dir, skill_dir \\ nil)
      when is_binary(tool_name) and is_binary(tools_dir) do
    _skill_dir = skill_dir || tools_dir |> Path.dirname()

    # Auto-detect runtime from script extension
    {script_path, runtime} = find_script(tools_dir, tool_name)
    schema_path = Path.join(tools_dir, "#{tool_name}.schema.json")
    has_schema = File.exists?(schema_path)

    if script_path do
      module_name = module_name_for(tool_name)

      # Skip if already created (idempotent)
      if Code.ensure_loaded?(module_name) and function_exported?(module_name, :name, 0) do
        {:ok, module_name}
      else
        ensure_parent_module()

        {schema_ast, json_mode} = load_tool_schema(tools_dir, tool_name, has_schema)
        description = load_tool_description(tools_dir, tool_name, tool_name)

        try do
          {:module, mod, _binary, _exports} =
            Module.create(
              module_name,
              generate_action_module(tool_name, description, schema_ast, tools_dir, json_mode, runtime),
              Macro.Env.location(__ENV__)
            )

          mode_label = if json_mode, do: "(JSON mode)", else: "(legacy mode)"
          IO.puts("[ScriptToolFactory] ✅ Created #{inspect(mod)} for '#{tool_name}' #{mode_label} [#{runtime}]")
          {:ok, mod}
        rescue
          e ->
            IO.puts("[ScriptToolFactory] ❌ Failed #{module_name} for '#{tool_name}': #{Exception.message(e)}")
            {:error, e}
        end
      end
    else
      IO.puts("[ScriptToolFactory] ⚠️  Script not found for '#{tool_name}' in #{tools_dir}")
      {:error, :script_not_found}
    end
  end

  @doc """
  Returns the list of modules (as `{:ok, mod}` tuples) in a format
  suitable for use with `ToolCatalog` or agent `tools:` list.

  Extracts just the modules, filtering out errors.
  """
  @spec modules_for_agent([{:ok, module()} | {:error, term()}]) :: [module()]
  def modules_for_agent(results) when is_list(results) do
    results
    |> Enum.filter(fn
      {:ok, _mod} -> true
      _ -> false
    end)
    |> Enum.map(fn {:ok, mod} -> mod end)
  end

  # ── Private ────────────────────────────────────────────────────────────────

  @runtime_map %{"js" => "bun"}

  # Finds the script file and returns {path, runtime_command}
  defp find_script(tools_dir, tool_name) do
    Enum.find_value(@runtime_map, fn {ext, runtime} ->
      path = Path.join(tools_dir, "#{tool_name}.#{ext}")
      if File.exists?(path), do: {path, runtime}
    end)
  end

  defp module_name_for(tool_name) do
    safe_name =
      tool_name
      |> String.replace(~r/[^a-zA-Z0-9_]/, "_")
      |> Macro.camelize()

    Module.concat([KgEdu, JidoAgents, Actions, Dynamic, safe_name])
  end

  defp ensure_parent_module do
    unless Code.ensure_loaded?(KgEdu.JidoAgents.Actions.Dynamic) do
      Module.create(KgEdu.JidoAgents.Actions.Dynamic, quote(do: nil), Macro.Env.location(__ENV__))
    end
  end

  defp load_tool_schema(tools_dir, tool_name, true = _has_schema) do
    schema_path = Path.join(tools_dir, "#{tool_name}.schema.json")

    case File.read(schema_path) |> elem(1) |> Jason.decode() do
      {:ok, %{"properties" => props, "required" => required}} ->
        {build_schema_from_json(props, required), true}

      _ ->
        {@default_schema_ast, false}
    end
  end

  defp load_tool_schema(_tools_dir, _tool_name, false) do
    {@default_schema_ast, false}
  end

  defp load_tool_description(tools_dir, tool_name, fallback) do
    desc_path = Path.join(tools_dir, "#{tool_name}.description.txt")

    if File.exists?(desc_path) do
      File.read!(desc_path) |> String.trim()
    else
      "Execute the '#{fallback}' Node.js tool with the given parameters."
    end
  end

  defp build_schema_from_json(props, _required) when is_map(props) do
    fields =
      Enum.map(props, fn {name, %{"type" => type} = prop} ->
        desc = Map.get(prop, "description", "")
        key = String.to_atom(name)

        field =
          case type do
            "integer" ->
              quote do
                Zoi.integer(description: unquote(desc)) |> Zoi.nullish() |> Zoi.default(0)
              end

            "number" ->
              quote do
                Zoi.number(description: unquote(desc)) |> Zoi.nullish() |> Zoi.default(0.0)
              end

            "string" ->
              quote do
                Zoi.string(description: unquote(desc)) |> Zoi.nullish() |> Zoi.default("")
              end

            "boolean" ->
              quote do
                Zoi.boolean(description: unquote(desc)) |> Zoi.nullish() |> Zoi.default(false)
              end

            _ ->
              quote do
                Zoi.any(description: unquote(desc)) |> Zoi.nullish()
              end
          end

        {key, field}
      end)

    quote do
      Zoi.object(%{unquote_splicing(fields)})
    end
  end

  defp build_schema_from_json(_props, _required), do: @default_schema_ast

    # Generate the full action module AST.
  # runtime is the command to invoke ("bun")
  # json_mode=true → params as JSON argv[2], stdout parsed as JSON
  # json_mode=false → params as positional CLI args, stdout parsed as integer
  defp generate_action_module(tool_name, description, schema_ast, tools_dir, json_mode, runtime) do
    ext = "js"
    script_path = Path.join(tools_dir, "#{tool_name}.#{ext}")

    run_body =
      if json_mode do
        json_mode_run_body(tool_name, script_path, runtime)
      else
        legacy_mode_run_body(tool_name, script_path, runtime)
      end

    quote do
      use Jido.Action,
        name: unquote(tool_name),
        description: unquote(description),
        schema: unquote(schema_ast)

      @impl true
      def run(params, _context) do
        unquote(run_body)
      end
    end
  end

  # ── JSON mode: params → JSON string → argv[2] → stdout JSON ──────────────

  defp json_mode_run_body(tool_name, script_path, runtime) do
    quote do
      require Logger
      script = unquote(script_path)
      runtime_cmd = unquote(runtime)

      if File.exists?(script) do
        json_params =
          params
          |> Map.drop([:__struct__, :__meta__])
          |> Jason.encode!()

        Logger.info("[#{String.upcase(runtime_cmd)} Tool] #{unquote(tool_name)} called with #{json_params}")
        start_ms = System.monotonic_time(:millisecond)

        result =
          case System.cmd(runtime_cmd, [script, json_params], stderr_to_stdout: true) do
            {output, 0} ->
              case Jason.decode(output) do
                {:ok, result} -> {:ok, %{result: result}}
                {:error, _} -> {:ok, %{raw: String.trim(output)}}
              end

            {output, exit_code} ->
              error_msg =
                case Jason.decode(output) do
                  {:ok, %{"error" => msg}} -> msg
                  _ -> String.trim(output)
                end

              {:error, "Tool '#{unquote(tool_name)}' failed (exit #{exit_code}): #{error_msg}"}
          end

        duration_ms = System.monotonic_time(:millisecond) - start_ms

        case result do
          {:ok, output} ->
            Logger.info("[#{String.upcase(runtime_cmd)} Tool] #{unquote(tool_name)} ✅ #{duration_ms}ms → #{inspect(output)}")

          {:error, reason} ->
            Logger.error("[#{String.upcase(runtime_cmd)} Tool] #{unquote(tool_name)} ❌ #{duration_ms}ms → #{reason}")
        end

        result
      else
        Logger.error("[#{String.upcase(runtime_cmd)} Tool] #{unquote(tool_name)} ❌ Script not found: #{script}")
        {:error, "Script not found: #{script}"}
      end
    end
  end

  # ── Legacy mode: params → positional CLI args → stdout integer ──────────

  defp legacy_mode_run_body(tool_name, script_path, runtime) do
    quote do
      require Logger
      script = unquote(script_path)
      runtime_cmd = unquote(runtime)

      if File.exists?(script) do
        args =
          params
          |> Map.drop([:__struct__, :__meta__])
          |> Enum.sort_by(fn {k, _} -> to_string(k) end)
          |> Enum.map(fn {_, v} -> to_string(v) end)

        Logger.info("[#{String.upcase(runtime_cmd)} Tool] #{unquote(tool_name)} called with args=#{inspect(args)}")
        start_ms = System.monotonic_time(:millisecond)

        result =
          case System.cmd(runtime_cmd, [script | args]) do
            {output, 0} ->
              parsed =
                output
                |> String.trim()
                |> case do
                  "" -> nil
                  s -> String.to_integer(s)
                end

              {:ok, %{result: parsed}}

            {error, _exit_code} ->
              {:error, "Script '#{unquote(tool_name)}' failed: #{String.trim(error)}"}
          end

        duration_ms = System.monotonic_time(:millisecond) - start_ms

        case result do
          {:ok, output} ->
            Logger.info("[#{String.upcase(runtime_cmd)} Tool] #{unquote(tool_name)} ✅ #{duration_ms}ms → #{inspect(output)}")

          {:error, reason} ->
            Logger.error("[#{String.upcase(runtime_cmd)} Tool] #{unquote(tool_name)} ❌ #{duration_ms}ms → #{reason}")
        end

        result
      else
        Logger.error("[#{String.upcase(runtime_cmd)} Tool] #{unquote(tool_name)} ❌ Script not found: #{script}")
        {:error, "Script not found: #{script}"}
      end
    end
  end
end

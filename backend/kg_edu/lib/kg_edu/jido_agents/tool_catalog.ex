defmodule KgEdu.JidoAgents.ToolCatalog do
  @moduledoc """
  Maps skill `allowed-tools` names to Jido action modules.

  Supports two modes:
  1. **Dynamic** (default) - Uses `NodeToolFactory` to auto-generate action modules
     from `.js` scripts in `priv/skills/<skill>/tools/`. No per-tool `.ex` files needed.
  2. **Static** - Falls back to manually registered Elixir-native action modules.

  ## Dynamic Mode

  The SKILL.md `priv/skills/math/SKILL.md` declares `allowed-tools: [add, multiply]`.
  The catalog auto-discovers `priv/skills/math/tools/add.js` and `multiply.js`,
  generates corresponding Jido.Action modules via `Module.create/3`, and returns them.

  No `add_node.ex` or `multiply_node.ex` wrapper files are needed.

  ## Static Mode (backward compat)

  Pre-registered action modules for tools that don't have a `.js` counterpart.
  """

  # Static fallback: manually registered Elixir-native actions
  @static_tools %{
    "add" => KgEdu.JidoAgents.Actions.Add,
    "multiply" => KgEdu.JidoAgents.Actions.Multiply
  }

  @doc "Returns all registered tools as a list of {name, module} tuples."
  def all do
    dynamic = dynamic_all()
    static = Map.to_list(@static_tools)

    # Dynamic tools take precedence over static
    dynamic_names = MapSet.new(Enum.map(dynamic, fn {name, _mod} -> name end))
    filtered_static = Enum.reject(static, fn {name, _mod} -> MapSet.member?(dynamic_names, name) end)

    dynamic ++ filtered_static
  end

  @doc """
  Returns action modules for the given skill tool name strings.

  If a tool name has a `.js` script in the skills directory, it will be
  dynamically generated via `NodeToolFactory`. Otherwise, falls back to
  static registered modules.
  """
  def for_skills(skill_names) when is_list(skill_names) do
    skill_names
    |> Enum.map(&resolve/1)
    |> Enum.reject(&is_nil/1)
  end

  @doc """
  Resolves a single tool name to its action module.

  Resolution order:
  1. Check if a dynamic module has already been created (cached)
  2. Try to create one from a `.js` script via `NodeToolFactory`
  3. Fall back to static registry
  """
  def resolve(name) when is_binary(name) do
    # 1. Dynamic cache lookup
    dynamic_mod = Module.concat([KgEdu, JidoAgents, Actions, Dynamic, Macro.camelize(name)])

    if Code.ensure_loaded?(dynamic_mod) and function_exported?(dynamic_mod, :name, 0) do
      dynamic_mod
    else
      # 2. Try to create from .js scripts (scan common skill directories)
      case find_and_create_from_scripts(name) do
        {:ok, mod} -> mod
        :not_found -> Map.get(@static_tools, name)
      end
    end
  end

  @doc """
  Pre-loads and generates modules for all tools found in skills directories.
  Call this once at application startup.

  Returns a list of `{:ok, mod}` tuples for successfully created modules.
  """
  def preload_all do
    skills_dir = Application.app_dir(:kg_edu, "priv/skills")

    if File.dir?(skills_dir) do
      skills_dir
      |> File.ls!()
      |> Enum.flat_map(fn skill_name ->
        skill_path = Path.join([skills_dir, skill_name, "SKILL.md"])

        if File.exists?(skill_path) do
          case KgEdu.JidoAgents.NodeToolFactory.create_from_skill(skill_path) do
            results when is_list(results) -> results
            {:error, _} -> []
          end
        else
          []
        end
      end)
    else
      []
    end
  end

  # ── Private ────────────────────────────────────────────────────────────────

  defp find_and_create_from_scripts(name) do
    skills_dir = Application.app_dir(:kg_edu, "priv/skills")

    if File.dir?(skills_dir) do
      # Look for first matching .js script in any skill's tools/ dir
      result =
        skills_dir
        |> File.ls!()
        |> Enum.find_value(:not_found, fn skill_name ->
          tools_dir = Path.join([skills_dir, skill_name, "tools"])
          script = Path.join(tools_dir, "#{name}.js")

          if File.exists?(script) do
            KgEdu.JidoAgents.NodeToolFactory.create_tool(name, tools_dir)
          end
        end)

      case result do
        {:ok, _mod} = ok -> ok
        :not_found -> :not_found
      end
    else
      :not_found
    end
  end

  defp dynamic_all do
    skills_dir = Application.app_dir(:kg_edu, "priv/skills")

    if File.dir?(skills_dir) do
      skills_dir
      |> File.ls!()
      |> Enum.flat_map(fn skill_name ->
        skill_path = Path.join([skills_dir, skill_name, "SKILL.md"])

        if File.exists?(skill_path) do
          case Jido.AI.Skill.Loader.load(skill_path) do
            {:ok, spec} ->
              spec.allowed_tools
              |> Enum.map(fn tool_name ->
                dynamic_mod =
                  Module.concat([KgEdu, JidoAgents, Actions, Dynamic, Macro.camelize(tool_name)])

                if Code.ensure_loaded?(dynamic_mod) and function_exported?(dynamic_mod, :name, 0) do
                  {tool_name, dynamic_mod}
                else
                  nil
                end
              end)
              |> Enum.reject(&is_nil/1)

            _ ->
              []
          end
        else
          []
        end
      end)
    else
      []
    end
  end
end

defmodule Mix.Tasks.PatchDeps do
  use Mix.Task

  @shortdoc "Apply project dependency patches (see patches/apply.sh)"

  @moduledoc """
  Applies the project's dependency patches to the vendored `deps/` sources.

  Some third-party deps need small source-level hotfixes that are not yet
  available upstream (e.g. the jido_ai ReAct args_lost retry guard for
  DashScope streaming). Since `deps/` is git-ignored, the patches live in
  `patches/*.patch` and must be re-applied after every `mix deps.get`.

  This task is hooked automatically after `mix deps.get` via the
  `deps.get` alias in `mix.exs`; it is idempotent and can also be run
  manually: `mix patch_deps`
  """

  @impl true
  def run(_args) do
    backend_root = Path.expand("../../..", Path.dirname(__ENV__.file))

    case System.cmd("bash", [Path.join(backend_root, "patches/apply.sh")], into: IO.stream(:stdio, :line)) do
      {_, 0} ->
        :ok

      {_, code} ->
        Mix.raise("依赖补丁应用失败 (exit #{code})，请检查 patches/apply.sh")
    end
  end
end
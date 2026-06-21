defmodule Mix.Tasks.BuildFrontend do
  @moduledoc """
  构建 React 前端 (Vite) 并将产物复制到 priv/static。

  用法:
      mix build_frontend

  此任务:
    1. 在 kg-edu-vite-antd/ 目录安装依赖 (bun install)
    2. 运行 Vite 生产构建 (bun run build)
    3. 将 dist/ 内容复制到 priv/static/
  """
  use Mix.Task

  @shortdoc "Build React frontend and copy to priv/static"

  def run(_args) do
    # 前端项目路径 (相对于 backend/kg_edu)
    frontend_dir = Path.expand("../../../kg-edu-vite-antd", __DIR__)

    unless File.dir?(frontend_dir) do
      Mix.shell().error("Frontend directory not found: #{frontend_dir}")
      System.halt(1)
    end

    dist_dir = Path.join(frontend_dir, "dist")
    static_dir = Path.expand("priv/static", File.cwd!())

    Mix.shell().info([:green, "==> ", :reset, "Installing frontend dependencies..."])

    case System.cmd("bun", ["install"], cd: frontend_dir, stderr_to_stdout: true) do
      {output, 0} ->
        Mix.shell().info(output)
      {output, code} ->
        Mix.shell().error("bun install failed (exit #{code}):\n#{output}")
        System.halt(1)
    end

    Mix.shell().info([:green, "==> ", :reset, "Building frontend (Vite)..."])

    case System.cmd("bun", ["run", "build"], cd: frontend_dir, stderr_to_stdout: true) do
      {output, 0} ->
        Mix.shell().info(output)
      {output, code} ->
        Mix.shell().error("Vite build failed (exit #{code}):\n#{output}")
        System.halt(1)
    end

    unless File.dir?(dist_dir) do
      Mix.shell().error("dist/ directory not found after build: #{dist_dir}")
      System.halt(1)
    end

    Mix.shell().info([:green, "==> ", :reset, "Copying dist to priv/static..."])

    # 确保 priv/static 存在
    File.mkdir_p!(static_dir)

    # 复制所有 dist 内容到 priv/static
    File.cp_r!(dist_dir, static_dir)

    # 验证关键文件
    index_path = Path.join(static_dir, "index.html")
    if File.exists?(index_path) do
      Mix.shell().info([:green, "✓ ", :reset, "index.html"])
    else
      Mix.shell().error("index.html not found after copy — build may have failed silently")
      System.halt(1)
    end

    Mix.shell().info([:green, "✓ ", :reset, "Frontend built and copied to priv/static/"])
  end
end

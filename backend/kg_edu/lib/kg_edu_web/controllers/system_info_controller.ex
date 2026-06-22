defmodule KgEduWeb.SystemInfoController do
  use KgEduWeb, :controller

  @doc """
  GET /api/admin/system-info
  Returns real-time system metrics using built-in Erlang functions (zero deps).
  """
  def get_info(conn, _params) do
    info = %{
      memory: get_memory_info(),
      cpu: get_cpu_info(),
      disk: get_disk_info(),
      system: get_system_info(),
      process_count: :erlang.system_info(:process_count),
      uptime_ms: get_uptime_ms(),
      node: node() |> Atom.to_string()
    }

    json(conn, %{success: true, data: info})
  end

  # ── Memory ──────────────────────────────────────────────────────────

  defp get_memory_info do
    mem = :erlang.memory()
    total_bytes = mem[:total]

    %{
      total_bytes: total_bytes,
      total_mb: round(total_bytes / (1024 * 1024)),
      processes_bytes: mem[:processes],
      atom_bytes: mem[:atom],
      binary_bytes: mem[:binary],
      ets_bytes: mem[:ets],
      code_bytes: mem[:code]
    }
  end

  # ── CPU ─────────────────────────────────────────────────────────────

  defp get_cpu_info do
    # Use OS-level load (cross-platform, no flag reset issue)
    try do
      {output, 0} = System.cmd("sh", ["-c", get_load_cmd()], stderr_to_stdout: true)
      parse_load(output)
    rescue
      _ -> %{source: "unavailable"}
    end
  end

  defp get_load_cmd do
    case :os.type() do
      {:unix, :darwin} -> "sysctl -n vm.loadavg | tr -d '{}'"
      {:unix, :linux} -> "cat /proc/loadavg | awk '{print $1,$2,$3}'"
      _ -> "uptime | awk -F'load average:' '{print $2}'"
    end
  end

  defp parse_load(output) do
    parts = output |> String.trim() |> String.split()

    case parts do
      [load1, load5, load15 | _] ->
        pct =
          try do
            val = String.to_float(load1)
            cores = :erlang.system_info(:schedulers_online)
            round(val / cores * 1000) / 10
          rescue
            _ -> 0.0
          end

        %{
          utilization: pct,
          load_1min: load1,
          load_5min: load5,
          load_15min: load15,
          cores: :erlang.system_info(:schedulers_online),
          source: "os_load"
        }

      _ ->
        %{source: "parse_failed", raw: output}
    end
  end

  # ── Disk ────────────────────────────────────────────────────────────

  defp get_disk_info do
    # Use shell df command (works on macOS and Linux)
    cwd = File.cwd!()

    case System.cmd("df", ["-h", cwd], stderr_to_stdout: true) do
      {output, 0} ->
        parse_df_output(output)

      _ ->
        %{error: "unavailable"}
    end
  end

  defp parse_df_output(output) do
    lines = String.split(output, "\n", trim: true)

    case lines do
      [_header, data | _] ->
        parts = String.split(data, ~r/\s+/, trim: true)

        case parts do
          [fs, size, used, avail, capacity | _] ->
            %{
              filesystem: fs,
              size: size,
              used: used,
              available: avail,
              capacity: capacity,
              mount: Enum.at(parts, 5) || ""
            }

          _ ->
            %{raw: data}
        end

      _ ->
        %{error: "parse_failed"}
    end
  end

  # ── System ──────────────────────────────────────────────────────────

  defp get_system_info do
    %{
      architecture: :erlang.system_info(:system_architecture) |> List.to_string(),
      otp_release: :erlang.system_info(:otp_release) |> List.to_string(),
      version: :erlang.system_info(:system_version) |> List.to_string(),
      scheduler_count: :erlang.system_info(:schedulers_online),
      port_count: length(:erlang.ports())
    }
  end

  defp get_uptime_ms do
    {ms, _} = :erlang.statistics(:wall_clock)
    ms
  end
end

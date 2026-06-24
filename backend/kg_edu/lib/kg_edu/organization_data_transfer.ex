defmodule KgEdu.OrganizationDataTransfer do
  @moduledoc """
  Cross-tenant data export/import using pg_dump + psql.

  Uses PostgreSQL's native pg_dump (--data-only, plain SQL) to export one tenant's
  schema data, then imports into a target tenant after sed-replacing the schema name.
  This is much more reliable than row-by-row copying because pg_dump handles FK
  dependency ordering and sequence resetting automatically.
  """

  @repo KgEdu.Repo
  @header_marker "-- KGEDU_EXPORT_SCHEMA:"

  # ── Export ────────────────────────────────────────────────────────────

  @doc """
  Export all tenant data as a plain-text SQL dump file.

  Uses pg_dump with:
    - --data-only          (only data, no DDL — target already has tables from migrations)
    - --no-owner / --no-privileges  (portable across environments)
    - --disable-triggers   (disable FK triggers during import, avoids ordering issues)

  Returns `{:ok, sql_content}` where sql_content is the full SQL text.
  """
  def export(tenant) do
    tmp_file = temp_file("export_#{tenant}")
    db_config = get_db_config()

    env = [{"PGPASSWORD", db_config[:password] || ""}]

    dump_args = [
      "--host=#{db_config[:hostname] || "localhost"}",
      "--port=#{db_config[:port] || 5432}",
      "--username=#{db_config[:username]}",
      "--dbname=#{db_config[:database]}",
      "--schema=#{tenant}",
      "--data-only",
      "--no-owner",
      "--no-privileges",
      "--disable-triggers",
      # Exclude schema_migrations — the target tenant will have its own from create_organization_with_migrations
      "--exclude-table=#{tenant}.schema_migrations",
      "-f",
      tmp_file
    ]

    pg_dump = find_pg_binary("pg_dump")

    case System.cmd(pg_dump, dump_args, env: env, stderr_to_stdout: true) do
      {_output, 0} ->
        # Prepend a header comment so the import side knows which schema was exported
        sql_body = File.read!(tmp_file)
        header = "#{@header_marker} #{tenant}\n"
        final_sql = header <> "-- pg_dump --data-only export from schema #{tenant}\n" <> sql_body
        File.rm(tmp_file)
        {:ok, final_sql}

      {error_output, exit_code} ->
        File.rm(tmp_file)
        {:error, "pg_dump (#{pg_dump}) failed (exit #{exit_code}): #{String.slice(error_output, 0, 500)}"}
    end
  rescue
    e ->
      {:error, Exception.message(e)}
  end

  # ── Import ────────────────────────────────────────────────────────────

  @doc """
  Import a pg_dump SQL file into a target tenant schema.

  1. Extracts the source schema name from the SQL header comment
  2. Uses sed to replace all occurrences of `old_schema.` with `new_schema.`
  3. Runs psql --single-transaction to import atomically

  Returns `{:ok, %{tenant: new_tenant, imported: true}}` on success.
  """
  def import(sql_content, new_tenant) do
    old_tenant = extract_source_schema(sql_content)

    if is_nil(old_tenant) do
      {:error, "Invalid export file: missing schema header"}
    else
      tmp_file = temp_file("import_#{old_tenant}_to_#{new_tenant}")
      db_config = get_db_config()
      env = [{"PGPASSWORD", db_config[:password] || ""}]

      # 1. Strip Ash Postgres \restrict / \unrestrict psql meta-commands
      #    These are injected by ash_postgres but not recognized by plain psql.
      replaced_sql =
        sql_content
        |> String.split("\n")
        |> Enum.reject(&(String.starts_with?(&1, "\\restrict") || String.starts_with?(&1, "\\unrestrict")))
        |> Enum.join("\n")

      # 2. sed-replace the old schema name with the new one
      replaced_sql = String.replace(replaced_sql, "#{old_tenant}.", "#{new_tenant}.")

      # Also fix the header comment to point to new schema
      replaced_sql =
        String.replace(
          replaced_sql,
          "#{@header_marker} #{old_tenant}",
          "#{@header_marker} #{new_tenant}"
        )

      File.write!(tmp_file, replaced_sql)

      # 2. Import via psql in a single transaction (fails atomically)
        psql = find_pg_binary("psql")
        import_result =
          System.cmd(psql, [
            "--host=#{db_config[:hostname] || "localhost"}",
            "--port=#{db_config[:port] || 5432}",
            "--username=#{db_config[:username]}",
            "--dbname=#{db_config[:database]}",
            "--single-transaction",
            "--set", "ON_ERROR_STOP=on",
            "-f", tmp_file
          ], env: env, stderr_to_stdout: true)

        File.rm(tmp_file)

        case import_result do
          {_output, 0} ->
            {:ok, %{tenant: new_tenant, source_schema: old_tenant, imported: true}}

          {error_output, exit_code} ->
            reason = parse_psql_error(error_output)
            {:error,
             "数据导入失败: #{reason}. 请确保源租户和目标租户的表结构一致（均通过 create_organization_with_migrations 创建）"}
        end
    end
  rescue
    e -> {:error, Exception.message(e)}
  end

  # ── Validation ────────────────────────────────────────────────────────

  @doc """
  Validate that an uploaded file is a legitimate pg_dump export.
  Checks for the schema header marker.
  """
  def validate_export_file(sql_content) do
    if extract_source_schema(sql_content) do
      :ok
    else
      {:error, "Invalid export file: missing #{@header_marker} header"}
    end
  end

  # ── Helpers ────────────────────────────────────────────────────────────

  defp extract_source_schema(sql_content) do
    case Regex.run(~r/#{@header_marker}\s+(\S+)/, sql_content) do
      [_, schema] -> schema
      nil -> nil
    end
  end

  # ── PG binary discovery ───────────────────────────────────────────────

  # Find pg_dump/psql matching the connected server version.
  # macOS: Postgres.app > Homebrew / Linux: standard paths.

  @pg_candidate_paths [
    # macOS Postgres.app (versioned + latest symlink)
    "/Applications/Postgres.app/Contents/Versions/latest/bin",
    # Homebrew / Linux standard
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin"
  ]

  defp find_pg_binary(name) do
    server_ver = get_server_major_version()

    # Try to find a binary whose version >= server version
    @pg_candidate_paths
    |> Enum.map(&Path.join(&1, name))
    |> Enum.filter(&File.exists?/1)
    |> Enum.find(fn bin ->
      case {extract_binary_version(bin), server_ver} do
        {bin_ver, srv_ver} when is_integer(bin_ver) and is_integer(srv_ver) ->
          bin_ver >= srv_ver
        _ ->
          # If we can't parse versions, prefer Postgres.app paths first
          String.contains?(bin, "Postgres.app")
      end
    end)
    |> case do
      nil -> System.find_executable(name) || name
      bin -> bin
    end
  end

  defp get_server_major_version do
    case @repo.query("SHOW server_version_num") do
      {:ok, %{rows: [[ver_str]]}} ->
        {int_ver, _} = Integer.parse(ver_str)
        # server_version_num is like 170004 → major version is 17
        div(int_ver, 10_000)

      _ -> nil
    end
  end

  defp extract_binary_version(bin) do
    case System.cmd(bin, ["--version"]) do
      {"pg_dump (PostgreSQL) " <> rest, 0} ->
        {ver, _} = rest |> String.trim() |> Integer.parse()
        ver

      {"psql (PostgreSQL) " <> rest, 0} ->
        {ver, _} = rest |> String.trim() |> Integer.parse()
        ver

      _ -> nil
    end
  end

  defp get_db_config do
    cfg = @repo.config()

    %{
      hostname: cfg[:hostname] || "localhost",
      port: cfg[:port] || 5432,
      username: cfg[:username] || "postgres",
      password: cfg[:password] || "",
      database: cfg[:database]
    }
  end

  defp temp_file(suffix) do
    Path.join(System.tmp_dir!(), "kg_edu_#{suffix}_#{:rand.uniform(1_000_000)}.sql")
  end

  # Extract a human-readable error from psql output
  defp parse_psql_error(output) do
    cond do
      String.contains?(output, "duplicate key") ->
        "主键冲突，目标租户可能已有数据"

      String.contains?(output, "does not exist") ->
        "表结构不匹配: #{extract_missing_relation(output)}"

      String.contains?(output, "violates foreign key") ->
        "外键约束冲突，源数据可能不完整"

      String.contains?(output, "violates not-null") ->
        "非空约束冲突，源数据缺少必填字段"

      true ->
        error_line =
          output
          |> String.split("\n")
          |> Enum.find(&String.match?(&1, ~r/ERROR:|error:/))
          || "未知错误"
        String.trim(error_line)
    end
  end

  defp extract_missing_relation(output) do
    # PostgreSQL errors: column "X" of relation "Y" does not exist
    case Regex.run(~r/column "([^"]+)" of relation "([^"]+)"/, output) do
      [_, col, rel] -> "列 '#{col}' 在表 '#{rel}' 中不存在"
      _ ->
        case Regex.run(~r/relation "([^"]+)" does not exist/, output) do
          [_, name] -> "表 '#{name}' 在目标 schema 中不存在"
          _ -> "部分表或列在目标 schema 中不存在"
        end
    end
  end
end

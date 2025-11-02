defmodule KgEdu.BackupManager do
  @moduledoc """
  SQL-based backup and restore functionality for multi-tenant organizations.

  This module provides functions to:
  - Backup entire tenant schemas
  - Restore tenant schemas from backups
  - Manage backup files and metadata
  - Schedule and automate backups
  """

  alias KgEdu.Repo
  alias KgEdu.Accounts.Organization

  @doc """
  Create a full backup of an organization's tenant schema.

  ## Examples

      iex> BackupManager.backup_organization("org-uuid-here")
      {:ok, %{backup_id: "backup_20231201_120000", file_path: "/path/to/backup.sql"}}

      iex> BackupManager.backup_organization("org-uuid-here", custom_name: "Monthly Backup")
      {:ok, %{backup_id: "Monthly_Backup_20231201_120000", file_path: "/path/to/backup.sql"}}
  """
  def backup_organization(organization_id, opts \\ []) do
    with {:ok, organization} <- get_organization(organization_id),
         {:ok, backup_info} <- create_backup_directory(organization),
         :ok <- validate_tenant_schema(organization.schema_name),
         {:ok, backup_file} <- generate_sql_backup(organization, backup_info, opts) do
      save_backup_metadata(backup_info, backup_file, opts)
    else
      {:error, reason} -> {:error, reason}
      error -> {:error, error}
    end
  end

  @doc """
  Restore an organization's tenant schema from a backup file.

  ## Examples

      iex> BackupManager.restore_organization("backup_20231201_120000", "org-uuid-here")
      {:ok, %{message: "Restore completed successfully"}}

      iex> BackupManager.restore_organization("backup_20231201_120000", "org-uuid-here", overwrite: true)
      {:ok, %{message: "Restore completed successfully"}}
  """
  def restore_organization(backup_id, organization_id, opts \\ []) do
    with {:ok, organization} <- get_organization(organization_id),
         {:ok, backup_file} <- get_backup_file_path(backup_id),
         {:ok, backup_metadata} <- load_backup_metadata(backup_id),
         :ok <- validate_restore_permissions(backup_metadata, organization, opts),
         :ok <- restore_from_sql_backup(backup_file, organization, opts) do
      update_restore_metadata(backup_id, organization_id)
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  List all available backups for an organization.
  """
  def list_organization_backups(organization_id) do
    query = """
    SELECT backup_id, organization_id, created_at, file_size, backup_type, metadata
    FROM organization_backups
    WHERE organization_id = $1
    ORDER BY created_at DESC
    """

    case Repo.query(query, [organization_id]) do
      {:ok, %{rows: rows}} ->
        backups = Enum.map(rows, fn [backup_id, org_id, created_at, file_size, backup_type, metadata] ->
          %{
            backup_id: backup_id,
            organization_id: org_id,
            created_at: created_at,
            file_size: file_size,
            backup_type: backup_type,
            metadata: metadata
          }
        end)
        {:ok, backups}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Delete a backup file and its metadata.
  """
  def delete_backup(backup_id) do
    with {:ok, backup_file} <- get_backup_file_path(backup_id),
         :ok <- File.rm(backup_file),
         {:ok, _} <- delete_backup_metadata(backup_id) do
      {:ok, %{message: "Backup deleted successfully"}}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Create scheduled backups for all organizations.
  """
  def create_scheduled_backups(backup_type \\ :daily) do
    organizations = get_all_organizations()

    results = Enum.map(organizations, fn org ->
      backup_organization(org.id, [
        backup_type: backup_type,
        scheduled: true,
        automatic: true
      ])
    end)

    successful = Enum.count(results, fn {result, _} -> result == :ok end)
    total = length(results)

    {:ok, %{successful: successful, total: total, results: results}}
  end

  @doc """
  Backup all organizations (full system backup).
  """
  def backup_all_organizations(opts \\ []) do
    organizations = get_all_organizations()

    results = Enum.map(organizations, fn org ->
      case backup_organization(org.id, Keyword.put(opts, :backup_type, :full_system)) do
        {:ok, backup_info} -> {org.id, {:ok, backup_info}}
        {:error, reason} -> {org.id, {:error, reason}}
      end
    end)

    successful = Enum.count(results, fn {_, result} -> elem(result, 0) == :ok end)
    total = length(results)

    {:ok, %{successful: successful, total: total, results: results}}
  end

  @doc """
  Get backup statistics.
  """
  def get_backup_statistics do
    query = """
    SELECT
      backup_type,
      COUNT(*) as count,
      SUM(file_size) as total_size,
      MAX(created_at) as last_backup
    FROM organization_backups
    GROUP BY backup_type
    """

    case Repo.query(query) do
      {:ok, %{rows: rows}} ->
        stats = Enum.map(rows, fn [backup_type, count, total_size, last_backup] ->
          %{
            backup_type: backup_type,
            count: count,
            total_size: total_size,
            last_backup: last_backup
          }
        end)
        {:ok, stats}
      {:error, reason} -> {:error, reason}
    end
  end

  # Private functions

  defp get_organization(organization_id) do
    case Organization |> Ash.get(organization_id) do
      {:ok, org} -> {:ok, org}
      {:error, reason} -> {:error, reason}
    end
  end

  defp get_all_organizations do
    case Organization |> Ash.read() do
      {:ok, orgs} -> orgs
      {:error, _} -> []
    end
  end

  defp create_backup_directory(organization) do
    timestamp = DateTime.utc_now() |> DateTime.to_iso8601()
    backup_id = "backup_#{timestamp |> String.replace(":", "") |> String.replace("-", "") |> String.replace(".", "")}"

    backup_dir = get_backup_directory()
    backup_file = Path.join(backup_dir, "#{backup_id}.sql")

    case File.mkdir_p(backup_dir) do
      :ok ->
        backup_info = %{
          backup_id: backup_id,
          organization_id: organization.id,
          organization_name: organization.name,
          schema_name: organization.schema_name,
          backup_dir: backup_dir,
          backup_file: backup_file,
          timestamp: timestamp
        }
        {:ok, backup_info}
      error -> error
    end
  end

  defp get_backup_directory do
    Application.get_env(:kg_edu, :backup_directory) ||
      Path.join([File.cwd!(), "priv", "backups"])
  end

  defp validate_tenant_schema(schema_name) do
    query = """
    SELECT 1
    FROM information_schema.schemata
    WHERE schema_name = $1
    """

    case Repo.query(query, [schema_name]) do
      {:ok, %{num_rows: 1}} -> :ok
      {:ok, %{num_rows: 0}} -> {:error, :schema_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  defp generate_sql_backup(organization, backup_info, opts) do
    schema_name = organization.schema_name
    backup_file = backup_info.backup_file

    # Generate pg_dump command
    dump_command = build_dump_command(schema_name, backup_file, opts)

    case System.cmd("pg_dump", dump_command, stderr_to_stdout: true) do
      {output, 0} ->
        # Add backup metadata to SQL file
        final_sql = add_backup_metadata_to_sql(output, backup_info, opts)
        File.write!(backup_file, final_sql)
        {:ok, backup_file}
      {error_output, exit_code} ->
        {:error, {:dump_failed, exit_code, error_output}}
    end
  end

  defp build_dump_command(schema_name, backup_file, opts) do
    db_config = Repo.config()
    host = Keyword.get(db_config, :hostname, "localhost")
    port = Keyword.get(db_config, :port, 5432)
    database = Keyword.get(db_config, :database)
    username = Keyword.get(db_config, :username)

    base_command = [
      "--host", host,
      "--port", to_string(port),
      "--username", username,
      "--dbname", database,
      "--schema", schema_name,
      "--no-owner",
      "--no-privileges",
      "--verbose",
      "--file", backup_file,
      "--format=custom"
    ]

    # Add optional flags
    optional_flags = [
      if(Keyword.get(opts, :data_only, false), do: "--data-only", else: nil),
      if(Keyword.get(opts, :schema_only, false), do: "--schema-only", else: nil),
      if(Keyword.get(opts, :exclude_sequences, false), do: "--exclude-table-data=*_seq", else: nil)
    ]

    base_command ++ Enum.filter(optional_flags, &(&1 != nil))
  end

  defp add_backup_metadata_to_sql(sql, backup_info, opts) do
    metadata = %{
      backup_id: backup_info.backup_id,
      organization_id: backup_info.organization_id,
      organization_name: backup_info.organization_name,
      schema_name: backup_info.schema_name,
      created_at: backup_info.timestamp,
      backup_options: opts,
      pg_version: get_postgresql_version(),
      backup_version: "1.0"
    }

    metadata_json = Jason.encode!(metadata)
    header_comment = """
    -- KgEdu Organization Backup
    -- Backup ID: #{backup_info.backup_id}
    -- Organization: #{backup_info.organization_name} (#{backup_info.organization_id})
    -- Schema: #{backup_info.schema_name}
    -- Created: #{backup_info.timestamp}
    -- Metadata: #{metadata_json}

    """

    header_comment <> sql
  end

  defp get_postgresql_version do
    case Repo.query("SELECT version()") do
      {:ok, %{rows: [[version]]}} -> version
      _ -> "Unknown"
    end
  end

  defp save_backup_metadata(backup_info, backup_file, opts) do
    file_info = File.stat!(backup_file)

    query = """
    INSERT INTO organization_backups
    (backup_id, organization_id, file_path, file_size, backup_type, metadata, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (backup_id) DO UPDATE SET
      file_size = EXCLUDED.file_size,
      metadata = EXCLUDED.metadata
    """

    metadata = %{
      backup_info: backup_info,
      options: opts,
      file_size: file_info.size
    }

    case Repo.query(query, [
      backup_info.backup_id,
      backup_info.organization_id,
      backup_file,
      file_info.size,
      Keyword.get(opts, :backup_type, :manual),
      metadata,
      backup_info.timestamp
    ]) do
      {:ok, _} ->
        {:ok, backup_info}
      {:error, reason} -> {:error, reason}
    end
  end

  defp get_backup_file_path(backup_id) do
    query = "SELECT file_path FROM organization_backups WHERE backup_id = $1"

    case Repo.query(query, [backup_id]) do
      {:ok, %{rows: [[file_path]]}} -> {:ok, file_path}
      {:ok, %{rows: []}} -> {:error, :backup_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  defp load_backup_metadata(backup_id) do
    query = "SELECT metadata FROM organization_backups WHERE backup_id = $1"

    case Repo.query(query, [backup_id]) do
      {:ok, %{rows: [[metadata]]}} -> {:ok, metadata}
      {:ok, %{rows: []}} -> {:error, :backup_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  defp validate_restore_permissions(backup_metadata, organization, opts) do
    # Check if backup belongs to same organization (unless forced)
    backup_org_id = get_in(backup_metadata, ["backup_info", "organization_id"])

    if backup_org_id != organization.id and !Keyword.get(opts, :force, false) do
      {:error, :organization_mismatch}
    else
      :ok
    end
  end

  defp restore_from_sql_backup(backup_file, organization, opts) do
    schema_name = organization.schema_name

    # Create schema if it doesn't exist
    if Keyword.get(opts, :create_schema, true) do
      Repo.query("CREATE SCHEMA IF NOT EXISTS #{schema_name}")
    end

    # Build restore command
    restore_command = build_restore_command(backup_file, schema_name, opts)

    case System.cmd("pg_restore", restore_command, stderr_to_stdout: true) do
      {output, 0} ->
        # Post-restore actions
        post_restore_actions(organization, opts)
      {error_output, exit_code} ->
        {:error, {:restore_failed, exit_code, error_output}}
    end
  end

  defp build_restore_command(backup_file, schema_name, opts) do
    db_config = Repo.config()
    host = Keyword.get(db_config, :hostname, "localhost")
    port = Keyword.get(db_config, :port, 5432)
    database = Keyword.get(db_config, :database)
    username = Keyword.get(db_config, :username)

    base_command = [
      "--host", host,
      "--port", to_string(port),
      "--username", username,
      "--dbname", database,
      "--schema", schema_name,
      "--verbose",
      "--no-owner",
      "--no-privileges",
      backup_file
    ]

    # Add optional flags
    optional_flags = [
      if(Keyword.get(opts, :data_only, false), do: "--data-only", else: nil),
      if(Keyword.get(opts, :clean, false), do: "--clean", else: nil),
      if(Keyword.get(opts, :if_exists, false), do: "--if-exists", else: nil)
    ]

    base_command ++ Enum.filter(optional_flags, &(&1 != nil))
  end

  defp post_restore_actions(organization, opts) do
    # Update sequences if needed
    if Keyword.get(opts, :reset_sequences, true) do
      reset_tenant_sequences(organization.schema_name)
    end

    # Run any custom post-restore SQL
    if opts[:post_restore_sql] do
      Repo.query(opts[:post_restore_sql], [], prefix: organization.schema_name)
    end

    :ok
  end

  defp reset_tenant_sequences(schema_name) do
    sequences_query = """
    SELECT sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = $1
    """

    case Repo.query(sequences_query, [schema_name]) do
      {:ok, %{rows: rows}} ->
        Enum.each(rows, fn [sequence_name] ->
          full_sequence_name = "#{schema_name}.#{sequence_name}"
          Repo.query("SELECT setval('#{full_sequence_name}', 1, false)")
        end)
      _ -> :ok
    end
  end

  defp update_restore_metadata(backup_id, organization_id) do
    query = """
    UPDATE organization_backups
    SET restored_at = $1, restored_to = $2
    WHERE backup_id = $3
    """

    Repo.query(query, [DateTime.utc_now(), organization_id, backup_id])
  end

  defp delete_backup_metadata(backup_id) do
    Repo.query("DELETE FROM organization_backups WHERE backup_id = $1", [backup_id])
  end

  @doc """
  Create the backup tracking table if it doesn't exist.
  """
  def create_backup_table do
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS organization_backups (
      backup_id VARCHAR(255) PRIMARY KEY,
      organization_id UUID NOT NULL,
      file_path TEXT NOT NULL,
      file_size BIGINT NOT NULL,
      backup_type VARCHAR(50) DEFAULT 'manual',
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      restored_at TIMESTAMP WITH TIME ZONE,
      restored_to UUID,
      created_by VARCHAR(255)
    );

    CREATE INDEX IF NOT EXISTS idx_org_backups_org_id ON organization_backups(organization_id);
    CREATE INDEX IF NOT EXISTS idx_org_backups_created_at ON organization_backups(created_at);
    CREATE INDEX IF NOT EXISTS idx_org_backups_type ON organization_backups(backup_type);
    """

    case Repo.query(create_table_sql) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end
end
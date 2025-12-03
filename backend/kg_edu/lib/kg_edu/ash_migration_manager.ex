defmodule KgEdu.AshMigrationManager do
  @moduledoc """
  AshPostgres-specific migration utilities for multi-tenant setup.

  This module provides programmatic access to AshPostgres migration functionality
  for creating organizations and running their tenant migrations.
  """

  alias KgEdu.Repo
  alias KgEdu.Accounts.Organization

  @doc """
  Create an organization and run all necessary tenant migrations using AshPostgres.

  ## Examples

      iex> AshMigrationManager.create_organization_with_migrations("Test School")
      {:ok, %{organization: %Organization{}, migrations: :completed}}

      iex> AshMigrationManager.create_organization_with_migrations("Test School", %{custom: "attr"})
      {:ok, %{organization: %Organization{}, migrations: :completed}}
  """
  def create_organization_with_migrations(name, attrs \\ %{}) do
    with {:ok, organization} <- create_organization(name, attrs),
         :ok <- run_tenant_migrations_for_org(organization) do
      {:ok, %{organization: organization, migrations: :completed}}
    else
      {:error, reason} -> {:error, %{migrations: :failed, error: reason}}
      error -> {:error, %{migrations: :failed, error: error}}
    end
  end

  @doc """
  Create organization without migrations.
  """
  def create_organization(name, attrs \\ %{}) do
    final_attrs = Map.merge(attrs, %{name: name})

    case Organization |> Ash.Changeset.for_action(:create, final_attrs) |> Ash.create() do
      {:ok, org} -> {:ok, org}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Run tenant migrations for a specific organization using AshPostgres.
  """
  def run_tenant_migrations_for_org(organization) do
    tenant_schema = organization.schema_name
    run_tenant_migrations(tenant_schema)
  end

  @doc """
  Run tenant migrations for a specific tenant schema.
  """
  def run_tenant_migrations(tenant_schema) do
    # Use AshPostgres migration runner
    try do
      # Start the repo if not already started
      {:ok, _pid} = ensure_repo_started()

      # Create schema if it doesn't exist
      :ok = ensure_tenant_schema(tenant_schema)

      # Run tenant migrations using AshPostgres
      case run_ash_tenant_migrations(tenant_schema) do
        :ok ->
          :ok
        {:error, reason} ->
          {:error, reason}
      end
    rescue
      error ->
        {:error, error}
    end
  end

  @doc """
  Run migrations for all existing tenants.
  """
  def run_all_tenant_migrations do
    tenants = KgEdu.Repo.all_tenants()

    results = Enum.map(tenants, fn tenant_schema ->
      case run_tenant_migrations(tenant_schema) do
        :ok -> {tenant_schema, :success}
        {:error, reason} -> {tenant_schema, {:failed, reason}}
      end
    end)

    failed = Enum.filter(results, fn {_, result} -> result != :success end)

    if Enum.empty?(failed) do
      {:ok, results}
    else
      {:error, failed}
    end
  end

  @doc """
  Run main repository migrations (non-tenant specific).
  """
  def run_main_migrations do
    try do
      {:ok, _pid} = ensure_repo_started()

      case run_ash_main_migrations() do
        :ok -> :ok
        {:error, reason} -> {:error, reason}
      end
    rescue
      error -> {:error, error}
    end
  end

  # Private functions

  defp ensure_repo_started do
    if Process.whereis(Repo) do
      {:ok, Repo}
    else
      # Start repo temporarily
      case Repo.start_link() do
        {:ok, pid} -> {:ok, pid}
        {:already_started, pid} -> {:ok, pid}
        error -> error
      end
    end
  end

  defp ensure_tenant_schema(schema_name) do
    query = "CREATE SCHEMA IF NOT EXISTS #{schema_name}"

    case Repo.query(query) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp run_ash_main_migrations do
    # Use Ecto Migrator for main migrations
    migrations_path = main_migrations_path()

    case Ecto.Migrator.with_repo(Repo, fn repo ->
      Ecto.Migrator.run(repo, migrations_path, :up, all: true)
    end) do
      {:ok, _, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp run_ash_tenant_migrations(tenant_schema) do
    migrations_path = tenant_migrations_path()

    case Ecto.Migrator.with_repo(Repo, fn repo ->
      Ecto.Migrator.run(repo, migrations_path, :up, all: true, prefix: tenant_schema)
    end) do
      {:ok, _, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp main_migrations_path do
    Application.get_env(:kg_edu, Repo)[:priv] || "priv/repo/migrations"
  end

  defp tenant_migrations_path do
    Application.get_env(:kg_edu, Repo)[:priv] || "priv/repo/tenant_migrations"
  end

  @doc """
  Get migration status for all tenants.
  """
  def get_tenant_migration_status do
    tenants = KgEdu.Repo.all_tenants()

    Enum.map(tenants, fn tenant_schema ->
      case get_tenant_current_version(tenant_schema) do
        {:ok, version} -> {tenant_schema, version, :ok}
        {:error, reason} -> {tenant_schema, nil, reason}
      end
    end)
  end

  defp get_tenant_current_version(tenant_schema) do
    query = """
    SELECT version
    FROM schema_migrations
    WHERE schema_name = $1
    ORDER BY version DESC
    LIMIT 1
    """

    case Repo.query(query, [tenant_schema], prefix: tenant_schema) do
      {:ok, %{rows: []}} -> {:ok, 0}
      {:ok, %{rows: [[version]]}} -> {:ok, version}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Drop tenant and all its data.
  """
  def drop_tenant(organization) do
    tenant_schema = organization.schema_name

    # First delete the organization record
    case Organization |> Ash.destroy(organization) do
      :ok ->
        # Then drop the schema
        query = "DROP SCHEMA IF EXISTS #{tenant_schema} CASCADE"

        case Repo.query(query) do
          {:ok, _} -> :ok
          {:error, reason} -> {:error, reason}
        end
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Check tenant health - verify schema exists and migrations are up to date.
  """
  def check_tenant_health(organization) do
    tenant_schema = organization.schema_name

    with true <- tenant_schema_exists?(tenant_schema),
         {:ok, _version} <- get_tenant_current_version(tenant_schema) do
      :ok
    else
      false -> {:error, :schema_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  defp tenant_schema_exists?(schema_name) do
    query = """
    SELECT 1
    FROM information_schema.schemata
    WHERE schema_name = $1
    """

    case Repo.query(query, [schema_name]) do
      {:ok, %{num_rows: 1}} -> true
      {:ok, %{num_rows: 0}} -> false
      {:error, _} -> false
    end
  end

  @doc """
  Setup complete tenant with verification.
  """
  def setup_verified_tenant(name, attrs \\ %{}) do
    case create_organization_with_migrations(name, attrs) do
      {:ok, %{organization: org}} = result ->
        case check_tenant_health(org) do
          :ok -> result
          {:error, health_error} ->
            {:error, %{result | health_check: {:failed, health_error}}}
        end
      error -> error
    end
  end
end
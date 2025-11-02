defmodule KgEdu.MigrationManager do
  @moduledoc """
  Utilities for managing database migrations programmatically, especially for multi-tenant setup.
  """

  alias KgEdu.Repo
  alias KgEdu.Accounts.Organization

  @doc """
  Create an organization and run all necessary migrations for it.

  ## Examples

      iex> MigrationManager.create_organization_with_migrations("New School")
      {:ok, %{organization: org, migrations: :completed}}

      iex> MigrationManager.create_organization_with_migrations("New School", %{name: "Custom Name"})
      {:ok, %{organization: org, migrations: :completed}}
  """
  def create_organization_with_migrations(name, attrs \\ %{}) do
    # Create the organization first
    case create_organization(name, attrs) do
      {:ok, organization} ->
        # Run migrations for the new tenant
        case run_tenant_migrations(organization) do
          :ok ->
            {:ok, %{organization: organization, migrations: :completed}}
          {:error, reason} ->
            # If migrations fail, we might want to rollback the organization creation
            {:error, %{organization: organization, migrations: {:failed, reason}}}
        end

      {:error, reason} ->
        {:error, %{organization: nil, migrations: :not_attempted, error: reason}}
    end
  end

  @doc """
  Create an organization without running migrations.
  """
  def create_organization(name, attrs \\ %{}) do
    final_attrs = Map.merge(attrs, %{name: name})

    case Organization |> Ash.Changeset.for_action(:create, final_attrs) |> Ash.create() do
      {:ok, org} -> {:ok, org}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Run migrations for a specific tenant/organization.
  """
  def run_tenant_migrations(organization) do
    tenant_schema = organization.schema_name

    # Create the schema if it doesn't exist
    case create_tenant_schema(tenant_schema) do
      :ok ->
        # Run tenant migrations
        case migrate_tenant(tenant_schema) do
          :ok ->
            :ok
          {:error, reason} ->
            {:error, reason}
        end
      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Run migrations for all existing tenants.
  """
  def run_all_tenant_migrations do
    tenants = Repo.all_tenants()

    results = Enum.map(tenants, fn tenant_schema ->
      {tenant_schema, migrate_tenant(tenant_schema)}
    end)

    failed_migrations = Enum.filter(results, fn {_tenant, result} ->
      result != :ok
    end)

    if Enum.empty?(failed_migrations) do
      :ok
    else
      {:error, failed_migrations}
    end
  end

  @doc """
  Run main repository migrations (non-tenant specific).
  """
  def run_main_migrations do
    # This runs the main migrations (like creating organizations table)
    case Ecto.Migrator.with_repo(Repo, &Ecto.Migrator.run(&1, :up, all: true)) do
      {:ok, version, migrations} ->
        {:ok, %{version: version, migrations: migrations}}
      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Create tenant schema in PostgreSQL.
  """
  def create_tenant_schema(schema_name) do
    query = "CREATE SCHEMA IF NOT EXISTS #{schema_name}"

    case Repo.query(query) do
      {:ok, _result} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Drop tenant schema in PostgreSQL.
  """
  def drop_tenant_schema(schema_name) do
    query = "DROP SCHEMA IF EXISTS #{schema_name} CASCADE"

    case Repo.query(query) do
      {:ok, _result} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Run migrations for a specific tenant schema.
  """
  def migrate_tenant(tenant_schema) do
    # Set tenant context for the migration
    # Note: This is a simplified approach. For full Ash integration,
    # you might need to use Ash's internal migration utilities.

    migrations_path = tenant_migrations_path()

    case Ecto.Migrator.with_repo(Repo, fn repo ->
      # Create a temporary repo configuration with the tenant schema
      tenant_config = Keyword.put(repo.config(), :schema, tenant_schema)

      # This is a simplified approach - in practice you might need
      # to use AshPostgres.Migration utilities for proper tenant migrations
      Ecto.Migrator.run(repo, migrations_path, :up, all: true, prefix: tenant_schema)
    end) do
      {:ok, version, migrations} ->
        :ok
      {:error, reason} ->
        {:error, reason}
    end
  rescue
    # Fallback for any errors
    error -> {:error, error}
  end

  @doc """
  Get the path to tenant migrations.
  """
  def tenant_migrations_path do
    # This should match your configured tenant migrations path
    Application.get_env(:kg_edu, :ecto_repos)[:tenant_migrations] ||
      "priv/repo/tenant_migrations"
  end

  @doc """
  Check if tenant schema exists.
  """
  def tenant_schema_exists?(schema_name) do
    query = """
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name = $1
    """

    case Repo.query(query, [schema_name]) do
      {:ok, %{rows: []}} -> false
      {:ok, %{rows: [_]}} -> true
      {:error, _} -> false
    end
  end

  @doc """
  List all existing tenant schemas in the database.
  """
  def list_tenant_schemas do
    query = """
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name LIKE 'org_%'
    ORDER BY schema_name
    """

    case Repo.query(query) do
      {:ok, %{rows: rows}} ->
        Enum.map(rows, fn [schema_name] -> schema_name end)
      {:error, _} -> []
    end
  end

  @doc """
  Setup a complete tenant: create organization, run migrations, and verify setup.
  """
  def setup_complete_tenant(name, attrs \\ %{}) do
    with {:ok, organization} <- create_organization(name, attrs),
         :ok <- create_tenant_schema(organization.schema_name),
         :ok <- migrate_tenant(organization.schema_name),
         true <- tenant_schema_exists?(organization.schema_name) do
      {:ok, organization}
    else
      {:error, reason} -> {:error, reason}
      false -> {:error, :schema_creation_failed}
      :error -> {:error, :migration_failed}
    end
  end

  @doc """
  Migrate to a specific version for a tenant.
  """
  def migrate_tenant_to(tenant_schema, version) do
    migrations_path = tenant_migrations_path()

    case Ecto.Migrator.with_repo(Repo, fn repo ->
      Ecto.Migrator.run(repo, migrations_path, :up, to: version, prefix: tenant_schema)
    end) do
      {:ok, _, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Rollback tenant migrations.
  """
  def rollback_tenant(tenant_schema, step \\ 1) do
    migrations_path = tenant_migrations_path()

    case Ecto.Migrator.with_repo(Repo, fn repo ->
      Ecto.Migrator.run(repo, migrations_path, :down, step: step, prefix: tenant_schema)
    end) do
      {:ok, _, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end
end
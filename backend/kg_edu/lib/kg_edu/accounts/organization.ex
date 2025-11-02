defmodule KgEdu.Accounts.Organization do
  use Ash.Resource,
    domain: KgEdu.Accounts,
    data_layer: AshPostgres.DataLayer,
    extensions: [AshTypescript.Resource]


  postgres do
    table "organizations"
    repo KgEdu.Repo
  end

  postgres do
    manage_tenant do
      template [:schema_name]
    end
  end

  typescript do
    type_name "Organization"
  end

  code_interface do
    define :create_organization_with_migrations, action: :create_with_migrations
    define :create_verified_organization, action: :create_verified_organization
    define :backup_organization, action: :backup_organization
    define :restore_organization, action: :restore_organization
    define :list_organization_backups, action: :list_organization_backups
    define :delete_backup, action: :delete_backup
    define :run_tenant_migrations, action: :run_tenant_migrations
    define :run_all_tenant_migrations, action: :run_all_tenant_migrations
    define :check_tenant_health, action: :check_tenant_health
    define :get_migration_status, action: :get_migration_status
    define :get_backup_statistics, action: :get_backup_statistics
    define :create_scheduled_backups, action: :create_scheduled_backups
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a org by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    create :create do
      accept [:name]
    end

    update :update do
      accept [:name]
    end

    action :create_with_migrations do
      description "Create an organization and run tenant migrations"

      argument :name, :string do
        allow_nil? false
      end

      run fn input, context ->
        case KgEdu.AshMigrationManager.create_organization_with_migrations(
               input.arguments.name
             ) do
          {:ok, result} -> {:ok, result.organization}
          {:error, reason} -> {:error, reason}
        end
      end

      # Returns the created organization
    end

    action :create_verified_organization do
      description "Create an organization, run migrations, and verify setup"

      argument :name, :string do
        allow_nil? false
      end

      run fn input, context ->
        case KgEdu.AshMigrationManager.setup_verified_tenant(input.arguments.name) do
          {:ok, org} -> {:ok, org}
          {:error, reason} -> {:error, reason}
        end
      end

      # Returns the created organization
    end

    action :run_tenant_migrations do
      description "Run migrations for a specific organization"

      argument :organization_id, :uuid do
        allow_nil? false
      end

      run fn input, context ->
        case KgEdu.Accounts.Organization |> Ash.get(input.arguments.organization_id) do
          {:ok, organization} ->
            case KgEdu.AshMigrationManager.run_tenant_migrations_for_org(organization) do
              :ok -> {:ok, %{message: "Migrations completed successfully"}}
              {:error, reason} -> {:error, reason}
            end
          {:error, reason} -> {:error, reason}
        end
      end

      returns :map
    end

    action :run_all_tenant_migrations do
      description "Run migrations for all existing tenants"

      run fn input, context ->
        case KgEdu.AshMigrationManager.run_all_tenant_migrations() do
          :ok -> {:ok, %{message: "All tenant migrations completed successfully"}}
          {:error, failed_migrations} -> {:ok, %{message: "Some migrations failed", failed: failed_migrations}}
        end
      end

      returns :map
    end

    action :check_tenant_health do
      description "Check health status of a specific organization"

      argument :organization_id, :uuid do
        allow_nil? false
      end

      run fn input, context ->
        case KgEdu.Accounts.Organization |> Ash.get(input.arguments.organization_id) do
          {:ok, organization} ->
            case KgEdu.AshMigrationManager.check_tenant_health(organization) do
              :ok -> {:ok, %{health: :healthy, organization: organization}}
              {:error, reason} -> {:ok, %{health: :unhealthy, reason: reason, organization: organization}}
            end
          {:error, reason} -> {:error, reason}
        end
      end

      returns :map
    end

    action :get_migration_status do
      description "Get migration status for all tenants"

      run fn input, context ->
        status = KgEdu.AshMigrationManager.get_tenant_migration_status()
        {:ok, %{migration_status: status}}
      end

      returns :map
    end

    action :backup_organization do
      description "Create a SQL backup of the organization's tenant schema"

      argument :organization_id, :uuid do
        allow_nil? false
      end

      argument :backup_type, :atom do
        allow_nil? true
        default :manual
        constraints one_of: [:manual, :scheduled, :daily, :weekly, :monthly, :full_system]
      end

      argument :include_data, :boolean do
        allow_nil? true
        default true
      end

      run fn input, context ->
        opts = [
          backup_type: input.arguments.backup_type,
          data_only: !input.arguments.include_data
        ]

        case KgEdu.BackupManager.backup_organization(input.arguments.organization_id, opts) do
          {:ok, backup_info} ->
            {:ok, %{
              backup_id: backup_info.backup_id,
              organization_id: backup_info.organization_id,
              organization_name: backup_info.organization_name,
              schema_name: backup_info.schema_name,
              timestamp: backup_info.timestamp,
              file_path: backup_info.backup_file,
              backup_type: input.arguments.backup_type
            }}
          {:error, reason} -> {:error, reason}
        end
      end

      returns :map
    end

    action :restore_organization do
      description "Restore an organization from a SQL backup"

      argument :backup_id, :string do
        allow_nil? false
      end

      argument :organization_id, :uuid do
        allow_nil? false
      end

      argument :overwrite, :boolean do
        allow_nil? true
        default false
      end

      argument :create_schema, :boolean do
        allow_nil? true
        default true
      end

      run fn input, context ->
        opts = [
          force: input.arguments.overwrite,
          create_schema: input.arguments.create_schema
        ]

        case KgEdu.BackupManager.restore_organization(
               input.arguments.backup_id,
               input.arguments.organization_id,
               opts
             ) do
          :ok -> {:ok, %{message: "Restore completed successfully"}}
          {:error, reason} -> {:error, reason}
        end
      end

      returns :map
    end

    action :list_organization_backups do
      description "List all available backups for an organization"

      argument :organization_id, :uuid do
        allow_nil? false
      end

      run fn input, context ->
        case KgEdu.BackupManager.list_organization_backups(input.arguments.organization_id) do
          {:ok, backups} -> {:ok, %{backups: backups}}
          {:error, reason} -> {:error, reason}
        end
      end

      returns :map
    end

    action :delete_backup do
      description "Delete a backup file and its metadata"

      argument :backup_id, :string do
        allow_nil? false
      end

      run fn input, context ->
        case KgEdu.BackupManager.delete_backup(input.arguments.backup_id) do
          {:ok, result} -> {:ok, result}
          {:error, reason} -> {:error, reason}
        end
      end

      returns :map
    end

    action :get_backup_statistics do
      description "Get backup statistics for all organizations"

      run fn input, context ->
        case KgEdu.BackupManager.get_backup_statistics() do
          {:ok, stats} -> {:ok, %{statistics: stats}}
          {:error, reason} -> {:error, reason}
        end
      end

      returns :map
    end

    action :create_scheduled_backups do
      description "Create scheduled backups for all organizations"

      argument :backup_type, :atom do
        allow_nil? true
        default :daily
        constraints one_of: [:daily, :weekly, :monthly]
      end

      run fn input, context ->
        case KgEdu.BackupManager.create_scheduled_backups(input.arguments.backup_type) do
          {:ok, result} -> {:ok, result}
          {:error, reason} -> {:error, reason}
        end
      end

      returns :map
    end
  end

  changes do
    # global
    change fn changeset, _ ->
      if changeset.action.type == :create do
        myId =
          case Ash.Changeset.get_attribute(changeset, :id) do
            nil -> Ecto.UUID.generate()
            specifiedId -> specifiedId
            _ -> Ecto.UUID.generate()
          end

        schema_name = org_id_to_schema_id(myId)
        Ash.Changeset.change_attribute(changeset, :schema_name, schema_name)
      else
        changeset
      end
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :name, :string do
      allow_nil? false
      public? true
    end

    attribute :schema_name, :string do
      allow_nil? true
      public? true
    end
  end

  defimpl Ash.ToTenant do
    def to_tenant(%{id: id, schema_name: schema_name}, resource) do
      if Ash.Resource.Info.data_layer(resource) == AshPostgres.DataLayer &&
           Ash.Resource.Info.multitenancy_strategy(resource) == :context do
        schema_name
      else
        # I think this case will never happen
        id
      end
    end
  end

  @spec org_id_to_schema_id(binary()) :: binary()
  def org_id_to_schema_id(org_id) do
    "org_" <> (org_id |> String.replace("-", "_"))
  end
end

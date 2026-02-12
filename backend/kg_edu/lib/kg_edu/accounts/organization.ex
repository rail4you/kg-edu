defmodule KgEdu.Accounts.Organization do
  use Ash.Resource,
    domain: KgEdu.Accounts,
    data_layer: AshPostgres.DataLayer,
    extensions: [AshTypescript.Resource, AshJsonApi.Resource]

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

  json_api do
    type "organization"
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
    define :get_organization_summary, args: [:organization_id], action: :get_organization_summary
    define :get_all_organization_summary, action: :get_all_organization_summary
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
        case KgEdu.AshMigrationManager.create_organization_with_migrations(input.arguments.name) do
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

          {:error, reason} ->
            {:error, reason}
        end
      end

      returns :map
    end

    action :run_all_tenant_migrations do
      description "Run migrations for all existing tenants"

      run fn input, context ->
        case KgEdu.AshMigrationManager.run_all_tenant_migrations() do
          :ok ->
            {:ok, %{message: "All tenant migrations completed successfully"}}

          {:error, failed_migrations} ->
            {:ok, %{message: "Some migrations failed", failed: failed_migrations}}
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
              :ok ->
                {:ok, %{health: :healthy, organization: organization}}

              {:error, reason} ->
                {:ok, %{health: :unhealthy, reason: reason, organization: organization}}
            end

          {:error, reason} ->
            {:error, reason}
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
            {:ok,
             %{
               backup_id: backup_info.backup_id,
               organization_id: backup_info.organization_id,
               organization_name: backup_info.organization_name,
               schema_name: backup_info.schema_name,
               timestamp: backup_info.timestamp,
               file_path: backup_info.backup_file,
               backup_type: input.arguments.backup_type
             }}

          {:error, reason} ->
            {:error, reason}
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

    action :get_organization_summary do
      description "Get comprehensive statistics for a specific organization"

      argument :organization_id, :uuid do
        allow_nil? false
        description "Organization ID to get statistics for"
      end

      returns :map

      run fn input, context ->
        organization_id = input.arguments.organization_id

        case KgEdu.Accounts.Organization |> Ash.get(organization_id) do
          {:ok, organization} ->
            tenant = organization.schema_name

            # Get user statistics
            user_stats =
              case KgEdu.Accounts.User |> Ash.read(tenant: tenant) do
                {:ok, users} ->
                  total_users = length(users)

                  users_by_role =
                    users
                    |> Enum.group_by(& &1.role)
                    |> Enum.map(fn {role, users} -> {role, length(users)} end)
                    |> Map.new()

                  %{
                    total: total_users,
                    by_role: users_by_role,
                    super_admins: Map.get(users_by_role, :super_admin, 0),
                    admins: Map.get(users_by_role, :admin, 0),
                    teachers: Map.get(users_by_role, :teacher, 0),
                    students: Map.get(users_by_role, :user, 0)
                  }

                {:error, _} ->
                  %{total: 0, by_role: %{}, super_admins: 0, admins: 0, teachers: 0, students: 0}
              end

            # Get course statistics
            course_stats =
              case KgEdu.Courses.Course |> Ash.read(tenant: tenant) do
                {:ok, courses} ->
                  total_courses = length(courses)
                  published_courses = courses |> Enum.count(& &1.publish_status)

                  %{
                    total: total_courses,
                    published: published_courses,
                    draft: total_courses - published_courses
                  }

                {:error, _} ->
                  %{total: 0, published: 0, draft: 0}
              end

            # Get knowledge resource statistics
            knowledge_stats =
              case KgEdu.Knowledge.Resource |> Ash.read(tenant: tenant) do
                {:ok, resources} ->
                  by_type =
                    resources
                    |> Enum.group_by(& &1.knowledge_type)
                    |> Enum.map(fn {type, resources} -> {type, length(resources)} end)
                    |> Map.new()

                  %{
                    total: length(resources),
                    by_type: by_type,
                    subjects: Map.get(by_type, :subject, 0),
                    knowledge_units: Map.get(by_type, :knowledge_unit, 0),
                    knowledge_cells: Map.get(by_type, :knowledge_cell, 0)
                  }

                {:error, _} ->
                  %{total: 0, by_type: %{}, subjects: 0, knowledge_units: 0, knowledge_cells: 0}
              end

            # Get file statistics
            file_stats =
              case KgEdu.Courses.File |> Ash.read(tenant: tenant) do
                {:ok, files} ->
                  %{
                    total: length(files)
                  }

                {:error, _} ->
                  %{total: 0}
              end

            # Get video statistics
            video_stats =
              case KgEdu.Courses.Video |> Ash.read(tenant: tenant) do
                {:ok, videos} ->
                  %{
                    total: length(videos)
                  }

                {:error, _} ->
                  %{total: 0}
              end

            # Get homework statistics
            homework_stats =
              case KgEdu.Knowledge.Homework |> Ash.read(tenant: tenant) do
                {:ok, homeworks} ->
                  %{
                    total: length(homeworks)
                  }

                {:error, _} ->
                  %{total: 0}
              end

            # Get exercise statistics
            exercise_stats =
              case KgEdu.Knowledge.Exercise |> Ash.read(tenant: tenant) do
                {:ok, exercises} ->
                  %{
                    total: length(exercises)
                  }

                {:error, _} ->
                  %{total: 0}
              end

            # Get activity statistics
            activity_stats =
              case KgEdu.Activity.ActivityLog |> Ash.read(tenant: tenant) do
                {:ok, activities} ->
                  by_type =
                    activities
                    |> Enum.group_by(& &1.action_type)
                    |> Enum.map(fn {type, activities} -> {type, length(activities)} end)
                    |> Map.new()

                  %{
                    total: length(activities),
                    by_type: by_type
                  }

                {:error, _} ->
                  %{total: 0, by_type: %{}}
              end

            summary = %{
              organization_id: organization_id,
              organization_name: organization.name,
              schema_name: tenant,
              users: user_stats,
              courses: course_stats,
              knowledge_resources: knowledge_stats,
              files: file_stats,
              videos: video_stats,
              homeworks: homework_stats,
              exercises: exercise_stats,
              activities: activity_stats,
              total_resources: %{
                files: file_stats.total,
                videos: video_stats.total,
                homeworks: homework_stats.total,
                exercises: exercise_stats.total,
                total:
                  file_stats.total + video_stats.total + homework_stats.total +
                    exercise_stats.total
              },
              calculated_at: DateTime.utc_now()
            }

            {:ok, summary}

          {:error, reason} ->
            {:error, reason}
        end
      end
    end

    action :get_all_organization_summary do
      description "Get comprehensive statistics for all organizations including all tenant data"

      returns :map

      run fn input, context ->
        case KgEdu.Accounts.Organization |> Ash.read() do
          {:ok, organizations} ->
            total_organizations = length(organizations)

            # First, gather all organization statistics
            org_statistics =
              organizations
              |> Enum.map(fn organization ->
                tenant = organization.schema_name

                # Get user statistics
                user_stats =
                  case KgEdu.Accounts.User |> Ash.read(tenant: tenant) do
                    {:ok, users} ->
                      total_users_in_org = length(users)

                      users_by_role =
                        users
                        |> Enum.group_by(& &1.role)
                        |> Enum.map(fn {role, users} -> {role, length(users)} end)
                        |> Map.new()

                      %{
                        total: total_users_in_org,
                        by_role: users_by_role,
                        super_admins: Map.get(users_by_role, :super_admin, 0),
                        admins: Map.get(users_by_role, :admin, 0),
                        teachers: Map.get(users_by_role, :teacher, 0),
                        students: Map.get(users_by_role, :user, 0)
                      }

                    {:error, _} ->
                      %{
                        total: 0,
                        by_role: %{},
                        super_admins: 0,
                        admins: 0,
                        teachers: 0,
                        students: 0
                      }
                  end

                # Get course statistics
                course_stats =
                  case KgEdu.Courses.Course |> Ash.read(tenant: tenant) do
                    {:ok, courses} ->
                      total_courses_in_org = length(courses)
                      published_courses_in_org = courses |> Enum.count(& &1.publish_status)

                      %{
                        total: total_courses_in_org,
                        published: published_courses_in_org,
                        draft: total_courses_in_org - published_courses_in_org
                      }

                    {:error, _} ->
                      %{total: 0, published: 0, draft: 0}
                  end

                # Get knowledge resource statistics
                knowledge_stats =
                  case KgEdu.Knowledge.Resource |> Ash.read(tenant: tenant) do
                    {:ok, resources} ->
                      total_knowledge_in_org = length(resources)

                      by_type =
                        resources
                        |> Enum.group_by(& &1.knowledge_type)
                        |> Enum.map(fn {type, resources} -> {type, length(resources)} end)
                        |> Map.new()

                      %{
                        total: total_knowledge_in_org,
                        by_type: by_type,
                        subjects: Map.get(by_type, :subject, 0),
                        knowledge_units: Map.get(by_type, :knowledge_unit, 0),
                        knowledge_cells: Map.get(by_type, :knowledge_cell, 0)
                      }

                    {:error, _} ->
                      %{
                        total: 0,
                        by_type: %{},
                        subjects: 0,
                        knowledge_units: 0,
                        knowledge_cells: 0
                      }
                  end

                # Get file statistics
                file_stats =
                  case KgEdu.Courses.File |> Ash.read(tenant: tenant) do
                    {:ok, files} ->
                      total_files_in_org = length(files)
                      %{total: total_files_in_org}

                    {:error, _} ->
                      %{total: 0}
                  end

                # Get video statistics
                video_stats =
                  case KgEdu.Courses.Video |> Ash.read(tenant: tenant) do
                    {:ok, videos} ->
                      total_videos_in_org = length(videos)
                      %{total: total_videos_in_org}

                    {:error, _} ->
                      %{total: 0}
                  end

                # Get homework statistics
                homework_stats =
                  case KgEdu.Knowledge.Homework |> Ash.read(tenant: tenant) do
                    {:ok, homeworks} ->
                      total_homeworks_in_org = length(homeworks)
                      %{total: total_homeworks_in_org}

                    {:error, _} ->
                      %{total: 0}
                  end

                # Get exercise statistics
                exercise_stats =
                  case KgEdu.Knowledge.Exercise |> Ash.read(tenant: tenant) do
                    {:ok, exercises} ->
                      total_exercises_in_org = length(exercises)
                      %{total: total_exercises_in_org}

                    {:error, _} ->
                      %{total: 0}
                  end

                # Get activity statistics
                activity_stats =
                  case KgEdu.Activity.ActivityLog |> Ash.read(tenant: tenant) do
                    {:ok, activities} ->
                      total_activities_in_org = length(activities)

                      by_type =
                        activities
                        |> Enum.group_by(& &1.action_type)
                        |> Enum.map(fn {type, activities} -> {type, length(activities)} end)
                        |> Map.new()

                      %{
                        total: total_activities_in_org,
                        by_type: by_type
                      }

                    {:error, _} ->
                      %{total: 0, by_type: %{}}
                  end

                %{
                  organization_id: organization.id,
                  organization_name: organization.name,
                  schema_name: tenant,
                  users: user_stats,
                  courses: course_stats,
                  knowledge_resources: knowledge_stats,
                  files: file_stats,
                  videos: video_stats,
                  homeworks: homework_stats,
                  exercises: exercise_stats,
                  activities: activity_stats,
                  total_resources: %{
                    files: file_stats.total,
                    videos: video_stats.total,
                    homeworks: homework_stats.total,
                    exercises: exercise_stats.total,
                    total:
                      file_stats.total + video_stats.total + homework_stats.total +
                        exercise_stats.total
                  }
                }
              end)

            # Calculate totals from the gathered organization statistics
            total_users = org_statistics |> Enum.map(& &1.users.total) |> Enum.sum()
            total_courses = org_statistics |> Enum.map(& &1.courses.total) |> Enum.sum()

            total_published_courses =
              org_statistics |> Enum.map(& &1.courses.published) |> Enum.sum()

            total_knowledge_resources =
              org_statistics |> Enum.map(& &1.knowledge_resources.total) |> Enum.sum()

            total_files = org_statistics |> Enum.map(& &1.files.total) |> Enum.sum()
            total_videos = org_statistics |> Enum.map(& &1.videos.total) |> Enum.sum()
            total_homeworks = org_statistics |> Enum.map(& &1.homeworks.total) |> Enum.sum()
            total_exercises = org_statistics |> Enum.map(& &1.exercises.total) |> Enum.sum()
            total_activities = org_statistics |> Enum.map(& &1.activities.total) |> Enum.sum()

            summary = %{
              overview: %{
                total_organizations: total_organizations,
                users: %{
                  total: total_users,
                  super_admins: org_statistics |> Enum.map(& &1.users.super_admins) |> Enum.sum(),
                  admins: org_statistics |> Enum.map(& &1.users.admins) |> Enum.sum(),
                  teachers: org_statistics |> Enum.map(& &1.users.teachers) |> Enum.sum(),
                  students: org_statistics |> Enum.map(& &1.users.students) |> Enum.sum()
                },
                courses: %{
                  total: total_courses,
                  published: total_published_courses,
                  draft: total_courses - total_published_courses
                },
                knowledge_resources: %{
                  total: total_knowledge_resources,
                  subjects:
                    org_statistics |> Enum.map(& &1.knowledge_resources.subjects) |> Enum.sum(),
                  knowledge_units:
                    org_statistics
                    |> Enum.map(& &1.knowledge_resources.knowledge_units)
                    |> Enum.sum(),
                  knowledge_cells:
                    org_statistics
                    |> Enum.map(& &1.knowledge_resources.knowledge_cells)
                    |> Enum.sum()
                },
                files: total_files,
                videos: total_videos,
                homeworks: total_homeworks,
                exercises: total_exercises,
                activities: total_activities,
                total_resources: %{
                  files: total_files,
                  videos: total_videos,
                  homeworks: total_homeworks,
                  exercises: total_exercises,
                  total: total_files + total_videos + total_homeworks + total_exercises
                },
                calculated_at: DateTime.utc_now()
              },
              organizations: org_statistics
            }

            {:ok, summary}

          {:error, reason} ->
            {:error, reason}
        end
      end
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

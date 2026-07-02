# Run migrations for all repos
IO.puts("Starting migration runner...")

{:ok, _} = Application.ensure_all_started(:kg_edu)

domains = Application.fetch_env!(:kg_edu, :ash_domains)

repos = Enum.flat_map(domains, fn domain ->
  domain
  |> Ash.Domain.Info.resources()
  |> Enum.map(&AshPostgres.DataLayer.Info.repo/1)
  |> Enum.uniq()
  |> Enum.reject(&is_nil/1)
end)

IO.puts("Found repos: #{inspect(repos)}")

for repo <- repos do
  path = repo.migrations_path()
  IO.puts("Running migrations at: #{path}")

  {:ok, _, _} = Ecto.Migrator.with_repo(repo, fn r ->
    Ecto.Migrator.run(r, path, :up, all: true, log: true)
  end)
end

# Then run tenant migrations
for repo <- repos do
  tenant_path = repo.migrations_path("tenant_migrations")
  if File.exists?(tenant_path) do
    IO.puts("Running tenant migrations at: #{tenant_path}")

    {:ok, _, _} = Ecto.Migrator.with_repo(repo, fn r ->
      # For each tenant
      if function_exported?(r, :all_tenants, 0) do
        for tenant <- r.all_tenants() do
          Ecto.Migrator.run(r, tenant_path, :up, all: true, prefix: tenant, log: true)
        end
      end
    end)
  end
end

IO.puts("Migrations complete!")

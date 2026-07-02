IO.puts("Running tenant migrations...")

{:ok, _} = Application.ensure_all_started(:kg_edu)

domains = Application.fetch_env!(:kg_edu, :ash_domains)

repos = Enum.flat_map(domains, fn domain ->
  domain
  |> Ash.Domain.Info.resources()
  |> Enum.map(&AshPostgres.DataLayer.Info.repo/1)
  |> Enum.uniq()
  |> Enum.reject(&is_nil/1)
end)

for repo <- repos do
  path = Ecto.Migrator.migrations_path(repo, "tenant_migrations")
  IO.puts("Tenant migrations path: #{path}")
  if File.exists?(path) do
    IO.puts("Found tenant migrations, running...")
    {:ok, _, _} = Ecto.Migrator.with_repo(repo, fn r ->
      Ecto.Migrator.run(r, path, :up, all: true)
    end)
  else
    IO.puts("No tenant migrations directory found")
  end
end

IO.puts("All tenant migrations complete!")

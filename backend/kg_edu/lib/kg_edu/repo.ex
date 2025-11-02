defmodule KgEdu.Repo do
  use AshPostgres.Repo,
    otp_app: :kg_edu

  @impl true
  def all_tenants do
    for org <-Ash.read!(KgEdu.Accounts.Organization) do
      org.schema_name
      # org.schema
    end
  end

  @impl true
  def installed_extensions do
    # Add extensions here, and the migration generator will install them.
    ["ash-functions", "citext"]
  end

  # Don't open unnecessary transactions
  # will default to `false` in 4.0
  @impl true
  def prefer_transaction? do
    false
  end

  @impl true
  def min_pg_version do
    %Version{major: 14, minor: 18, patch: 0}
  end
end

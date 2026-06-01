defmodule KgEdu.Repo.TenantMigrations.AddMmEnrollmentApplication do
  @moduledoc """
  Add fields for micro-major enrollment application/approval workflow:
  - rejected_reason: text, reason when teacher rejects an application
  - reviewed_at: timestamp when the enrollment was reviewed (approved/rejected)
  - reviewed_by_id: UUID of the reviewer teacher
  """
  use Ecto.Migration

  def up do
    alter table(:micro_major_enrollments) do
      add :rejected_reason, :text
      add :reviewed_at, :utc_datetime
      add :reviewed_by_id, :uuid
    end
  end

  def down do
    alter table(:micro_major_enrollments) do
      remove :rejected_reason
      remove :reviewed_at
      remove :reviewed_by_id
    end
  end
end

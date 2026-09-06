defmodule KgEdu.Repo.Migrations.CheckDrift do
  @moduledoc """
  Fresh-install backfill.

  The migration history was squashed in the past ("removee migration files"),
  so a brand-new database misses a few columns/constraints that incremental
  UAT databases already have:

    * users.school / users.class_id (+ FK + index) / users.avatar_url /
      users.job_title / users.bio / users.employee_id
    * FKs on course_assignments(assigned_by_id, course_id, teacher_id)

  Everything here is guarded (IF NOT EXISTS / constraint checks), so this
  migration is a no-op on databases that were migrated incrementally.
  """

  use Ecto.Migration

  def up do
    # --- users backfill -------------------------------------------------
    execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS school text")
    execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS class_id uuid")
    execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text")
    execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title text")
    execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text")
    execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id text")

    execute("""
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_class_id_fkey') THEN
        ALTER TABLE users ADD CONSTRAINT users_class_id_fkey
          FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;
      END IF;
    END
    $$;
    """)

    execute("CREATE INDEX IF NOT EXISTS users_class_id_index ON users (class_id)")

    # --- course_assignments FK backfill ----------------------------------
    # (table is created by an older migration without FKs when the
    # referenced users/courses tables do not exist yet)
    execute("""
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_assignments_assigned_by_id_fkey') THEN
        ALTER TABLE course_assignments ADD CONSTRAINT course_assignments_assigned_by_id_fkey
          FOREIGN KEY (assigned_by_id) REFERENCES users(id) ON DELETE SET NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_assignments_course_id_fkey') THEN
        ALTER TABLE course_assignments ADD CONSTRAINT course_assignments_course_id_fkey
          FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_assignments_teacher_id_fkey') THEN
        ALTER TABLE course_assignments ADD CONSTRAINT course_assignments_teacher_id_fkey
          FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE;
      END IF;
    END
    $$;
    """)
  end

  def down do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_assignments_teacher_id_fkey') THEN
        ALTER TABLE course_assignments DROP CONSTRAINT course_assignments_teacher_id_fkey;
      END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_assignments_course_id_fkey') THEN
        ALTER TABLE course_assignments DROP CONSTRAINT course_assignments_course_id_fkey;
      END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_assignments_assigned_by_id_fkey') THEN
        ALTER TABLE course_assignments DROP CONSTRAINT course_assignments_assigned_by_id_fkey;
      END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_class_id_fkey') THEN
        ALTER TABLE users DROP CONSTRAINT users_class_id_fkey;
      END IF;
    END
    $$;
    """)

    execute("DROP INDEX IF EXISTS users_class_id_index")
    execute("ALTER TABLE users DROP COLUMN IF EXISTS employee_id")
    execute("ALTER TABLE users DROP COLUMN IF EXISTS bio")
    execute("ALTER TABLE users DROP COLUMN IF EXISTS job_title")
    execute("ALTER TABLE users DROP COLUMN IF EXISTS avatar_url")
    execute("ALTER TABLE users DROP COLUMN IF EXISTS class_id")
    execute("ALTER TABLE users DROP COLUMN IF EXISTS school")
  end
end

defmodule KgEdu.Repo.TenantMigrations.AddAiConversations do
  @moduledoc """
  Tenant migration: 安全添加 micro_major_enrollments 字段。

  幂等设计：
  - 先检查表是否存在（跳过没有该表的 tenant）
  - 每列单独检查 IF NOT EXISTS（跳过已有该列的 tenant）
  - down 不删除（字段可能被其他迁移使用）
  """

  use Ecto.Migration

  def up do
    # 仅在表存在时执行
    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'micro_major_enrollments'
        AND table_schema = current_schema()
      ) THEN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'micro_major_enrollments'
          AND column_name = 'reviewed_by_id'
          AND table_schema = current_schema()
        ) THEN
          ALTER TABLE micro_major_enrollments ADD COLUMN reviewed_by_id uuid;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'micro_major_enrollments'
          AND column_name = 'rejected_reason'
          AND table_schema = current_schema()
        ) THEN
          ALTER TABLE micro_major_enrollments ADD COLUMN rejected_reason text;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'micro_major_enrollments'
          AND column_name = 'reviewed_at'
          AND table_schema = current_schema()
        ) THEN
          ALTER TABLE micro_major_enrollments ADD COLUMN reviewed_at timestamptz;
        END IF;
      END IF;
    END $$;
    """)
  end

  def down do
    :ok
  end
end

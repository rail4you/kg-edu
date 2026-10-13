defmodule KgEdu.Repo.TenantMigrations.AddCascadeDeleteToCourseReferences do
  @moduledoc """
  允许删除课程：把「课程级联删除集合」内、当前为 NO ACTION 的外键改为 ON DELETE CASCADE。

  涉及父表：courses 及其直接级联对象 chapters、knowledge_resources。

  这些外键原本没有级联，删除课程时会被 check_in_sessions、course_infos、
  course_assignments 等子表引用而报错，前端表现为「课程无法删除」。
  """

  use Ecto.Migration

  def up do
    schema = prefix()

    execute("""
    DO $$
    DECLARE
      r RECORD;
      sch text := '#{schema}';
      parent_oids oid[];
    BEGIN
      parent_oids := ARRAY[
        to_regclass(format('%I.courses', sch)),
        to_regclass(format('%I.chapters', sch)),
        to_regclass(format('%I.knowledge_resources', sch))
      ];

      FOR r IN
        SELECT
          c.relname AS tbl,
          ct.conname AS conname,
          a.attname AS col,
          p.relname AS parent
        FROM pg_constraint ct
        JOIN pg_class c ON c.oid = ct.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = sch
        JOIN pg_class p ON p.oid = ct.confrelid
        JOIN pg_attribute a
          ON a.attrelid = ct.conrelid
         AND a.attnum = ANY (ct.conkey)
        WHERE ct.contype = 'f'
          AND ct.confdeltype = 'a'
          AND ct.confrelid = ANY (parent_oids)
      LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', sch, r.tbl, r.conname);
        EXECUTE format(
          'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I(id) ON DELETE CASCADE',
          sch, r.tbl, r.conname, r.col, sch, r.parent
        );
      END LOOP;
    END $$;
    """)
  end

  def down do
    # 不回滚：级联删除是关键业务能力，回滚可能造成数据不一致。
    :ok
  end
end

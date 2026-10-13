defmodule KgEdu.Repo.TenantMigrations.DeepCascadeForCourseChain do
  @moduledoc """
  20261018000000 已把指向 courses/chapters/knowledge_resources 的 NO_ACTION
  FK 改为 CASCADE，但忽略了**间接链路**——能力图谱一条链：

      courses → main_abilities → sub_abilities → sub_ability_knowledge_resources
      courses → books

  这些"二级"FK 仍是 NO_ACTION，导致删除课程时仍报：
      update or delete on table "main_abilities" violates foreign key constraint
      "sub_abilities_main_ability_id_fkey" on table "sub_abilities"

  本迁移把"沿 courses 级联闭包"内任何 NO_ACTION FK（除顶级表 users/classes/
  subject_categories/relation_types 等业务独立表外）一律改为 CASCADE。

  **安全说明**：被改 CASCADE 的 parent 表全部与课程业务强耦合：
  books/main_abilities/sub_abilities/sub_ability_knowledge_resources 等。
  顶级表 users 等的指向保持不变以保护账号/选课数据完整性。
  """

  use Ecto.Migration

  @course_chain [
    "courses",
    "chapters",
    "knowledge_resources",
    "main_abilities",
    "sub_abilities",
    "sub_ability_knowledge_resources",
    "books",
    "files",
    "course_videos",
    "course_infos",
    "homeworks",
    "exercises",
    "exams",
    "experiments",
    "links",
    "groups",
    "group_tasks",
    "discussions",
    "discussion_sessions",
    "email_messages",
    "research_room_messages",
    "check_in_records",
    "form_submissions",
    "student_exams",
    "student_answers",
    "student_exercise_attempts",
    "practice_sessions",
    "practice_attempts",
    "competency_course_supports",
    "major_courses",
    "micro_major_chapters",
    "micro_major_exercises",
    "micro_major_homeworks",
    "micro_major_resources",
    "micro_major_videos",
    "video_analyses",
    "video_knowledge_marks",
    "course_assignments",
    "course_enrollments",
    "knowledge_question_connections",
    "knowledge_questions",
    "knowledge_relations",
    "relations"
  ]

  # 顶级/业务独立表：不能 cascade 删除账号和学科目录
  @protected_parents [
    "users",
    "classes",
    "books",
    "subject_categories",
    "relation_types",
    "check_in_sessions",
    "form_assignments",
    "email_messages"
  ]

  def up do
    sch = prefix()

    execute("""
    DO $$
    DECLARE
      r RECORD;
      sch text := '#{sch}';
      protected_parents text[] := ARRAY#{format_pg_array(@protected_parents)};
    BEGIN
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
          AND p.relname = ANY(ARRAY#{format_pg_array(@course_chain)})
          AND NOT (p.relname = ANY(protected_parents))
      LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', sch, r.tbl, r.conname);
        EXECUTE format(
          'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I(id) ON DELETE CASCADE',
          sch, r.tbl, r.conname, r.col, sch, r.parent
        );
        RAISE NOTICE 'deep cascaded: %.% -> %.%', sch, r.tbl, sch, r.parent;
      END LOOP;
    END $$;
    """)
  end

  def down do
    # 不回滚：与 20261018000000 同理，关键业务能力不回滚
    :ok
  end

  defp format_pg_list(list) do
    list |> Enum.map(&"'#{&1}'") |> Enum.join(", ")
  end

  defp format_pg_array(list) do
    # 生成 PG 数组字面量：ARRAY['a','b']
    "[" <> format_pg_list(list) <> "]"
  end
end

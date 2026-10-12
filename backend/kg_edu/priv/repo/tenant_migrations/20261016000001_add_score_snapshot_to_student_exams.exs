defmodule KgEdu.Repo.TenantMigrations.AddScoreSnapshotToStudentExams do
  @moduledoc """
  为 student_exams 增加试卷满分 / 及格分快照字段，
  避免试题增删改导致历史成绩（总分、及格线）失真。
  """

  use Ecto.Migration

  def up do
    alter table(:student_exams, prefix: prefix()) do
      add :total_score, :bigint, null: false, default: 0
      add :passing_score, :bigint, null: false, default: 60
    end

    # 回填历史记录：用考试当前的试题总分与及格分作为快照
    execute("""
    UPDATE #{prefix()}.student_exams se
    SET total_score = COALESCE(sub.total, 0),
        passing_score = COALESCE(e.passing_score, 60)
    FROM #{prefix()}.exams e
    LEFT JOIN (
      SELECT exam_id, SUM(points) AS total FROM #{prefix()}.exam_exercises GROUP BY exam_id
    ) sub ON sub.exam_id = e.id
    WHERE se.exam_id = e.id AND se.total_score = 0
    """)
  end

  def down do
    alter table(:student_exams, prefix: prefix()) do
      remove :total_score
      remove :passing_score
    end
  end
end

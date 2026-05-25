defmodule KgEdu.Repo.TenantMigrations.AddMicroMajorModel do
  @moduledoc """
  创建微专业相关数据表
  
  - micro_majors: 微专业表
  - micro_major_courses: 微专业课程关联表
  - micro_major_enrollments: 学生微专业选课记录表
  """
  use Ecto.Migration

  def up do
    # 创建微专业表
    create table(:micro_majors, primary_key: false) do
      add :id, :uuid, primary_key: true, default: fragment("gen_random_uuid()")
      
      # 基本信息
      add :name, :string, null: false
      add :project_background, :text
      add :knowledge_objective, :text
      add :ability_objective, :text
      add :quality_objective, :text
      add :project_features, :text
      
      # 学习信息
      add :learning_cycle, :string
      add :assessment_method, :string
      add :tuition_fee, :string
      
      # 媒体信息
      add :cover_url, :string
      add :intro, :text
      
      # 人员信息（关联教师）
      add :responsible_teacher_id, references(:users, type: :uuid, on_delete: :nilify_all)
      add :consultant_teacher_id, references(:users, type: :uuid, on_delete: :nilify_all)
      
      # 状态信息
      add :status, :string, null: false, default: "draft"
      add :sort_order, :integer, null: false, default: 0
      add :published_at, :utc_datetime
      
      # 时间戳
      add :inserted_at, :utc_datetime, default: fragment("now()"), null: false
      add :updated_at, :utc_datetime, default: fragment("now()"), null: false
    end
    
    create index(:micro_majors, [:status])
    create index(:micro_majors, [:responsible_teacher_id])
    create index(:micro_majors, [:consultant_teacher_id])

    # 创建微专业课程关联表
    create table(:micro_major_courses, primary_key: false) do
      add :id, :uuid, primary_key: true, default: fragment("gen_random_uuid()")
      
      add :micro_major_id, references(:micro_majors, type: :uuid, on_delete: :delete_all), null: false
      add :course_id, references(:courses, type: :uuid, on_delete: :delete_all), null: false
      
      # 微专业课程特有的属性
      add :credit, :float
      add :period, :integer
      add :semester, :string
      add :course_type, :string, null: false, default: "required"
      add :sort_order, :integer, null: false, default: 0
      add :description, :text
      
      add :inserted_at, :utc_datetime, default: fragment("now()"), null: false
      add :updated_at, :utc_datetime, default: fragment("now()"), null: false
    end
    
    create index(:micro_major_courses, [:micro_major_id])
    create index(:micro_major_courses, [:course_id])
    create unique_index(:micro_major_courses, [:micro_major_id, :course_id], name: "micro_major_courses_unique")

    # 创建学生微专业选课记录表
    create table(:micro_major_enrollments, primary_key: false) do
      add :id, :uuid, primary_key: true, default: fragment("gen_random_uuid()")
      
      add :micro_major_id, references(:micro_majors, type: :uuid, on_delete: :delete_all), null: false
      add :student_id, references(:users, type: :uuid, on_delete: :delete_all), null: false
      add :assigned_by_id, references(:users, type: :uuid, on_delete: :nilify_all)
      
      add :status, :string, null: false, default: "active"
      add :progress, :float, null: false, default: 0.0
      add :notes, :text
      add :assigned_at, :utc_datetime, null: false, default: fragment("now()")
      add :completed_at, :utc_datetime
      
      add :inserted_at, :utc_datetime, default: fragment("now()"), null: false
      add :updated_at, :utc_datetime, default: fragment("now()"), null: false
    end
    
    create index(:micro_major_enrollments, [:micro_major_id])
    create index(:micro_major_enrollments, [:student_id])
    create unique_index(:micro_major_enrollments, [:micro_major_id, :student_id], name: "micro_major_enrollments_unique")
  end

  def down do
    drop table(:micro_major_enrollments)
    drop table(:micro_major_courses)
    drop table(:micro_majors)
  end
end
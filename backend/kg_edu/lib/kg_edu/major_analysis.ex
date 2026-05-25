defmodule KgEdu.MajorAnalysis do
  @moduledoc """
  专业分析域。
  基于录入的专业信息，调用 AI 服务开展岗位分析、能力分析，
  构建专业能力素质图谱，AI 辅助人才培养设计。
  """
  use Ash.Domain,
    otp_app: :kg_edu,
    extensions: [AshAdmin.Domain, AshJsonApi.Domain, AshPhoenix, AshTypescript.Rpc]

  admin do
    show? true
  end

  json_api do
    routes do
      base_route "/majors", KgEdu.MajorAnalysis.Major do
        get :read, route: "/"
        index :by_college, route: "/college/:college"
        post :create, route: "/"
        patch :update_major, route: "/:id"
        delete :destroy, route: "/:id"
        get :by_id, route: "/:id"
      end

      base_route "/job-positions", KgEdu.MajorAnalysis.JobPosition do
        get :read, route: "/"
        index :by_major, route: "/major/:major_id"
        post :create, route: "/"
        patch :update_job_position, route: "/:id"
        delete :destroy, route: "/:id"
        post :trigger_ai_analysis, route: "/:id/ai-analysis"
        get :by_id, route: "/:id"
      end

      base_route "/major-competencies", KgEdu.MajorAnalysis.MajorCompetency do
        get :read, route: "/"
        index :by_major, route: "/major/:major_id"
        index :root_competencies, route: "/major/:major_id/root"
        post :create, route: "/"
        patch :update_competency, route: "/:id"
        delete :destroy, route: "/:id"
        get :by_id, route: "/:id"
      end

      base_route "/curriculum-designs", KgEdu.MajorAnalysis.CurriculumDesign do
        get :read, route: "/"
        index :by_major, route: "/major/:major_id"
        post :create, route: "/"
        patch :update_curriculum, route: "/:id"
        delete :destroy, route: "/:id"
        post :ai_generate, route: "/ai-generate"
        patch :publish, route: "/:id/publish"
        get :by_id, route: "/:id"
      end

      base_route "/analysis-reports", KgEdu.MajorAnalysis.AnalysisReport do
        get :read, route: "/"
        index :by_major, route: "/major/:major_id"
        index :by_type, route: "/type/:report_type"
        post :create, route: "/"
        delete :destroy, route: "/:id"
        post :generate_report, route: "/generate"
        get :by_id, route: "/:id"
      end
    end
  end

  typescript_rpc do
    resource KgEdu.MajorAnalysis.MicroMajor do
      rpc_action :create_micro_major, :create
      rpc_action :update_micro_major, :update
      rpc_action :delete_micro_major, :destroy
      rpc_action :get_micro_major, :by_id
      rpc_action :list_micro_majors, :read
      rpc_action :list_micro_majors_by_teacher, :by_teacher
      rpc_action :publish_micro_major, :publish
      rpc_action :unpublish_micro_major, :unpublish
    end

    resource KgEdu.MajorAnalysis.MicroMajorCourse do
      rpc_action :create_micro_major_course, :create
      rpc_action :update_micro_major_course, :update
      rpc_action :delete_micro_major_course, :destroy
      rpc_action :list_micro_major_courses, :read
      rpc_action :list_courses_by_micro_major, :by_micro_major
      rpc_action :replace_micro_major_courses, :replace_for_micro_major
    end

    resource KgEdu.MajorAnalysis.MicroMajorEnrollment do
      rpc_action :assign_student_to_micro_major, :create
      rpc_action :remove_student_from_micro_major, :destroy
      rpc_action :list_micro_major_enrollments, :read
      rpc_action :list_enrollments_by_micro_major, :by_micro_major
      rpc_action :get_micro_major_enrollments_by_student, :by_student
      rpc_action :my_micro_major_enrollments, :my_enrollments
      rpc_action :bulk_assign_students_to_micro_major, :bulk_assign
      rpc_action :update_enrollment, :update
    end

    resource KgEdu.MajorAnalysis.Major do
      rpc_action :list_majors, :read
      rpc_action :list_public_micro_majors, :public_list
      rpc_action :get_majors_by_college, :by_college
      rpc_action :create_major, :create
      rpc_action :update_major, :update_major
      rpc_action :delete_major, :destroy
      rpc_action :get_major, :by_id
      rpc_action :get_public_micro_major, :public_detail
    end

    resource KgEdu.MajorAnalysis.JobPosition do
      rpc_action :list_job_positions, :read
      rpc_action :get_positions_by_major, :by_major
      rpc_action :create_job_position, :create
      rpc_action :update_job_position, :update_job_position
      rpc_action :delete_job_position, :destroy
      rpc_action :trigger_ai_analysis, :trigger_ai_analysis
      rpc_action :get_job_position, :by_id
    end

    resource KgEdu.MajorAnalysis.MajorCompetency do
      rpc_action :list_competencies, :read
      rpc_action :get_competencies_by_major, :by_major
      rpc_action :get_root_competencies, :root_competencies
      rpc_action :create_competency, :create
      rpc_action :update_competency, :update_competency
      rpc_action :delete_competency, :destroy
      rpc_action :get_competency, :by_id
    end

    resource KgEdu.MajorAnalysis.CurriculumDesign do
      rpc_action :list_curriculum_designs, :read
      rpc_action :get_designs_by_major, :by_major
      rpc_action :create_curriculum_design, :create
      rpc_action :update_curriculum_design, :update_curriculum
      rpc_action :delete_curriculum_design, :destroy
      rpc_action :ai_generate_curriculum, :ai_generate
      rpc_action :publish_curriculum, :publish
      rpc_action :get_curriculum_design, :by_id
    end

    resource KgEdu.MajorAnalysis.AnalysisReport do
      rpc_action :list_reports, :read
      rpc_action :get_reports_by_major, :by_major
      rpc_action :get_reports_by_type, :by_type
      rpc_action :create_report, :create
      rpc_action :delete_report, :destroy
      rpc_action :generate_report, :generate_report
      rpc_action :get_report, :by_id
    end

    resource KgEdu.MajorAnalysis.MajorEnrollment do
      rpc_action :assign_major_student, :create
      rpc_action :remove_major_student, :destroy
      rpc_action :list_major_enrollments_by_major, :by_major
      rpc_action :my_major_enrollments, :my_enrollments
      rpc_action :bulk_assign_major_students, :bulk_assign
      rpc_action :select_micro_major, :select_micro_major
    end

    resource KgEdu.MajorAnalysis.MajorCourse do
      rpc_action :create_major_course, :create
      rpc_action :update_major_course, :update_major_course
      rpc_action :delete_major_course, :destroy
      rpc_action :list_major_courses, :read
      rpc_action :list_major_courses_by_major, :by_major
      rpc_action :replace_major_courses, :replace_for_major
    end

    resource KgEdu.MajorAnalysis.CompetencyCourseSupport do
      rpc_action :create_competency_course_support, :create
      rpc_action :update_competency_course_support, :update_support
      rpc_action :delete_competency_course_support, :destroy
      rpc_action :list_competency_course_supports, :read
      rpc_action :list_supports_by_competency, :by_competency
      rpc_action :list_supports_by_course, :by_course
      rpc_action :replace_competency_course_supports, :replace_for_competency
    end
  end

  resources do
    resource KgEdu.MajorAnalysis.MicroMajor
    resource KgEdu.MajorAnalysis.MicroMajorCourse
    resource KgEdu.MajorAnalysis.MicroMajorEnrollment
    resource KgEdu.MajorAnalysis.Major
    resource KgEdu.MajorAnalysis.JobPosition
    resource KgEdu.MajorAnalysis.MajorCompetency
    resource KgEdu.MajorAnalysis.CurriculumDesign
    resource KgEdu.MajorAnalysis.AnalysisReport
    resource KgEdu.MajorAnalysis.MajorEnrollment
    resource KgEdu.MajorAnalysis.MajorCourse
    resource KgEdu.MajorAnalysis.CompetencyCourseSupport
  end
end

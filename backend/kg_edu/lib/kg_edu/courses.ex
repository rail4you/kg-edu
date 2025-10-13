defmodule KgEdu.Courses do
  use Ash.Domain,
    otp_app: :kg_edu,
    extensions: [AshAdmin.Domain, AshJsonApi.Domain, AshPhoenix, AshTypescript.Rpc]

  admin do
    show? true
  end

  typescript_rpc do
    resource KgEdu.Courses.Course do
      rpc_action :list_courses, :read
      rpc_action :create_course, :create
      rpc_action :destroy_course, :destroy
      rpc_action :get_course, :get
    end

    resource KgEdu.Courses.Chapter do
      rpc_action :list_chapters, :read
      rpc_action :create_chapter, :create
      rpc_action :get_chapter, :read
      rpc_action :update_chapter, :update
      rpc_action :delete_chapter, :destroy
    end

    resource KgEdu.Courses.File do
      rpc_action :list_files, :read
      rpc_action :upload_file, :upload
      rpc_action :delete_file, :destroy
      # rpc_action :get_file, :get
    end
  end

  json_api do
    routes do
      # Course endpoints
      base_route "/courses", KgEdu.Courses.Course do
        get :read, route: "/"
        index :by_teacher, route: "/teacher/:teacher_id"
        index :by_student, route: "/student/:student_id"
        post :create, route: "/"
        patch :update, route: "/:id"
        delete :destroy, route: "/:id"
      end

      # Chapter endpoints
      base_route "/chapters", KgEdu.Courses.Chapter do
        get :read, route: "/"
        index :by_course, route: "/course/:course_id"
        index :root_chapters, route: "/course/:course_id/root"
        index :subchapters, route: "/parent/:parent_chapter_id"
        post :create, route: "/"
        patch :update, route: "/:id"
        delete :destroy, route: "/:id"
      end

      # Course enrollment endpoints
      base_route "/course-enrollments", KgEdu.Courses.CourseEnrollment do
        get :read, route: "/"
        index :by_course, route: "/course/:course_id"
        index :by_student, route: "/student/:student_id"
        post :create, route: "/"
        delete :destroy, route: "/:id"
      end
    end
  end

  resources do
    resource KgEdu.Courses.Course
    resource KgEdu.Courses.CourseEnrollment
    resource KgEdu.Courses.Chapter
    resource KgEdu.Courses.File
  end
end

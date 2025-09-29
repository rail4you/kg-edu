defmodule KgEdu.Courses do
  use Ash.Domain,
    otp_app: :kg_edu,
    extensions: [AshAdmin.Domain, AshJsonApi.Domain, AshAi, AshPhoenix, AshTypescript.Rpc]

  admin do
    show? true
  end

  typescript_rpc do
    resource KgEdu.Courses.Course do
      rpc_action :list_courses, :read
      rpc_action :create_course, :create
      rpc_action :get_course, :get
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

  tools do
    # Course tools
    tool :list_courses, KgEdu.Courses.Course, :read do
      description "List all courses with optional filtering"
    end

    tool :get_course, KgEdu.Courses.Course, :read do
      description "Get a specific course by ID"
    end

    tool :create_course, KgEdu.Courses.Course, :create do
      description "Create a new course"
    end

    tool :update_course, KgEdu.Courses.Course, :update do
      description "Update an existing course"
    end

    tool :delete_course, KgEdu.Courses.Course, :destroy do
      description "Delete a course"
    end

    tool :list_courses_by_teacher, KgEdu.Courses.Course, :by_teacher do
      description "Get courses taught by a specific teacher"
    end

    tool :list_courses_by_student, KgEdu.Courses.Course, :by_student do
      description "Get courses assigned to a specific student"
    end

    # Course enrollment tools
    tool :list_enrollments, KgEdu.Courses.CourseEnrollment, :read do
      description "List all course enrollments"
    end

    tool :enroll_student, KgEdu.Courses.CourseEnrollment, :create do
      description "Enroll a student in a course"
    end

    tool :unenroll_student, KgEdu.Courses.CourseEnrollment, :destroy do
      description "Unenroll a student from a course"
    end

    tool :list_enrollments_by_course, KgEdu.Courses.CourseEnrollment, :by_course do
      description "Get enrollments for a specific course"
    end

    tool :list_enrollments_by_student, KgEdu.Courses.CourseEnrollment, :by_student do
      description "Get enrollments for a specific student"
    end
  end

  resources do
    resource KgEdu.Courses.Course
    resource KgEdu.Courses.CourseEnrollment
    resource KgEdu.Courses.File
  end
end

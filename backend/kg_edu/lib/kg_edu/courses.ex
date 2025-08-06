defmodule KgEdu.Courses do
  use Ash.Domain, otp_app: :kg_edu, extensions: [AshAdmin.Domain, AshJsonApi.Domain]

  admin do
    show? true
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

  resources do
    resource KgEdu.Courses.Course
    resource KgEdu.Courses.CourseEnrollment
  end
end

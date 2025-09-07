defmodule KgEdu.Knowledge do
  use Ash.Domain, otp_app: :kg_edu, extensions: [AshAdmin.Domain, AshJsonApi.Domain, AshPhoenix]

  admin do
    show? true
  end

  json_api do
    routes do
      # Knowledge resource endpoints
      base_route "/knowledge-resources", KgEdu.Knowledge.Resource do
        get :read, route: "/"
        index :by_course, route: "/course/:course_id"
        post :create, route: "/"
        patch :update, route: "/:id"
        delete :destroy, route: "/:id"
      end

      # Knowledge relation endpoints
      base_route "/knowledge-relations", KgEdu.Knowledge.Relation do
        get :read, route: "/"
        post :create, route: "/"
        patch :update, route: "/:id"
        delete :destroy, route: "/:id"
      end
    end
  end

  resources do
    resource KgEdu.Knowledge.Resource
    resource KgEdu.Knowledge.Relation
  end
end

defmodule KgEdu.Knowledge do
  use Ash.Domain, otp_app: :kg_edu, extensions: [AshAdmin.Domain, AshJsonApi.Domain, AshPhoenix, AshTypescript.Rpc, AshAi]

  admin do
    show? true
  end

  typescript_rpc do
    resource KgEdu.Knowledge.Resource do
      rpc_action :list_subjects, :list_subjects
      rpc_action :create_resource, :create
      rpc_action :get_subject_with_units, :get_subject_with_units
      rpc_action :get_full_hierarchy, :get_full_hierarchy
      rpc_action :update_resource, :update
      rpc_action :destroy_resource, :destroy
      # rpc_action :get_resource, :get_resource
    end

    resource KgEdu.Knowledge.Relation do
      rpc_action :list_relations, :read
      rpc_action :create_relation, :create
      rpc_action :destroy_relation, :destroy
      rpc_action :get_knowledge_relation, :by_id
    end

    resource KgEdu.Knowledge.RelationType do
      rpc_action :list_relation_types, :read
      rpc_action :create_relation_type, :create
      rpc_action :destroy_relation_type, :destroy
      rpc_action :get_relation_type, :by_id
    end

    resource KgEdu.Knowledge.Exercise do
      rpc_action :list_exercises, :read
      rpc_action :create_exercise, :create
      rpc_action :destroy_exercise, :destroy
      rpc_action :get_exercise, :by_id
    end
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
      # Exercise endpoints
      base_route "/exercises", KgEdu.Knowledge.Exercise do
        get :read, route: "/"
        index :by_knowledge, route: "/knowledge/:knowledge_resource_id"
        index :by_course, route: "/course/:course_id"
        post :create, route: "/"
        patch :update, route: "/:id"
        delete :destroy, route: "/:id"
      end
    end
  end

  resources do
    resource KgEdu.Knowledge.Resource
    resource KgEdu.Knowledge.Relation
    resource KgEdu.Knowledge.RelationType
    resource KgEdu.Knowledge.Exercise
  end
end

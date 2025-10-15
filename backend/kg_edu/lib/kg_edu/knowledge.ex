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
      rpc_action :import_knowledge_from_excel, :import_from_excel
      # rpc_action :get_resource, :get_resource
    end

    resource KgEdu.Knowledge.Relation do
      rpc_action :list_relations, :read
      rpc_action :create_relation, :create
      rpc_action :destroy_relation, :destroy
      rpc_action :get_knowledge_relation, :by_id
      rpc_action :import_relations_from_excel, :import_relations_from_excel
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
      rpc_action :generate_ai_exercise, :generate_ai_exercise
      rpc_action :get_recent_ai_exercises, :recent_ai_exercises
      rpc_action :link_exercise_to_knowledge, :link_exercise_to_knowledge
      rpc_action :unlink_exercise_from_knowledge, :unlink_exercise_from_knowledge
    end

    resource KgEdu.Knowledge.Question do
      rpc_action :list_questions, :read
      rpc_action :create_question, :create
      rpc_action :destroy_question, :destroy
      rpc_action :get_question, :by_id
      rpc_action :list_global_questions, :list_global_questions
      rpc_action :list_concept_questions, :list_concept_questions
      rpc_action :list_method_questions, :list_method_questions
      rpc_action :get_question_flow, :get_question_flow
    end

    resource KgEdu.Knowledge.QuestionConnection do
      rpc_action :list_connections, :read
      rpc_action :create_connection, :create_connection
      rpc_action :destroy_connection, :destroy
      rpc_action :get_connection, :by_id
      rpc_action :get_connections_by_source, :by_source
      rpc_action :get_connections_by_target, :by_target
      rpc_action :get_course_connections, :by_course
    end

    resource KgEdu.Knowledge.Homework do
      rpc_action :list_homeworks, :read
      rpc_action :create_homework, :create
      rpc_action :destroy_homework, :destroy
      rpc_action :get_homework, :by_id
      rpc_action :list_homeworks_by_course, :by_course
      rpc_action :list_homeworks_by_chapter, :by_chapter
      rpc_action :list_homeworks_by_knowledge_resource, :by_knowledge_resource
      rpc_action :list_homeworks_by_creator, :by_creator
      rpc_action :link_homework_to_knowledge, :link_homework_to_knowledge
      rpc_action :unlink_homework_from_knowledge, :unlink_homework_from_knowledge
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
        index :recent_ai_exercises, route: "/ai/recent"
        post :create, route: "/"
        post :generate_ai_exercise, route: "/ai/generate"
        patch :update, route: "/:id"
        delete :destroy, route: "/:id"
      end

      # Question endpoints
      base_route "/questions", KgEdu.Knowledge.Question do
        get :read, route: "/"
        index :list_global_questions, route: "/global"
        index :list_concept_questions, route: "/concept"
        index :list_method_questions, route: "/method"
        index :get_question_flow, route: "/flow/:course_id"
        post :create, route: "/"
        patch :update_question, route: "/:id"
        delete :destroy, route: "/:id"
      end

      # Question connection endpoints
      base_route "/question-connections", KgEdu.Knowledge.QuestionConnection do
        get :read, route: "/"
        index :by_source, route: "/source/:source_question_id"
        index :by_target, route: "/target/:target_question_id"
        index :by_course, route: "/course/:course_id"
        post :create_connection, route: "/"
        patch :update, route: "/:id"
        delete :destroy, route: "/:id"
      end

      # Homework endpoints
      base_route "/homeworks", KgEdu.Knowledge.Homework do
        get :read, route: "/"
        index :by_course, route: "/course/:course_id"
        index :by_chapter, route: "/chapter/:chapter_id"
        index :by_knowledge_resource, route: "/knowledge/:knowledge_resource_id"
        index :by_creator, route: "/creator/:created_by_id"
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
    resource KgEdu.Knowledge.Question
    resource KgEdu.Knowledge.QuestionConnection
    resource KgEdu.Knowledge.Homework
  end
end

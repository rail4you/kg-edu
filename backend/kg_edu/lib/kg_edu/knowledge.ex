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
      rpc_action :update_resource, :update_knowledge_resource
      rpc_action :destroy_resource, :destroy
      rpc_action :bulk_destory_knowledges, :bulk_destory_knowledges
      rpc_action :delete_all_knowledges_by_course, :delete_all_knowledges_by_course
      rpc_action :import_knowledge_from_excel, :import_from_excel
      rpc_action :import_knowledge_from_llm, :import_from_llm
      # rpc_action :get_resource, :get_resource
    end

    resource KgEdu.Knowledge.Relation do
      rpc_action :list_relations, :read
      rpc_action :create_relation, :create
      rpc_action :destroy_relation, :destroy
      rpc_action :update_relation, :update_knowledge_relation
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
      rpc_action :update_exercise, :update_exercise
      rpc_action :generate_ai_exercise, :generate_ai_exercise
      rpc_action :get_recent_ai_exercises, :recent_ai_exercises
      rpc_action :link_exercise_to_knowledge, :link_exercise_to_knowledge
      rpc_action :unlink_exercise_from_knowledge, :unlink_exercise_from_knowledge
      rpc_action :import_exercises_from_excel, :import_exercises_from_excel
      rpc_action :export_exercise_template, :export_exercise_template
    end

    resource KgEdu.Knowledge.Question do
      rpc_action :list_questions, :read
      rpc_action :create_question, :create
      rpc_action :destroy_question, :destroy
      rpc_action :update_question, :update_question
      rpc_action :get_question, :by_id
      rpc_action :list_global_questions, :list_global_questions
      rpc_action :list_concept_questions, :list_concept_questions
      rpc_action :list_method_questions, :list_method_questions
      rpc_action :get_question_flow, :get_question_flow
      rpc_action :import_questions_from_xlsx, :import_questions_from_xlsx
      rpc_action :export_question_template, :export_question_template
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
      rpc_action :update_homework, :update_homework
      rpc_action :get_homework, :by_id
      # rpc_action :list_homeworks_by_course, :by_course
      # rpc_action :list_homeworks_by_chapter, :by_chapter
      # rpc_action :list_homeworks_by_knowledge_resource, :by_knowledge_resource
      # rpc_action :list_homeworks_by_creator, :by_creator
      rpc_action :link_homework_to_knowledge, :link_homework_to_knowledge
      rpc_action :unlink_homework_from_knowledge, :unlink_homework_from_knowledge
      rpc_action :import_homework_from_xlsx, :import_homework_from_xlsx
      rpc_action :export_homework_template, :export_homework_template
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

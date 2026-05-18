defmodule KgEdu.Knowledge do
  use Ash.Domain,
    otp_app: :kg_edu,
    extensions: [AshAdmin.Domain, AshJsonApi.Domain, AshPhoenix, AshTypescript.Rpc, AshAi]

  admin do
    show?(true)
  end

  typescript_rpc do
    resource KgEdu.Knowledge.Resource do
      rpc_action(:list_subjects, :list_subjects)
      rpc_action(:list_knowledges, :read)
      rpc_action(:create_resource, :create)
      rpc_action(:get_subject_with_units, :get_subject_with_units)
      rpc_action(:get_full_hierarchy, :get_full_hierarchy)
      rpc_action(:update_resource, :update_knowledge_resource)
      rpc_action(:destroy_resource, :destroy)
      rpc_action(:bulk_destroy_knowledges, :bulk_destroy_knowledges)
      rpc_action(:bulk_update_importance_level, :bulk_update_importance_level)
      rpc_action(:delete_all_knowledges_by_course, :delete_all_knowledges_by_course)
      rpc_action(:import_knowledge_from_excel, :import_from_excel)
      rpc_action(:import_knowledge_from_llm, :import_from_llm)
      rpc_action(:import_knowledge_from_opml, :import_from_opml)
      rpc_action(:get_knowledge_resources_by_name_and_importance, :by_name_and_importance)
      rpc_action(:get_course_learning_stats_by_student, :get_course_learning_stats_by_student)
      rpc_action(:add_tag_to_knowledge, :add_tag)
      rpc_action(:remove_tag_from_knowledge, :remove_tag)
      rpc_action(:regenerate_sort_paths, :regenerate_sort_paths)
      rpc_action(:reorder_knowledge_resource, :reorder)
    end

    resource KgEdu.Knowledge.Relation do
      rpc_action(:list_relations, :list)
      rpc_action(:create_relation, :create)
      rpc_action(:destroy_relation, :destroy)
      rpc_action(:update_relation, :update_knowledge_relation)
      rpc_action(:get_knowledge_relation, :by_id)
      rpc_action(:import_relations_from_excel, :import_relations_from_excel)
    end

    resource KgEdu.Knowledge.RelationType do
      rpc_action(:list_relation_types, :read)
      rpc_action(:create_relation_type, :create)
      rpc_action(:destroy_relation_type, :destroy)
      rpc_action(:get_relation_type, :by_id)
    end

    resource KgEdu.Knowledge.Exercise do
      rpc_action(:list_exercises, :read)
      rpc_action(:get_exercises_by_course, :by_course)
      rpc_action(:create_exercise, :create)
      rpc_action(:destroy_exercises, :destroy)
      rpc_action(:get_exercise, :by_id)
      rpc_action(:update_exercise, :update_exercise)
      rpc_action(:generate_ai_exercise, :generate_ai_exercise)
      rpc_action(:get_recent_ai_exercises, :recent_ai_exercises)
      rpc_action(:link_exercise_to_knowledge, :link_exercise_to_knowledge)
      rpc_action(:unlink_exercise_from_knowledge, :unlink_exercise_from_knowledge)
      rpc_action(:import_exercises_from_excel, :import_exercises_from_excel)
      rpc_action(:export_exercise_template, :export_exercise_template)
      rpc_action(:move_exercise_up, :move_up)
      rpc_action(:move_exercise_down, :move_down)
    end

    resource KgEdu.Knowledge.Question do
      rpc_action(:list_questions, :read)
      rpc_action(:create_question, :create)
      rpc_action(:destroy_question, :destroy)
      rpc_action(:update_question, :update_question)
      rpc_action(:get_question, :by_id)
      rpc_action(:list_global_questions, :list_global_questions)
      rpc_action(:list_concept_questions, :list_concept_questions)
      rpc_action(:list_method_questions, :list_method_questions)
      rpc_action(:get_question_flow, :get_question_flow)
      rpc_action(:get_questions_by_knowledge, :by_knowledge_resource)
      rpc_action(:link_question_to_knowledge, :link_question_to_knowledge)
      rpc_action(:unlink_question_from_knowledge, :unlink_question_from_knowledge)
      rpc_action(:import_questions_from_xlsx, :import_questions_from_xlsx)
      rpc_action(:export_question_template, :export_question_template)
      rpc_action(:bulk_destroy_questions, :bulk_destroy_questions)
      rpc_action(:move_question_up, :move_up)
      rpc_action(:move_question_down, :move_down)
    end

    resource KgEdu.Knowledge.QuestionConnection do
      rpc_action(:list_connections, :read)
      rpc_action(:create_connection, :create_connection)
      rpc_action(:destroy_connection, :destroy)
      rpc_action(:get_connection, :by_id)
      rpc_action(:get_connections_by_source, :by_source)
      rpc_action(:get_connections_by_target, :by_target)
      rpc_action(:get_course_connections, :by_course)
    end

    resource KgEdu.Knowledge.Homework do
      rpc_action(:list_homeworks, :read)
      rpc_action(:create_homework, :create)
      rpc_action(:destroy_homework, :destroy)
      rpc_action(:get_homework, :by_id)
      rpc_action(:update_homework, :update_homework)
      rpc_action(:link_homework_to_knowledge, :link_homework_to_knowledge)
      rpc_action(:unlink_homework_from_knowledge, :unlink_homework_from_knowledge)
      rpc_action(:import_homework_from_xlsx, :import_homework_from_xlsx)
      rpc_action(:export_homework_template, :export_homework_template)
      rpc_action(:move_homework_up, :move_up)
      rpc_action(:move_homework_down, :move_down)
      rpc_action(:bulk_destroy_homeworks, :bulk_destroy)
    end

    resource KgEdu.Knowledge.KnowledgePointCognitive do
      rpc_action(:list_knowledge_point_cognitives, :read)
      rpc_action(:create_knowledge_point_cognitive, :create)
      rpc_action(:destroy_knowledge_point_cognitive, :destroy)
      rpc_action(:update_knowledge_point_cognitive, :update)
      rpc_action(:get_knowledge_point_cognitive, :by_id)
      rpc_action(:get_cognitives_by_knowledge_point, :by_knowledge_point)

      rpc_action(
        :get_knowledge_point_cognitive_by_knowledge_cid_and_level,
        :get_knowledge_point_cognitive_by_knowledge_cid_and_level
      )

      rpc_action(:get_cognitives_by_level, :by_level)
      rpc_action(:get_cognitives_by_course, :by_course)
    end

    resource KgEdu.Knowledge.MainAbility do
      rpc_action(:list_main_abilities, :read)
      rpc_action(:create_main_ability, :create)
      rpc_action(:update_main_ability, :update)
      rpc_action(:destroy_main_ability, :destroy)
      rpc_action(:get_main_ability, :read)
      rpc_action(:get_main_abilities_by_course, :by_course)
      rpc_action(:get_main_ability_by_name, :by_name)
    end

    resource KgEdu.Knowledge.SubAbility do
      rpc_action(:list_sub_abilities, :read)
      rpc_action(:create_sub_ability, :create)
      rpc_action(:update_sub_ability, :update)
      rpc_action(:destroy_sub_ability, :destroy)
      rpc_action(:get_sub_ability, :read)
      rpc_action(:get_sub_abilities_by_main_ability, :by_main_ability)
      rpc_action(:get_sub_ability_by_name, :by_name)
    end

    resource KgEdu.Knowledge.SubAbilityKnowledgeResource do
      rpc_action(:create_join, :create)
      rpc_action(:destroy_join, :destroy)
      rpc_action(:get_joins_by_sub_ability, :by_sub_ability)
      rpc_action(:get_joins_by_knowledge_resource, :by_knowledge_resource)
    end

    resource KgEdu.Knowledge.UserCase do
      rpc_action(:list_user_cases, :read)
      rpc_action(:create_user_case, :create)
      rpc_action(:update_user_case, :update)
      rpc_action(:destroy_user_case, :destroy)
      rpc_action(:get_user_case, :read)
      rpc_action(:get_user_cases_by_knowledge_resource, :by_knowledge_resource)
    end

    resource KgEdu.Knowledge.Exam do
      rpc_action(:list_exams, :read)
      rpc_action(:create_exam, :create)
      rpc_action(:update_exam, :update)
      rpc_action(:destroy_exam, :destroy)
      rpc_action(:get_exam, :by_id)
      rpc_action(:get_exams_by_course, :by_course)
      rpc_action(:get_exams_by_creator, :by_creator)
      rpc_action(:add_exercise_to_exam, :add_exercise)
      rpc_action(:remove_exercise_from_exam, :remove_exercise)
    end

    resource KgEdu.Knowledge.ExamExercise do
      rpc_action(:list_exam_exercises, :read)
      rpc_action(:create_exam_exercise, :create)
      rpc_action(:update_exam_exercise, :update)
      rpc_action(:destroy_exam_exercise, :destroy)
      rpc_action(:get_exam_exercise, :by_id)
      rpc_action(:get_exercises_by_exam, :by_exam)
    end

    resource KgEdu.Knowledge.StudentExam do
      rpc_action(:list_student_exams, :read)
      rpc_action(:get_student_exam, :by_id)
      rpc_action(:get_student_exams_by_exam, :by_exam)
      rpc_action(:get_student_exams_by_student, :by_student)
      rpc_action(:start_exam, :start_exam)
      rpc_action(:continue_or_start_exam, :continue_or_start_exam)
      rpc_action(:get_in_progress_exam, :get_in_progress_exam)
      rpc_action(:submit_exam, :submit_exam)
      rpc_action(:grade_exam, :grade_exam)
    end

    resource KgEdu.Knowledge.StudentExamAnswer do
      rpc_action(:list_student_exam_answers, :read)
      rpc_action(:get_student_exam_answer, :by_id)
      rpc_action(:get_answers_by_student_exam, :by_student_exam)
      rpc_action(:grade_answer, :grade_answer)
    end

    # Recommendation System Resources
    resource KgEdu.Knowledge.StudentKnowledgeMastery do
      rpc_action(:list_masteries, :read)
      rpc_action(:get_mastery, :by_id)
      rpc_action(:get_student_mastery_for_knowledge, :by_student_and_knowledge)
      rpc_action(:get_all_student_masteries, :by_student)
      rpc_action(:get_weak_knowledge_points, :get_weak_points)
      rpc_action(:recalculate_mastery, :recalculate_mastery)
      rpc_action(:get_class_weakness, :class_weakness)
      rpc_action(:get_student_profile_overview, :get_student_profile_overview)
      rpc_action(:get_knowledge_radar, :get_knowledge_radar)
      rpc_action(:get_learning_trend, :get_learning_trend)
      rpc_action(:get_weak_knowledge_points_profile, :get_weak_knowledge_points)
      rpc_action(:get_activity_distribution, :get_activity_distribution)
      rpc_action(:get_ability_assessment, :get_ability_assessment)
      rpc_action(:get_group_task_stats, :get_group_task_stats)
    end

    resource KgEdu.Knowledge.LearningRecommendation do
      rpc_action(:list_recommendations, :read)
      rpc_action(:get_recommendation, :by_id)
      rpc_action(:get_student_recommendations, :get_student_recommendations_rpc)
      rpc_action(:generate_recommendations, :generate_for_student)
      rpc_action(:get_student_recommendations_rpc, :get_student_recommendations_rpc)
      rpc_action(:get_learning_progress_summary_rpc, :get_learning_progress_summary_rpc)
      rpc_action(:mark_as_viewed, :mark_viewed)
      rpc_action(:mark_as_completed, :mark_completed)
      rpc_action(:dismiss_recommendation, :dismiss)
    end

    # Experiment Resources
    resource KgEdu.Knowledge.Experiment do
      rpc_action(:list_experiments, :read)
      rpc_action(:create_experiment, :create)
      rpc_action(:update_experiment, :update)
      rpc_action(:destroy_experiment, :destroy)
      rpc_action(:get_experiment, :read)
      rpc_action(:get_experiments_by_course, :by_course)
      rpc_action(:get_experiments_by_chapter, :by_chapter)
      rpc_action(:get_experiments_by_creator, :by_creator)
      rpc_action(:get_published_experiments, :published)
      rpc_action(:add_knowledge_resource_to_experiment, :add_knowledge_resource)
      rpc_action(:remove_knowledge_resource_from_experiment, :remove_knowledge_resource)
      rpc_action(:add_ability_to_experiment, :add_ability)
      rpc_action(:remove_ability_from_experiment, :remove_ability)
      rpc_action(:update_experiment_guide_file, :update_guide_file)
    end

    resource KgEdu.Knowledge.ExperimentKnowledgeResource do
      rpc_action(:list_experiment_knowledge_resources, :read)
      rpc_action(:create_experiment_knowledge_resource, :create)
      rpc_action(:destroy_experiment_knowledge_resource, :destroy)
      rpc_action(:get_experiment_knowledge_resource, :read)
      rpc_action(:get_by_experiment_and_resource, :by_experiment_and_resource)
    end

    resource KgEdu.Knowledge.ExperimentAbility do
      rpc_action(:list_experiment_abilities, :read)
      rpc_action(:create_experiment_ability, :create)
      rpc_action(:destroy_experiment_ability, :destroy)
      rpc_action(:get_experiment_ability, :read)
      rpc_action(:get_abilities_by_experiment, :by_experiment)
    end
  end

  resources do
    resource(KgEdu.Knowledge.Resource)
    resource(KgEdu.Knowledge.Relation)
    resource(KgEdu.Knowledge.RelationType)
    resource(KgEdu.Knowledge.Exercise)
    resource(KgEdu.Knowledge.Question)
    resource(KgEdu.Knowledge.QuestionConnection)
    resource(KgEdu.Knowledge.Homework)
    resource(KgEdu.Knowledge.KnowledgePointCognitive)
    resource(KgEdu.Knowledge.MainAbility)
    resource(KgEdu.Knowledge.SubAbility)
    resource(KgEdu.Knowledge.SubAbilityKnowledgeResource)
    resource(KgEdu.Knowledge.UserCase)
    resource(KgEdu.Knowledge.Exam)
    resource(KgEdu.Knowledge.ExamExercise)
    resource(KgEdu.Knowledge.StudentExam)
    resource(KgEdu.Knowledge.StudentExamAnswer)
    resource(KgEdu.Knowledge.StudentKnowledgeMastery)
    resource(KgEdu.Knowledge.LearningRecommendation)
    resource(KgEdu.Knowledge.Experiment)
    resource(KgEdu.Knowledge.ExperimentKnowledgeResource)
    resource(KgEdu.Knowledge.ExperimentAbility)
  end
end

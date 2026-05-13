defmodule KgEdu.GroupTask do
  @moduledoc """
  Domain for managing student groups and group tasks.
  分组任务管理域：学习小组创建、任务分配、进度追踪。
  """
  use Ash.Domain,
    otp_app: :kg_edu,
    extensions: [AshAdmin.Domain, AshJsonApi.Domain, AshPhoenix, AshTypescript.Rpc]

  admin do
    show? true
  end

  json_api do
    routes do
      base_route "/groups", KgEdu.GroupTask.Group do
        get :read, route: "/"
        index :by_course, route: "/course/:course_id"
        post :create, route: "/"
        patch :update_group, route: "/:id"
        delete :destroy, route: "/:id"
        patch :add_members, route: "/:id/add-members"
        patch :remove_member, route: "/:id/remove-member"
        get :by_id, route: "/:id"
      end

      base_route "/group-tasks", KgEdu.GroupTask.Task do
        get :read, route: "/"
        index :by_course, route: "/course/:course_id"
        index :by_status, route: "/status/:status"
        get :by_token, route: "/token/:token"
        post :create, route: "/"
        patch :update_task, route: "/:id"
        patch :publish, route: "/:id/publish"
        patch :close, route: "/:id/close"
        delete :destroy, route: "/:id"
        get :get_progress, route: "/:id/progress"
        get :by_id, route: "/:id"
      end

      base_route "/task-submissions", KgEdu.GroupTask.TaskSubmission do
        get :read, route: "/"
        index :by_task, route: "/task/:task_id"
        index :by_task_and_group, route: "/task/:task_id/group/:group_id"
        post :submit, route: "/"
        patch :grade, route: "/:id/grade"
        get :get_submission_stats, route: "/task/:task_id/stats"
        get :by_id, route: "/:id"
      end
    end
  end

  typescript_rpc do
    resource KgEdu.GroupTask.Group do
      rpc_action :list_groups, :read
      rpc_action :get_groups_by_course, :by_course
      rpc_action :create_group, :create
      rpc_action :update_group, :update_group
      rpc_action :delete_group, :destroy
      rpc_action :add_members, :add_members
      rpc_action :remove_member, :remove_member
      rpc_action :random_grouping, :random_grouping
      rpc_action :get_group, :by_id
    end

    resource KgEdu.GroupTask.Task do
      rpc_action :list_tasks, :read
      rpc_action :get_tasks_by_course, :by_course
      rpc_action :get_tasks_by_status, :by_status
      rpc_action :get_task_by_token, :by_token
      rpc_action :create_task, :create
      rpc_action :update_task, :update_task
      rpc_action :publish_task, :publish
      rpc_action :close_task, :close
      rpc_action :delete_task, :destroy
      rpc_action :get_task_progress, :get_progress
      rpc_action :get_task, :by_id
    end

    resource KgEdu.GroupTask.TaskSubmission do
      rpc_action :list_submissions, :read
      rpc_action :get_submissions_by_task, :by_task
      rpc_action :get_submissions_by_task_and_group, :by_task_and_group
      rpc_action :submit_task, :submit
      rpc_action :grade_submission, :grade
      rpc_action :get_submission_stats, :get_submission_stats
      rpc_action :get_submission, :by_id
    end
  end

  resources do
    resource KgEdu.GroupTask.Group
    resource KgEdu.GroupTask.GroupMember
    resource KgEdu.GroupTask.TaskGroup
    resource KgEdu.GroupTask.Task
    resource KgEdu.GroupTask.TaskSubmission
  end
end

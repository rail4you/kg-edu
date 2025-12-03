defmodule KgEdu.Activity do
  use Ash.Domain,
    otp_app: :kg_edu,
    extensions: [AshAdmin.Domain, AshJsonApi.Domain, AshPhoenix, AshTypescript.Rpc]

  admin do
    show? true
  end

  typescript_rpc do
    resource KgEdu.Activity.ActivityLog do
      rpc_action :log_file_view, :log_file_view
      rpc_action :log_video_view, :log_video_view
      rpc_action :log_exercise_submit, :log_exercise_submit
      rpc_action :log_homework_submit, :log_homework_submit
      rpc_action :list_activity_logs, :read
      rpc_action :get_activity_log, :by_id
      rpc_action :list_activity_logs_by_user, :by_user
      rpc_action :list_activity_logs_by_action_type, :by_action_type
      rpc_action :list_activity_logs_by_resource_type, :by_resource_type
      rpc_action :list_activity_logs_by_time_range, :by_time_range
      rpc_action :get_view_count_distribution, :view_count_distribution
    end
  end

  json_api do
    routes do
      base_route "/activity-logs", KgEdu.Activity.ActivityLog do
        get :read, route: "/"
        index :by_user, route: "/user/:user_id"
        index :by_action_type, route: "/action/:action_type"
        index :by_resource_type, route: "/resource/:resource_type"
        index :by_time_range, route: "/time-range"
        get :view_count_distribution, route: "/distribution/views"
        post :log_file_view, route: "/file-view"
        post :log_video_view, route: "/video-view"
        post :log_exercise_submit, route: "/exercise-submit"
        post :log_homework_submit, route: "/homework-submit"
        get :by_id, route: "/:id"
      end
    end
  end

  resources do
    resource KgEdu.Activity.ActivityLog
  end
end
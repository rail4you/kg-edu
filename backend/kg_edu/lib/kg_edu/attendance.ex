defmodule KgEdu.Attendance do
  @moduledoc """
  Domain for managing attendance and check-in functionality.
  """
  use Ash.Domain,
    otp_app: :kg_edu,
    extensions: [AshAdmin.Domain, AshJsonApi.Domain, AshPhoenix, AshTypescript.Rpc]

  admin do
    show? true
  end

  typescript_rpc do
    resource KgEdu.Attendance.CheckInSession do
      rpc_action :create_session, :create
      rpc_action :close_session, :close
      rpc_action :get_active_sessions, :active_sessions
      rpc_action :get_session_by_token, :by_token
      rpc_action :list_sessions, :read
      rpc_action :get_session, :by_id
    end

    resource KgEdu.Attendance.CheckInRecord do
      rpc_action :check_in, :check_in
      rpc_action :get_records_by_session, :by_session
      rpc_action :get_records_by_user, :by_user
      rpc_action :list_records, :read
      rpc_action :get_record, :by_id
    end
  end

  json_api do
    routes do
      base_route "/check-in-sessions", KgEdu.Attendance.CheckInSession do
        get :read, route: "/"
        index :active_sessions, route: "/active"
        get :by_token, route: "/token/:token"
        post :create, route: "/"
        patch :close, route: "/:id/close"
        get :by_id, route: "/:id"
      end

      base_route "/check-in-records", KgEdu.Attendance.CheckInRecord do
        get :read, route: "/"
        index :by_session, route: "/session/:session_id"
        index :by_user, route: "/user/:user_id"
        post :check_in, route: "/"
        get :by_id, route: "/:id"
      end
    end
  end

  resources do
    resource KgEdu.Attendance.CheckInSession
    resource KgEdu.Attendance.CheckInRecord
  end
end

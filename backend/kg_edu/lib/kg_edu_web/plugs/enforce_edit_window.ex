defmodule KgEduWeb.Plugs.EnforceEditWindow do
  @moduledoc """
  教师编辑权限（使用期限）强制拦截。

  - `authorize_rpc/2`：供 `/rpc/run`、`/rpc/validate` controller 在解析 action 后，
    按动作类型（create/update/destroy）或动作名（通用 :action 写类）拦截写操作。
  - `call/2`：作为 Plug 挂载在 `/api/json` scope，对只读教师按 HTTP 写方法拦截。

  只读教师仍可正常登录与读取，仅写操作被拒绝，响应为：
  RPC：HTTP 200 + `%{success: false, errors: [...]}`（避免触发前端 403 登出逻辑）
  JSON API / 控制器：HTTP 403 + `%{code: "edit_locked", ...}`
  """

  import Plug.Conn

  alias KgEdu.Accounts.EditPermission

  @write_methods ["POST", "PATCH", "PUT", "DELETE"]

  # 通用(:action)动作中属于"会话/认证/纯读取"类、必须放行的动作名。
  # 除名单之外的所有通用动作，锁定教师一律拦截（默认拒绝，更安全）。
  @rpc_generic_allow_actions MapSet.new(~w(
    sign_in_tenant refresh_session super_admin_sign_in sign_out
    change_password_direct
    list_organization_backups check_tenant_health get_migration_status
    get_backup_statistics get_organization_summary get_all_organization_summary
    calculate_course_statistics course_overview get_dashboard_stats
    get_course_learning_stats_by_student export_exercise_template
    export_question_template export_homework_template
    get_student_profile_overview get_knowledge_radar get_learning_trend
    get_weak_knowledge_points_profile get_activity_distribution
    get_ability_assessment get_group_task_stats get_student_recommendations
    get_student_recommendations_rpc get_learning_progress_summary_rpc
    list_mm_homework_submissions_by_course
  ))

  @impl Plug
  def init(opts), do: opts

  @impl Plug
  def call(conn, _opts) do
    case EditPermission.status(actor(conn)) do
      {:locked, reason} when conn.method in @write_methods ->
        conn
        |> put_resp_content_type("application/json")
        |> send_resp(
          403,
          Jason.encode!(%{
            code: "edit_locked",
            success: false,
            message: EditPermission.message(reason)
          })
        )
        |> halt()

      _ ->
        conn
    end
  end

  @doc """
  判断 RPC 动作是否为写操作（只读教师需拦截）。

  解析方式与 `AshTypescript.Rpc.Pipeline` 一致（基于全域 RPC action 注册表）。
  """
  @spec rpc_write_action?(String.t()) :: boolean()
  def rpc_write_action?(action_name) when is_binary(action_name) do
    case resolve_action(action_name) do
      {:ok, action} ->
        case action.type do
          type when type in [:create, :update, :destroy] -> true
          :action -> not MapSet.member?(@rpc_generic_allow_actions, action_name)
          _ -> false
        end

      :error ->
        # 未知动作：放行，交由 RPC 管线返回标准错误
        false
    end
  end

  @doc """
  `/rpc/run` 与 `/rpc/validate` 的写拦截入口。

  返回 `:ok` 或 `{:error, message}`。只读教师执行写动作时返回错误，否则放行。
  """
  @spec authorize_rpc(Plug.Conn.t(), map()) :: :ok | {:error, String.t()}
  def authorize_rpc(conn, params) do
    case EditPermission.status(actor(conn)) do
      {:locked, reason} ->
        action_name = params["action"]

        if is_binary(action_name) and rpc_write_action?(action_name) do
          {:error, EditPermission.message(reason)}
        else
          :ok
        end

      _ ->
        :ok
    end
  end

  defp actor(conn) do
    conn.private[:ash_actor] || Ash.PlugHelpers.get_actor(conn)
  end

  defp resolve_action(action_name) do
    :kg_edu
    |> Ash.Info.domains()
    |> Enum.flat_map(&AshTypescript.Rpc.Info.typescript_rpc/1)
    |> Enum.find_value(:error, fn %{resource: resource, rpc_actions: rpc_actions} ->
      Enum.find_value(rpc_actions, fn rpc_action ->
        if to_string(rpc_action.name) == action_name do
          {:ok, Ash.Resource.Info.action(resource, rpc_action.action)}
        end
      end)
    end)
  end
end

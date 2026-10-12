defmodule KgEduWeb.Plugs.AuthorizeRpc do
  @moduledoc """
  RPC 层服务端鉴权（与前端路由守卫互补，防止绕过界面直接调用接口）。

  规则（默认要求登录）：
    1. 管理端专属动作 → 仅 admin / super_admin；
    2. 公开动作（游客可访问的首页/课程/微专业/登录等）→ 放行；
    3. 其余动作 → 必须已登录（actor 存在），否则拒绝。

  拒绝时沿用 AshTypescript RPC 的约定：HTTP 200 + `success: false`，
  避免被前端 401/403 拦截器误判为登录失效而登出。
  """
  import Plug.Conn
  import Phoenix.Controller, only: [json: 2]

  @admin_actions MapSet.new(~w(
    create_user delete_user admin_change_user_password
    bulk_update_edit_permission import_users_from_excel
    create_class update_class delete_class create_class_with_students
    create_organization_with_migrations update_organization delete_organization
    create_report_template delete_report_template list_report_templates
  ))

  # 游客可访问的动作（公开页面 + 登录/注册/找回密码）
  @public_actions MapSet.new(~w(
    sign_in_tenant sign_in_with_password register_with_password
    request_password_reset_token reset_password_with_token sign_in_with_token
    get_all_courses get_user
    list_courses list_courses_by_micro_major list_enrollments
    list_micro_major_enrollments list_micro_majors list_organizations
    my_applications my_certificates my_micro_major_enrollments
    list_course_categories list_course_category_items
    get_branding_config get_site_content get_portal_config
    list_portal_levels list_template_pages get_template_page
  ))

  def init(opts), do: opts

  def call(conn, _opts) do
    action = conn.params["action"]
    actor = Ash.PlugHelpers.get_actor(conn)

    cond do
      MapSet.member?(@admin_actions, action) and not admin?(actor) ->
        deny(conn, "无权限执行该管理操作（需要管理员角色）")

      MapSet.member?(@public_actions, action) ->
        conn

      is_nil(actor) ->
        deny(conn, "请先登录后再操作")

      true ->
        conn
    end
  end

  defp deny(conn, message) do
    conn
    |> json(%{success: false, errors: [%{type: "forbidden", message: message}]})
    |> halt()
  end

  defp admin?(%{role: role}), do: role in [:admin, :super_admin]
  defp admin?(_), do: false
end

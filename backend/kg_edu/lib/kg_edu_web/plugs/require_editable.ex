defmodule KgEduWeb.Plugs.RequireEditable do
  @moduledoc """
  要求当前 actor 具备教师编辑权限（用于写类控制器）。

  只读教师（编辑权限被限制）访问时返回 403 + `%{code: "edit_locked", ...}`，
  供前端拦截器识别并提示，而不会误判为鉴权失败。
  """

  import Plug.Conn

  alias KgEdu.Accounts.EditPermission

  @impl Plug
  def init(opts), do: opts

  @impl Plug
  def call(conn, _opts) do
    actor = conn.private[:ash_actor] || Ash.PlugHelpers.get_actor(conn)

    case EditPermission.ensure_editable!(actor) do
      :ok ->
        conn

      {:error, message} ->
        conn
        |> put_resp_content_type("application/json")
        |> send_resp(
          403,
          Jason.encode!(%{
            code: "edit_locked",
            success: false,
            message: message
          })
        )
        |> halt()
    end
  end
end

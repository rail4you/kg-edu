defmodule KgEduWeb.AshTypescriptRpcController do
  use KgEduWeb, :controller

  def run(conn, params) do
    with :ok <- KgEduWeb.Plugs.EnforceEditWindow.authorize_rpc(conn, params) do
      result = AshTypescript.Rpc.run_action(:kg_edu, conn, params)
      json(conn, result)
    else
      {:error, message} ->
        conn
        |> put_status(200)
        |> json(%{
          success: false,
          errors: [
            %{type: "forbidden", message: message, details: %{code: "edit_locked"}}
          ]
        })
    end
  end

  def validate(conn, params) do
    with :ok <- KgEduWeb.Plugs.EnforceEditWindow.authorize_rpc(conn, params) do
      result = AshTypescript.Rpc.validate_action(:kg_edu, conn, params)
      json(conn, result)
    else
      {:error, message} ->
        conn
        |> put_status(200)
        |> json(%{
          success: false,
          errors: [
            %{type: "forbidden", message: message, details: %{code: "edit_locked"}}
          ]
        })
    end
  end
end

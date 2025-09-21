defmodule KgEduWeb.AshTypescriptRpcController do
  use KgEduWeb, :controller

  def run(conn, params) do
    result = AshTypescript.Rpc.run_action(:kg_edu, conn, params)
    json(conn, result)
  end

  def validate(conn, params) do
    result = AshTypescript.Rpc.validate_action(:kg_edu, conn, params)
    json(conn, result)
  end
end

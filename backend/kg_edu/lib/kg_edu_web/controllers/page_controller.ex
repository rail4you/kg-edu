defmodule KgEduWeb.PageController do
  use KgEduWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end
end

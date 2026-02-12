defmodule KgEduWeb.OrganizationController do
  use KgEduWeb, :controller

  def get_summary(conn, %{"organization_id" => organization_id}) do
    case KgEdu.Accounts.Organization.get_organization_summary(%{organization_id: organization_id}) do
      {:ok, summary} ->
        json(conn, %{success: true, data: summary})

      {:error, reason} ->
        conn
        |> put_status(:bad_request)
        |> json(%{success: false, error: inspect(reason)})
    end
  end
end

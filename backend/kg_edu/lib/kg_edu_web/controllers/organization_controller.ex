defmodule KgEduWeb.OrganizationController do
  use KgEduWeb, :controller

  require Ash.Query

  alias KgEdu.OrganizationDataTransfer

  def get_summary(conn, %{"organization_id" => organization_id}) do
    case KgEdu.Accounts.Organization.get_organization_summary(organization_id) do
      {:ok, summary} ->
        json(conn, %{success: true, data: summary})

      {:error, reason} ->
        conn
        |> put_status(:bad_request)
        |> json(%{success: false, error: inspect(reason)})
    end
  end

  @doc """
  Export all tenant data as a downloadable pg_dump SQL file.
  POST /api/organizations/:id/export
  """
  def export(conn, %{"id" => org_id}) do
    case get_org_and_tenant(org_id) do
      {:ok, _org, tenant} ->
        case OrganizationDataTransfer.export(tenant) do
          {:ok, sql} ->
            date_str = Date.utc_today() |> Date.to_iso8601()
            filename = "kg_edu_export_#{tenant}_#{date_str}.sql"

            conn
            |> put_resp_header("content-type", "application/sql; charset=utf-8")
            |> put_resp_header(
              "content-disposition",
              ~s(attachment; filename="#{filename}")
            )
            |> send_resp(200, sql)

          {:error, reason} ->
            conn
            |> put_status(500)
            |> json(%{success: false, error: reason})
        end

      {:error, reason} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: reason})
    end
  end

  @doc """
  Import tenant data from an uploaded pg_dump SQL export file.
  POST /api/organizations/import
  Accepts multipart: file (.sql) + name (new org name).
  Uses pg_dump + sed + psql approach — atomic, FK-order-safe.
  """
  def import(conn, %{"name" => name} = params) do
    case Map.get(params, "file") do
      %Plug.Upload{} = upload ->
        case File.read(upload.path) do
          {:ok, body} ->
            # Validate the export file before proceeding
            with :ok <- OrganizationDataTransfer.validate_export_file(body),
                 {:ok, org} <- create_org_with_migrations(name),
                 {:ok, _org, tenant} <- get_org_and_tenant(org.id),
                 {:ok, _result} <- OrganizationDataTransfer.import(body, tenant) do
              json(conn, %{
                success: true,
                data: %{id: org.id, name: name, tenant: tenant},
                message: "数据导入成功"
              })
            else
              {:error, reason} ->
                conn
                |> put_status(500)
                |> json(%{success: false, error: "导入失败: #{inspect(reason)}"})
            end

          {:error, reason} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: "文件读取失败: #{reason}"})
        end

      _ ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "请上传导出的 .sql 文件"})
    end
  end

  # ── Helpers ────────────────────────────────────────────────────────

  defp get_org_and_tenant(org_id) do
    case KgEdu.Accounts.Organization
         |> Ash.Query.filter(id == ^org_id)
         |> Ash.read_one() do
      {:ok, org} -> {:ok, org, org.schema_name}
      _ -> {:error, "组织不存在"}
    end
  end

  defp create_org_with_migrations(name) do
    case KgEdu.AshMigrationManager.create_organization_with_migrations(name) do
      {:ok, %{organization: org}} -> {:ok, org}
      error -> error
    end
  end
end

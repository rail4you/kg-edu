defmodule KgEduWeb.SessionController do
  use KgEduWeb, :controller

  def find_tenants(conn, %{"memberId" => member_id, "password" => password}) when is_binary(member_id) and is_binary(password) do
    member_id_value = String.trim(member_id)

    tenants =
      KgEdu.Repo.all_tenants()
      |> Enum.flat_map(fn tenant_schema ->
        org =
          case KgEdu.Accounts.Organization |> Ash.read() do
            {:ok, orgs} -> Enum.find(orgs, &(&1.schema_name == tenant_schema))
            _ -> nil
          end

        case KgEdu.Accounts.User |> Ash.read(tenant: tenant_schema) do
          {:ok, users} ->
            user = Enum.find(users, fn u ->
              u.member_id == member_id_value || u.phone == member_id_value
            end)

            case user do
              nil ->
                []

              user ->
                if Bcrypt.verify_pass(password, user.hashed_password) do
                  [
                    %{
                      tenantId: org && org.id,
                      tenantName: org && org.name,
                      schemaName: tenant_schema
                    }
                  ]
                else
                  []
                end
            end

          _ ->
            []
        end
      end)

    if tenants == [] do
      json(conn, %{
        success: false,
        errors: [%{type: "authentication", message: "用户名或密码错误"}]
      })
    else
      json(conn, %{success: true, data: %{tenants: tenants}})
    end
  end

  def find_tenants(conn, %{"member_id" => member_id, "password" => password}) when is_binary(member_id) and is_binary(password) do
    find_tenants(conn, %{"memberId" => member_id, "password" => password})
  end

  def find_tenants(conn, _params) do
    json(conn, %{
      success: false,
      errors: [%{type: "validation", message: "请提供 memberId 和 password"}]
    })
  end
end

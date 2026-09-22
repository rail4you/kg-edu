defmodule KgEdu.AccountsFixtures do
  @moduledoc """
  Test fixtures for Accounts domain (previously missing — exercise tests import this).

  多租户说明：User 等资源按 PG schema 隔离，tenant 字符串即 schema 名。
  `test_tenant/0` 复用测试库中已 provision 的 organization schema（`mix test`
  前 `ash.setup` + 历史 seed 已建好）；全新空库时现场创建一个。
  """

  def test_tenant do
    case first_org_schema() do
      nil -> create_test_org!()
      schema -> schema
    end
  end

  def user_fixture(attrs \\ %{}) do
    attrs =
      Enum.into(attrs, %{
        member_id: "fixture_user_#{System.unique_integer([:positive])}",
        name: "Fixture User",
        password: "password123"
      })

    {:ok, user} = KgEdu.Accounts.create_user(attrs, tenant: test_tenant())
    user
  end

  defp first_org_schema do
    case Ecto.Adapters.SQL.query(
           KgEdu.Repo,
           "SELECT schema_name FROM organizations WHERE schema_name IS NOT NULL LIMIT 1",
           []
         ) do
      {:ok, %{rows: [[schema]]}} when is_binary(schema) -> schema
      _ -> nil
    end
  end

  defp create_test_org! do
    {:ok, %{"schemaName" => schema}} =
      KgEdu.Accounts.Organization
      |> Ash.Changeset.for_action(:create_with_migrations, %{
        name: "Test Org #{System.unique_integer([:positive])}"
      })
      |> Ash.run_action!(authorize?: false)

    schema
  end
end

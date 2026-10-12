defmodule KgEdu.Accounts.User.Changes.ProtectRole do
  @moduledoc """
  保护用户角色字段：仅 admin / super_admin 可修改 `role`。

  学生 / 教师通过 `:update` 等动作修改自己资料时，若提交了 role，
  会被强制还原为原值，防止自行提权（如把 role 改成 admin）。
  """

  use Ash.Resource.Change

  @managed_fields [:role]

  def change(changeset, _opts, context) do
    if can_manage_role?(context.actor) do
      changeset
    else
      Enum.reduce(@managed_fields, changeset, fn field, cs ->
        if Ash.Changeset.changing_attribute?(cs, field) do
          Ash.Changeset.change_attribute(cs, field, Map.get(cs.data, field))
        else
          cs
        end
      end)
    end
  end

  defp can_manage_role?(nil), do: false
  defp can_manage_role?(actor), do: actor.role in [:admin, :super_admin]
end

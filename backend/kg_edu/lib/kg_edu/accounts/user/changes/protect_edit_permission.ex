defmodule KgEdu.Accounts.User.Changes.ProtectEditPermission do
  @moduledoc """
  保护用户的编辑权限字段 (edit_enabled / edit_period_start / edit_period_end)。

  只有 super_admin 可以设置/修改这些字段：
  - 教师或其他角色通过 `:update` 动作修改自己资料时，这些字段会被强制还原为原值，
    防止教师自行开启或延长自己的编辑权限。
  - 非超级管理员通过 `:create_user` 创建用户时，这些字段会被重置为默认值
    （编辑权限开启、不限期限），防止普通管理员绕过限制配置使用时限。
  """

  use Ash.Resource.Change

  @edit_fields [:edit_enabled, :edit_period_start, :edit_period_end]

  def change(changeset, _opts, context) do
    if can_manage_edit_permission?(context.actor) do
      changeset
    else
      case changeset.action_type do
        :create ->
          changeset
          |> Ash.Changeset.force_change_attribute(:edit_enabled, true)
          |> Ash.Changeset.force_change_attribute(:edit_period_start, nil)
          |> Ash.Changeset.force_change_attribute(:edit_period_end, nil)

        _ ->
          Enum.reduce(@edit_fields, changeset, fn field, changeset ->
            if Ash.Changeset.changing_attribute?(changeset, field) do
              Ash.Changeset.change_attribute(changeset, field, Map.get(changeset.data, field))
            else
              changeset
            end
          end)
      end
    end
  end

  defp can_manage_edit_permission?(nil), do: false

  defp can_manage_edit_permission?(actor) do
    actor.role == :super_admin
  end
end
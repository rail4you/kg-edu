defmodule KgEdu.Accounts.EditPermission do
  @moduledoc """
  教师/管理员编辑权限（使用期限）判定引擎。

  仅对 `teacher` 与 `admin` 角色生效；超级管理员、学生、游客（无 actor）不受影响。

  ## 判定规则（以服务器日期为准）
  - actor 为 nil 或非 teacher/admin 角色 → `:not_applicable`（不拦截）
  - `edit_enabled == false` → `{:locked, :disabled}`（管理员已关闭）
  - 已设置 `edit_period_start` 且今天 < start → `{:locked, :not_started}`（未到开始时间）
  - 已设置 `edit_period_end` 且今天 > end → `{:locked, :expired}`（已到期）
  - 其余 → `:ok`（可编辑）
  """

  @restricted_roles [:teacher, :admin]

  @type locked_reason :: :disabled | :not_started | :expired
  @type status :: :ok | :not_applicable | {:locked, locked_reason}

  @readonly_messages %{
    disabled: "编辑权限已被管理员关闭，当前仅可查看",
    not_started: "编辑权限尚未到开始时间，当前仅可查看",
    expired: "编辑权限已到期，当前仅可查看"
  }

  @doc "返回用户的编辑权限状态。"
  @spec status(term(), Date.t()) :: status()
  def status(actor, today \\ Date.utc_today())

  def status(nil, _today), do: :not_applicable

  def status(actor, today) do
    if Map.get(actor, :role) not in @restricted_roles do
      :not_applicable
    else
      cond do
        Map.get(actor, :edit_enabled) == false ->
          {:locked, :disabled}

        not is_nil(Map.get(actor, :edit_period_start)) and
            Date.compare(today, Map.get(actor, :edit_period_start)) == :lt ->
          {:locked, :not_started}

        not is_nil(Map.get(actor, :edit_period_end)) and
            Date.compare(today, Map.get(actor, :edit_period_end)) == :gt ->
          {:locked, :expired}

        true ->
          :ok
      end
    end
  end

  @doc "是否处于只读状态（教师被锁定编辑权限）。"
  @spec readonly?(term(), Date.t()) :: boolean()
  def readonly?(actor, today \\ Date.utc_today()) do
    match?({:locked, _}, status(actor, today))
  end

  @doc "检查当前 actor 是否可执行写操作。返回 `:ok` 或 `{:error, message}`。"
  @spec ensure_editable!(term(), Date.t()) :: :ok | {:error, String.t()}
  def ensure_editable!(actor, today \\ Date.utc_today()) do
    case status(actor, today) do
      {:locked, reason} -> {:error, message(reason)}
      _ -> :ok
    end
  end

  @doc "返回某锁定原因对应的只读提示文案。"
  @spec message(locked_reason()) :: String.t()
  def message(reason), do: Map.fetch!(@readonly_messages, reason)
end

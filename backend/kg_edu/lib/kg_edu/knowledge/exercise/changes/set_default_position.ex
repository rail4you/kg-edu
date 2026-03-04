defmodule KgEdu.Knowledge.Exercise.Changes.SetDefaultPosition do
  @moduledoc """
  自动为新习题设置 position。
  如果没有指定 position，则设置为当前课程最大 position + 1。
  """

  use Ash.Resource.Change

  require Ash.Query

  @impl true
  def change(changeset, _opts, context) do
    # 如果已经设置了 position，直接返回
    if Ash.Changeset.get_attribute(changeset, :position) != nil do
      changeset
    else
      course_id = Ash.Changeset.get_attribute(changeset, :course_id)

      if course_id do
        max_position = get_max_position(course_id, context.tenant)
        Ash.Changeset.change_attribute(changeset, :position, max_position + 1)
      else
        changeset
      end
    end
  end

  defp get_max_position(course_id, tenant) do
    KgEdu.Knowledge.Exercise
    |> Ash.Query.filter(course_id == ^course_id)
    |> Ash.Query.select([:position])
    |> Ash.Query.sort(position: :desc)
    |> Ash.Query.limit(1)
    |> Ash.read_one(tenant: tenant, authorize?: false)
    |> case do
      {:ok, nil} -> 0
      {:ok, exercise} -> exercise.position || 0
      {:error, _} -> 0
    end
  end
end

defmodule KgEdu.Agent.JobManager do
  @moduledoc """
  ETS-based async job tracker for curriculum generation.

  Replaces the TypeScript curriculum-job.ts in-memory Map.
  """

  @table_name :kg_edu_jobs

  def start do
    :ets.new(@table_name, [:set, :public, :named_table, read_concurrency: true])
    :ok
  end

  def create(tenant, major_id) do
    job_id = "curriculum_#{tenant}_#{major_id}_#{System.os_time(:millisecond)}"
    now = DateTime.utc_now() |> DateTime.to_iso8601()

    job = %{
      id: job_id,
      status: "queued",
      message: "任务已创建",
      createdAt: now,
      updatedAt: now,
      completedAt: nil,
      result: nil,
      error: nil
    }

    :ets.insert(@table_name, {job_id, job})
    job_id
  end

  def get(job_id) do
    case :ets.lookup(@table_name, job_id) do
      [{^job_id, job}] -> {:ok, job}
      [] -> {:error, :not_found}
    end
  end

  def update(job_id, updates) do
    case get(job_id) do
      {:ok, job} ->
        now = DateTime.utc_now() |> DateTime.to_iso8601()
        updated = Map.merge(job, Map.put(updates, :updatedAt, now))

        updated =
          if updates[:status] in ["succeeded", "failed"] do
            Map.put(updated, :completedAt, now)
          else
            updated
          end

        :ets.insert(@table_name, {job_id, updated})
        :ok

      {:error, _} ->
        {:error, :not_found}
    end
  end

  def delete(job_id) do
    :ets.delete(@table_name, job_id)
  end

  def cleanup do
    # Keep last 100 jobs
    all = :ets.tab2list(@table_name) |> Enum.sort_by(fn {_, j} -> j.createdAt end, :desc)
    Enum.drop(all, 100) |> Enum.each(fn {id, _} -> :ets.delete(@table_name, id) end)
  end
end

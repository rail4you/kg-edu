defmodule KgEdu.Knowledge.ExamAnalysis do
  @moduledoc """
  P1: 试卷分析 — 题型统计（题量/分数）、难易度统计（题量/分数）、题目明细。

  正确率口径：该习题在**所有考试**已批改作答中的得分率
  `sum(points_earned) / sum(单题满分)`，满分取作答关联的 exam_exercise.points。
  """

  require Ash.Query

  def analyze(exam_id, tenant) do
    opts = [tenant: tenant, authorize?: false]

    with {:ok, exam} <- get_exam(exam_id, opts),
         {:ok, rows} <- get_exam_exercises(exam_id, opts) do
      by_type = summarize(rows, &to_string(&1.exercise.question_type))
      by_difficulty = summarize(rows, & &1.exercise.difficulty)
      items = Enum.map(rows, &build_item(&1, opts))

      {:ok,
       %{
         exam_id: exam_id,
         title: exam.title,
         total_questions: length(rows),
         total_score: Enum.sum(Enum.map(rows, & &1.points)),
         by_type: by_type,
         by_difficulty: by_difficulty,
         items: items
       }}
    end
  end

  # ── Private ────────────────────────────────────────────────────────────

  defp get_exam(exam_id, opts) do
    case KgEdu.Knowledge.Exam.get_exam(%{id: exam_id}, opts) do
      {:ok, nil} -> {:error, "试卷不存在"}
      {:ok, exam} -> {:ok, exam}
      {:error, reason} -> {:error, reason}
    end
  end

  defp get_exam_exercises(exam_id, opts) do
    KgEdu.Knowledge.ExamExercise
    |> Ash.Query.filter(exam_id == ^exam_id)
    |> Ash.Query.sort(order: :asc)
    |> Ash.Query.load(exercise: [:knowledge_resource])
    |> Ash.read(opts)
  end

  defp summarize(rows, key_fn) do
    rows
    |> Enum.group_by(key_fn)
    |> Enum.map(fn {key, group} ->
      %{key: key, count: length(group), score: Enum.sum(Enum.map(group, & &1.points))}
    end)
    |> Enum.sort_by(& &1.count, :desc)
  end

  defp build_item(row, opts) do
    exercise = row.exercise
    {correct_rate, attempts} = correct_rate(exercise.id, opts)

    %{
      exam_exercise_id: row.id,
      order: row.order,
      exercise_id: exercise.id,
      title: exercise.title,
      question_type: to_string(exercise.question_type),
      difficulty: exercise.difficulty,
      knowledge_point: knowledge_name(exercise),
      points: row.points,
      correct_rate: correct_rate,
      attempts: attempts
    }
  end

  defp knowledge_name(%{knowledge_resource: %{name: name}}) when is_binary(name), do: name
  defp knowledge_name(_), do: nil

  defp correct_rate(exercise_id, opts) do
    case KgEdu.Knowledge.StudentExamAnswer
         |> Ash.Query.filter(exercise_id == ^exercise_id and graded == true)
         |> Ash.Query.load(:exam_exercise)
         |> Ash.read(opts) do
      {:ok, answers} when answers != [] ->
        {earned, full} =
          Enum.reduce(answers, {0, 0}, fn a, {e, f} ->
            max = (a.exam_exercise && a.exam_exercise.points) || 0
            {e + (a.points_earned || 0), f + max}
          end)

        rate = if full > 0, do: Float.round(earned / full, 4), else: nil
        {rate, length(answers)}

      _ ->
        {nil, 0}
    end
  end
end

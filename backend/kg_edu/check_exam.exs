# Check exam exercises in database
exam_id = "76519cb4-323b-4c8e-ad03-93c666e88a86"
student_id = "9afac447-4725-4842-9b26-e2f0de338b7f"

# Start application
Application.ensure_all_started(:kg_edu)

# Set tenant
tenant = "org_01c8j3k0000000000000000000"

IO.puts("\n=== Checking Exam: #{exam_id} ===")
IO.puts("Tenant: #{tenant}\n")

# Get exam
case Ash.get(KgEdu.Knowledge.Exam, exam_id, tenant: tenant) do
  {:ok, exam} ->
    IO.puts("✓ Exam found: #{exam.title}")
    IO.puts("  - Type: #{exam.exam_type}")
    IO.puts("  - Duration: #{exam.duration_minutes} minutes")
    IO.puts("  - Total Score: #{exam.total_score}")
    IO.puts("  - Passing Score: #{exam.passing_score}")

    # Get exam exercises
    IO.puts("\n=== Exam Exercises ===")

    exercises_query =
      Ash.Query.filter(KgEdu.Knowledge.ExamExercise, exam_id == ^exam_id)
      |> Ash.Query.sort(:order)

    case Ash.read(exercises_query, tenant: tenant) do
      {:ok, exercises} ->
        IO.puts("✓ Found #{length(exercises)} exercises:")

        Enum.each(exercises, fn ex ->
          IO.puts("  - Order: #{ex.order}, Points: #{ex.points}, ID: #{ex.id}")
        end)

      {:error, reason} ->
        IO.puts("✗ Error loading exercises: #{inspect(reason)}")
    end

  {:error, reason} ->
    IO.puts("✗ Error loading exam: #{inspect(reason)}")
end

# Check student exam
IO.puts("\n=== Student Exams ===")

student_exam_query =
  Ash.Query.filter(KgEdu.Knowledge.StudentExam, exam_id == ^exam_id and student_id == ^student_id)

case Ash.read(student_exam_query, tenant: tenant) do
  {:ok, student_exams} ->
    IO.puts("✓ Found #{length(student_exams)} student exams:")

    Enum.each(student_exams, fn se ->
      IO.puts("  - ID: #{se.id}")
      IO.puts("    Status: #{se.status}")
      IO.puts("    Score: #{se.score}")
      IO.puts("    Started: #{se.started_at}")

      # Check student exam answers
      answers_query =
        Ash.Query.filter(KgEdu.Knowledge.StudentExamAnswer, student_exam_id == ^se.id)

      case Ash.read(answers_query, tenant: tenant) do
        {:ok, answers} ->
          IO.puts("    ✓ Has #{length(answers)} answers")

        {:error, reason} ->
          IO.puts("    ✗ Error loading answers: #{inspect(reason)}")
      end
    end)

  {:error, reason} ->
    IO.puts("✗ Error loading student exams: #{inspect(reason)}")
end

IO.puts("\n=== Check Complete ===\n")

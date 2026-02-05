import Ash.Query
alias KgEdu.Knowledge

tenant = "org_2af44c7b_081a_497a_9858_365fa90ad5d7"
exam_id = "76519cb4-323b-4c8e-ad03-93c666e88a86"
student_id = "9afac447-4725-4842-9b26-e2f0de338b7f"

IO.puts("Checking for existing student exams...")
IO.puts("Exam ID: #{exam_id}")
IO.puts("Student ID: #{student_id}")
IO.puts("Tenant: #{tenant}")
IO.puts("")

query = Knowledge.StudentExam
  |> filter(exam_id == ^exam_id and student_id == ^student_id)
  |> sort(inserted_at: :desc)
  |> Ash.Query.set_context(%{tenant: tenant})

case Ash.read(query) do
  {:ok, exams} ->
    IO.puts("Found #{length(exams)} student exams:")
    Enum.each(exams, fn exam ->
      IO.puts("  ID: #{exam.id}")
      IO.puts("  Status: #{exam.status}")
      IO.puts("  Started: #{exam.started_at}")
      IO.puts("  Score: #{exam.score}")
      IO.puts("")
    end)

    # Delete all existing exams to allow fresh start
    if length(exams) > 0 do
      IO.puts("Deleting existing exams to allow fresh start...")
      Enum.each(exams, fn exam ->
        case Ash.destroy(Knowledge.StudentExam, exam, tenant: tenant) do
          {:ok, _} ->
            IO.puts("  ✓ Deleted exam #{exam.id}")
          {:error, error} ->
            IO.puts("  ✗ Failed to delete exam #{exam.id}: #{inspect(error)}")
        end
      end)
    end

  {:error, error} ->
    IO.puts("Error querying exams: #{inspect(error)}")
end

System.halt(0)

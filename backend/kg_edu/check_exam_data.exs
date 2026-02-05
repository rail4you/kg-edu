# Script to check exam data
exam_id = "76519cb4-323b-4c8e-ad03-93c666e88a86"

# Start the app
{:ok, _} = Application.ensure_all_started(:kg_edu)

# Set tenant
tenant = "org_01c8j3k0000000000000000000"  # Replace with actual tenant
Ash.Context.to_set(tenant: tenant)

# Get the exam
case Ash.get(KgEdu.Knowledge.Exam, exam_id, tenant: tenant) do
  {:ok, exam} ->
    IO.puts("Exam found: #{exam.title}")

    # Get exam exercises
    case Ash.read(Ash.Query.filter(KgEdu.Knowledge.ExamExercise, exam_id == ^exam_id), tenant: tenant) do
      {:ok, exercises} ->
        IO.puts("Number of exercises: #{length(exercises)}")
        Enum.each(exercises, fn ex ->
          IO.puts("  - Exercise ID: #{ex.id}, Order: #{ex.order}, Points: #{ex.points}")
        end)

      {:error, reason} ->
        IO.puts("Error loading exercises: #{inspect(reason)}")
    end

  {:error, reason} ->
    IO.puts("Error loading exam: #{inspect(reason)}")
end

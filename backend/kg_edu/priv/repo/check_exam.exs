# Check if exam exists and which tenant it belongs to
exam_id = "dd773fd2-ef92-426d-803b-01c714035a2e"

IO.puts("Checking for exam: #{exam_id}")
IO.puts("")

# First, get all tenant schema names
tenants_result = KgEdu.Repo.query(
  "SELECT schema_name FROM tenants",
  []
)

case tenants_result do
  {:ok, _columns, tenants_rows} ->
    IO.puts("Found #{Enum.count(tenants_rows)} tenants")
    IO.puts("")

    # Check each tenant's exams table
    exam_found = Enum.reduce_while(tenants_rows, nil, fn tenant_row, _acc ->
      schema_name = Enum.at(tenant_row, 0)

      # Query exams in this tenant's schema
      exam_result = KgEdu.Repo.query(
        "SELECT id, title, course_id FROM #{schema_name}.exams WHERE id = $1",
        [exam_id]
      )

      case exam_result do
        {:ok, _, [exam_row]} ->
          # Found it!
          exam_data = %{
            id: Enum.at(exam_row, 0),
            title: Enum.at(exam_row, 1),
            course_id: Enum.at(exam_row, 2),
            schema_name: schema_name
          }
          {:halt, exam_data}

        _ ->
          # Not in this tenant, check next
          {:cont, nil}
      end
    end)

    if exam_found do
      IO.puts("✅ Exam FOUND!")
      IO.puts("")
      IO.puts("Exam Details:")
      IO.puts("  ID: #{exam_found.id}")
      IO.puts("  Title: #{exam_found.title}")
      IO.puts("  Course ID: #{exam_found.course_id}")
      IO.puts("  Schema/Tenant: #{exam_found.schema_name}")
      IO.puts("")
      IO.puts("Current request tenant: org_2af44c7b_081a_497a_9858_365fa90ad5d7")
      IO.puts("")

      if exam_found.schema_name != "org_2af44c7b_081a_497a_9858_365fa90ad5d7" do
        IO.puts("⚠️  WARNING: Exam tenant mismatch!")
        IO.puts("  The exam belongs to tenant: #{exam_found.schema_name}")
        IO.puts("  But the request is from tenant: org_2af44c7b_081a_497a_9858_365fa90ad5d7")
        IO.puts("")
        IO.puts("This is why start_exam fails - it cannot find the exam!")
        IO.puts("")
        IO.puts("Solution: Make sure you're accessing the exam from the correct tenant/course")
      else
        IO.puts("✓ Tenant matches - should work")
      end
    else
      IO.puts("❌ Exam NOT FOUND in any tenant!")
      IO.puts("")
      IO.puts("The exam ID #{exam_id} does not exist in any tenant's exams table.")
      IO.puts("Possible reasons:")
      IO.puts("  1. The exam was deleted")
      IO.puts("  2. The exam ID is incorrect")
      IO.puts("  3. Frontend is showing cached/outdated data")
      IO.puts("")
      IO.puts("Solution: Refresh the page or re-create the exam")
    end

  {:error, reason} ->
    IO.puts("❌ Error querying tenants: #{inspect(reason)}")
end

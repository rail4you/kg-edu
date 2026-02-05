# Check if exam exists using Ash framework
exam_id = "dd773fd2-ef92-426d-803b-01c714035a2e"

IO.puts("Checking for exam: #{exam_id}")
IO.puts("")

# Try to get exam with each tenant
tenants = [
  "org_2af44c7b_081a_497a_9858_365fa90ad5d7",
  "org_2af44c7b_081a_497a_9858_365fa90ad5d6"
]

exam_found = Enum.reduce_while(tenants, nil, fn tenant, _acc ->
  IO.puts("Trying tenant: #{tenant}")

  case Ash.get(KgEdu.Knowledge.Exam, exam_id, tenant: tenant) do
    {:ok, exam} ->
      IO.puts("  ✅ Found in this tenant!")
      exam_data = %{
        id: exam.id,
        title: exam.title,
        course_id: exam.course_id,
        tenant: tenant
      }
      {:halt, exam_data}

    {:error, reason} ->
      IO.puts("  ❌ Not found: #{inspect(reason)}")
      {:cont, nil}
  end
end)

IO.puts("")

if exam_found do
  IO.puts("✅ Exam FOUND!")
  IO.puts("")
  IO.puts("Exam Details:")
  IO.puts("  ID: #{exam_found.id}")
  IO.puts("  Title: #{exam_found.title}")
  IO.puts("  Course ID: #{exam_found.course_id}")
  IO.puts("  Tenant: #{exam_found.tenant}")
  IO.puts("")
  IO.puts("Current request tenant: org_2af44c7b_081a_497a_9858_365fa90ad5d7")
  IO.puts("")

  if exam_found.tenant != "org_2af44c7b_081a_497a_9858_365fa90ad5d7" do
    IO.puts("⚠️  WARNING: Exam tenant mismatch!")
    IO.puts("  The exam belongs to tenant: #{exam_found.tenant}")
    IO.puts("  But the request is from tenant: org_2af44c7b_081a_497a_9858_365fa90ad5d7")
    IO.puts("")
    IO.puts("This is why start_exam fails - it cannot find the exam!")
  else
    IO.puts("✓ Tenant matches - should work")
  end
else
  IO.puts("❌ Exam NOT FOUND in any checked tenant!")
  IO.puts("")
  IO.puts("The exam ID #{exam_id} does not exist.")
  IO.puts("")
  IO.puts("Possible reasons:")
  IO.puts("  1. The exam was deleted")
  IO.puts("  2. The exam ID is incorrect")
  IO.puts("  3. Frontend is showing cached/outdated data")
  IO.puts("  4. Exam belongs to a different tenant not checked")
  IO.puts("")
  IO.puts("Solutions:")
  IO.puts("  1. Refresh the page to reload exam list")
  IO.puts("  2. Check browser console for current tenant")
  IO.puts("  3. Make sure you're accessing the correct course")
end

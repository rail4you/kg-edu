# Test the fixed learning statistics functionality
course_id = "15cbf640-c16b-46b9-a029-70a56f4f20f9"

IO.puts("=== Testing Fixed Learning Statistics ===")
IO.puts("Course ID: #{course_id}")

# First, let's try to detect what tenant exists for this course
IO.puts("\n1. Testing with nil tenant:")

case KgEdu.Knowledge.Resource.get_course_learning_stats_by_student(
       %{course_id: course_id},
       tenant: nil,
       authorize?: false,
       actor: nil
     ) do
  {:ok, stats} ->
    IO.puts("✅ Success with nil tenant! Found stats for #{length(stats)} students")
    if length(stats) > 0 do
      Enum.each(stats, fn stat ->
        IO.puts("Student #{stat.student_id}: Overall #{Float.round(stat.overall.completion_ratio * 100, 1)}% completion")
      end)
    end

  {:error, reason} ->
    IO.puts("❌ Error with nil tenant: #{inspect(reason)}")
end

# Test with a default tenant
IO.puts("\n2. Testing with default tenant:")

case KgEdu.Knowledge.Resource.get_course_learning_stats_by_student(
       %{course_id: course_id},
       tenant: "public",
       authorize?: false,
       actor: nil
     ) do
  {:ok, stats} ->
    IO.puts("✅ Success with 'public' tenant! Found stats for #{length(stats)} students")
    if length(stats) > 0 do
      Enum.each(stats, fn stat ->
        IO.puts("Student #{stat.student_id}: Overall #{Float.round(stat.overall.completion_ratio * 100, 1)}% completion")
      end)
    end

  {:error, reason} ->
    IO.puts("❌ Error with 'public' tenant: #{inspect(reason)}")
end

# Try to find available courses first
IO.puts("\n3. Trying to find available courses:")

case KgEdu.Knowledge.Resource.list_knowledges(tenant: nil, authorize?: false, actor: nil) do
  {:ok, resources} ->
    IO.puts("Found #{length(resources)} knowledge resources total")
    if length(resources) > 0 do
      course_ids = resources |> Enum.map(& &1.course_id) |> Enum.uniq() |> Enum.reject(&is_nil/1)
      IO.puts("Available course IDs: #{inspect(course_ids)}")

      # Test with the first available course
      if length(course_ids) > 0 do
        test_course_id = hd(course_ids)
        IO.puts("\n4. Testing with found course ID: #{test_course_id}")

        case KgEdu.Knowledge.Resource.get_course_learning_stats_by_student(
               %{course_id: test_course_id},
               tenant: nil,
               authorize?: false,
               actor: nil
             ) do
          {:ok, stats} ->
            IO.puts("✅ Success with found course! Stats for #{length(stats)} students")
            if length(stats) > 0 do
              Enum.each(stats, fn stat ->
                IO.puts("  Student #{stat.student_id}:")
                IO.puts("    Videos: #{stat.videos.completed}/#{stat.videos.total} (#{Float.round(stat.videos.completion_ratio * 100, 1)}%)")
                IO.puts("    Files: #{stat.files.completed}/#{stat.files.total} (#{Float.round(stat.files.completion_ratio * 100, 1)}%)")
                IO.puts("    Exercises: #{stat.exercises.completed}/#{stat.exercises.total} (#{Float.round(stat.exercises.completion_ratio * 100, 1)}%)")
                IO.puts("    Homework: #{stat.homeworks.completed}/#{stat.homeworks.total} (#{Float.round(stat.homeworks.completion_ratio * 100, 1)}%)")
                IO.puts("    Overall: #{Float.round(stat.overall.completion_ratio * 100, 1)}%")
              end)
            end

          {:error, reason} ->
            IO.puts("❌ Error with found course: #{inspect(reason)}")
        end
      end
    end

  {:error, reason} ->
    IO.puts("❌ Error listing knowledge resources: #{inspect(reason)}")
end

IO.puts("\n=== Test Complete ===")
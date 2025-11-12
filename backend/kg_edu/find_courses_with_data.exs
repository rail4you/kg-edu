# Find courses with knowledge resources and test student learning statistics
IO.puts("=== Finding Courses with Data ===")

# Test with "public" tenant since that worked for activity logs
tenant = "public"

# First, get all knowledge resources to find available courses
case KgEdu.Knowledge.Resource.list_knowledges(tenant: tenant, authorize?: false, actor: nil) do
  {:ok, resources} ->
    IO.puts("Found #{length(resources)} total knowledge resources")

    if length(resources) > 0 do
      # Group by course_id to find courses with data
      course_groups = resources
        |> Enum.group_by(& &1.course_id)
        |> Enum.reject(fn {course_id, _resources} -> is_nil(course_id) end)

      IO.puts("Found #{length(course_groups)} courses with knowledge resources")

      # Test each course that has data
      Enum.each(course_groups, fn {course_id, course_resources} ->
        IO.puts("\n--- Testing Course: #{course_id} ---")
        IO.puts("This course has #{length(course_resources)} knowledge resources")

        # Test the student learning stats for this course
        case KgEdu.Knowledge.Resource.get_course_learning_stats_by_student(
               %{course_id: course_id},
               tenant: tenant,
               authorize?: false,
               actor: nil
             ) do
          {:ok, stats} ->
            IO.puts("✅ Success! Found stats for #{length(stats)} students")

            if length(stats) > 0 do
              # Show first few students with detailed stats
              stats
              |> Enum.take(3)
              |> Enum.each(fn stat ->
                IO.puts("\nStudent #{stat.student_id}:")
                IO.puts("  Videos: #{stat.videos.completed}/#{stat.videos.total} (#{Float.round(stat.videos.completion_ratio * 100, 1)}%)")
                IO.puts("  Files: #{stat.files.completed}/#{stat.files.total} (#{Float.round(stat.files.completion_ratio * 100, 1)}%)")
                IO.puts("  Exercises: #{stat.exercises.completed}/#{stat.exercises.total} (#{Float.round(stat.exercises.completion_ratio * 100, 1)}%)")
                IO.puts("  Homework: #{stat.homeworks.completed}/#{stat.homeworks.total} (#{Float.round(stat.homeworks.completion_ratio * 100, 1)}%)")
                IO.puts("  Overall: #{Float.round(stat.overall.completion_ratio * 100, 1)}%")
              end)
            else
              IO.puts("ℹ️  No student activity found for this course")
            end

          {:error, reason} ->
            IO.puts("❌ Error: #{inspect(reason)}")
        end
      end)

      # Also test individual resource stats if we have resources
      if length(resources) > 0 do
        IO.puts("\n--- Testing Individual Resource Stats ---")

        # Pick a few resources to test
        test_resources = Enum.take(resources, 3)

        # Find a user ID from activity logs to test with
        case KgEdu.Activity.ActivityLog.list_activity_logs(tenant: tenant, authorize?: false, actor: nil) do
          {:ok, logs} when length(logs) > 0 ->
            test_user_id = hd(logs).user_id
            IO.puts("Testing with user_id: #{test_user_id}")

            Enum.each(test_resources, fn resource ->
              IO.puts("\nTesting resource: #{resource.name} (#{resource.id})")

              case KgEdu.Knowledge.Resource.calculate_student_learning_stats(
                     resource,
                     %{student_id: test_user_id},
                     tenant: tenant
                   ) do
                {:ok, stats} ->
                  IO.puts("✅ Individual resource stats:")
                  IO.puts("  Videos: #{stats.videos.completed}/#{stats.videos.total}")
                  IO.puts("  Files: #{stats.files.completed}/#{stats.files.total}")
                  IO.puts("  Exercises: #{stats.exercises.completed}/#{stats.exercises.total}")
                  IO.puts("  Homework: #{stats.homeworks.completed}/#{stats.homeworks.total}")
                  IO.puts("  Overall completion: #{Float.round(stats.overall.completion_ratio * 100, 1)}%")

                {:error, reason} ->
                  IO.puts("❌ Error calculating individual stats: #{inspect(reason)}")
              end
            end)

          {:ok, []} ->
            IO.puts("ℹ️  No activity logs found to test individual resource stats")

          {:error, reason} ->
            IO.puts("❌ Error getting activity logs: #{inspect(reason)}")
        end
      end

    else
      IO.puts("ℹ️  No knowledge resources found")
    end

  {:error, reason} ->
    IO.puts("❌ Error listing knowledge resources: #{inspect(reason)}")
end

IO.puts("\n=== Test Complete ===")
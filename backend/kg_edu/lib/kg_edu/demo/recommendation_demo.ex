defmodule KgEdu.Demo.RecommendationDemo do
  require Logger

  def list_all_data do
    IO.puts("=== Listing All System Data ===\n")
    tenant = "org_c4517dff_c56e_4f12_a58d_f6e9393bd3bd"

    IO.puts("--- Users ---")

    case Ash.read(KgEdu.Accounts.User, tenant: tenant, authorize?: false, page: %{limit: 5}) do
      {:ok, page} ->
        users = page.results
        IO.puts("Found #{length(users)} users")
        Enum.each(users, fn u -> IO.puts("  #{u.name} (#{u.email}) - ID: #{u.id}") end)

      {:error, e} ->
        IO.puts("Error: #{inspect(e)}")
    end

    IO.puts("\n--- Course Enrollments ---")

    case Ash.read(KgEdu.Courses.CourseEnrollment,
           tenant: tenant,
           authorize?: false,
           page: %{limit: 5}
         ) do
      {:ok, page} ->
        es = page.results
        IO.puts("Found #{length(es)} enrollments")
        Enum.each(es, fn e -> IO.puts("  Student: #{e.member_id}, Course: #{e.course_id}") end)

      {:error, e} ->
        IO.puts("Error: #{inspect(e)}")
    end

    IO.puts("\n--- Activity Logs ---")

    case Ash.read(KgEdu.Activity.ActivityLog,
           tenant: tenant,
           authorize?: false,
           page: %{limit: 5}
         ) do
      {:ok, page} ->
        ls = page.results
        IO.puts("Found #{length(ls)} logs")
        Enum.each(ls, fn l -> IO.puts("  #{l.action_type}: #{l.resource_type}") end)

      {:error, e} ->
        IO.puts("Error: #{inspect(e)}")
    end

    IO.puts("\n--- Student Knowledge Masteries ---")

    case Ash.read(KgEdu.Knowledge.StudentKnowledgeMastery,
           tenant: tenant,
           authorize?: false,
           page: %{limit: 5}
         ) do
      {:ok, page} ->
        ms = page.results
        IO.puts("Found #{length(ms)} masteries")

        Enum.each(ms, fn m -> IO.puts("  Student: #{m.student_id}, Level: #{m.mastery_level}") end)

      {:error, e} ->
        IO.puts("Error: #{inspect(e)}")
    end

    IO.puts("\n--- Learning Recommendations ---")

    case Ash.read(KgEdu.Knowledge.LearningRecommendation,
           tenant: tenant,
           authorize?: false,
           page: %{limit: 5}
         ) do
      {:ok, page} ->
        rs = page.results
        IO.puts("Found #{length(rs)} recommendations")

        Enum.each(rs, fn r ->
          IO.puts(
            "  Student: #{r.student_id}, Type: #{r.recommendation_type}, Status: #{r.status}"
          )
        end)

      {:error, e} ->
        IO.puts("Error: #{inspect(e)}")
    end
  end

  def test_recommendations do
    IO.puts("=== Testing Recommendation APIs ===\n")
    tenant = "org_c4517dff_c56e_4f12_a58d_f6e9393bd3bd"

    case Ash.read(KgEdu.Accounts.User, tenant: tenant, authorize?: false, page: %{limit: 1}) do
      {:ok, page} ->
        users = page.results
        user = List.first(users)

        if user do
          IO.puts("Testing with user: #{user.name} (#{user.email})")
          IO.puts("User ID: #{user.id}\n")

          IO.puts("=== 1. Get Existing Recommendations ===")

          case KgEdu.Knowledge.LearningRecommendation.get_student_recommendations(
                 student_id: user.id,
                 tenant: tenant,
                 authorize?: false
               ) do
            {:ok, recs} ->
              IO.puts("Found #{length(recs)} existing recommendations")

            {:error, e} ->
              IO.puts("Error: #{inspect(e)}")
          end

          IO.puts("\n=== 2. Generate New Recommendations ===")

          case KgEdu.Knowledge.RecommendationEngine.generate_comprehensive_recommendations(
                 user.id,
                 nil,
                 tenant: tenant
               ) do
            {:ok, result} ->
              IO.puts("Generated #{length(result.recommendations)} new recommendations")

              Enum.each(Enum.take(result.recommendations, 3), fn r ->
                IO.puts("  - Type: #{r.recommendation_type}")
                IO.puts("    Reason: #{String.slice(r.reason || "", 0, 60)}...")
              end)

            {:error, e} ->
              IO.puts("Error: #{inspect(e)}")
          end

          IO.puts("\n=== 3. Learning Progress Summary ===")

          case KgEdu.Knowledge.RecommendationAPI.get_learning_progress_summary(user.id,
                 tenant: tenant
               ) do
            {:ok, s} ->
              IO.puts("Total: #{s.total_recommendations}")
              IO.puts("Pending: #{s.pending.count}")
              IO.puts("In Progress: #{s.in_progress.count}")
              IO.puts("Completed: #{s.completed.count}")
              IO.puts("Completion Rate: #{s.completion_rate}%")

            {:error, e} ->
              IO.puts("Error: #{inspect(e)}")
          end
        else
          IO.puts("No users found!")
        end

      {:error, e} ->
        IO.puts("Error: #{inspect(e)}")
    end
  end
end

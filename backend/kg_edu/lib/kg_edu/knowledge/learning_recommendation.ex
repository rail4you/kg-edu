defmodule KgEdu.Knowledge.LearningRecommendation do
  @moduledoc """
  个性化学习推荐
  为每个学生生成个性化的学习资源推荐，基于知识点掌握度、学习行为等
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Ash.Query
  require Logger

  postgres do
    table("learning_recommendations")
    repo(KgEdu.Repo)

    references do
      reference(:student, on_delete: :delete)
      reference(:knowledge_resource, on_delete: :delete)
    end
  end

  json_api do
    type("learning_recommendation")
  end

  typescript do
    type_name("LearningRecommendation")
  end

  code_interface do
    define(:get_recommendation, action: :by_id)
    define(:list_recommendations, action: :read)
    define(:get_student_recommendations, action: :get_student_recommendations_rpc)
    define(:generate_recommendations, action: :generate_for_student)
    define(:mark_as_viewed, action: :mark_viewed)
    define(:mark_as_completed, action: :mark_completed)
    define(:dismiss_recommendation, action: :dismiss)
  end

  actions do
    defaults([:read, :destroy])

    read :by_id do
      description("Get a recommendation by ID")
      get?(true)
      argument(:id, :uuid, allow_nil?: false)
      filter(expr(id == ^arg(:id)))
    end

    read :by_student do
      description("Get all recommendations for a student")
      argument(:student_id, :uuid, allow_nil?: false)
      argument(:status, :atom, allow_nil?: true)

      filter(expr(student_id == ^arg(:student_id)))

      prepare(fn query, _context ->
        status = Ash.Query.get_argument(query, :status)

        query
        |> then(fn q ->
          if status do
            Ash.Query.filter(q, status == ^status)
          else
            q
          end
        end)
        |> Ash.Query.sort(priority: :desc, inserted_at: :desc)
        |> Ash.Query.limit(20)
      end)
    end

    create :create do
      description("Create a new recommendation")

      accept([
        :student_id,
        :knowledge_resource_id,
        :recommendation_type,
        :priority,
        :reason,
        :metadata
      ])

      change(set_attribute(:status, :pending))
    end

    action :generate_for_student do
      description(
        "Generate personalized recommendations for a student based on their weaknesses and learning goals"
      )

      argument :student_id, :uuid do
        allow_nil?(false)
        description("Student to generate recommendations for")
      end

      argument :course_id, :uuid do
        allow_nil?(true)
        description("Optional: Generate recommendations for specific course only")
      end

      argument :limit, :integer do
        allow_nil?(true)
        default(10)
        description("Maximum number of recommendations to generate")
      end

      run(fn input, context ->
        student_id = input.arguments.student_id
        course_id = input.arguments.course_id
        limit = input.arguments.limit
        tenant = context.tenant

        Logger.info(
          "Generating recommendations for student #{student_id} in course #{course_id || "all"}"
        )

        # Step 1: Get weak knowledge points - use Ash.Query directly
        weak_query =
          KgEdu.Knowledge.StudentKnowledgeMastery
          |> Ash.Query.filter(student_id == ^student_id and mastery_level < ^0.6)
          |> Ash.Query.load(:knowledge_resource)

        case Ash.read(weak_query, tenant: tenant, authorize?: false) do
          {:ok, weak_masteries} when is_list(weak_masteries) and length(weak_masteries) > 0 ->
            # Step 2: Generate recommendations for weak points
            recommendations =
              weak_masteries
              |> Enum.take(limit)
              |> Enum.map(fn mastery ->
                generate_recommendation_for_weakness(mastery, student_id, tenant)
              end)
              |> Enum.filter(fn
                {:ok, _} -> true
                _ -> false
              end)
              |> Enum.map(fn {:ok, rec} -> rec end)

            Logger.info(
              "Generated #{length(recommendations)} recommendations for student #{student_id}"
            )

            {:ok, recommendations}

          {:ok, []} ->
            Logger.info("No weak points found for student #{student_id}")
            {:ok, []}

          {:error, reason} ->
            Logger.error("Failed to get weak points: #{inspect(reason)}")
            {:error, "Failed to get weak points"}
        end
      end)
    end

    action :get_student_recommendations_rpc do
      description("Get personalized learning recommendations for a student (RPC wrapper)")

      argument :student_id, :uuid do
        allow_nil?(false)
        description("Student ID")
      end

      argument :course_id, :uuid do
        allow_nil?(true)
        description("Optional course ID")
      end

      argument :status, :atom do
        allow_nil?(true)
        description("Filter by status: pending, in_progress, completed")
      end

      argument :limit, :integer do
        allow_nil?(true)
        default(20)
        description("Maximum number of recommendations")
      end

      argument :force_refresh, :boolean do
        allow_nil?(true)
        default(false)
        description("Force regenerate recommendations")
      end

      returns(:map)

      run(fn input, context ->
        student_id = input.arguments.student_id
        course_id = Map.get(input.arguments, :course_id)
        status = Map.get(input.arguments, :status)
        limit = Map.get(input.arguments, :limit, 20) || 20
        force_refresh = Map.get(input.arguments, :force_refresh, false) || false
        tenant = context.tenant

        Logger.info(
          "RPC: Getting recommendations for student #{student_id}, force_refresh: #{force_refresh}, tenant: #{inspect(tenant)}"
        )

        # Check if we need to generate new recommendations
        should_regen = should_regenerate?(student_id, tenant)
        Logger.info("should_regenerate? result: #{should_regen}")

        if force_refresh or should_regen do
          Logger.info("Generating recommendations for student #{student_id}")

          # Get student's enrolled courses
          case KgEdu.Courses.CourseEnrollment.list_enrollments_by_student(
                 %{member_id: student_id},
                 tenant: tenant,
                 authorize?: false
               ) do
            {:ok, enrollments} ->
              enrolled_course_ids = Enum.map(enrollments, & &1.course_id)

              Logger.info(
                "Student #{student_id} is enrolled in #{length(enrolled_course_ids)} courses: #{inspect(enrolled_course_ids)}"
              )

              if length(enrolled_course_ids) > 0 do
                # Get knowledge resources from enrolled courses (5 per course)
                resources_result =
                  Enum.map(enrolled_course_ids, fn course_id ->
                    case KgEdu.Knowledge.Resource.get_knowledge_resources_by_course(
                           %{course_id: course_id},
                           tenant: tenant,
                           authorize?: false
                         ) do
                      {:ok, resources} -> Enum.take(resources, 5)
                      {:error, _} -> []
                    end
                  end)
                  |> Enum.flat_map(& &1)

                Logger.info(
                  "Found #{length(resources_result)} knowledge resources from enrolled courses"
                )

                if length(resources_result) > 0 do
                  Enum.each(resources_result, fn resource ->
                    create_attrs = %{
                      student_id: student_id,
                      knowledge_resource_id: resource.id,
                      recommendation_type: :weak_knowledge_review,
                      priority: 7,
                      reason: "根据您的学习档案，我们推荐从「#{resource.name}」开始学习"
                    }

                    case KgEdu.Knowledge.LearningRecommendation
                         |> Ash.Changeset.for_action(:create, create_attrs)
                         |> Ash.create(tenant: tenant, authorize?: false) do
                      {:ok, _rec} ->
                        Logger.info("Created recommendation for #{resource.name}")

                      {:error, reason} ->
                        Logger.error("Failed to create recommendation: #{inspect(reason)}")
                    end
                  end)
                else
                  Logger.info("No knowledge resources found for enrolled courses")
                end
              else
                Logger.info("Student #{student_id} is not enrolled in any course")
              end

            {:error, reason} ->
              Logger.error("Failed to get student enrollments: #{inspect(reason)}")
          end
        else
          Logger.info("Skipping recommendation generation - not needed")
        end

        # Get recommendations from database
        Logger.info("About to read LearningRecommendation for tenant: #{inspect(tenant)}")

        read_result =
          KgEdu.Knowledge.LearningRecommendation
          |> Ash.Query.load(:knowledge_resource)
          |> Ash.read(tenant: tenant, authorize?: false)

        Logger.info("Read result: #{inspect(read_result)}")

        recommendations_result =
          case read_result do
            {:ok, recommendations} ->
              Logger.info("Total recommendations in DB: #{length(recommendations)}")
              filtered = Enum.filter(recommendations, fn r -> r.student_id == student_id end)
              Logger.info("Filtered recommendations for student: #{length(filtered)}")
              {:ok, filtered}

            {:error, reason} ->
              Logger.error("Error reading recommendations: #{inspect(reason)}")
              {:error, reason}
          end

        Logger.info("Final recommendations_result: #{inspect(recommendations_result)}")

        case recommendations_result do
          {:ok, recommendations} ->
            enriched =
              recommendations
              |> Enum.take(limit)
              |> Enum.map(fn rec ->
                resource =
                  case rec.knowledge_resource do
                    %Ash.NotLoaded{} -> nil
                    r -> r
                  end

                %{
                  id: rec.id,
                  recommendation_type: rec.recommendation_type,
                  priority: rec.priority,
                  reason: rec.reason,
                  status: rec.status,
                  created_at: rec.inserted_at,
                  viewed_at: rec.viewed_at,
                  completed_at: rec.completed_at,
                  knowledge_resource:
                    if(resource,
                      do: %{
                        id: resource.id,
                        name: resource.name,
                        knowledge_type: resource.knowledge_type,
                        importance_level: resource.importance_level,
                        description: resource.description
                      },
                      else: nil
                    ),
                  metadata: rec.metadata || %{}
                }
              end)

            if enriched == [] do
              {:ok, %{recommendations: [], message: "暂无推荐"}}
            else
              {:ok, %{recommendations: enriched, total: length(enriched)}}
            end

          {:error, reason} ->
            Logger.error("Failed to get recommendations: #{inspect(reason)}")
            {:error, reason}
        end
      end)
    end

    defp should_regenerate?(student_id, tenant) do
      Logger.info(
        "should_regenerate? called with student_id: #{student_id}, tenant: #{inspect(tenant)}"
      )

      query = Ash.Query.new(KgEdu.Knowledge.LearningRecommendation)

      result =
        case query
             |> Ash.Query.set_tenant(tenant)
             |> Ash.Query.filter(student_id: student_id)
             |> Ash.read(authorize?: false) do
          {:ok, recommendations} when is_list(recommendations) ->
            Logger.info("Found #{length(recommendations)} existing recommendations")

            if length(recommendations) == 0 do
              true
            else
              oldest = List.last(recommendations)

              if oldest do
                hours_ago = DateTime.diff(DateTime.utc_now(), oldest.inserted_at) / 3600
                Logger.info("Oldest recommendation is #{hours_ago} hours old")
                hours_ago > 24
              else
                true
              end
            end

          {:error, reason} ->
            Logger.error("should_regenerate? error: #{inspect(reason)}")
            true

          other ->
            Logger.info("should_regenerate? unexpected result: #{inspect(other)}")
            true
        end

      Logger.info("should_regenerate? returning: #{result}")
      result
    end

    action :get_learning_progress_summary_rpc do
      description("Get learning progress summary for a student")

      argument :student_id, :uuid do
        allow_nil?(false)
        description("Student ID")
      end

      argument :course_id, :uuid do
        allow_nil?(true)
        description("Optional course ID")
      end

      run(fn input, context ->
        student_id = input.arguments.student_id
        course_id = input.arguments.course_id
        tenant = context.tenant

        KgEdu.Knowledge.RecommendationAPI.get_learning_progress_summary(
          student_id,
          course_id: course_id,
          tenant: tenant
        )
      end)
    end

    update :mark_viewed do
      description("Mark recommendation as viewed by student")

      accept([])

      change(atomic_update(:status, :viewed))
      change(atomic_update(:viewed_at, expr(now())))
    end

    update :mark_completed do
      description("Mark recommendation as completed (student has finished learning)")

      accept([])

      change(atomic_update(:status, :completed))
      change(atomic_update(:completed_at, expr(now())))
    end

    update :dismiss do
      description("Dismiss a recommendation (student doesn't want to follow it)")

      accept([])

      change(atomic_update(:status, :dismissed))
      change(atomic_update(:dismissed_at, expr(now())))
    end
  end

  policies do
    policy always() do
      authorize_if(always())
    end
  end

  multitenancy do
    strategy(:context)
  end

  attributes do
    uuid_primary_key(:id)

    attribute :recommendation_type, :atom do
      allow_nil?(false)

      constraints(
        one_of: [
          :weak_knowledge_review,
          :prerequisite_learning,
          :related_practice,
          :video_learning,
          :reading_material,
          :homework_practice,
          :exam_review
        ]
      )

      description("Type of recommendation")
      public?(true)
    end

    attribute :priority, :integer do
      allow_nil?(false)
      default(5)
      constraints(min: 1, max: 10)
      description("Priority from 1 (lowest) to 10 (highest)")
      public?(true)
    end

    attribute :reason, :string do
      allow_nil?(true)
      description("Explanation of why this recommendation was made")
      public?(true)
    end

    attribute :status, :atom do
      allow_nil?(false)
      default(:pending)
      constraints(one_of: [:pending, :viewed, :in_progress, :completed, :dismissed])
      description("Status of the recommendation")
      public?(true)
    end

    attribute :viewed_at, :utc_datetime do
      allow_nil?(true)
      description("When the student first viewed this recommendation")
      public?(true)
    end

    attribute :completed_at, :utc_datetime do
      allow_nil?(true)
      description("When the student completed this recommendation")
      public?(true)
    end

    attribute :dismissed_at, :utc_datetime do
      allow_nil?(true)
      description("When the student dismissed this recommendation")
      public?(true)
    end

    attribute :metadata, :map do
      allow_nil?(true)
      default(%{})
      description("Additional metadata about the recommendation")
      public?(true)
    end

    timestamps()
  end

  relationships do
    belongs_to :student, KgEdu.Accounts.User do
      public?(true)
      allow_nil?(false)
      description("The student this recommendation is for")
    end

    belongs_to :knowledge_resource, KgEdu.Knowledge.Resource do
      public?(true)
      allow_nil?(false)
      description("The knowledge resource being recommended")
    end
  end

  # ============ Helper Functions ============

  defp generate_recommendation_for_weakness(mastery, student_id, tenant) do
    knowledge_resource =
      case mastery.knowledge_resource do
        %Ash.NotLoaded{} -> nil
        resource -> resource
      end

    if knowledge_resource do
      # Determine recommendation type based on available resources
      recommendation_type = determine_recommendation_type(knowledge_resource, tenant)

      # Calculate priority based on mastery level (lower mastery = higher priority)
      priority = calculate_priority(mastery.mastery_level)

      # Generate reason
      reason = generate_reason(mastery, knowledge_resource)

      # Check if recommendation already exists
      query = Ash.Query.new(KgEdu.Knowledge.LearningRecommendation)

      case query
           |> Ash.Query.set_tenant(tenant)
           |> Ash.Query.filter(student_id: student_id)
           |> Ash.Query.filter(knowledge_resource_id: knowledge_resource.id)
           |> Ash.Query.filter(status: [:pending, :viewed, :in_progress])
           |> Ash.read(authorize?: false) do
        {:ok, existing} when is_list(existing) and length(existing) > 0 ->
          # Recommendation already exists, skip
          {:ok, hd(existing)}

        _ ->
          # Create new recommendation
          create_attrs = %{
            student_id: student_id,
            knowledge_resource_id: knowledge_resource.id,
            recommendation_type: recommendation_type,
            priority: priority,
            reason: reason,
            metadata: %{
              current_mastery_level: mastery.mastery_level,
              practice_count: mastery.practice_count,
              importance_level: knowledge_resource.importance_level
            }
          }

          KgEdu.Knowledge.LearningRecommendation
          |> Ash.Changeset.for_action(:create, create_attrs)
          |> Ash.create(tenant: tenant, authorize?: false)
      end
    else
      {:error, "Knowledge resource not loaded"}
    end
  end

  defp determine_recommendation_type(knowledge_resource, tenant) do
    # Load associated resources
    case KgEdu.Knowledge.Resource.get_knowledge_resource(
           %{id: knowledge_resource.id},
           tenant: tenant,
           authorize?: false,
           load: [:videos, :files, :homeworks, :exercises]
         ) do
      {:ok, resource} ->
        cond do
          # Has homework available
          has_resources?(resource.homeworks) ->
            :homework_practice

          # Has videos available
          has_resources?(resource.videos) ->
            :video_learning

          # Has reading materials
          has_resources?(resource.files) ->
            :reading_material

          # Has exercises
          has_resources?(resource.exercises) ->
            :related_practice

          # Default to review
          true ->
            :weak_knowledge_review
        end

      _ ->
        :weak_knowledge_review
    end
  end

  defp has_resources?(%Ash.NotLoaded{}), do: false
  defp has_resources?(nil), do: false
  defp has_resources?([]), do: false
  defp has_resources?(list) when is_list(list), do: true

  defp calculate_priority(mastery_level) when is_number(mastery_level) do
    # Lower mastery level = higher priority
    # Mastery 0.0 -> Priority 10
    # Mastery 0.6 -> Priority 4
    # Mastery 1.0 -> Priority 1

    cond do
      mastery_level < 0.2 -> 10
      mastery_level < 0.4 -> 8
      mastery_level < 0.6 -> 6
      mastery_level < 0.8 -> 4
      true -> 2
    end
  end

  defp calculate_priority(_), do: 5

  defp generate_reason(mastery, knowledge_resource) do
    mastery_percent = Float.round(mastery.mastery_level * 100, 1)

    base_msg = "Your mastery level for '#{knowledge_resource.name}' is #{mastery_percent}%."

    detail_msg =
      cond do
        mastery.mastery_level < 0.3 ->
          " This is a critical weak point that needs immediate attention."

        mastery.mastery_level < 0.6 ->
          " Regular practice is recommended to strengthen your understanding."

        true ->
          " A quick review will help you master this topic."
      end

    importance_msg =
      case knowledge_resource.importance_level do
        "hard" -> " This is marked as a hard topic."
        "important" -> " This is an important topic."
        _ -> ""
      end

    base_msg <> detail_msg <> importance_msg
  end
end

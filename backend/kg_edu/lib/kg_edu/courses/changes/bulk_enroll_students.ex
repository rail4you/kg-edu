defmodule KgEdu.Courses.Changes.BulkEnrollStudents do
  use Ash.Resource.Change

  def change(changeset, _opts, _context) do
    course_id = Ash.Changeset.get_argument(changeset, :course_id)
    member_ids = Ash.Changeset.get_argument(changeset, :member_ids)

    cond do
      is_nil(course_id) or is_nil(member_ids) ->
        Ash.Changeset.add_error(changeset, "course_id and member_ids are required")
        
      Enum.empty?(member_ids) ->
        Ash.Changeset.add_error(changeset, "member_ids cannot be empty")
        
      true ->
        # Create individual enrollments using Ash.create for each member_id
        Ash.Changeset.after_action(changeset, fn _changeset, _result ->
          results = 
            Enum.map(member_ids, fn member_id ->
              enrollment_attrs = %{
                course_id: course_id,
                member_id: member_id
              }
              
              case Ash.create(KgEdu.Courses.CourseEnrollment, enrollment_attrs, 
                     authorize?: false, domain: KgEdu.Courses) do
                {:ok, enrollment} -> {:ok, enrollment}
                {:error, error} -> {:error, error}
              end
            end)
          
          # Separate successes and errors
          {successful, failed} = Enum.split_with(results, &match?({:ok, _}, &1))
          
          if Enum.empty?(successful) do
            errors = Enum.map(failed, fn {:error, error} -> error end)
            {:error, errors}
          else
            # Return the first successful enrollment as the result
            case Enum.at(successful, 0) do
              {:ok, enrollment} -> 
                enrolled_count = length(successful)
                {:ok, Map.put(enrollment, :enrolled_count, enrolled_count)}
              _ -> 
                {:ok, %{enrolled_count: length(successful)}}
            end
          end
        end)
    end
  end
end
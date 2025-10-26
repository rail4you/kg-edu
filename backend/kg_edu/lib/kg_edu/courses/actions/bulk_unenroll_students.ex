defmodule KgEdu.Courses.Actions.BulkUnenrollStudents do
  def run(input, _context, _opts) do
    course_id = input.arguments.course_id
    member_ids = input.arguments.member_ids

    if course_id && member_ids do
      # Use the by_course action to find enrollments, then filter by member_ids
      case KgEdu.Courses.CourseEnrollment.list_enrollments_by_course(%{course_id: course_id}, authorize?: false) do
        {:ok, enrollments} ->
          # Filter enrollments by member_ids
          matching_enrollments = Enum.filter(enrollments, fn enrollment ->
            enrollment.member_id in member_ids
          end)
          
          # Destroy each matching enrollment
          results = Enum.map(matching_enrollments, fn enrollment ->
            KgEdu.Courses.CourseEnrollment.unenroll_student(enrollment, authorize?: false)
          end)
          
          successful_count = Enum.count(results, &match?({:ok, _}, &1))
          {:ok, %{unenrolled_count: successful_count}}
          
        {:error, error} ->
          {:error, error}
      end
    else
      {:error, "course_id and member_ids are required"}
    end
  end
end
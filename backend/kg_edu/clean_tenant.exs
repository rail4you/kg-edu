tenant = "org_c1d3065a_5af9_4df6_b790_50dfd40dfc19"
tables = [
  # Tables that reference other tables first (child before parent)
  "course_enrollments", "course_assignments", "course_videos",
  "chapters", "videos", "books", "courses",
  "discussion_replies", "discussions",
  "files", "links", "classes",
  "exercises", "homeworks",
  "knowledge_question_connections", "knowledge_questions",
  "knowledge_relations", "knowledge_resources", "relation_types",
  "curriculum_designs",
  "users",
  "file_templates",
]

Enum.each(tables, fn t ->
  try do
    {:ok, res} = Ecto.Adapters.SQL.query(KgEdu.Repo, "DELETE FROM \"#{tenant}\".#{t}", [])
    IO.puts("#{t}: #{res.num_rows} deleted")
  rescue
    e -> IO.puts("#{t}: skip - #{Exception.message(e)}")
  end
end)

IO.puts("CLEANED #{tenant}")

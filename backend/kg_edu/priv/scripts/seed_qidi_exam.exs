# 为「启迪」租户创建教师 wang、学生 chen，并造一套完整考试数据用于统计/分析页验证。
# 运行：cd backend/kg_edu && MIX_ENV=dev mix run priv/scripts/seed_qidi_exam.exs
#
# 登录：wang / 123456（教师）、chen / 123456（学生）

alias KgEdu.Accounts.User
alias KgEdu.Courses.Course
alias KgEdu.Knowledge.{Exam, ExamExercise, Exercise, StudentExam, StudentExamAnswer}

require Ash.Query

tenant = "org_63fdf2ba_1e29_4cf9_b4e6_27318330bb8d"
opts = [tenant: tenant, authorize?: false]
now = DateTime.utc_now()

IO.puts("== 租户: #{tenant} ==")

# ── 用户 ────────────────────────────────────────────────────────────────
ensure_user = fn member_id, name, role ->
  case User |> Ash.Query.filter(member_id == ^member_id) |> Ash.read(opts) do
    {:ok, [u | _]} ->
      IO.puts("用户已存在: #{member_id} (#{u.id})")
      u

    _ ->
      {:ok, u} =
        User.create_user(
          %{member_id: member_id, name: name, password: "123456", role: role},
          opts
        )

      IO.puts("创建用户: #{member_id} (#{u.id})")
      u
  end
end

teacher = ensure_user.("wang", "王老师", :teacher)
student = ensure_user.("chen", "陈同学", :user)

# ── 课程 ────────────────────────────────────────────────────────────────
course =
  case Course |> Ash.Query.filter(title == "启迪测试课程") |> Ash.read(opts) do
    {:ok, [c | _]} ->
      c

    _ ->
      {:ok, c} =
        Course.create_course(
          %{
            title: "启迪测试课程",
            description: "用于验证考试统计分析的样例课程",
            teacher_id: teacher.id,
            publish_status: true
          },
          opts
        )

      IO.puts("创建课程: #{c.title} (#{c.id})")
      c
  end

# ── 考试 ────────────────────────────────────────────────────────────────
exam =
  case Exam |> Ash.Query.filter(title == "启迪测试考试") |> Ash.read(opts) do
    {:ok, [e | _]} ->
      e

    _ ->
      {:ok, e} =
        Exam.create_exam(
          %{
            title: "启迪测试考试",
            description: "统计分析样例试卷",
            exam_type: :quiz,
            duration_minutes: 60,
            passing_score: 30,
            course_id: course.id,
            created_by_id: teacher.id,
            exam_date: DateTime.add(now, -3600, :second)
          },
          opts
        )

      IO.puts("创建考试: #{e.title} (#{e.id})")
      e
  end

# ── 习题 ────────────────────────────────────────────────────────────────
questions = [
  %{
    title: "选择题：HTTP 状态码 200 表示？",
    question_content: "以下哪个状态码表示请求成功？",
    question_type: :multiple_choice,
    answer: "A",
    difficulty: 1,
    points: 10,
    student_answer: "A",
    awarded: 10
  },
  %{
    title: "判断题：GET 请求可以携带请求体。",
    question_content: "GET 请求通常不携带请求体。",
    question_type: :true_false,
    answer: "错误",
    difficulty: 2,
    points: 10,
    student_answer: "错误",
    awarded: 10
  },
  %{
    title: "填空题：TCP 是面向____的协议。",
    question_content: "TCP 是面向____的协议。",
    question_type: :fill_in_blank,
    answer: "连接",
    difficulty: 3,
    points: 10,
    student_answer: "对象",
    awarded: 0
  },
  %{
    title: "问答题：简述 REST 的核心思想。",
    question_content: "简述 REST 的核心思想。",
    question_type: :essay,
    answer: "以资源为中心，通过统一接口对资源进行操作。",
    difficulty: 3,
    points: 20,
    student_answer: "以资源为中心，用 HTTP 方法操作资源。",
    awarded: 15
  }
]

existing_titles =
  ExamExercise
  |> Ash.Query.filter(exam_id == ^exam.id)
  |> Ash.Query.load(:exercise)
  |> Ash.read!(opts)
  |> Enum.map(&(&1.exercise && &1.exercise.title))

questions
|> Enum.with_index(1)
|> Enum.each(fn {q, idx} ->
  if q.title in existing_titles do
    IO.puts("  习题已存在，跳过: #{q.title}")
  else
    {:ok, exercise} =
      Exercise.create_exercise(
        %{
          title: q.title,
          question_content: q.question_content,
          question_type: q.question_type,
          answer: q.answer,
          difficulty: q.difficulty,
          course_id: course.id,
          created_by_id: teacher.id
        },
        opts
      )

    {:ok, _ee} =
      ExamExercise.create_exam_exercise(
        %{points: q.points, order: idx, exam: exam.id, exercise: exercise.id},
        opts
      )

    IO.puts("  习题#{idx}: #{q.title} (#{q.question_type}, #{q.points}分)")
  end
end)

# ── 学生作答 ─────────────────────────────────────────────────────────────
# start_exam 会自动为每道题创建空作答（若已存在则复用）
{:ok, existing_se} =
  StudentExam
  |> Ash.Query.filter(exam_id == ^exam.id and student_id == ^student.id)
  |> Ash.read(opts)
  |> then(fn
    {:ok, [se | _]} -> {:ok, se}
    _ -> StudentExam.start_exam(%{exam_id: exam.id, student_id: student.id}, opts)
  end)

student_exam = existing_se
IO.puts("学生作答记录: student_exam=#{student_exam.id} status=#{student_exam.status}")

answers =
  StudentExamAnswer
  |> Ash.Query.filter(student_exam_id == ^student_exam.id)
  |> Ash.read!(opts)

# 逐题写入作答与得分
answers
  |> Enum.each(fn ans ->
    # 通过 exam_exercise 关联找到对应习题的作答
    loaded =
      StudentExamAnswer
      |> Ash.Query.filter(id == ^ans.id)
      |> Ash.Query.load([:exam_exercise, :exercise])
      |> Ash.read!(opts)
      |> List.first()

    exercise_title = loaded.exercise && loaded.exercise.title
    match = Enum.find(questions, fn q -> q.title == exercise_title end)

    {student_answer, awarded} =
      case match do
        nil -> {"", 0}
        m -> {m.student_answer, m.awarded}
      end

    loaded
    |> Ash.Changeset.for_update(:update_answer, %{answer: student_answer, answered_at: now})
    |> Ash.update!(opts)

    loaded
    |> Ash.Changeset.for_update(:grade, %{
      points_earned: awarded,
      graded: true,
      graded_at: now,
      feedback: "样例批改"
    })
    |> Ash.update!(opts)
  end)

:ok = StudentExam.grade_exam(%{student_exam_id: student_exam.id}, opts)

{:ok, final} = StudentExam.get_student_exam(%{id: student_exam.id}, opts)
IO.puts("批改结果: 得分 #{final.score}/#{final.total_score} status=#{final.status} passed=#{final.passed}")

IO.puts("""

完成 ✅
- 教师：wang / 123456
- 学生：chen / 123456
- 课程：#{course.title}
- 考试：#{exam.title} (#{exam.id})
- 去 考试管理 → #{exam.title} → 统计分析 查看成绩分析
""")

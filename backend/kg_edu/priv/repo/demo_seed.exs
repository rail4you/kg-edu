# 智慧课程演示数据（一键灌入，供 15 项演示走查）。
# 运行：MIX_ENV=dev mix run priv/repo/demo_seed.exs
# 幂等：已存在同名「【演示】」数据则跳过。

require Ash.Query

tenant = "org_2af44c7b_081a_497a_9858_365fa90ad5d7"
opts = [tenant: tenant, authorize?: false]
IO.puts("== 演示数据灌入 tenant=#{tenant} ==")

find_user = fn member_id ->
  KgEdu.Accounts.User
  |> Ash.Query.filter(member_id == ^member_id)
  |> Ash.read_one!(opts)
end

teacher = find_user.("teacher") || raise "缺少演示教师账号 teacher"

student =
  find_user.("cd123456") ||
    KgEdu.Accounts.create_user!(%{member_id: "演示学生", name: "演示学生", password: "password123", colledge: "演示学院"}, opts)

# 演示学生归属院系（签到率/上传量演示用）
if is_nil(student.colledge) do
  student |> Ash.Changeset.for_update(:update, %{colledge: "演示学院"}) |> Ash.update!(opts)
end

student2 =
  find_user.("456789") ||
    KgEdu.Accounts.create_user!(%{member_id: "演示学生2", name: "演示学生二", password: "password123", colledge: "演示学院"}, opts)

IO.puts("教师=#{teacher.name} 学生=#{student.name}/#{student2.name}")

# ── 课程与章节 ─────────────────────────────────────────────────────────
course =
  case KgEdu.Courses.Course |> Ash.Query.filter(title == "【演示】智慧课程导论") |> Ash.read_one!(opts) do
    nil ->
      KgEdu.Courses.Course.create_course!(
        %{title: "【演示】智慧课程导论", description: "15项功能演示专用课", teacher_id: teacher.id},
        opts
      )

    c ->
      c
  end

IO.puts("课程=#{course.id}")

mk_chapter = fn title, parent_id ->
  q =
    KgEdu.Courses.Chapter
    |> Ash.Query.filter(title == ^title and course_id == ^course.id)

  case Ash.read_one!(q, opts) do
    nil ->
      KgEdu.Courses.Chapter.create_chapter!(
        %{title: title, description: "#{title}简介", course_id: course.id, parent_chapter_id: parent_id},
        opts
      )

    c ->
      c
  end
end

ch1 = mk_chapter.("第一章 人工智能导论", nil)
ch11 = mk_chapter.("1.1 机器学习基础", ch1.id)
ch12 = mk_chapter.("1.2 神经网络入门", ch1.id)
IO.puts("章节=#{ch1.id} 子=#{ch11.id},#{ch12.id}")

# ── 知识点 ─────────────────────────────────────────────────────────────
mk_resource = fn name, type, parent_id ->
  q =
    KgEdu.Knowledge.Resource
    |> Ash.Query.filter(name == ^name and course_id == ^course.id)

  case Ash.read_one!(q, opts) do
    nil ->
      KgEdu.Knowledge.Resource.create_knowledge_resource!(
        %{
          name: name,
          description: "#{name}知识点",
          course_id: course.id,
          knowledge_type: type,
          importance_level: "important",
          parent_knowledge_resource_id: parent_id
        },
        opts
      )

    r ->
      r
  end
end

subj = mk_resource.("人工智能", :subject, nil)
cell1 = mk_resource.("机器学习", :knowledge_cell, subj.id)
cell2 = mk_resource.("神经网络", :knowledge_cell, subj.id)
IO.puts("知识点=#{subj.id}")

# ── 习题（多题型/多难度） ──────────────────────────────────────────────
mk_exercise = fn title, type, difficulty, knowledge_id ->
  q =
    KgEdu.Knowledge.Exercise
    |> Ash.Query.filter(title == ^title and course_id == ^course.id)

  case Ash.read_one!(q, opts) do
    nil ->
      KgEdu.Knowledge.Exercise.create_exercise!(
        %{
          title: title,
          question_content: "#{title}：请作答",
          answer: "略",
          question_type: type,
          difficulty: difficulty,
          options: %{"A" => "选项A", "B" => "选项B", "C" => "选项C", "D" => "选项D"},
          course_id: course.id,
          knowledge_resource_id: knowledge_id
        },
        opts
      )

    e ->
      e
  end
end

ex1 = mk_exercise.("【演示】单选-ML概念", :multiple_choice, 1, cell1.id)
ex2 = mk_exercise.("【演示】单选-神经网络", :multiple_choice, 2, cell2.id)
ex3 = mk_exercise.("【演示】判断-感知机", :true_false, 1, cell1.id)
ex4 = mk_exercise.("【演示】填空-激活函数", :fill_in_blank, 3, cell2.id)
ex5 = mk_exercise.("【演示】问答-深度学习展望", :essay, 3, cell2.id)
ex6 = mk_exercise.("【演示】多选-ML算法", :multiple_response, 3, cell1.id)
IO.puts("习题 6 道就绪")

# ── 试卷 + 考生作答（正确率演示） ──────────────────────────────────────
exam =
  case KgEdu.Knowledge.Exam |> Ash.Query.filter(title == "【演示】期中试卷") |> Ash.read_one!(opts) do
    nil ->
      KgEdu.Knowledge.Exam.create_exam!(
        %{title: "【演示】期中试卷", course_id: course.id, passing_score: 60, created_by_id: teacher.id},
        opts
      )

    e ->
      e
  end

mk_ee = fn exercise, points, order ->
  q =
    KgEdu.Knowledge.ExamExercise
    |> Ash.Query.filter(exam_id == ^exam.id and exercise_id == ^exercise.id)

  case Ash.read_one!(q, opts) do
    nil ->
      KgEdu.Knowledge.ExamExercise.create_exam_exercise!(
        %{exam: exam.id, exercise: exercise.id, points: points, order: order},
        opts
      )

    ee ->
      ee
  end
end

[ex1, ex2, ex3, ex4, ex5, ex6]
|> Enum.with_index(1)
|> Enum.each(fn {ex, i} -> mk_ee.(ex, if(i <= 3, do: 10, else: 5), i) end)

grade_all = fn student_id, earned_map ->
  {:ok, se} = KgEdu.Knowledge.StudentExam.start_exam(%{exam_id: exam.id, student_id: student_id}, opts)
  {:ok, answers} = KgEdu.Knowledge.StudentExamAnswer.get_answers_by_student_exam(%{student_exam_id: se.id}, opts)

  Enum.each(answers, fn a ->
    earned = Map.get(earned_map, a.exercise_id, 0)

    a
    |> Ash.Changeset.for_update(:grade, %{points_earned: earned, graded: true})
    |> Ash.update!(opts)
  end)
end

# 学生1：单选全对、问答半对；学生2：只对一半单选（制造正确率差异）
grade_all.(student.id, %{ex1.id => 10, ex2.id => 10, ex3.id => 10, ex4.id => 0, ex5.id => 3, ex6.id => 0})
grade_all.(student2.id, %{ex1.id => 10, ex2.id => 0, ex3.id => 0, ex4.id => 5, ex5.id => 0, ex6.id => 5})
IO.puts("试卷=#{exam.id} 两名考生已交卷批改")

# ── 课程视频（解析页演示；ASR 需有效 Key，分析记录用 mock 预置） ───────
video =
  case KgEdu.Courses.CourseVideo
       |> Ash.Query.filter(course_id == ^course.id)
       |> Ash.read!(opts) do
    {:ok, [v | _]} ->
      v

    _ ->
      KgEdu.Courses.CourseVideo.create_course_video!(
        %{
          name: "课程视频",
          media_type: "video",
          video_url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
          course_id: course.id
        },
        opts
      )
  end

IO.puts("视频=#{video.id}")

analysis =
  case KgEdu.Courses.VideoAnalysis.get_analysis_by_video(
         %{video_type: "course_video", video_id: video.id},
         opts
       ) do
    {:ok, [a | _]} ->
      a

    _ ->
      {:ok, a} =
        KgEdu.Courses.VideoAnalysis.create_video_analysis(
          %{video_type: "course_video", video_id: video.id, course_id: course.id},
          opts
        )

      a
  end

analysis =
  if analysis.status == :done do
    analysis
  else
    analysis
    |> Ash.Changeset.for_update(:update, %{
      status: :done,
        summary: "本视频介绍人工智能的基本概念、机器学习流程与神经网络原理，并展望深度学习应用。",
        segments: [
          %{start_sec: 0, end_sec: 120, title: "人工智能概述", summary: "介绍 AI 定义与发展简史。"},
          %{start_sec: 120, end_sec: 300, title: "机器学习流程", summary: "讲解数据、模型、训练三要素。"},
          %{start_sec: 300, end_sec: 420, title: "神经网络入门", summary: "感知机、激活函数与反向传播。"}
        ],
        wordcloud: [
          %{word: "人工智能", weight: 10},
          %{word: "机器学习", weight: 9},
          %{word: "神经网络", weight: 8},
          %{word: "模型", weight: 5},
          %{word: "数据", weight: 4}
        ]
      })
      |> Ash.update!(opts)
  end

Enum.each([{cell1.id, "机器学习", 130}, {cell2.id, "神经网络", 310}], fn {rid, label, sec} ->
  q =
    KgEdu.Courses.VideoKnowledgeMark
    |> Ash.Query.filter(video_id == ^video.id and knowledge_resource_id == ^rid)

  case Ash.read_one!(q, opts) do
    nil ->
      KgEdu.Courses.VideoKnowledgeMark.create_mark!(
        %{video_type: "course_video", video_id: video.id, knowledge_resource_id: rid, point_sec: sec, label: label},
        opts
      )

    _ ->
      :ok
  end
end)

IO.puts("视频解析 mock 记录就绪")

# ── 表单 + 提交 ────────────────────────────────────────────────────────
form =
  case KgEdu.Forms.FormDef |> Ash.Query.filter(title == "【演示】请假申请") |> Ash.read_one!(opts) do
    nil ->
      KgEdu.Forms.FormDef.create_form_def!(
        %{
          title: "【演示】请假申请",
          category: "请假",
          schema: [
            %{"key" => "reason", "label" => "请假事由", "type" => "textarea", "required" => true},
            %{"key" => "days", "label" => "天数", "type" => "number", "required" => true},
            %{"key" => "kind", "label" => "类型", "type" => "radio", "required" => false, "options" => ["事假", "病假"]}
          ]
        },
        opts
      )

    f ->
      f
  end

case KgEdu.Forms.FormSubmission.list_submissions_by_form(%{form_id: form.id}, opts) do
  {:ok, []} ->
    KgEdu.Forms.FormSubmission.submit_form!(
      %{form_id: form.id, submitter_id: student.id, values: %{"reason" => "感冒发烧", "days" => 2, "kind" => "病假"}},
      opts
    )

  _ ->
    :ok
end

IO.puts("表单=#{form.id}")

# ── 签到（问答演示） ───────────────────────────────────────────────────
{:ok, session} =
  KgEdu.Attendance.CheckInSession.create(
    %{title: "【演示】签到", description: "演示用", created_by_id: teacher.id},
    opts
  )
  |> case do
    {:ok, s} -> {:ok, s}
    {:error, _} -> {:ok, %{token: nil}}
  end

if session.token do
  Enum.each([student.id, student2.id], fn uid ->
    KgEdu.Attendance.CheckInRecord.check_in(%{user_id: uid, token: session.token}, opts)
  end)
end

IO.puts("签到场次就绪")

# ── 文件（上传量演示） ─────────────────────────────────────────────────
Enum.each(["演示讲义.pdf", "演示课件.pptx"], fn name ->
  q = KgEdu.Courses.File |> Ash.Query.filter(filename == ^name)

  case Ash.read_one!(q, opts) do
    nil ->
      KgEdu.Courses.File
      |> Ash.Changeset.for_create(:create, %{
        filename: name,
        path: "https://kg-edu.oss-cn-beijing.aliyuncs.com/demo/#{name}",
        size: 1024,
        file_type: "doc",
        purpose: "course_material",
        source: "demo",
        created_by_id: teacher.id,
        course_id: course.id
      })
      |> Ash.create!(opts)

    _ ->
      :ok
  end
end)

IO.puts("文件记录就绪")

# ── 报告模板 / 助教工具 / 追踪 / 实践 / 抓拍 ───────────────────────────
{:ok, _} =
  KgEdu.Insights.ReportTemplate.create_report_template(
    %{name: "【演示】上传量报表", kind: :table, config: %{dataset: "upload", days: 30}},
    opts
  )
  |> case do
    {:ok, _} = ok -> ok
    {:error, _} -> {:ok, :exists}
  end

Enum.each([{"官网解析", "plugin", "web_parse"}, {"天气服务", "mcp", "weather"}], fn {name, kind, plugin} ->
  q = KgEdu.AI.AssistantTool |> Ash.Query.filter(name == ^name)

  case Ash.read_one!(q, opts) do
    nil -> KgEdu.AI.AssistantTool.create_assistant_tool!(%{name: name, kind: String.to_atom(kind), plugin: plugin}, opts)
    _ -> :ok
  end
end)

Enum.each([{"interest", "graph neural networks", "GNN"}, {"scholar", "A689832436", "Yoshua Bengio"}], fn {kind, ref, label} ->
  q = KgEdu.AI.ResearchFollow |> Ash.Query.filter(ref_id == ^ref)

  case Ash.read_one!(q, opts) do
    nil ->
      KgEdu.AI.ResearchFollow.follow_research!(
        %{user_id: teacher.id, kind: String.to_atom(kind), ref_id: ref, label: label},
        opts
      )

    _ ->
      :ok
  end
end)

case KgEdu.Knowledge.PracticeAttempt.list_attempts_by_user(%{user_id: student.id}, opts) do
  {:ok, []} ->
    KgEdu.Knowledge.PracticeAttempt.create_practice_attempt!(
      %{
        scenario: :debate_arena,
        user_id: student.id,
        course_id: course.id,
        transcript: [%{"role" => "user", "content" => "AI 应该取代教师"}, %{"role" => "ai", "content" => "反方观点…"}],
        score: 82,
        report: "论点鲜明，论据可再充实。",
        status: :evaluated
      },
      opts
    )

  _ ->
    :ok
end

KgEdu.Attendance.FaceCheckLog.log_face_check!(
  %{user_id: student.id, scene: :video_start, result: :pass, course_id: course.id, note: "演示"},
  opts
)

IO.puts("== 演示数据灌入完成 ==")
IO.puts("course_id=#{course.id}")
IO.puts("exam_id=#{exam.id}")
IO.puts("video_id=#{video.id}")
IO.puts("form_id=#{form.id}")

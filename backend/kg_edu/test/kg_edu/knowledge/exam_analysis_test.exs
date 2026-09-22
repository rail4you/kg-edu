defmodule KgEdu.Knowledge.ExamAnalysisTest do
  @moduledoc """
  P1: 试卷分析 — 题型/难易度统计（题量+分数）、题目明细、跨考试正确率。
  """
  use KgEdu.DataCase, async: true

  import KgEdu.AccountsFixtures

  alias KgEdu.Courses.Course
  alias KgEdu.Knowledge.{Exercise, Exam, ExamExercise, StudentExam, StudentExamAnswer}

  setup do
    tenant = test_tenant()
    teacher = user_fixture()
    student = user_fixture()

    {:ok, course} =
      Course.create_course(%{title: "分析测试课", teacher_id: teacher.id}, tenant: tenant)

    {:ok, mc} =
      Exercise.create_exercise(
        %{
          title: "单选1",
          question_content: "1+1=?",
          answer: "2",
          question_type: :multiple_choice,
          options: %{"A" => "1", "B" => "2"},
          course_id: course.id,
          difficulty: 1
        },
        tenant: tenant
      )

    {:ok, essay} =
      Exercise.create_exercise(
        %{
          title: "问答1",
          question_content: "论述…",
          answer: "略",
          question_type: :essay,
          course_id: course.id,
          difficulty: 3
        },
        tenant: tenant
      )

    {:ok, exam} =
      Exam.create_exam(%{title: "期中卷", course_id: course.id, passing_score: 9, created_by_id: teacher.id}, tenant: tenant)

    {:ok, ee1} =
      ExamExercise.create_exam_exercise(
        %{exam: exam.id, exercise: mc.id, points: 5, order: 1},
        tenant: tenant
      )

    {:ok, _ee2} =
      ExamExercise.create_exam_exercise(
        %{exam: exam.id, exercise: essay.id, points: 10, order: 2},
        tenant: tenant
      )

    # 一名考生交卷：单选满分(5/5)，问答半对(5/10)，均已批改
    {:ok, student_exam} =
      StudentExam.start_exam(%{exam_id: exam.id, student_id: student.id}, tenant: tenant)

    {:ok, answers} =
      StudentExamAnswer.get_answers_by_student_exam(%{student_exam_id: student_exam.id},
        tenant: tenant
      )

    for answer <- answers do
      earned = if answer.exercise_id == mc.id, do: 5, else: 5

      answer
      |> Ash.Changeset.for_update(:grade, %{points_earned: earned, graded: true})
      |> Ash.update!(tenant: tenant)
    end

    %{tenant: tenant, exam: exam, mc: mc, essay: essay, ee1: ee1}
  end

  test "题型/难易度统计按题量与分数汇总", %{tenant: tenant, exam: exam} do
    assert {:ok, analysis} = Exam.get_exam_analysis(%{exam_id: exam.id}, tenant: tenant)

    assert analysis.total_questions == 2
    assert analysis.total_score == 15

    by_type = Map.new(analysis.by_type, &{&1.key, &1})
    assert by_type["multiple_choice"] == %{key: "multiple_choice", count: 1, score: 5}
    assert by_type["essay"] == %{key: "essay", count: 1, score: 10}

    by_diff = Map.new(analysis.by_difficulty, &{&1.key, &1})
    assert by_diff[1] == %{key: 1, count: 1, score: 5}
    assert by_diff[3] == %{key: 3, count: 1, score: 10}
  end

  test "题目明细含正确率与考试次数", %{tenant: tenant, exam: exam, mc: mc, essay: essay} do
    assert {:ok, analysis} = Exam.get_exam_analysis(%{exam_id: exam.id}, tenant: tenant)

    items = Enum.sort_by(analysis.items, & &1.order)
    assert length(items) == 2

    [first, second] = items
    assert first.exercise_id == mc.id
    assert first.points == 5
    assert first.correct_rate == 1.0
    assert first.attempts == 1

    assert second.exercise_id == essay.id
    assert second.points == 10
    assert second.correct_rate == 0.5
    assert second.attempts == 1

    assert Enum.all?(items, &Map.has_key?(&1, :knowledge_point))
  end

  test "无作答时正确率为 nil、次数为 0", %{tenant: tenant} do
    teacher = user_fixture()

    {:ok, course2} =
      Course.create_course(%{title: "空考课", teacher_id: teacher.id}, tenant: tenant)

    {:ok, ex} =
      Exercise.create_exercise(
        %{title: "判断题一", question_content: "对吗", answer: "对", question_type: :true_false, course_id: course2.id},
        tenant: tenant
      )

    {:ok, exam2} = Exam.create_exam(%{title: "空白试卷", course_id: course2.id, passing_score: 1, created_by_id: teacher.id}, tenant: tenant)

    {:ok, _} =
      ExamExercise.create_exam_exercise(
        %{exam: exam2.id, exercise: ex.id, points: 2, order: 1},
        tenant: tenant
      )

    assert {:ok, analysis} = Exam.get_exam_analysis(%{exam_id: exam2.id}, tenant: tenant)
    [item] = analysis.items
    assert item.correct_rate == nil
    assert item.attempts == 0
  end

  test "试卷不存在返回错误", %{tenant: tenant} do
    assert {:error, _} =
             Exam.get_exam_analysis(%{exam_id: Ash.UUID.generate()}, tenant: tenant)
  end
end

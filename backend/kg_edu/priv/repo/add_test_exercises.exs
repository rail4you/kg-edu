# Script to add test exercises to exam
# Run with: mix run priv/repo/add_test_exercises.exs

alias KgEdu.Knowledge

tenant = "org_2af44c7b_081a_497a_9858_365fa90ad5d7"
exam_id = "76519cb4-323b-4c8e-ad03-93c666e88a86"

# Check if exercises already exist for this exam
import Ash.Query
existing_query = Knowledge.ExamExercise
  |> filter(exam_id == ^exam_id)
  |> Ash.Query.set_context(%{tenant: tenant})

existing_results = case Ash.read(existing_query) do
  {:ok, results} -> results
  _ -> []
end

if length(existing_results) > 0 do
  IO.puts("Exam already has #{length(existing_results)} exercises. Skipping creation.")
  System.halt(0)
end

# Create test exercises
exercises_data = [
  %{
    title: "什么是React？",
    question_content: "请简述React的主要特点和优势。",
    question_type: :essay,
    answer: "React是一个用于构建用户界面的JavaScript库。主要特点包括：组件化、虚拟DOM、单向数据流、声明式编程等。"
  },
  %{
    title: "JSX与HTML的区别",
    question_content: "JSX和普通HTML有什么区别？请举例说明。",
    question_type: :essay,
    answer: "JSX是JavaScript的语法扩展，允许在JS中写类似HTML的代码。主要区别：1) JSX可以嵌入JS表达式；2) 使用className代替class；3) 属性名采用驼峰命名；4) 必须有单一根元素等。"
  },
  %{
    title: "React Hooks的理解",
    question_content: "什么是React Hooks？它解决了什么问题？",
    question_type: :essay,
    answer: "Hooks是React 16.8引入的特性，允许在函数组件中使用state和其他React特性。主要解决了：1) class组件逻辑复用难的问题；2) 组件树变复杂的问题；3) class组件this指向困扰等。常用Hooks包括useState、useEffect、useContext等。"
  },
  %{
    title: "组件生命周期",
    question_content: "请描述React组件的主要生命周期方法及其作用。",
    question_type: :essay,
    answer: "主要生命周期方法包括：1) componentDidMount：组件挂载后执行，适合发送API请求；2) componentDidUpdate：组件更新后执行；3) componentWillUnmount：组件卸载前执行，适合清理工作。Hooks中useEffect可以模拟这些生命周期。"
  },
  %{
    title: "状态管理方案",
    question_content: "你熟悉哪些React状态管理方案？它们各有什么特点？",
    question_type: :essay,
    answer: "常见方案包括：1) useState：组件内部状态；2) Context API：跨组件共享状态；3) Redux：全局状态管理，单向数据流；4) Zustand：轻量级状态管理；5) Recoil：Facebook出品，原子化状态。选择取决于项目规模和复杂度。"
  }
]

IO.puts("Creating #{length(exercises_data)} exercises...")

created_exercises =
  Enum.map(exercises_data, fn exercise_data ->
    {:ok, exercise} =
      Ash.create(Knowledge.Exercise, exercise_data,
        action: :create,
        tenant: tenant
      )

    IO.puts("✓ Created exercise: #{exercise.title}")
    exercise
  end)

# Create exam exercises
IO.puts("\nLinking exercises to exam...")

Enum.with_index(created_exercises, 1)
|> Enum.each(fn {exercise, index} ->
  {:ok, _exam_exercise} =
    Ash.create(
      Knowledge.ExamExercise,
      %{
        exam: exam_id,
        exercise: exercise.id,
        points: 20,
        order: index
      },
      action: :create,
      tenant: tenant
    )

  IO.puts("✓ Linked exercise #{index}: #{exercise.title} (20 points)")
end)

IO.puts("\n✅ Successfully added #{length(created_exercises)} exercises to exam!")
IO.puts("Total exam score: #{length(created_exercises) * 20} points")

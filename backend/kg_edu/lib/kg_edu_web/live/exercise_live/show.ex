defmodule KgEduWeb.ExerciseLive.Show do
  use KgEduWeb, :live_view

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <.header>
        Exercise {@exercise.id}
        <:subtitle>This is a exercise record from your database.</:subtitle>

        <:actions>
          <.button navigate={~p"/exercises"}>
            <.icon name="hero-arrow-left" />
          </.button>
          <.button variant="primary" navigate={~p"/exercises/#{@exercise}/edit?return_to=show"}>
            <.icon name="hero-pencil-square" /> Edit Exercise
          </.button>
        </:actions>
      </.header>

      <.list>
        <:item title="Id">{@exercise.id}</:item>

        <:item title="Title">{@exercise.title}</:item>

        <:item title="Question content">{@exercise.question_content}</:item>

        <:item title="Answer">{@exercise.answer}</:item>

        <:item title="Question type">{@exercise.question_type}</:item>

        <:item title="Options">{@exercise.options}</:item>

        <:item title="Knowledge resource">{@exercise.knowledge_resource_id}</:item>

        <:item title="Course">{@exercise.course_id}</:item>

        <:item title="Created by">{@exercise.created_by_id}</:item>
      </.list>
    </Layouts.app>
    """
  end

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, "Show Exercise")
     |> assign(
       :exercise,
       Ash.get!(KgEdu.Knowledge.Exercise, id, actor: socket.assigns.current_user)
     )}
  end
end

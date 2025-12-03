defmodule KgEduWeb.ExerciseLive.Index do
  use KgEduWeb, :live_view

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <div data-theme="green" class="rounded-lg p-4">
      <.header>
        Listing Exercises
        <:actions>
          <.button variant="primary" navigate={~p"/exercises/new"}>
            <.icon name="hero-plus" /> New Exercise
          </.button>
        </:actions>
      </.header>

      <.table
        id="exercises"
        rows={@streams.exercises}
        row_click={fn {_id, exercise} -> JS.navigate(~p"/exercises/#{exercise}") end}
      >
        <:col :let={{_id, exercise}} label="Id">{exercise.id}</:col>

        <:col :let={{_id, exercise}} label="Title">{exercise.title}</:col>

        <:col :let={{_id, exercise}} label="Question content">{exercise.question_content}</:col>

        <:col :let={{_id, exercise}} label="Answer">{exercise.answer}</:col>

        <:col :let={{_id, exercise}} label="Question type">{exercise.question_type}</:col>

        <:col :let={{_id, exercise}} label="Options">{exercise.options}</:col>

        <:col :let={{_id, exercise}} label="Knowledge resource">
          {exercise.knowledge_resource_id}
        </:col>

        <:col :let={{_id, exercise}} label="Course">{exercise.course_id}</:col>

        <:col :let={{_id, exercise}} label="Created by">{exercise.created_by_id}</:col>

        <:action :let={{_id, exercise}}>
          <div class="sr-only">
            <.link navigate={~p"/exercises/#{exercise}"}>Show</.link>
          </div>

          <.link navigate={~p"/exercises/#{exercise}/edit"}>Edit</.link>
        </:action>

        <:action :let={{id, exercise}}>
          <.link
            phx-click={JS.push("delete", value: %{id: exercise.id}) |> hide("##{id}")}
            data-confirm="Are you sure?"
          >
            Delete
          </.link>
        </:action>
      </.table>
      </div>
    </Layouts.app>
    """
  end

  @impl true
  def mount(_params, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, "Listing Exercises")
     |> assign_new(:current_user, fn -> nil end)
     |> stream(
       :exercises,
       Ash.read!(KgEdu.Knowledge.Exercise, actor: socket.assigns[:current_user])
     )}
  end

  @impl true
  def handle_event("delete", %{"id" => id}, socket) do
    exercise = Ash.get!(KgEdu.Knowledge.Exercise, id, actor: socket.assigns.current_user)
    KgEdu.Knowledge.Exercise.delete_exercise!(exercise, actor: socket.assigns.current_user)

    {:noreply, stream_delete(socket, :exercises, exercise)}
  end
end

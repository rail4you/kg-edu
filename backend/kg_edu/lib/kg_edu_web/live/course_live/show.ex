defmodule KgEduWeb.CourseLive.Show do
  use KgEduWeb, :live_view

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <.header>
        Course {@course.id}
        <:subtitle>This is a course record from your database.</:subtitle>

        <:actions>
          <.button navigate={~p"/courses"}>
            <.icon name="hero-arrow-left" />
          </.button>
          <.button variant="primary" navigate={~p"/courses/#{@course}/edit?return_to=show"}>
            <.icon name="hero-pencil-square" /> Edit Course
          </.button>
        </:actions>
      </.header>

      <.list>
        <:item title="Id">{@course.id}</:item>

        <:item title="Title">{@course.title}</:item>

        <:item title="Description">{@course.description}</:item>

        <:item title="Teacher">{@course.teacher_id}</:item>
      </.list>
    </Layouts.app>
    """
  end

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, "Show Course")
     |> assign(:course, Ash.get!(KgEdu.Courses.Course, id, actor: socket.assigns.current_user))}
  end
end

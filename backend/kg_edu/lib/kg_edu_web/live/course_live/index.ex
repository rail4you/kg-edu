defmodule KgEduWeb.CourseLive.Index do
  use KgEduWeb, :live_view

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_page={@current_page}>
      <.header>
        Listing Courses
        <:actions>
          <.button variant="primary" navigate={~p"/courses/new"}>
            <.icon name="hero-plus" /> New Course
          </.button>
        </:actions>
      </.header>

      <.table
        id="courses"
        rows={@streams.courses}
        row_click={fn {_id, course} -> JS.navigate(~p"/courses/#{course}") end}
      >
        <:col :let={{_id, course}} label="Id">{course.id}</:col>

        <:col :let={{_id, course}} label="Title">{course.title}</:col>

        <:col :let={{_id, course}} label="Description">{course.description}</:col>

        <:col :let={{_id, course}} label="Teacher">{course.teacher.member_id}</:col>

        <:action :let={{_id, course}}>
          <div class="sr-only">
            <.link navigate={~p"/courses/#{course}"}>Show</.link>
          </div>

          <.link navigate={~p"/courses/#{course}/edit"}>Edit</.link>
        </:action>

        <:action :let={{id, course}}>
          <.link
            phx-click={JS.push("delete", value: %{id: course.id}) |> hide("##{id}")}
            data-confirm="Are you sure?"
          >
            Delete
          </.link>
        </:action>
      </.table>
    </Layouts.app>
    """
  end

  @impl true
  def mount(_params, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, "Listing Courses")
     |> assign(:current_page, :courses)
     |> assign_new(:current_user, fn -> nil end)
     |> stream(:courses, Ash.read!(KgEdu.Courses.Course, actor: socket.assigns[:current_user], load: [:teacher]))}
  end

  @impl true
  def handle_event("delete", %{"id" => id}, socket) do
    course = Ash.get!(KgEdu.Courses.Course, id, actor: socket.assigns.current_user)
    KgEdu.Courses.Course.delete_course!(course, actor: socket.assigns.current_user)

    {:noreply, stream_delete(socket, :courses, course)}
  end
end

defmodule KgEduWeb.CoursesLive.Index do
  use KgEduWeb, :live_view
  alias KgEdu.Courses
  alias KgEdu.Courses.Course

  on_mount {KgEduWeb.LiveUserAuth, :live_user_required}

  @impl true
  def mount(_params, _session, socket) do
    {:ok, assign(socket, :courses, list_courses())}
  end

  @impl true
  def handle_params(params, _url, socket) do
    {:noreply, apply_action(socket, socket.assigns.live_action, params)}
  end

  defp apply_action(socket, :index, _params) do
    socket
    |> assign(:page_title, "Courses")
    |> assign(:course, nil)
  end

  defp apply_action(socket, :new, _params) do
    socket
    |> assign(:page_title, "New Course")
    |> assign(:course, %Course{})
  end

  defp apply_action(socket, :edit, %{"id" => id}) do
    course = Courses.get_course!(id)
    
    socket
    |> assign(:page_title, "Edit Course")
    |> assign(:course, course)
  end

  @impl true
  def handle_event("delete", %{"id" => id}, socket) do
    course = Courses.get_course!(id)
    {:ok, _} = Courses.destroy_course(course)

    {:noreply, assign(socket, :courses, list_courses())}
  end

  defp list_courses do
    Courses.read_course()
  end
end
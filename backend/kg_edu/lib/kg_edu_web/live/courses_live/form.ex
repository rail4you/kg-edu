defmodule KgEduWeb.CoursesLive.Form do
  use KgEduWeb, :live_view

  on_mount {KgEduWeb.LiveUserAuth, :live_user_required}

  @impl true
  def mount(_params, _session, socket) do
    teachers =
      KgEdu.Accounts.get_users()
      |> Enum.filter(&(&1.role == :teacher))
      |> Enum.map(&{&1.full_name || &1.email, &1.id})

    socket = assign(socket, teachers: teachers)
    {:ok, socket}
  end

  @impl true
  def handle_params(params, _url, socket) do
    {:noreply, apply_action(socket, socket.assigns.live_action, params)}
  end

  defp apply_action(socket, :new, _params) do
    form = AshPhoenix.Form.for_create(KgEdu.Courses.Course, :create) |> to_form()

    socket
    |> assign(:page_title, "New Course")
    |> assign(:form, form)
  end

  defp apply_action(socket, :edit, %{"id" => id}) do
    course = KgEdu.Courses.get_course!(id)
    form = AshPhoenix.Form.for_update(course, :update) |> to_form()

    socket
    |> assign(:page_title, "Edit Course")
    |> assign(:form, form)
    |> assign(:course, course)
  end

  @impl true
  def handle_event("validate", %{"form" => params}, socket) do
    form = AshPhoenix.Form.validate(socket.assigns.form, params)
    {:noreply, assign(socket, :form, form)}
  end

  def handle_event("save", %{"form" => params}, socket) do
    case AshPhoenix.Form.submit(socket.assigns.form, params: params) do
      {:ok, course} ->
        socket =
          socket
          |> put_flash(:info, "Course #{socket.assigns.live_action}d successfully")
          |> push_navigate(to: ~p"/courses")

        {:noreply, socket}

      {:error, form} ->
        {:noreply, assign(socket, :form, form)}
    end
  end
end

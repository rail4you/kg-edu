defmodule KgEduWeb.CourseLive.Form do
  use KgEduWeb, :live_view

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <.header>
        {@page_title}
        <:subtitle>Use this form to manage course records in your database.</:subtitle>
      </.header>

      <.form for={@form} id="course-form" phx-change="validate" phx-submit="save">
        <fieldset>
          <.input field={@form[:title]} type="text" label="Title" />
          <.input field={@form[:description]} type="text" label="Description" />
          <.input field={@form[:teacher_id]} type="select" label="Id" options={teacher_list()} />
        </fieldset>
        <.button phx-disable-with="Saving..." variant="primary">Save Course</.button>
        <.button navigate={return_path(@return_to, @course)}>Cancel</.button>
      </.form>
    </Layouts.app>
    """
  end

  @impl true
  def mount(params, _session, socket) do
    course =
      case params["id"] do
        nil -> nil
        id -> Ash.get!(KgEdu.Courses.Course, id, actor: socket.assigns.current_user)
      end

    action = if is_nil(course), do: "New", else: "Edit"
    page_title = action <> " " <> "Course"

    {:ok,
     socket
     |> assign(:return_to, return_to(params["return_to"]))
     |> assign(course: course)
     |> assign(:page_title, page_title)
     |> assign_form()}
  end

  defp return_to("show"), do: "show"
  defp return_to(_), do: "index"

  @impl true
  def handle_event("validate", %{"course" => course_params}, socket) do
    {:noreply, assign(socket, form: AshPhoenix.Form.validate(socket.assigns.form, course_params))}
  end

  def handle_event("save", %{"course" => course_params}, socket) do
    case AshPhoenix.Form.submit(socket.assigns.form, params: course_params) do
      {:ok, course} ->
        notify_parent({:saved, course})

        socket =
          socket
          |> put_flash(:info, "Course updated successfully")
          |> push_navigate(to: return_path(socket.assigns.return_to, course))

        {:noreply, socket}

      {:error, form} ->
        {:noreply, assign(socket, form: form)}
    end
  end

  defp notify_parent(msg), do: send(self(), {__MODULE__, msg})

  defp assign_form(%{assigns: %{course: course}} = socket) do
    form =
      if course do
        AshPhoenix.Form.for_update(course, :update,
          as: "course",
          actor: socket.assigns.current_user
        )
      else
        AshPhoenix.Form.for_create(KgEdu.Courses.Course, :create,
          as: "course",
          actor: socket.assigns.current_user
        )
      end

    assign(socket, form: to_form(form))
  end

  defp return_path("index", _course), do: ~p"/courses"
  defp return_path("show", course), do: ~p"/courses/#{course.id}"

  def teacher_list do
    Ash.read!(KgEdu.Accounts.User, actor: nil)
    |> Enum.filter(fn user -> user.role == :teacher end)
    |> Enum.map(fn user -> {user.member_id, user.id} end)
  end
end

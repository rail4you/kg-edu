defmodule KgEduWeb.CoursesLive.FormComponent do
  use KgEduWeb, :live_component

  @impl true
  def update(%{course: course} = assigns, socket) do
    changeset = AshPhoenix.Form.for_update(course, :update) |> to_form()

    {:ok,
     socket
     |> assign(assigns)
     |> assign(:form, changeset)}
  end

  @impl true
  def handle_event("validate", %{"course" => course_params}, socket) do
    changeset =
      socket.assigns.course
      |> AshPhoenix.Form.for_update(:update)
      |> AshPhoenix.Form.validate(course_params)
      |> to_form()

    {:noreply, assign(socket, :form, changeset)}
  end

  def handle_event("save", %{"course" => course_params}, socket) do
    case KgEdu.Courses.update_course(socket.assigns.course, course_params) do
      {:ok, _course} ->
        {:noreply,
         socket
         |> put_flash(:info, "Course updated successfully")
         |> push_patch(to: socket.assigns.patch)}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, assign(socket, :form, to_form(changeset))}
    end
  end
end
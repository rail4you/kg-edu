defmodule KgEduWeb.FilesLive.FormComponent do
  use KgEduWeb, :live_component

  @impl true
  def update(%{file: file} = assigns, socket) do
    changeset = AshPhoenix.Form.for_update(file, :update) |> to_form()

    {:ok,
     socket
     |> assign(assigns)
     |> assign(:form, changeset)}
  end

  @impl true
  def handle_event("validate", %{"file" => file_params}, socket) do
    changeset =
      socket.assigns.file
      |> AshPhoenix.Form.for_update(:update)
      |> AshPhoenix.Form.validate(file_params)
      |> to_form()

    {:noreply, assign(socket, :form, changeset)}
  end

  def handle_event("save", %{"file" => file_params}, socket) do
    case KgEdu.Courses.update_file(socket.assigns.file, file_params) do
      {:ok, _file} ->
        {:noreply,
         socket
         |> put_flash(:info, "File updated successfully")
         |> push_patch(to: socket.assigns.patch)}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, assign(socket, :form, to_form(changeset))}
    end
  end
end
defmodule KgEduWeb.KnowledgeLive.FormComponent do
  use KgEduWeb, :live_component

  @impl true
  def update(%{resource: resource} = assigns, socket) do
    changeset = AshPhoenix.Form.for_update(resource, :update) |> to_form()

    {:ok,
     socket
     |> assign(assigns)
     |> assign(:form, changeset)}
  end

  @impl true
  def handle_event("validate", %{"resource" => resource_params}, socket) do
    changeset =
      socket.assigns.resource
      |> AshPhoenix.Form.for_update(:update)
      |> AshPhoenix.Form.validate(resource_params)
      |> to_form()

    {:noreply, assign(socket, :form, changeset)}
  end

  def handle_event("save", %{"resource" => resource_params}, socket) do
    case KgEdu.Knowledge.update_resource(socket.assigns.resource, resource_params) do
      {:ok, _resource} ->
        {:noreply,
         socket
         |> put_flash(:info, "Knowledge resource updated successfully")
         |> push_patch(to: socket.assigns.patch)}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, assign(socket, :form, to_form(changeset))}
    end
  end
end
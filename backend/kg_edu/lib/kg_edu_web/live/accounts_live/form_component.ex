defmodule KgEduWeb.AccountsLive.FormComponent do
  use KgEduWeb, :live_component

  @impl true
  def update(%{user: user} = assigns, socket) do
    changeset = AshPhoenix.Form.for_update(user, :update) |> to_form()

    {:ok,
     socket
     |> assign(assigns)
     |> assign(:form, changeset)}
  end

  @impl true
  def handle_event("validate", %{"user" => user_params}, socket) do
    changeset =
      socket.assigns.user
      |> AshPhoenix.Form.for_update(:update)
      |> AshPhoenix.Form.validate(user_params)
      |> to_form()

    {:noreply, assign(socket, :form, changeset)}
  end

  def handle_event("save", %{"user" => user_params}, socket) do
    case KgEdu.Accounts.update_user(socket.assigns.user, user_params) do
      {:ok, _user} ->
        {:noreply,
         socket
         |> put_flash(:info, "User updated successfully")
         |> push_patch(to: socket.assigns.patch)}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, assign(socket, :form, to_form(changeset))}
    end
  end
end
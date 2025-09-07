defmodule KgEduWeb.KnowledgeLive.Form do
  use KgEduWeb, :live_view

  on_mount {KgEduWeb.LiveUserAuth, :live_user_required}

  @impl true
  def mount(_params, _session, socket) do
    {:ok, socket}
  end

  @impl true
  def handle_params(params, _url, socket) do
    {:noreply, apply_action(socket, socket.assigns.live_action, params)}
  end

  defp apply_action(socket, :new, _params) do
    form = AshPhoenix.Form.for_create(KgEdu.Knowledge.Resource, :create) |> to_form()

    socket
    |> assign(:page_title, "New Knowledge Resource")
    |> assign(:form, form)
  end

  defp apply_action(socket, :edit, %{"id" => id}) do
    resource = KgEdu.Knowledge.get_resource!(id)
    form = AshPhoenix.Form.for_update(resource, :update) |> to_form()

    socket
    |> assign(:page_title, "Edit Knowledge Resource")
    |> assign(:form, form)
    |> assign(:resource, resource)
  end

  @impl true
  def handle_event("validate", %{"form" => params}, socket) do
    form = AshPhoenix.Form.validate(socket.assigns.form, params)
    {:noreply, assign(socket, :form, form)}
  end

  def handle_event("save", %{"form" => params}, socket) do
    case AshPhoenix.Form.submit(socket.assigns.form, params: params) do
      {:ok, resource} ->
        socket =
          socket
          |> put_flash(:info, "Knowledge Resource #{socket.assigns.live_action}d successfully")
          |> push_navigate(to: ~p"/knowledge")

        {:noreply, socket}

      {:error, form} ->
        {:noreply, assign(socket, :form, form)}
    end
  end
end
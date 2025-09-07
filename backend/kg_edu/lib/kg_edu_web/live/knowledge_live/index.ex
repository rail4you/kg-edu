defmodule KgEduWeb.KnowledgeLive.Index do
  use KgEduWeb, :live_view
  alias KgEdu.Knowledge
  alias KgEdu.Knowledge.Resource

  on_mount {KgEduWeb.LiveUserAuth, :live_user_required}

  @impl true
  def mount(_params, _session, socket) do
    {:ok, assign(socket, :resources, list_resources())}
  end

  @impl true
  def handle_params(params, _url, socket) do
    {:noreply, apply_action(socket, socket.assigns.live_action, params)}
  end

  defp apply_action(socket, :index, _params) do
    socket
    |> assign(:page_title, "Knowledge Resources")
    |> assign(:resource, nil)
  end

  defp apply_action(socket, :new, _params) do
    socket
    |> assign(:page_title, "New Knowledge Resource")
    |> assign(:resource, %Resource{})
  end

  defp apply_action(socket, :edit, %{"id" => id}) do
    resource = Knowledge.get_resource!(id)
    
    socket
    |> assign(:page_title, "Edit Knowledge Resource")
    |> assign(:resource, resource)
  end

  @impl true
  def handle_event("delete", %{"id" => id}, socket) do
    resource = Knowledge.get_resource!(id)
    {:ok, _} = Knowledge.destroy_resource(resource)

    {:noreply, assign(socket, :resources, list_resources())}
  end

  defp list_resources do
    Knowledge.read_resource()
  end
end
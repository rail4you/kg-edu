defmodule KgEduWeb.ResourceLive.Index do
  use KgEduWeb, :live_view

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <div data-theme="green" class="rounded-lg p-4">
        <.header>
          Listing Resources
        <:actions>
          <.button variant="primary" navigate={~p"/resources/new"}>
            <.icon name="hero-plus" /> New Resource
          </.button>
        </:actions>
      </.header>

      <.table
        id="resources"
        rows={@streams.resources}
        row_click={fn {_id, resource} -> JS.navigate(~p"/resources/#{resource}") end}
      >
        <:col :let={{_id, resource}} label="Id">{resource.id}</:col>

        <:col :let={{_id, resource}} label="Name">{resource.name}</:col>

        <:col :let={{_id, resource}} label="Description">{resource.description}</:col>

        <:col :let={{_id, resource}} label="Course">{resource.course_id}</:col>

        <:col :let={{_id, resource}} label="Created by">{resource.created_by_id}</:col>

        <:action :let={{_id, resource}}>
          <div class="sr-only">
            <.link navigate={~p"/resources/#{resource}"}>Show</.link>
          </div>

          <.link navigate={~p"/resources/#{resource}/edit"}>Edit</.link>
        </:action>

        <:action :let={{id, resource}}>
          <.link
            phx-click={JS.push("delete", value: %{id: resource.id}) |> hide("##{id}")}
            data-confirm="Are you sure?"
          >
            Delete
          </.link>
        </:action>
      </.table>
      </div>
    </Layouts.app>
    """
  end

  @impl true
  def mount(_params, _session, socket) do
    IO.inspect(socket.assigns.current_user, label: "Current User in ResourceLive.Index")
    {:ok,
     socket
     |> assign(:page_title, "Listing Resources")
     |> assign_new(:current_user, fn -> nil end)
     |> stream(
       :resources,
       Ash.read!(KgEdu.Knowledge.Resource, actor: socket.assigns[:current_user])
     )}
  end

  @impl true
  def handle_event("delete", %{"id" => id}, socket) do
    resource = Ash.get!(KgEdu.Knowledge.Resource, id, actor: socket.assigns.current_user)

    KgEdu.Knowledge.Resource.delete_knowledge_resource!(resource,
      actor: socket.assigns.current_user
    )

    {:noreply, stream_delete(socket, :resources, resource)}
  end
end

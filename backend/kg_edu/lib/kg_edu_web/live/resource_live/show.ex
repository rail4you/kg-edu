defmodule KgEduWeb.ResourceLive.Show do
  use KgEduWeb, :live_view

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <div data-theme="green" class="rounded-lg p-4">
        <.header>
          Resource {@resource.id}
          <:subtitle>This is a resource record from your database.</:subtitle>

          <:actions>
            <.button navigate={~p"/resources"}>
              <.icon name="hero-arrow-left" />
            </.button>
            <.button variant="primary" navigate={~p"/resources/#{@resource}/edit?return_to=show"}>
              <.icon name="hero-pencil-square" /> Edit Resource
            </.button>
          </:actions>
        </.header>

        <.list>
        <:item title="Id">{@resource.id}</:item>

        <:item title="Name">{@resource.name}</:item>

        <:item title="Description">{@resource.description}</:item>

        <:item title="Course">{@resource.course_id}</:item>

        <:item title="Created by">{@resource.created_by_id}</:item>
      </.list>
      </div>
    </Layouts.app>
    """
  end

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, "Show Resource")
     |> assign(
       :resource,
       Ash.get!(KgEdu.Knowledge.Resource, id, actor: socket.assigns.current_user)
     )}
  end
end

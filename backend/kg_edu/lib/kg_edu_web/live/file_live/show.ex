defmodule KgEduWeb.FileLive.Show do
  use KgEduWeb, :live_view

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <.header>
        File {@file.id}
        <:subtitle>This is a file record from your database.</:subtitle>

        <:actions>
          <.button navigate={~p"/files"}>
            <.icon name="hero-arrow-left" />
          </.button>
          <.button variant="primary" navigate={~p"/files/#{@file}/edit?return_to=show"}>
            <.icon name="hero-pencil-square" /> Edit File
          </.button>
        </:actions>
      </.header>

      <.list>
        <:item title="Id">{@file.id}</:item>

        <:item title="Filename">{@file.filename}</:item>

        <:item title="Path">{@file.path}</:item>

        <:item title="Size">{@file.size}</:item>

        <:item title="File type">{@file.file_type}</:item>

        <:item title="Purpose">{@file.purpose}</:item>
      </.list>
    </Layouts.app>
    """
  end

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, "Show File")
     |> assign(:file, Ash.get!(KgEdu.Courses.File, id, actor: socket.assigns.current_user))}
  end
end

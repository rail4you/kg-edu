defmodule KgEduWeb.FileLive.Index do
  use KgEduWeb, :live_view

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <.header>
        Listing Files
        <:actions>
          <.button variant="primary" navigate={~p"/files/new"}>
            <.icon name="hero-plus" /> New File
          </.button>
        </:actions>
      </.header>

      <.table
        id="files"
        rows={@streams.files}
        row_click={fn {_id, file} -> JS.navigate(~p"/files/#{file}") end}
      >
        <:col :let={{_id, file}} label="Id">{file.id}</:col>

        <:col :let={{_id, file}} label="Filename">{file.filename}</:col>

        <:col :let={{_id, file}} label="Path">{file.path}</:col>

        <:col :let={{_id, file}} label="Size">{file.size}</:col>

        <:col :let={{_id, file}} label="File type">{file.file_type}</:col>

        <:col :let={{_id, file}} label="Purpose">{file.purpose}</:col>

        <:action :let={{_id, file}}>
          <div class="sr-only">
            <.link navigate={~p"/files/#{file}"}>Show</.link>
          </div>

          <.link navigate={~p"/files/#{file}/edit"}>Edit</.link>
        </:action>

        <:action :let={{id, file}}>
          <.link
            phx-click={JS.push("delete", value: %{id: file.id}) |> hide("##{id}")}
            data-confirm="Are you sure?"
          >
            Delete
          </.link>
        </:action>
      </.table>
    </Layouts.app>
    """
  end

  @impl true
  def mount(_params, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, "Listing Files")
     |> assign_new(:current_user, fn -> nil end)
     |> stream(:files, Ash.read!(KgEdu.Courses.File, actor: socket.assigns[:current_user]))}
  end

  @impl true
  def handle_event("delete", %{"id" => id}, socket) do
    file = Ash.get!(KgEdu.Courses.File, id, actor: socket.assigns.current_user)
    KgEdu.Courses.File.delete_file!(file, actor: socket.assigns.current_user)

    {:noreply, stream_delete(socket, :files, file)}
  end
end

defmodule KgEduWeb.FilesLive.Index do
  use KgEduWeb, :live_view
  alias KgEdu.Courses
  alias KgEdu.Courses.File

  on_mount {KgEduWeb.LiveUserAuth, :live_user_required}

  @impl true
  def mount(_params, _session, socket) do
    {:ok, assign(socket, :files, list_files())}
  end

  @impl true
  def handle_params(params, _url, socket) do
    {:noreply, apply_action(socket, socket.assigns.live_action, params)}
  end

  defp apply_action(socket, :index, _params) do
    socket
    |> assign(:page_title, "Files")
    |> assign(:file, nil)
  end

  defp apply_action(socket, :new, _params) do
    socket
    |> assign(:page_title, "New File")
    |> assign(:file, %File{})
  end

  defp apply_action(socket, :edit, %{"id" => id}) do
    file = Courses.get_file!(id)

    socket
    |> assign(:page_title, "Edit File")
    |> assign(:file, file)
  end

  @impl true
  def handle_event("delete", %{"id" => id}, socket) do
    file = Courses.get_file!(id)
    {:ok, _} = Courses.delete_file(file)

    {:noreply, assign(socket, :files, list_files())}
  end

  defp list_files do
    Courses.list_files()
  end

  defp file_size(size) when size > 1_000_000, do: "#{Float.round(size / 1_000_000, 2)} MB"
  defp file_size(size) when size > 1_000, do: "#{Float.round(size / 1_000, 2)} KB"
  defp file_size(size), do: "#{size} B"
end

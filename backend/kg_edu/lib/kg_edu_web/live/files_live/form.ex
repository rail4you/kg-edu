defmodule KgEduWeb.FilesLive.Form do
  use KgEduWeb, :live_view

  on_mount {KgEduWeb.LiveUserAuth, :live_user_required}

  @impl true
  def mount(_params, _session, socket) do
    courses = KgEdu.Courses.read_course()
      |> Enum.map(&{&1.title, &1.id})
    socket = assign(socket, :courses, courses)
    {:ok, socket}
  end

  @impl true
  def handle_params(params, _url, socket) do
    {:noreply, apply_action(socket, socket.assigns.live_action, params)}
  end

  defp apply_action(socket, :new, _params) do
    form = AshPhoenix.Form.for_create(KgEdu.Courses.File, :create) |> to_form()

    socket
    |> assign(:page_title, "New File")
    |> assign(:form, form)
  end

  defp apply_action(socket, :edit, %{"id" => id}) do
    file = KgEdu.Courses.get_file!(id)
    form = AshPhoenix.Form.for_update(file, :update) |> to_form()

    socket
    |> assign(:page_title, "Edit File")
    |> assign(:form, form)
    |> assign(:file, file)
  end

  @impl true
  def handle_event("validate", %{"form" => params}, socket) do
    form = AshPhoenix.Form.validate(socket.assigns.form, params)
    {:noreply, assign(socket, :form, form)}
  end

  def handle_event("save", %{"form" => params}, socket) do
    case AshPhoenix.Form.submit(socket.assigns.form, params: params) do
      {:ok, file} ->
        socket =
          socket
          |> put_flash(:info, "File #{socket.assigns.live_action}d successfully")
          |> push_navigate(to: ~p"/files")

        {:noreply, socket}

      {:error, form} ->
        {:noreply, assign(socket, :form, form)}
    end
  end

  defp file_size(size) when size > 1_000_000, do: "#{Float.round(size / 1_000_000, 2)} MB"
  defp file_size(size) when size > 1_000, do: "#{Float.round(size / 1_000, 2)} KB"
  defp file_size(size), do: "#{size} B"
end

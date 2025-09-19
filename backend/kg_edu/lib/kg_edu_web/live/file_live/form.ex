defmodule KgEduWeb.FileLive.Form do
  use KgEduWeb, :live_view

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <.header>
        {@page_title}
        <:subtitle>Use this form to manage file records in your database.</:subtitle>
      </.header>

      <.form for={@form} id="file-form" phx-change="validate" phx-submit="save">
        <!-- File Upload Section -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Upload File
          </label>

          <.live_file_input upload={@uploads.file} class="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100" />

          <%= for entry <- @uploads.file.entries do %>
            <KgEduWeb.CoreComponents.live_file_preview entry={entry} />
            <button
              type="button"
              phx-click="cancel-upload"
              phx-value-ref={entry.ref}
              class="mt-2 text-red-600 hover:text-red-800 text-sm">
              Cancel
            </button>
          <% end %>
        </div>

        <!-- Course Selection -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Course
          </label>
          <.input
            type="select"
            name="file[course_id]"
            options={@courses}
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
        </div>

        <!-- File Purpose -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Purpose
          </label>
          <select
            name="file[purpose]"
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
            <option value="course_file">Course File</option>
            <option value="course_image">Course Image</option>
            <option value="course_video">Course Video</option>
          </select>
        </div>

        <!-- Existing File Preview (for editing) -->
        <%= if @file && @file.path do %>
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Current File
            </label>
            <div class="mt-2">
              <%= if String.contains?(@file.file_type, "image") do %>
                <img src={@file.path} alt={@file.filename} class="max-w-full h-auto rounded-md shadow-sm max-h-96 object-contain" />
              <% else %>
                <%= if String.contains?(@file.file_type, "video") do %>
                  <video controls class="max-w-full h-auto rounded-md shadow-sm max-h-96">
                    <source src={@file.path} type={@file.file_type} />
                    Your browser does not support the video tag.
                  </video>
                <% else %>
                <div class="flex items-center space-x-2 p-3 bg-gray-50 rounded-md">
                    <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div>
                      <span class="text-sm font-medium text-gray-700"><%= @file.filename %></span>
                      <span class="text-xs text-gray-500 ml-2"><%= format_file_size(@file.size) %></span>
                    </div>
                  </div>
                <% end %>
              <% end %>
            </div>
          </div>
        <% end %>

        <.button phx-disable-with="Saving..." variant="primary">Save File</.button>
        <.button navigate={return_path(@return_to, @file)}>Cancel</.button>
      </.form>
    </Layouts.app>
    """
  end

  @impl true
  def mount(params, _session, socket) do
    file =
      case params["id"] do
        nil -> nil
        id -> Ash.get!(KgEdu.Courses.File, id, actor: socket.assigns.current_user)
      end

    action = if is_nil(file), do: "New", else: "Edit"
    page_title = action <> " " <> "File"
    course_list = KgEdu.Courses.Course.list_courses!(actor: socket.assigns.current_user)
    |> Enum.map(&{&1.title, &1.id})
    {:ok,
     socket
     |> assign(:return_to, return_to(params["return_to"]))
     |> assign(file: file)
     |> assign(:page_title, page_title)
     |> assign(:uploaded_files, [])
     |> assign(:courses, course_list)
     |> assign(:course_id, params["course_id"])
     |> allow_upload(:file, accept: ~w(.jpg .jpeg .png .gif .pdf .doc .docx .txt .zip .rar .mp4 .mov .avi .mp3 .wav), max_entries: 1)
     |> assign_form()}
  end

  defp return_to("show"), do: "show"
  defp return_to(_), do: "index"

  @impl true
  def handle_event("validate", %{"file" => file_params}, socket) do
    {:noreply, assign(socket, form: AshPhoenix.Form.validate(socket.assigns.form, file_params))}
  end

  def handle_event("cancel-upload", %{"ref" => ref}, socket) do
    {:noreply, cancel_upload(socket, :file, ref)}
  end

  def handle_event("save", %{"file" => file_params}, socket) do
    uploaded_files =
      consume_uploaded_entries(socket, :file, fn %{path: path}, entry ->
        # Create Plug.Upload struct from the uploaded file
        upload = %Plug.Upload{
          path: path,
          filename: entry.client_name,
          content_type: entry.client_type
        }

        # copy uploaded file to desired location
        upload_params = Map.put(file_params, "file", upload)
        upload_params = Map.put(upload_params, "course_id", file_params["course_id"] || socket.assigns.course_id)
        uploads_dir = "uploads"
        dir = Path.join([:code.priv_dir(:kg_edu), uploads_dir])
        File.cp(path, dir)

        # store file record
    # Ensure uploads directory exists

    # Generate destination path
        case KgEdu.Courses.File.upload_file(upload_params, actor: socket.assigns.current_user) do
          {:ok, file} ->
            {:ok, file}
          {:error, error} ->
            {:error, error}
        end
      end)

    case uploaded_files do
      [file] ->
        notify_parent({:saved, file})

        socket =
          socket
          |> put_flash(:info, "File uploaded successfully")
          |> push_navigate(to: return_path(socket.assigns.return_to, file))

        {:noreply, socket}

      [{:error, error}] ->
        {:noreply, put_flash(socket, :error, "Failed to upload file: #{inspect(error)}")}

      [] ->
        # No file uploaded, try regular form submission
        case AshPhoenix.Form.submit(socket.assigns.form, params: file_params) do
          {:ok, file} ->
            notify_parent({:saved, file})

            socket =
              socket
              |> put_flash(:info, "File #{socket.assigns.form.source.type}d successfully")
              |> push_navigate(to: return_path(socket.assigns.return_to, file))

            {:noreply, socket}

          {:error, form} ->
            {:noreply, assign(socket, form: form)}
        end
    end
  end

  defp notify_parent(msg), do: send(self(), {__MODULE__, msg})

  defp assign_form(%{assigns: %{file: file}} = socket) do
    form =
      if file do
        AshPhoenix.Form.for_update(file, :update, as: "file", actor: socket.assigns.current_user)
      else
        AshPhoenix.Form.for_create(KgEdu.Courses.File, :create,
          as: "file",
          actor: socket.assigns.current_user
        )
      end

    assign(socket, form: to_form(form))
  end

  defp return_path("index", _file), do: ~p"/files"
  defp return_path("show", file), do: ~p"/files/#{file.id}"

  defp format_file_size(size) when size < 1024, do: "#{size} B"
  defp format_file_size(size) when size < 1024 * 1024, do: "#{Float.round(size / 1024, 1)} KB"
  defp format_file_size(size) when size < 1024 * 1024 * 1024, do: "#{Float.round(size / (1024 * 1024), 1)} MB"
  defp format_file_size(size), do: "#{Float.round(size / (1024 * 1024 * 1024), 1)} GB"
end

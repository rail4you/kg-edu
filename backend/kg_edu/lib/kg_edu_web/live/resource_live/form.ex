defmodule KgEduWeb.ResourceLive.Form do
  use KgEduWeb, :live_view

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <div data-theme="green" class="rounded-lg p-4">
        <.header>
          {@page_title}
          <:subtitle>Use this form to manage resource records in your database.</:subtitle>
        </.header>

        <.form for={@form} id="resource-form" phx-change="validate" phx-submit="save">
        <fieldset>
          <.input field={@form[:name]} type="text" label="Name" />
          <.input field={@form[:description]} type="text" label="Description" />
          <.input field={@form[:course_id]} type="select" label="Course" options={@course_list} />
        </fieldset>
        <.button phx-disable-with="Saving..." variant="primary">Save Resource</.button>
        <.button navigate={return_path(@return_to, @resource)}>Cancel</.button>
      </.form>
      </div>
    </Layouts.app>
    """
  end

  @impl true
  def mount(params, _session, socket) do
    resource =
      case params["id"] do
        nil -> nil
        id -> Ash.get!(KgEdu.Knowledge.Resource, id, actor: socket.assigns.current_user)
      end

    action = if is_nil(resource), do: "New", else: "Edit"
    page_title = action <> " " <> "Resource"

    course_list =
      KgEdu.Courses.Course.list_courses!(actor: socket.assigns.current_user)
      |> Enum.map(&{&1.title, &1.id})

    {:ok,
     socket
     |> assign(:return_to, return_to(params["return_to"]))
     |> assign(resource: resource)
     |> assign(:course_list, course_list)
     |> assign(:page_title, page_title)
     |> assign_form()}
  end

  defp return_to("show"), do: "show"
  defp return_to(_), do: "index"

  @impl true
  def handle_event("validate", %{"resource" => resource_params}, socket) do
    {:noreply,
     assign(socket, form: AshPhoenix.Form.validate(socket.assigns.form, resource_params))}
  end

  def handle_event("save", %{"resource" => resource_params}, socket) do
    case AshPhoenix.Form.submit(socket.assigns.form, params: resource_params) do
      {:ok, resource} ->
        notify_parent({:saved, resource})

        socket =
          socket
          |> put_flash(:info, "Resource #{socket.assigns.form.source.type}d successfully")
          |> push_navigate(to: return_path(socket.assigns.return_to, resource))

        {:noreply, socket}

      {:error, form} ->
        {:noreply, assign(socket, form: form)}
    end
  end

  defp notify_parent(msg), do: send(self(), {__MODULE__, msg})

  defp assign_form(%{assigns: %{resource: resource}} = socket) do
    form =
      if resource do
        AshPhoenix.Form.for_update(resource, :update,
          as: "resource",
          actor: socket.assigns.current_user
        )
      else
        AshPhoenix.Form.for_create(KgEdu.Knowledge.Resource, :create,
          as: "resource",
          actor: socket.assigns.current_user
        )
      end

    assign(socket, form: to_form(form))
  end

  defp return_path("index", _resource), do: ~p"/resources"
  defp return_path("show", resource), do: ~p"/resources/#{resource.id}"
end

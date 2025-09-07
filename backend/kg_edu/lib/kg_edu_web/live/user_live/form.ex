defmodule KgEduWeb.UserLive.Form do
  use KgEduWeb, :live_view

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <.header>
        {@page_title}
        <:subtitle>Use this form to manage user records in your database.</:subtitle>
      </.header>

      <.form for={@form} id="user-form" phx-change="validate" phx-submit="save">
        <fieldset>
          <.input field={@form[:email]} type="email" label="Email" />
          <.input field={@form[:member_id]} type="text" label="Student Id" />
          <.input
            field={@form[:role]}
            type="select"
            label="Role"
            options={["user", "teacher", "admin"]}
          />
          <.input
            field={@form[:password]}
            type="password"
            label="Password"
            autocomplete="new-password"
          />
          <.input
            field={@form[:password_confirmation]}
            type="password"
            label="Confirm Password"
            autocomplete="new-password"
          />
        </fieldset>
        <.button phx-disable-with="Saving..." variant="primary">Save User</.button>
        <.button navigate={return_path(@return_to, @user)}>Cancel</.button>
      </.form>
    </Layouts.app>
    """
  end

  @impl true
  def mount(params, _session, socket) do
    user =
      case params["id"] do
        nil -> nil
        id -> Ash.get!(KgEdu.Accounts.User, id, actor: socket.assigns.current_user)
      end

    action = if is_nil(user), do: "New", else: "Edit"
    page_title = action <> " " <> "User"

    {:ok,
     socket
     |> assign(:return_to, return_to(params["return_to"]))
     |> assign(user: user)
     |> assign(:page_title, page_title)
     |> assign_form()}
  end

  defp return_to("show"), do: "show"
  defp return_to(_), do: "index"

  @impl true
  def handle_event("validate", %{"user" => user_params}, socket) do
    {:noreply, assign(socket, form: AshPhoenix.Form.validate(socket.assigns.form, user_params))}
  end

  def handle_event("save", %{"user" => user_params}, socket) do
    case AshPhoenix.Form.submit(socket.assigns.form, params: user_params) do
      {:ok, user} ->
        notify_parent({:saved, user})

        socket =
          socket
          |> put_flash(:info, "User #{socket.assigns.form.source.type}d successfully")
          |> push_navigate(to: return_path(socket.assigns.return_to, user))

        {:noreply, socket}

      {:error, form} ->
        {:noreply, assign(socket, form: form)}
    end
  end

  defp notify_parent(msg), do: send(self(), {__MODULE__, msg})

  defp assign_form(%{assigns: %{user: user}} = socket) do
    form =
      if user do
        AshPhoenix.Form.for_update(user, :update, as: "user", actor: socket.assigns.current_user)
      else
        AshPhoenix.Form.for_create(KgEdu.Accounts.User, :register_with_password,
          as: "user",
          actor: socket.assigns.current_user
        )
      end

    assign(socket, form: to_form(form))
  end

  defp return_path("index", _user), do: ~p"/users"
  defp return_path("show", user), do: ~p"/users/#{user.id}"
end

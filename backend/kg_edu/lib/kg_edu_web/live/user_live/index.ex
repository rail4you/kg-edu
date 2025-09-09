defmodule KgEduWeb.UserLive.Index do
  use KgEduWeb, :live_view
  on_mount {KgEduWeb.LiveUserAuth, :live_user_required}

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_page={@current_page}>
      <.header>
        Listing Users
        <:actions>
          <.button variant="primary" navigate={~p"/users/new"}>
            <.icon name="hero-plus" /> New User
          </.button>
        </:actions>
      </.header>

      <Cinder.Table.table resource={KgEdu.Accounts.User} actor={@current_user}>
        <:col :let={user} field="member_id" filter sort>{user.member_id}</:col>
        <:col :let={user} field="name" filter sort>{user.name}</:col>
        <:col :let={user} field="email" filter>{user.email}</:col>
        <:col :let={user} field="role" filter={:select} sort>{user.role}</:col>
        <:col :let={user} label="Actions">
          <div class="flex gap-1">
            <.link navigate={~p"/users/#{user}"} class="btn btn-sm btn-ghost" title="View">
              <.icon name="hero-eye" />
            </.link>
            <.link navigate={~p"/users/#{user}/edit"} class="btn btn-sm btn-ghost" title="Edit">
              <.icon name="hero-pencil" />
            </.link>
            <.link
              phx-click={JS.push("delete", value: %{id: user.id})}
              data-confirm="Are you sure?"
              class="btn btn-sm btn-ghost text-error"
              title="Delete"
            >
              <.icon name="hero-trash" />
            </.link>
          </div>
        </:col>
      </Cinder.Table.table>
    </Layouts.app>
    """
  end

  @impl true
  def mount(_params, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, "Listing Users")
     |> assign(:current_page, :users)
     |> assign_new(:current_user, fn -> nil end)
     |> stream(:users, Ash.read!(KgEdu.Accounts.User, actor: socket.assigns[:current_user]))}
  end

  @impl true
  def handle_event("delete", %{"id" => id}, socket) do
    user = Ash.get!(KgEdu.Accounts.User, id, actor: socket.assigns.current_user)
    KgEdu.Accounts.User.delete_user!(user, actor: socket.assigns.current_user)

    {:noreply, stream_delete(socket, :users, user)}
  end
end

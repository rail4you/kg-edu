defmodule KgEduWeb.UserLive.Index do
  use KgEduWeb, :live_view

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <.header>
        Listing Users
        <:actions>
          <.button variant="primary" navigate={~p"/users/new"}>
            <.icon name="hero-plus" /> New User
          </.button>
        </:actions>
      </.header>

      <.table
        id="users"
        rows={@streams.users}
        row_click={fn {_id, user} -> JS.navigate(~p"/users/#{user}") end}
      >
        <:col :let={{_id, user}} label="Id">{user.id}</:col>

        <:col :let={{_id, user}} label="Student">{user.student_id}</:col>

        <:col :let={{_id, user}} label="Email">{user.email}</:col>

        <:col :let={{_id, user}} label="Role">{user.role}</:col>

        <:action :let={{_id, user}}>
          <div class="sr-only">
            <.link navigate={~p"/users/#{user}"}>Show</.link>
          </div>

          <.link navigate={~p"/users/#{user}/edit"}>Edit</.link>
        </:action>

        <:action :let={{id, user}}>
          <.link
            phx-click={JS.push("delete", value: %{id: user.id}) |> hide("##{id}")}
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
     |> assign(:page_title, "Listing Users")
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

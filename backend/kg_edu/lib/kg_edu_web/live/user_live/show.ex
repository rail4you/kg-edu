defmodule KgEduWeb.UserLive.Show do
  use KgEduWeb, :live_view

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <.header>
        User {@user.id}
        <:subtitle>This is a user record from your database.</:subtitle>

        <:actions>
          <.button navigate={~p"/users"}>
            <.icon name="hero-arrow-left" />
          </.button>
          <.button variant="primary" navigate={~p"/users/#{@user}/edit?return_to=show"}>
            <.icon name="hero-pencil-square" /> Edit User
          </.button>
        </:actions>
      </.header>

      <.list>
        <:item title="Id">{@user.id}</:item>

        <:item title="Student">{@user.member_id}</:item>

        <:item title="Email">{@user.email}</:item>

        <:item title="Role">{@user.role}</:item>
      </.list>
    </Layouts.app>
    """
  end

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, "Show User")
     |> assign(:user, Ash.get!(KgEdu.Accounts.User, id, actor: socket.assigns.current_user))}
  end
end

defmodule KgEduWeb.Layouts do
  @moduledoc """
  This module holds layouts and related functionality
  used by your application.
  """
  use KgEduWeb, :html

  # Embed all files in layouts/* within this module.
  # The default root.html.heex file contains the HTML
  # skeleton of your application, namely HTML headers
  # and other static content.
  embed_templates "layouts/*"

  @doc """
  Renders your app layout.

  This function is typically invoked from every template,
  and it often contains your application menu, sidebar,
  or similar.

  ## Examples

      <Layouts.app flash={@flash}>
        <h1>Content</h1>
      </Layouts.app>

  """
  def current_user(assigns) do
    assigns[:current_user]
  end

  defp menu() do
    [
      %{name: "Chat", path: "chat", icon: "hero-chat-bubble-left-right", page: :chat},
      %{name: "Courses", path: "courses", icon: "hero-home", page: :courses},
      %{name: "Files", path: "files", icon: "hero-folder", page: :files},
      %{name: "Users", path: "users", icon: "hero-users", page: :users},
      %{name: "Resources", path: "resources", icon: "hero-book-open", page: :resources},
      %{name: "Exercises", path: "exercises", icon: "hero-pencil-square", page: :exercises}
    ]
  end

  attr :flash, :map, required: true, doc: "the map of flash messages"
  attr :current_user, :map, default: nil, doc: "the current user"
  attr :current_page, :atom, default: nil, doc: "the current page"

  attr :current_scope, :map,
    default: nil,
    doc: "the current [scope](https://hexdocs.pm/phoenix/scopes.html)"

  slot :inner_block, required: true

  def app(assigns) do
    ~H"""
    <div class="drawer lg:drawer-open">
      <!-- Sidebar toggle for mobile -->
      <input id="drawer-toggle" type="checkbox" class="drawer-toggle" />

    <!-- Main content -->
      <div class="drawer-content flex flex-col">
        <!-- Navigation Banner -->
        <header class="navbar bg-base-100 shadow-sm px-4 sm:px-6 lg:px-8 border-b">
          <div class="flex-none lg:hidden">
            <label for="drawer-toggle" class="btn btn-square btn-ghost">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6h16M4 12h16M4 18h16"
                >
                </path>
              </svg>
            </label>
          </div>

          <div class="flex-1">
            <a href="/" class="flex items-center gap-2">
              <img src={~p"/images/logo.svg"} width="36" alt="Logo" />
              <span class="text-sm font-semibold hidden sm:inline">
                v{Application.spec(:phoenix, :vsn)}
              </span>
            </a>
          </div>

          <div class="flex-none">
            <div class="flex items-center gap-2">
              <.theme_toggle />

              <%= if @current_user do %>
                <div class="dropdown dropdown-end">
                  <div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar">
                    <div class="w-10 rounded-full">
                      <%= if @current_user.avatar_url do %>
                        <img src={@current_user.avatar_url} alt="Profile" />
                      <% else %>
                        <div class="bg-neutral text-neutral-content rounded-full w-10 h-10 flex items-center justify-center">
                          {String.first(@current_user.email || "U") |> String.upcase()}
                        </div>
                      <% end %>
                    </div>
                  </div>
                  <ul
                    tabindex="0"
                    class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52"
                  >
                    <li>
                      <.link navigate={~p"/profile"} class="justify-between">
                        Profile <span class="badge">New</span>
                      </.link>
                    </li>
                    <li><a>Settings</a></li>
                    <li>
                      <.link
                        href={~p"/auth/sign-out"}
                        method="delete"
                        data-confirm="Are you sure you want to sign out?"
                      >
                        Logout
                      </.link>
                    </li>
                  </ul>
                </div>
              <% else %>
                <div class="flex gap-2">
                  <.link navigate={~p"/sign-in"} class="btn btn-ghost btn-sm">
                    Sign In
                  </.link>
                  <.link navigate={~p"/register"} class="btn btn-primary btn-sm">
                    Sign Up
                  </.link>
                </div>
              <% end %>
            </div>
          </div>
        </header>

    <!-- Main content area -->
        <main class="flex-1 p-4 sm:p-6 lg:p-8">
          <div class="mx-auto max-w-7xl">
            {render_slot(@inner_block)}
          </div>
        </main>

        <.custom_flash_group flash={@flash} />
      </div>

    <!-- Sidebar -->
      <div class="drawer-side">
        <label for="drawer-toggle" aria-label="close sidebar" class="drawer-overlay"></label>
        <aside class="min-h-full w-64 bg-base-200">
          <div class="p-4">
            <div class="flex items-center gap-2 mb-8">
              <img src={~p"/images/logo.svg"} width="32" alt="Logo" />
              <span class="font-bold text-lg">MyApp</span>
            </div>
            <%= if true do %>
              <ul class="menu menu-lg w-full">
                <li class="menu-title">
                  <span>Navigation</span>
                </li>
                <li :for={item <- menu()}>
                  <.link
                    navigate={~p"/#{item.path}"}
                    class={
                      if @current_page == item.page do
                        if item.page in [:resources, :exercises],
                          do: "bg-green-100 text-green-700",
                          else: "bg-blue-100 text-blue-700"
                      else
                        "hover:bg-gray-100"
                      end
                    }
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      >
                      </path>
                    </svg>
                    {item.name}
                  </.link>
                </li>
              </ul>
            <% end %>
          </div>
        </aside>
      </div>
    </div>

    <.custom_flash_group flash={@flash} />
    """
  end

  @doc """
  Shows the flash group with standard titles and content.

  ## Examples

      <.flash_group flash={@flash} />
  """
  attr :flash, :map, required: true, doc: "the map of flash messages"
  attr :id, :string, default: "flash-group", doc: "the optional id of flash container"

  def custom_flash_group(assigns) do
    ~H"""
    <div id={@id} aria-live="polite">
      <.flash kind={:info} flash={@flash} />
      <.flash kind={:error} flash={@flash} />

      <.flash
        id="client-error"
        kind={:error}
        title={gettext("We can't find the internet")}
        phx-disconnected={show(".phx-client-error #client-error") |> JS.remove_attribute("hidden")}
        phx-connected={hide("#client-error") |> JS.set_attribute({"hidden", ""})}
        hidden
      >
        {gettext("Attempting to reconnect")}
        <.icon name="hero-arrow-path" class="ml-1 size-3 motion-safe:animate-spin" />
      </.flash>

      <.flash
        id="server-error"
        kind={:error}
        title={gettext("Something went wrong!")}
        phx-disconnected={show(".phx-server-error #server-error") |> JS.remove_attribute("hidden")}
        phx-connected={hide("#server-error") |> JS.set_attribute({"hidden", ""})}
        hidden
      >
        {gettext("Attempting to reconnect")}
        <.icon name="hero-arrow-path" class="ml-1 size-3 motion-safe:animate-spin" />
      </.flash>
    </div>
    """
  end

  @doc """
  Provides dark vs light theme toggle based on themes defined in app.css.

  See <head> in root.html.heex which applies the theme before page load.
  """
  def theme_toggle(assigns) do
    ~H"""
    <div class="card relative flex flex-row items-center border-2 border-base-300 bg-base-300 rounded-full">
      <div class="absolute w-1/3 h-full rounded-full border-1 border-base-200 bg-base-100 brightness-200 left-0 [[data-theme=light]_&]:left-1/3 [[data-theme=dark]_&]:left-2/3 transition-[left]" />

      <button
        phx-click={JS.dispatch("phx:set-theme", detail: %{theme: "system"})}
        class="flex p-2 cursor-pointer w-1/3"
      >
        <.icon name="hero-computer-desktop-micro" class="size-4 opacity-75 hover:opacity-100" />
      </button>

      <button
        phx-click={JS.dispatch("phx:set-theme", detail: %{theme: "light"})}
        class="flex p-2 cursor-pointer w-1/3"
      >
        <.icon name="hero-sun-micro" class="size-4 opacity-75 hover:opacity-100" />
      </button>

      <button
        phx-click={JS.dispatch("phx:set-theme", detail: %{theme: "dark"})}
        class="flex p-2 cursor-pointer w-1/3"
      >
        <.icon name="hero-moon-micro" class="size-4 opacity-75 hover:opacity-100" />
      </button>
    </div>
    """
  end
end

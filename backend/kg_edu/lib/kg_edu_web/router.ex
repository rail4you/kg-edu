defmodule KgEduWeb.Router do
  use KgEduWeb, :router

  use AshAuthentication.Phoenix.Router

  import AshAuthentication.Plug.Helpers

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {KgEduWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
    plug :load_from_session
  end

  pipeline :api do
    plug :accepts, ["json"]
    plug :load_from_bearer
    plug :set_actor, :user
  end

  scope "/", KgEduWeb do
    pipe_through :browser

    ash_authentication_live_session :authenticated_routes do
      # in each liveview, add one of the following at the top of the module:
      #
      # If an authenticated user must be present:
      # on_mount {KgEduWeb.LiveUserAuth, :live_user_required}
      #
      # If an authenticated user *may* be present:
      # on_mount {KgEduWeb.LiveUserAuth, :live_user_optional}
      #
      # If an authenticated user must *not* be present:
      # on_mount {KgEduWeb.LiveUserAuth, :live_no_user}

      # Accounts CRUD
      live "/users", UserLive.Index, :index
      live "/users/new", UserLive.Form, :new
      live "/users/:id/edit", UserLive.Form, :edit

      live "/users/:id", UserLive.Show, :show
      live "/users/:id/show/edit", UserLive.Show, :edit

      # Courses CRUD
      live "/courses", CourseLive.Index, :index
      live "/courses/new", CourseLive.Form, :new
      live "/courses/:id/edit", CourseLive.Form, :edit

      live "/courses/:id", CourseLive.Show, :show
      live "/courses/:id/show/edit", CourseLive.Show, :edit

      # Files CRUD

      # Knowledge Resources CRUD
    end
  end

  scope "/api/json" do
    pipe_through [:api]

    forward "/swaggerui", OpenApiSpex.Plug.SwaggerUI,
      path: "/api/json/open_api",
      default_model_expand_depth: 4

    forward "/", KgEduWeb.AshJsonApiRouter
  end

  scope "/", KgEduWeb do
    pipe_through :browser

    get "/", PageController, :home
    auth_routes AuthController, KgEdu.Accounts.User, path: "/auth"
    sign_out_route AuthController

    # Remove these if you'd like to use your own authentication views
    sign_in_route register_path: "/register",
                  reset_path: "/reset",
                  auth_routes_prefix: "/auth",
                  on_mount: [{KgEduWeb.LiveUserAuth, :live_no_user}],
                  overrides: [KgEduWeb.AuthOverrides, AshAuthentication.Phoenix.Overrides.Default]

    # Remove this if you do not want to use the reset password feature
    reset_route auth_routes_prefix: "/auth",
                overrides: [KgEduWeb.AuthOverrides, AshAuthentication.Phoenix.Overrides.Default]

    # Remove this if you do not use the confirmation strategy
    confirm_route KgEdu.Accounts.User, :confirm_new_user,
      auth_routes_prefix: "/auth",
      overrides: [KgEduWeb.AuthOverrides, AshAuthentication.Phoenix.Overrides.Default]

    # Remove this if you do not use the magic link strategy.
    magic_sign_in_route(KgEdu.Accounts.User, :magic_link,
      auth_routes_prefix: "/auth",
      overrides: [KgEduWeb.AuthOverrides, AshAuthentication.Phoenix.Overrides.Default]
    )
  end

  # Other scopes may use custom stacks.
  scope "/api", KgEduWeb do
    pipe_through :api

    post "/files/upload", FileUploadController, :upload
  end

  scope "/mcp" do
    # pipe_through :mcp

    forward "/", AshAi.Mcp.Router,
      tools: [
        :list_courses,
        :create_course
      ],
      # For many tools, you will need to set the `protocol_version_statement` to the older version.
      protocol_version_statement: "2024-11-05",
      otp_app: :kg_edu
  end

  # Enable LiveDashboard and Swoosh mailbox preview in development
  if Application.compile_env(:kg_edu, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through :browser

      live_dashboard "/dashboard", metrics: KgEduWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end

  if Application.compile_env(:kg_edu, :dev_routes) do
    import AshAdmin.Router

    scope "/admin" do
      pipe_through :browser

      ash_admin "/"
    end
  end
end

defmodule KgEduWeb.Plugs.LoadActor do
  import Plug.Conn
  require Ash.Query

  def init(opts), do: opts

  def call(conn, _opts) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] ->
        with {:ok, %{"tenant" => tenant, "sub" => subject}} <- verify_and_extract_claims(token),
             {:ok, user} <- load_user(subject, tenant) do
          conn
          |> put_private(:ash_actor, user)
          |> assign(:actor, user)
          |> assign(:tenant, tenant)
          |> assign(:current_user, user)
        else
          # 签名无效 / 已过期 / 已注销：必须清除上游 set_actor 设置的 actor
          _ -> clear_actor(conn)
        end

      _ ->
        conn
    end
  end

  defp clear_actor(conn) do
    conn
    |> assign(:actor, nil)
    |> assign(:current_user, nil)
    |> put_private(:ash_actor, nil)
    |> put_private(:ash, Map.put(conn.private[:ash] || %{}, :actor, nil))
  end

  defp verify_and_extract_claims(token) do
    # 解析 token 声明；若 jti 已被注销则拒绝（防止「注销后仍可用」）
    case AshAuthentication.Jwt.peek(token) do
      {:ok, %{"tenant" => tenant, "sub" => subject} = claims}
      when not is_nil(tenant) and not is_nil(subject) ->
        if revoked?(claims) do
          {:error, :revoked}
        else
          {:ok, %{"tenant" => tenant, "sub" => subject}}
        end

      {:ok, _claims} ->
        {:error, :missing_fields}

      {:error, _} = error ->
        error
    end
  end

  defp revoked?(%{"jti" => jti}) when is_binary(jti) do
    AshAuthentication.TokenResource.Actions.jti_revoked?(KgEdu.Accounts.Token, jti)
  rescue
    _ -> false
  end

  defp revoked?(_), do: false

  defp load_user(nil, _), do: {:error, :no_subject}

  defp load_user(subject, tenant) do
    # Extract user ID from subject (format: "user?id=<uuid>" or just uuid)
    user_id = extract_user_id(subject)

    case user_id do
      nil ->
        {:error, :invalid_subject}

      _ ->
        case KgEdu.Accounts.User
             |> Ash.Query.filter(id == ^user_id)
             |> Ash.read_one(tenant: tenant) do
          {:ok, nil} -> {:error, :user_not_found}
          {:ok, user} -> {:ok, user}
          {:error, reason} -> {:error, reason}
        end
    end
  end

  defp extract_user_id("user?id=" <> user_id), do: user_id
  defp extract_user_id(other), do: other
end

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
    plug KgEduWeb.Plug.SetTenantFromToken
    plug :load_from_bearer
    plug :set_actor, :user
    plug KgEduWeb.Plugs.LoadActor
  end

  pipeline :api_upload do
    plug :accepts, ["json", "multipart"]
    plug KgEduWeb.Plug.SetTenantFromToken
    plug :load_from_bearer
    plug :set_actor, :user
    plug KgEduWeb.Plugs.LoadActor
  end

  # RPC 管道：在 api 基础上增加管理动作的角色校验
  pipeline :api_rpc do
    plug :accepts, ["json"]
    plug KgEduWeb.Plug.SetTenantFromToken
    plug :load_from_bearer
    plug :set_actor, :user
    plug KgEduWeb.Plugs.LoadActor
    plug KgEduWeb.Plugs.AuthorizeRpc
  end

  # JSON API 写操作守卫：只读教师禁止 POST/PATCH/PUT/DELETE
  pipeline :api_json_write_guard do
    plug KgEduWeb.Plugs.EnforceEditWindow
  end

  scope "/api", KgEduWeb do
    pipe_through :api
    get "/health", PageController, :health
    get "/client-ip", PageController, :client_ip
    get "/branding", PageController, :branding
    put "/branding", PageController, :update_branding
    get "/site-content", PageController, :get_site_content
    put "/site-content", PageController, :update_site_content
    get "/portal-config", PageController, :get_portal_config
    get "/portal-config/admin", PageController, :get_portal_config_admin
    put "/portal-config/levels", PageController, :update_portal_levels
    put "/portal-config/pages", PageController, :save_portal_pages
    get "/smart-portal/layout", PageController, :get_smart_portal_layout
    put "/smart-portal/layout", PageController, :update_smart_portal_layout
    get "/smart-portal/config", SmartPortalController, :get_template
    get "/smart-portal/configs", SmartPortalController, :list_configs
    post "/smart-portal/configs", SmartPortalController, :create_config
    put "/smart-portal/configs/:id", SmartPortalController, :update_config
    delete "/smart-portal/configs/:id", SmartPortalController, :delete_config
    get "/smart-portal/student", SmartPortalController, :get_student_config
    get "/course-categories", PageController, :get_course_categories
    get "/course-categories/admin", PageController, :get_course_categories_admin
    put "/course-categories", PageController, :save_course_categories
    post "/chat/stream", ChatController, :stream_message
    get "/knowledge/hierarchy/nested", NestedHierarchyController, :get_nested_hierarchy
    post "/session/find-tenants", SessionController, :find_tenants
    post "/generate_ai_exercise", GenerationController, :generate_exercise
    get "/admin/system-info", SystemInfoController, :get_info
    # P0: AI 语音合成（Qwen TTS）
    get "/tts/voices", TtsController, :voices
    post "/tts/translate", TtsController, :translate
    post "/tts/synthesize", TtsController, :synthesize
    # P1: 考试监考抓拍
    get "/proctor/exams", ProctorController, :exams
    get "/proctor/exams/:id/snapshots", ProctorController, :snapshots
    # P2: 视频 AI 解析
    post "/video-analysis/analyze", VideoAnalysisController, :analyze
    get "/video-analysis", VideoAnalysisController, :index
    get "/video-analysis/by-video", VideoAnalysisController, :by_video
    get "/video-analysis/:id", VideoAnalysisController, :show
    get "/video-analysis/:id/marks", VideoAnalysisController, :marks
    # P3: 表单 AI（填表/公式）与实践评估
    post "/forms/ai-fill", FormsAiController, :ai_fill
    post "/forms/ai-formula", FormsAiController, :ai_formula
    get "/practice/attempts", PracticeController, :list_attempts
    get "/practice/session", PracticeController, :session
    post "/practice/session", PracticeController, :save_session
    post "/practice/session/reset", PracticeController, :reset_session
    post "/practice/evaluate", PracticeController, :evaluate
    get "/practice-session/mine", PracticeSessionController, :mine
    get "/practice-session/tenant", PracticeSessionController, :list_tenant
    post "/practice-session", PracticeSessionController, :create
    get "/practice-session/:token", PracticeSessionController, :show
    post "/practice-session/:token/join", PracticeSessionController, :join
    post "/practice-session/:token/messages", PracticeSessionController, :messages
    post "/practice-session/:token/start", PracticeSessionController, :start
    post "/practice-session/:token/evaluate", PracticeSessionController, :evaluate
    post "/practice-session/:token/grade", PracticeSessionController, :grade
  end

  # Legacy /agent prefix — frontend still calls with /agent/* URLs
  scope "/agent", KgEduWeb do
    pipe_through :api
    post "/api/generate_ai_exercise", GenerationController, :generate_exercise
    post "/api/chat", ChatController, :stream_message
    post "/import-chapters", ImportController, :import_chapters
    post "/import", ImportController, :import_knowledge
    post "/competency-graph/generate", GenerationController, :generate_competency_graph
    post "/exam/preview", GenerationController, :preview_exam
  end

  # File upload endpoints (migrated from Express :3000 server)
  scope "/api", KgEduWeb do
    pipe_through :api_upload
    post "/upload", FileUploadController, :upload
    post "/sts-token", FileUploadController, :sts_token
  end

  # Competency graph, curriculum generation, and exam preview endpoints
  scope "/", KgEduWeb do
    pipe_through :api
    post "/api/chat", ChatController, :stream_message
    post "/competency-graph/generate", GenerationController, :generate_competency_graph
    post "/curriculum/generate", GenerationController, :generate_curriculum
    post "/exam/preview", GenerationController, :preview_exam
    post "/api/job-competency-graph/ai-generate", GenerationController, :ai_generate_job_graph
    post "/update_answer_explanation", GenerationController, :update_answer_explanation
  end

  # Excel import endpoints (compatible with agent-server format)
  scope "/", KgEduWeb do
    pipe_through :api
    post "/import", ImportController, :import_knowledge
    post "/import-chapters", ImportController, :import_chapters
  end

  # Curriculum document upload + async jobs
  scope "/api/curriculum", KgEduWeb do
    pipe_through :api
    post "/upload", GenerationController, :upload_curriculum_document
    post "/jobs", GenerationController, :create_curriculum_job
    get "/jobs/:jobId", GenerationController, :get_curriculum_job
  end

  # CopilotKit/Pi SDK compatible chat endpoint
  # Frontend calls POST /api/assistant/ag-ui via Vite proxy
  scope "/api/assistant", KgEduWeb do
    pipe_through :api
    post "/ag-ui", ChatController, :stream_message
    # 需求 10：助教插件
    get "/settings", AssistantController, :settings
    post "/settings", AssistantController, :save_settings
    get "/plugins", AssistantController, :plugins
    post "/plugin-run", AssistantController, :plugin_run
    get "/mcp-tools", AssistantController, :mcp_tools
  end

  # 需求 12：AI 追踪
  scope "/api/track", KgEduWeb do
    pipe_through :api
    get "/search", TrackController, :search
    get "/author", TrackController, :author
    post "/twin-chat", TrackController, :twin_chat
    get "/venue-digest", TrackController, :venue_digest
  end

  scope "/live", KgEduWeb do
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
      live "/resources", ResourceLive.Index, :index
      live "/resources/new", ResourceLive.Form, :new
      live "/resources/:id/edit", ResourceLive.Form, :edit

      live "/resources/:id", ResourceLive.Show, :show
      live "/resources/:id/show/edit", ResourceLive.Show, :edit

      # Exercise CRUD
      live "/exercises", ExerciseLive.Index, :index
      live "/exercises/new", ExerciseLive.Form, :new
      live "/exercises/:id/edit", ExerciseLive.Form, :edit

      live "/exercises/:id", ExerciseLive.Show, :show
      live "/exercises/:id/show/edit", ExerciseLive.Show, :edit

      # File
      live "/files", FileLive.Index, :index
      live "/files/new", FileLive.Form, :new
      live "/files/:id/edit", FileLive.Form, :edit

      live "/files/:id", FileLive.Show, :show
      live "/files/:id/show/edit", FileLive.Show, :edit
    end
  end

  scope "/rpc" do
    pipe_through :api_rpc
    post "/run", KgEduWeb.AshTypescriptRpcController, :run
    post "/validate", KgEduWeb.AshTypescriptRpcController, :validate
  end

  # P0: ash_ai MCP Server（仅 MCP 功能）— 暴露 Domain tools 给 MCP 客户端（AI 助教/插件）
  # 演示环境允许匿名连接；生产建议加 ApiKey/OAuth 鉴权
  scope "/mcp" do
    pipe_through :api
    forward "/", AshAi.Mcp.Router, otp_app: :kg_edu, protocol_version_statement: "2024-11-05"
  end

  scope "/api/json" do
    pipe_through [:api, :api_json_write_guard]

    forward "/swaggerui", OpenApiSpex.Plug.SwaggerUI,
      path: "/api/json/open_api",
      default_model_expand_depth: 4

    forward "/", KgEduWeb.AshJsonApiRouter
  end

  # Other scopes may use custom stacks.
  scope "/api", KgEduWeb do
    pipe_through :api
    get "/download/template", DownloadController, :template

    # Organization statistics endpoints
    get "/organizations/summary", OrganizationController, :get_all_summary
    post "/organizations/summary", OrganizationController, :get_all_summary
    get "/organizations/:organization_id/summary", OrganizationController, :get_summary
    post "/organizations/summary/:organization_id", OrganizationController, :get_summary

    # Organization export/import (tenant cloning)
    post "/organizations/:id/export", OrganizationController, :export
    post "/organizations/import", OrganizationController, :import
  end

  scope "/api", KgEduWeb do
    pipe_through :api_upload
    post "/files/upload", FileUploadController, :upload
    get "/files/template", FileUploadController, :download_template
    post "/files/import-xmind", FileUploadController, :import_xmind
    post "/files/import-excel", FileUploadController, :import_excel
    post "/videos/upload-waffle", UploadVideoController, :upload
    post "/videos/:video_id/link-chapter", UploadVideoController, :link_to_chapter
    post "/videos/:video_id/unlink-chapter", UploadVideoController, :unlink_from_chapter
  end

  scope "/", KgEduWeb do
    pipe_through :browser
    get "/health", PageController, :health
    get "/*path", PageController, :index

    # get "/", PageController, :home
    # auth_routes AuthController, KgEdu.Accounts.User, path: "/auth"
    # sign_out_route AuthController

    # # Remove these if you'd like to use your own authentication views
    # sign_in_route register_path: "/register",
    #               reset_path: "/reset",
    #               auth_routes_prefix: "/auth",
    #               on_mount: [{KgEduWeb.LiveUserAuth, :live_no_user}],
    #               overrides: [KgEduWeb.AuthOverrides, AshAuthentication.Phoenix.Overrides.Default]

    # # Remove this if you do not want to use the reset password feature
    # reset_route auth_routes_prefix: "/auth",
    #             overrides: [KgEduWeb.AuthOverrides, AshAuthentication.Phoenix.Overrides.Default]

    # # Remove this if you do not use the confirmation strategy
    # confirm_route KgEdu.Accounts.User, :confirm_new_user,
    #   auth_routes_prefix: "/auth",
    #   overrides: [KgEduWeb.AuthOverrides, AshAuthentication.Phoenix.Overrides.Default]

    # # Remove this if you do not use the magic link strategy.
    # magic_sign_in_route(KgEdu.Accounts.User, :magic_link,
    #   auth_routes_prefix: "/auth",
    #   overrides: [KgEduWeb.AuthOverrides, AshAuthentication.Phoenix.Overrides.Default]
    # )
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

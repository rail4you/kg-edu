# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config
config :waffle,
  storage: Waffle.Storage.AliyunOss,
  bucket: "kg-edu",
  region: "cn-beijing",
  endpoint: "oss-cn-beijing.aliyuncs.com",
  access_key_id: "LTAI5tA3M63FNf9qJPGwHGMU",
  access_key_secret: "Y481c9cjNvloxWTC0WOkLw8qWM9FMI"



config :ash_typescript,
  output_file: "../../minimal-vite-ts/src/lib/ash_rpc.ts",
  run_endpoint: "/rpc/run",
  validate_endpoint: "/rpc/validate",
  input_field_formatter: :camel_case,
  output_field_formatter: :camel_case,
  require_tenant_parameters: false,
  generate_zod_schemas: true,
  generate_phx_channel_rpc_actions: false,
  generate_validation_functions: true,
  zod_import_path: "zod",
  zod_schema_suffix: "ZodSchema",
  phoenix_import_path: "phoenix"

config :cinder, default_theme: "modern"
# config :ash_oban, pro?: false

config :kg_edu, Oban,
  engine: Oban.Engines.Basic,
  notifier: Oban.Notifiers.Postgres,
  queues: [default: 10, chat_responses: [limit: 10], conversations: [limit: 10]],
  repo: KgEdu.Repo,
  plugins: [{Oban.Plugins.Cron, []}]

config :mime,
  extensions: %{"json" => "application/vnd.api+json"},
  types: %{"application/vnd.api+json" => ["json"], "multipart/x.ash+form-data" => ["json"]}

config :ash_json_api,
  show_public_calculations_when_loaded?: false,
  authorize_update_destroy_with_error?: true

config :ash,
  allow_forbidden_field_for_relationships_by_default?: true,
  include_embedded_source_by_default?: false,
  show_keysets_for_all_actions?: false,
  default_page_type: :keyset,
  policies: [no_filter_static_forbidden_reads?: false],
  keep_read_action_loads_when_loading?: false,
  default_actions_require_atomic?: true,
  read_action_after_action_hooks_in_order?: true,
  bulk_actions_default_to_errors?: true

config :spark,
  formatter: [
    remove_parens?: true,
    "Ash.Resource": [
      section_order: [
        :admin,
        :authentication,
        :tokens,
        :postgres,
        :json_api,
        :resource,
        :code_interface,
        :actions,
        :policies,
        :pub_sub,
        :preparations,
        :changes,
        :validations,
        :multitenancy,
        :attributes,
        :relationships,
        :calculations,
        :aggregates,
        :identities
      ]
    ],
    "Ash.Domain": [
      section_order: [
        :admin,
        :json_api,
        :resources,
        :policies,
        :authorization,
        :domain,
        :execution
      ]
    ]
  ]

config :kg_edu,
  ecto_repos: [KgEdu.Repo],
  generators: [timestamp_type: :utc_datetime],
  ash_domains: [KgEdu.Accounts, KgEdu.Courses, KgEdu.Knowledge, KgEdu.AI]

# Configures the endpoint
config :kg_edu, KgEduWeb.Endpoint,
  secret_key_base: "kjoy3o1zeidquwy1398juxzldjlksahdk3",
  url: [host: "localhost"],
   static_url: [path: "/"],
  static: [
    at: "/",
    from: :my_app,
    gzip: false,
    only: ~w(js css images fonts favicon.ico robots.txt index.html)
  ],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [html: KgEduWeb.ErrorHTML, json: KgEduWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: KgEdu.PubSub,
  live_view: [signing_salt: "Hy3+4L3g"]

# Configures the mailer
#
# By default it uses the "Local" adapter which stores the emails
# locally. You can see the emails in your browser, at "/dev/mailbox".
#
# For production it's recommended to configure a different adapter
# at the `config/runtime.exs`.
config :kg_edu, KgEdu.Mailer, adapter: Swoosh.Adapters.Local

# Configure esbuild (the version is required)
config :esbuild,
  version: "0.25.4",
  kg_edu: [
    args:
      ~w(js/index.tsx js/app.js --bundle --target=es2022 --outdir=../priv/static/assets/js --external:/fonts/* --external:/images/* --alias:@=.),
    cd: Path.expand("../assets", __DIR__),
    env: %{"NODE_PATH" => [Path.expand("../deps", __DIR__), Mix.Project.build_path()]}
  ]

# Configure tailwind (the version is required)
config :tailwind,
  version: "4.1.7",
  kg_edu: [
    args: ~w(
      --input=assets/css/app.css
      --output=priv/static/assets/css/app.css
    ),
    cd: Path.expand("..", __DIR__)
  ]

# Configures Elixir's Logger
config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# ReqLLM configuration for AI exercise generation
config :kg_edu, :reqllm,
  api_key: System.get_env("OPENROUTER_API_KEY") || "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",
  model: "openrouter:z-ai/glm-4.5"

# Waffle configuration for file uploads
# config :waffle,
#   storage: Waffle.Storage.Local,
#   asset_host: "http://localhost:4000",
#   uploads_dir: "priv/uploads"

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"

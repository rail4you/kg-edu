defmodule KgEdu.Utils.FileTemplate do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Utils,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  postgres do
    table "file_templates"
    repo KgEdu.Repo
  end

  multitenancy do
    strategy :context
  end


  json_api do
    type "file_template"
  end

  typescript do
    type_name "FileTemplate"
  end

  code_interface do
    define :create_file_template, action: :create
    define :update_file_template, action: :update
    define :delete_file_template, action: :destroy
    define :get_file_template, action: :read, get_by: [:id]
    define :list_file_templates, action: :read
    define :get_file_template_by_section, action: :by_section
  end

  actions do
    defaults [:read, :destroy]

    read :get do
      description "Get a file template by ID"
      get? true
    end

    create :create do
      accept [:section, :file_path]
    end

    update :update do
      accept [:section, :file_path]
    end

    read :by_section do
      description "Get file templates by section"
      get? true
      argument :section, :string, allow_nil?: false
      filter expr(section == ^arg(:section))
    end
  end

  policies do
    policy always() do
      authorize_if always()
    end
  end

  attributes do
    uuid_primary_key :id do
      public? true
    end

    attribute :section, :string do
      allow_nil? false
      public? true
      description "The section category for the file template"
    end

    attribute :file_path, :string do
      allow_nil? false
      public? true
      description "The file path for the template"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end
end

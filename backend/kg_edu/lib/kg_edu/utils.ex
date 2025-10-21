defmodule KgEdu.Utils do
  use Ash.Domain,
    otp_app: :kg_edu,
    extensions: [AshAdmin.Domain, AshJsonApi.Domain, AshPhoenix, AshTypescript.Rpc]

  admin do
    show? true
  end

  typescript_rpc do
    resource KgEdu.Utils.FileTemplate do
      rpc_action :list_file_templates, :read
      rpc_action :create_file_template, :create
      rpc_action :update_file_template, :update
      rpc_action :destroy_file_template, :destroy
      rpc_action :get_file_template, :get
      rpc_action :get_file_template_by_section, :by_section
    end
  end

  json_api do
    routes do
      base_route "/file-templates", KgEdu.Utils.FileTemplate do
        get :read, route: "/"
        index :by_section, route: "/section/:section"
        post :create, route: "/"
        patch :update, route: "/:id"
        delete :destroy, route: "/:id"
      end
    end
  end

  resources do
    resource KgEdu.Utils.FileTemplate
  end
end

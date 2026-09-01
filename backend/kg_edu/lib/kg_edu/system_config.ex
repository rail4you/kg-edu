defmodule KgEdu.SystemConfig do
  @moduledoc """
  Domain for global system configuration (non-tenant).
  Only super admins should have access to modify these settings.
  """

  use Ash.Domain,
    otp_app: :kg_edu,
    extensions: [AshAdmin.Domain, AshJsonApi.Domain, AshPhoenix, AshTypescript.Rpc]

  admin do
    show?(true)
  end

  typescript_rpc do
    resource KgEdu.SystemConfig.ApiKeyConfig do
      rpc_action(:get_api_key_config, :by_provider)
      rpc_action(:update_api_key_config, :upsert)
      rpc_action(:list_api_key_configs, :read)
      rpc_action(:delete_api_key_config, :destroy)
    end

    resource KgEdu.SystemConfig.SiteContentConfig do
      rpc_action(:get_site_content, :read_default)
      rpc_action(:save_site_content, :upsert)
    end

    resource KgEdu.SystemConfig.PortalLevel do
      rpc_action(:list_portal_levels, :read)
      rpc_action(:save_portal_level, :upsert)
    end

    resource KgEdu.SystemConfig.TemplatePage do
      rpc_action(:list_template_pages, :read)
      rpc_action(:create_template_page, :create)
      rpc_action(:update_template_page, :update)
      rpc_action(:delete_template_page, :destroy)
    end
  end

  resources do
    resource(KgEdu.SystemConfig.ApiKeyConfig)
    resource(KgEdu.SystemConfig.SiteContentConfig)
    resource(KgEdu.SystemConfig.PortalLevel)
    resource(KgEdu.SystemConfig.TemplatePage)
  end
end

defmodule KgEdu.Email do
  use Ash.Domain, otp_app: :kg_edu, extensions: [AshAdmin.Domain, AshJsonApi.Domain, AshPhoenix, AshTypescript.Rpc]

  admin do
    show? true
  end

  typescript_rpc do
    resource KgEdu.Email.EmailConfig do
      rpc_action :list_email_configs, :read
      rpc_action :get_email_config, :by_id
      rpc_action :get_email_config_by_user, :by_user
      rpc_action :create_email_config, :create
      rpc_action :update_email_config, :update
      rpc_action :delete_email_config, :destroy
    end

    resource KgEdu.Email.EmailMessage do
      rpc_action :list_email_messages, :read
      rpc_action :get_email_message, :by_id
      rpc_action :list_sent_messages, :by_sender
      rpc_action :list_received_messages, :by_receiver
      rpc_action :create_email_message, :create
      rpc_action :send_email, :send_email
      rpc_action :reply_email, :reply_email
      rpc_action :mark_as_sent, :mark_as_sent
      rpc_action :mark_as_failed, :mark_as_failed
    end
  end

  resources do
    resource KgEdu.Email.EmailConfig
    resource KgEdu.Email.EmailMessage
  end
end

defmodule KgEdu.AI do
  use Ash.Domain, otp_app: :kg_edu, extensions: [AshPhoenix, AshTypescript.Rpc]

  typescript_rpc do
    resource KgEdu.AI.Command do
      rpc_action :create_command, :create
      rpc_action :get_command, :by_id
      rpc_action :list_commands, :read
      rpc_action :update_command, :update
      rpc_action :delete_command, :destroy
    end

    resource KgEdu.AI.Conversation do
      rpc_action :create_conversation, :create
      rpc_action :get_conversation, :by_id
      rpc_action :list_conversations, :read
      rpc_action :delete_conversation, :destroy
    end

    resource KgEdu.AI.AssistantSetting do
      rpc_action(:list_assistant_settings, :read)
      rpc_action(:save_assistant_settings, :upsert)
    end

    resource KgEdu.AI.AssistantTool do
      rpc_action(:create_assistant_tool, :create)
      rpc_action(:update_assistant_tool, :update)
      rpc_action(:delete_assistant_tool, :destroy)
      rpc_action(:get_assistant_tool, :read)
      rpc_action(:list_assistant_tools, :read)
    end

    resource KgEdu.AI.ResearchFollow do
      rpc_action(:follow_research, :create)
      rpc_action(:unfollow_research, :destroy)
      rpc_action(:list_research_follows, :read)
      rpc_action(:list_follows_by_user, :by_user)
    end
  end

  resources do
    resource KgEdu.AI.Command do
      define :create_command, action: :create
      define :get_command, action: :read, get_by: [:id]
      define :list_commands, action: :read
      define :update_command, action: :update
      define :delete_command, action: :destroy
    end

    resource KgEdu.AI.Conversation do
      define :create_conversation, action: :create
      define :get_conversation, action: :read, get_by: [:id]
      define :list_conversations, action: :read
      define :delete_conversation, action: :destroy
    end

    resource KgEdu.AI.AssistantSetting do
      define :get_assistant_settings, action: :read
      define :save_assistant_settings, action: :upsert
    end

    resource KgEdu.AI.AssistantTool do
      define :create_assistant_tool, action: :create
      define :update_assistant_tool, action: :update
      define :delete_assistant_tool, action: :destroy
      define :get_assistant_tool, action: :read, get_by: [:id]
      define :list_assistant_tools, action: :read
    end

    resource KgEdu.AI.ResearchFollow do
      define :follow_research, action: :create
      define :unfollow_research, action: :destroy
      define :list_research_follows, action: :read
      define :list_follows_by_user, action: :by_user
    end
  end
end

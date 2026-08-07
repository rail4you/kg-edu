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

    resource KgEdu.AI.DigitalHumanTask do
      rpc_action :create_digital_human_task, :create
      rpc_action :get_digital_human_task, :by_id
      rpc_action :list_digital_human_tasks, :read
    end

    resource KgEdu.AI.CameraScript do
      rpc_action :create_camera_script, :create
      rpc_action :get_camera_script, :by_id
      rpc_action :list_camera_scripts, :read
      rpc_action :update_camera_script, :update
      rpc_action :delete_camera_script, :destroy
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

    resource KgEdu.AI.DigitalHumanTask do
      define :create_digital_human_task, action: :create
      define :get_digital_human_task, action: :read, get_by: [:id]
      define :list_digital_human_tasks, action: :read
      define :update_digital_human_task_status, action: :update_status
    end

    resource KgEdu.AI.CameraScript do
      define :create_camera_script, action: :create
      define :get_camera_script, action: :read, get_by: [:id]
      define :list_camera_scripts, action: :read
      define :update_camera_script, action: :update
      define :update_camera_script_status, action: :update_status
      define :delete_camera_script, action: :destroy
    end
  end
end

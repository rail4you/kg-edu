defmodule KgEdu.Research do
  @moduledoc """
  虚拟教研室：教师协同研讨的讨论与消息。
  """
  use Ash.Domain,
    otp_app: :kg_edu,
    extensions: [AshAdmin.Domain, AshJsonApi.Domain, AshPhoenix, AshTypescript.Rpc]

  admin do
    show?(true)
  end

  typescript_rpc do
    resource KgEdu.Research.ResearchRoomMessage do
      rpc_action(:list_research_room_messages, :read)
      rpc_action(:get_research_room_message, :by_id)
      rpc_action(:create_research_room_message, :create)
      rpc_action(:mark_research_room_message_read, :mark_read)
      rpc_action(:delete_research_room_message, :destroy)
    end
  end

  resources do
    resource(KgEdu.Research.ResearchRoomMessage)
  end
end

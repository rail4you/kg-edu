defmodule KgEdu.Insights do
  use Ash.Domain,
    otp_app: :kg_edu,
    extensions: [AshAdmin.Domain, AshJsonApi.Domain, AshPhoenix, AshTypescript.Rpc]

  admin do
    show?(true)
  end

  typescript_rpc do
    resource KgEdu.Insights.ReportTemplate do
      rpc_action(:create_report_template, :create)
      rpc_action(:update_report_template, :update)
      rpc_action(:delete_report_template, :destroy)
      rpc_action(:get_report_template, :read)
      rpc_action(:list_report_templates, :read)
      rpc_action(:ask_data_question, :ask_question)
      rpc_action(:build_data_report, :build_report)
      rpc_action(:build_data_table, :build_table)
    end
  end

  resources do
    resource(KgEdu.Insights.ReportTemplate)
  end
end

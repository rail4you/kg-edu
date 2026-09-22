defmodule KgEdu.Forms do
  use Ash.Domain,
    otp_app: :kg_edu,
    extensions: [AshAdmin.Domain, AshJsonApi.Domain, AshPhoenix, AshTypescript.Rpc]

  admin do
    show?(true)
  end

  typescript_rpc do
    resource KgEdu.Forms.FormDef do
      rpc_action(:create_form_def, :create)
      rpc_action(:update_form_def, :update)
      rpc_action(:delete_form_def, :destroy)
      rpc_action(:get_form_def, :read)
      rpc_action(:list_form_defs, :read)
    end

    resource KgEdu.Forms.FormSubmission do
      rpc_action(:submit_form, :create)
      rpc_action(:review_submission, :review)
      rpc_action(:delete_submission, :destroy)
      rpc_action(:get_form_submission, :read)
      rpc_action(:list_form_submissions, :read)
      rpc_action(:list_form_submissions_by_form, :by_form)
      rpc_action(:list_form_submissions_by_submitter, :by_submitter)
    end
  end

  resources do
    resource(KgEdu.Forms.FormDef)
    resource(KgEdu.Forms.FormSubmission)
  end
end

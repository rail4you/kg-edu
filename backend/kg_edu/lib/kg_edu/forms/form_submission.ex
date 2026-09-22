defmodule KgEdu.Forms.FormSubmission do
  @moduledoc """
  P3: 表单提交 + 简易审批流（学生提交 → 教师审核）。
  status: submitted（待审核）/ approved / rejected。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Forms,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  postgres do
    table "form_submissions"
    repo KgEdu.Repo
  end

  json_api do
    type "form_submission"
  end

  typescript do
    type_name "FormSubmission"
  end

  code_interface do
    define :submit_form, action: :create
    define :review_submission, action: :review
    define :delete_submission, action: :destroy
    define :get_submission, action: :read, get_by: [:id]
    define :list_submissions, action: :read
    define :list_submissions_by_form, action: :by_form
    define :list_submissions_by_submitter, action: :by_submitter
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [:form_id, :submitter_id, :values]

      change set_attribute(:status, :submitted)
    end

    update :review do
      description "教师审核：批准或驳回"
      accept [:status, :review_note, :reviewer_id]
      require_atomic? false

      validate fn changeset, _ ->
        status = Ash.Changeset.get_attribute(changeset, :status)

        if status in [:approved, :rejected] do
          :ok
        else
          {:error, field: :status, message: "只能审核为 approved 或 rejected"}
        end
      end
    end

    read :by_form do
      argument :form_id, :uuid, allow_nil?: false
      filter expr(form_id == ^arg(:form_id))
    end

    read :by_submitter do
      argument :submitter_id, :uuid, allow_nil?: false
      filter expr(submitter_id == ^arg(:submitter_id))
    end
  end

  policies do
    policy always() do
      authorize_if always()
    end
  end

  multitenancy do
    strategy :context
  end

  attributes do
    uuid_primary_key :id do
      public? true
    end

    attribute :submitter_id, :uuid do
      allow_nil? true
      public? true
    end

    attribute :values, :map do
      allow_nil? false
      public? true
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :submitted
      constraints one_of: [:submitted, :approved, :rejected]
    end

    attribute :review_note, :string do
      allow_nil? true
      public? true
    end

    attribute :reviewer_id, :uuid do
      allow_nil? true
      public? true
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :form, KgEdu.Forms.FormDef do
      allow_nil? false
      public? true
    end
  end
end

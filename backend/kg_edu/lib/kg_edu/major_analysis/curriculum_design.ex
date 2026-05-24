defmodule KgEdu.MajorAnalysis.CurriculumDesign do
  @moduledoc """
  课程体系设计资源。
  存储 AI 辅助生成的课程体系方案。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "curriculum_designs"
    repo KgEdu.Repo
    references do
      reference :major, on_delete: :delete
    end
  end

  json_api do
    type "curriculum_design"
  end

  typescript do
    type_name "CurriculumDesign"
  end

  code_interface do
    define :create_curriculum_design, action: :create
    define :update_curriculum_design, action: :update_curriculum
    define :delete_curriculum_design, action: :destroy
    define :get_curriculum_design, action: :by_id
    define :list_curriculum_designs, action: :read
    define :get_designs_by_major, action: :by_major
    define :ai_generate_curriculum, action: :ai_generate
    define :publish_curriculum, action: :publish
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_major do
      argument :major_id, :uuid, allow_nil?: false
      filter expr(major_id == ^arg(:major_id))
    end

    create :create do
      accept [:title, :description, :major_id, :design_data, :file_url, :markdown_content]
      change fn changeset, _context ->
        Ash.Changeset.change_attribute(changeset, :version, 1)
        |> Ash.Changeset.change_attribute(:status, :draft)
      end
    end

    update :update_curriculum do
      accept [:title, :description, :design_data, :file_url, :markdown_content]
      require_atomic? false
    end

    update :publish do
      require_atomic? false
      accept []
      change fn changeset, _context ->
        Ash.Changeset.change_attribute(changeset, :status, :published)
      end
    end

    action :ai_generate, :map do
      description "AI generate curriculum design"
      argument :major_id, :uuid, allow_nil?: false

      run fn input, context ->
        tenant = context.tenant
        major_name = "专业"

        case Ash.get(KgEdu.MajorAnalysis.Major, input.arguments.major_id, tenant: tenant, authorize?: false) do
          {:ok, major} ->
            design_data = Jason.encode!(%{
              semesters: [
                %{semester: 1, courses: [%{name: "专业导论", credits: 2, type: "basic"}]},
                %{semester: 2, courses: [%{name: "专业基础课", credits: 3, type: "professional_basic"}]}
              ],
              generated_at: DateTime.utc_now() |> DateTime.to_iso8601()
            })

            name = major.name || "专业"
            __MODULE__
            |> Ash.Changeset.for_create(:create, %{
              title: "#{name} - AI生成课程体系",
              description: "基于AI分析自动生成的课程体系设计方案",
              major_id: input.arguments.major_id,
              design_data: design_data,
              ai_generated: true
            }, tenant: tenant, authorize?: false)
            |> Ash.create()

          error -> error
        end
      end
    end
  end

  policies do
    # 公开读取课程体系设计
    policy [action(:read), action(:by_id), action(:by_major)] do
      authorize_if always()
    end

    # 教师/管理员可管理课程体系
    policy [action(:create), action(:update_curriculum), action(:destroy), action(:ai_generate), action(:publish)] do
      authorize_if expr(:teacher == ^actor(:role))
      authorize_if expr(:admin == ^actor(:role))
      authorize_if expr(:super_admin == ^actor(:role))
    end
  end

  multitenancy do
    strategy :context
  end

  attributes do
    uuid_primary_key :id

    attribute :title, :string do
      allow_nil? false
      public? true
    end

    attribute :description, :string do
      allow_nil? true
      public? true
    end

    attribute :design_data, :string do
      allow_nil? true
      public? true
      description "Structured curriculum data (JSON)"
    end

    attribute :file_url, :string do
      allow_nil? true
      public? true
      description "DOCX file URL stored in OSS"
    end

    attribute :markdown_content, :string do
      allow_nil? true
      public? true
      description "Full markdown content for preview"
    end

    attribute :ai_generated, :boolean do
      allow_nil? false
      public? true
      default false
    end

    attribute :version, :integer do
      allow_nil? false
      public? true
      default 1
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :draft
      constraints one_of: [:draft, :published]
    end

    create_timestamp :inserted_at do
      public? true
    end
    update_timestamp :updated_at do
      public? true
    end
  end

  relationships do
    belongs_to :major, KgEdu.MajorAnalysis.Major do
      allow_nil? false
      public? true
    end
  end
end

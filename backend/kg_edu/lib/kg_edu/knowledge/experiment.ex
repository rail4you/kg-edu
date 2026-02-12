defmodule KgEdu.Knowledge.Experiment do
  @moduledoc """
  Experiment resource (实验).
  Represents a laboratory experiment or practical assignment in a course.
  Experiments can be online (virtual labs) or offline (physical labs).
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Logger

  postgres do
    table "experiments"
    repo KgEdu.Repo

    references do
      reference :course, on_delete: :delete
      reference :chapter, on_delete: :nilify
      reference :created_by, on_delete: :nilify
    end
  end

  json_api do
    type "experiment"
  end

  typescript do
    type_name "Experiment"
  end

  code_interface do
    define :create_experiment, action: :create
    define :update_experiment, action: :update
    define :destroy_experiment, action: :destroy
    define :get_experiment, action: :read, get_by: [:id]
    define :list_experiments, action: :read
    define :get_experiments_by_course, action: :by_course
    define :get_experiments_by_chapter, action: :by_chapter
    define :get_experiments_by_creator, action: :by_creator
    define :get_published_experiments, action: :published
    define :add_knowledge_resource, action: :add_knowledge_resource
    define :remove_knowledge_resource, action: :remove_knowledge_resource
    define :add_ability, action: :add_ability
    define :remove_ability, action: :remove_ability
    define :update_guide_file, action: :update_guide_file
  end

  actions do
    defaults [:read, :destroy]

    read :by_course do
      description "Get all experiments for a specific course"

      argument :course_id, :uuid do
        allow_nil? false
      end

      filter expr(course_id == ^arg(:course_id))

      prepare fn query, _context ->
        Ash.Query.sort(query, sort_order: :asc, inserted_at: :desc)
      end
    end

    read :by_chapter do
      description "Get all experiments for a specific chapter"

      argument :chapter_id, :uuid do
        allow_nil? false
      end

      filter expr(chapter_id == ^arg(:chapter_id))

      prepare fn query, _context ->
        Ash.Query.sort(query, sort_order: :asc, inserted_at: :desc)
      end
    end

    read :by_creator do
      description "Get experiments created by a specific user"

      argument :created_by_id, :uuid do
        allow_nil? false
      end

      filter expr(created_by_id == ^arg(:created_by_id))

      prepare fn query, _context ->
        Ash.Query.sort(query, inserted_at: :desc)
      end
    end

    read :published do
      description "Get only published experiments"

      filter expr(status == :published)
    end

    create :create do
      primary? true

      accept [
        :title,
        :description,
        :experiment_type,
        :duration_hours,
        :difficulty_level,
        :objectives,
        :requirements,
        :equipment,
        :status,
        :sort_order,
        :guide_url,
        :guide_title,
        :course_id,
        :chapter_id,
        :created_by_id
      ]

      argument :knowledge_resource_ids, {:array, :uuid} do
        description "List of knowledge resource IDs to associate with this experiment"
        default []
      end

      argument :ability_ids, {:array, :map} do
        description """
        List of ability associations with format:
        [%{ability_type: :main_ability, main_ability_id: uuid},
         %{ability_type: :sub_ability, sub_ability_id: uuid}]
        """

        default []
      end

      change fn changeset, _context ->
        # Set default sort_order if not provided
        sort_order = Ash.Changeset.get_attribute(changeset, :sort_order)

        if is_nil(sort_order) do
          # Get max sort_order for this course and increment
          course_id = Ash.Changeset.get_attribute(changeset, :course_id)

          if course_id do
            case KgEdu.Knowledge.Experiment.list_experiments(
                   authorize?: false,
                   query: [filter: [course_id: course_id]]
                 ) do
              {:ok, experiments} ->
                max_order =
                  Enum.reduce(experiments, 0, fn exp, acc ->
                    if exp.sort_order && exp.sort_order > acc, do: exp.sort_order, else: acc
                  end)

                Ash.Changeset.change_attribute(changeset, :sort_order, max_order + 1)

              _ ->
                changeset
            end
          else
            Ash.Changeset.change_attribute(changeset, :sort_order, 1)
          end
        else
          changeset
        end
      end

      change manage_relationship(
               :knowledge_resource_ids,
               :knowledge_resources,
               type: :append
             )

      change fn changeset, _context ->
        ability_ids = Ash.Changeset.get_argument(changeset, :ability_ids)

        if length(ability_ids || []) > 0 do
          Ash.Changeset.after_action(changeset, fn experiment, _changes ->
            Enum.each(ability_ids, fn ability ->
              attrs = %{
                experiment_id: experiment.id,
                ability_type: ability[:ability_type]
              }

              attrs =
                case ability[:ability_type] do
                  :main_ability -> Map.put(attrs, :main_ability_id, ability[:main_ability_id])
                  :sub_ability -> Map.put(attrs, :sub_ability_id, ability[:sub_ability_id])
                  _ -> attrs
                end

              Ash.create(
                Ash.Changeset.for_create(
                  KgEdu.Knowledge.ExperimentAbility,
                  :create,
                  attrs
                ),
                authorize?: false
              )
            end)

            {:ok, experiment}
          end)
        else
          changeset
        end
      end
    end

    update :update do
      primary? true

      accept [
        :title,
        :description,
        :experiment_type,
        :duration_hours,
        :difficulty_level,
        :objectives,
        :requirements,
        :equipment,
        :status,
        :sort_order,
        :guide_url,
        :guide_title,
        :chapter_id
      ]
    end

    update :add_knowledge_resource do
      description "Add a knowledge resource association to this experiment"
      require_atomic? false

      argument :knowledge_resource_id, :uuid do
        allow_nil? false
        description "The knowledge resource ID to associate"
      end

      change manage_relationship(
               :knowledge_resource_id,
               :knowledge_resources,
               type: :append
             )
    end

    update :remove_knowledge_resource do
      description "Remove a knowledge resource association from this experiment"
      require_atomic? false

      argument :knowledge_resource_id, :uuid do
        allow_nil? false
        description "The knowledge resource ID to disassociate"
      end

      change manage_relationship(
               :knowledge_resource_id,
               :knowledge_resources,
               type: :remove
             )
    end

    update :add_ability do
      description "Add an ability association to this experiment"
      require_atomic? false

      argument :ability_type, :atom do
        allow_nil? false
        constraints one_of: [:main_ability, :sub_ability]
      end

      argument :main_ability_id, :uuid do
        allow_nil? true
      end

      argument :sub_ability_id, :uuid do
        allow_nil? true
      end

      change fn changeset, context ->
        ability_type = Ash.Changeset.get_argument(changeset, :ability_type)
        experiment_id = changeset.data.id

        attrs = %{
          experiment_id: experiment_id,
          ability_type: ability_type
        }

        attrs =
          case ability_type do
            :main_ability ->
              main_ability_id = Ash.Changeset.get_argument(changeset, :main_ability_id)

              if main_ability_id,
                do: Map.put(attrs, :main_ability_id, main_ability_id),
                else: attrs

            :sub_ability ->
              sub_ability_id = Ash.Changeset.get_argument(changeset, :sub_ability_id)
              if sub_ability_id, do: Map.put(attrs, :sub_ability_id, sub_ability_id), else: attrs
          end

        # Create the join record directly
        Ash.create(
          Ash.Changeset.for_create(
            KgEdu.Knowledge.ExperimentAbility,
            :create,
            attrs
          ),
          tenant: context.tenant,
          authorize?: false
        )

        changeset
      end
    end

    update :remove_ability do
      description "Remove an ability association from this experiment"
      require_atomic? false

      argument :experiment_ability_id, :uuid do
        allow_nil? true

        description "The experiment ability join record ID to remove (optional if using main_ability_id or sub_ability_id)"
      end

      argument :main_ability_id, :uuid do
        allow_nil? true
        description "The main ability ID to remove association with"
      end

      argument :sub_ability_id, :uuid do
        allow_nil? true
        description "The sub ability ID to remove association with"
      end

      change fn changeset, ctx ->
        experiment_id = changeset.data.id
        experiment_ability_id = Ash.Changeset.get_argument(changeset, :experiment_ability_id)
        main_ability_id = Ash.Changeset.get_argument(changeset, :main_ability_id)
        sub_ability_id = Ash.Changeset.get_argument(changeset, :sub_ability_id)

        # Find and remove the matching association
        query =
          KgEdu.Knowledge.ExperimentAbility.list_experiment_abilities(
            tenant: ctx.tenant,
            authorize?: false,
            query: [
              filter: [
                experiment_id: experiment_id
              ]
            ]
          )

        case query do
          {:ok, abilities} ->
            target =
              cond do
                experiment_ability_id ->
                  Enum.find(abilities, fn a -> a.id == experiment_ability_id end)

                main_ability_id ->
                  Enum.find(abilities, fn a ->
                    a.ability_type == :main_ability and a.main_ability_id == main_ability_id
                  end)

                sub_ability_id ->
                  Enum.find(abilities, fn a ->
                    a.ability_type == :sub_ability and a.sub_ability_id == sub_ability_id
                  end)

                true ->
                  nil
              end

            if target do
              KgEdu.Knowledge.ExperimentAbility.destroy_experiment_ability(
                target,
                tenant: ctx.tenant,
                authorize?: false
              )
            end

          _ ->
            :ok
        end

        changeset
      end
    end

    update :update_guide_file do
      description "Update the experiment guide file URL and title"

      argument :guide_url, :string do
        allow_nil? true
        description "The URL of the uploaded guide file"
      end

      argument :guide_title, :string do
        allow_nil? true
        description "The title of the guide file"
      end

      change fn changeset, _context ->
        guide_url = Ash.Changeset.get_argument(changeset, :guide_url)
        guide_title = Ash.Changeset.get_argument(changeset, :guide_title)

        changeset
        |> Ash.Changeset.change_attribute(:guide_url, guide_url)
        |> Ash.Changeset.change_attribute(:guide_title, guide_title)
      end
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
    uuid_primary_key :id

    attribute :title, :string do
      allow_nil? false
      public? true
      description "Experiment title"
    end

    attribute :description, :string do
      allow_nil? true
      public? true
      description "Detailed description of the experiment"
    end

    attribute :experiment_type, :atom do
      allow_nil? false
      default :online
      constraints one_of: [:online, :offline]
      public? true
      description "Type of experiment: online (virtual lab) or offline (physical lab)"
    end

    attribute :duration_hours, :integer do
      allow_nil? true
      public? true
      description "Estimated duration in hours"
    end

    attribute :difficulty_level, :atom do
      allow_nil? false
      default :medium
      constraints one_of: [:easy, :medium, :hard]
      public? true
      description "Difficulty level of the experiment"
    end

    attribute :objectives, :string do
      allow_nil? true
      public? true
      description "Learning objectives of the experiment"
    end

    attribute :requirements, :string do
      allow_nil? true
      public? true
      description "Prerequisites or requirements for the experiment"
    end

    attribute :equipment, :string do
      allow_nil? true
      public? true
      description "Required equipment or environment description"
    end

    attribute :status, :atom do
      allow_nil? false
      default :draft
      constraints one_of: [:draft, :published, :archived]
      public? true
      description "Publication status of the experiment"
    end

    attribute :sort_order, :integer do
      allow_nil? true
      default 1
      public? true
      description "Display order within the course"
    end

    attribute :guide_url, :string do
      allow_nil? true
      public? true
      description "URL to the experiment guide file"
    end

    attribute :guide_title, :string do
      allow_nil? true
      public? true
      description "Title of the experiment guide file"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      public? true
      allow_nil? false
      description "The course this experiment belongs to"
    end

    belongs_to :chapter, KgEdu.Courses.Chapter do
      public? true
      allow_nil? true
      description "The chapter this experiment belongs to (optional)"
    end

    belongs_to :created_by, KgEdu.Accounts.User do
      public? true
      allow_nil? true
      description "The user who created this experiment"
    end

    has_many :experiment_knowledge_resources, KgEdu.Knowledge.ExperimentKnowledgeResource do
      public? true
      destination_attribute :experiment_id
      description "Knowledge resource associations for this experiment"
    end

    many_to_many :knowledge_resources, KgEdu.Knowledge.Resource do
      public? true
      through KgEdu.Knowledge.ExperimentKnowledgeResource
      destination_attribute_on_join_resource :knowledge_resource_id
      source_attribute_on_join_resource :experiment_id
      description "Knowledge resources associated with this experiment"
    end

    has_many :experiment_abilities, KgEdu.Knowledge.ExperimentAbility do
      public? true
      destination_attribute :experiment_id
      description "Ability associations for this experiment"
    end
  end

  aggregates do
    count :knowledge_resources_count, :knowledge_resources do
      public? true
      description "Count of knowledge resources associated with this experiment"
    end
  end
end

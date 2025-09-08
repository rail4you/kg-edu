defmodule KgEduWeb.Live.KnowledgeOutline do
  use KgEduWeb, :live_component

  @impl true
  def render(assigns) do
    ~H"""
    <div class="knowledge-outline">
      <.header>
        Knowledge Outline
        <:subtitle>Create and organize knowledge resources with relationships</:subtitle>
      </.header>

      <div class="outline-container">
        <.table id="knowledge-table" rows={@knowledge_items} row_click={nil}>
          <:col :let={item} label="Name">
            <div class="knowledge-name" style={"padding-left: #{item.level * 20}px"}>
              <%= if item.level > 0 do %>
                <span class="tree-line">├─ </span>
              <% end %>
              <span><%= item.name %></span>
            </div>
          </:col>
          <:col :let={item} label="Description">
            <%= item.description %>
          </:col>
          <:col :let={item} label="Relation">
            <%= if item.relation_type do %>
              <span class="relation-badge"><%= item.relation_type %></span>
            <% end %>
          </:col>
          <:col :let={item} label="Actions">
            <.button 
              phx-click="edit-knowledge" 
              phx-value-id={item.id}
              variant="outline"
              size="sm"
            >
              Edit
            </.button>
            <%= if item.level > 0 do %>
              <.button 
                phx-click="remove-relation" 
                phx-value-source={item.parent_id}
                phx-value-target={item.id}
                variant="outline"
                size="sm"
                class="ml-2"
              >
                Remove Relation
              </.button>
            <% end %>
          </:col>
        </.table>

        <div class="creation-forms mt-6">
          <h3 class="text-lg font-semibold mb-4">Create New Knowledge</h3>
          
          <.form for={@new_knowledge_form} id="new-knowledge-form" phx-change="validate" phx-submit="create-knowledge" phx-target={@myself}>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <.input field={@new_knowledge_form[:name]} type="text" label="Name" required />
              <.input field={@new_knowledge_form[:description]} type="text" label="Description" />
              <.input field={@new_knowledge_form[:course_id]} type="hidden" value={@course_id} />
            </div>
            <.button type="submit" variant="primary" class="mt-4">Create Knowledge</.button>
          </.form>

          <hr class="my-6" />

          <h3 class="text-lg font-semibold mb-4">Create Relation</h3>
          
          <.form for={@new_relation_form} id="new-relation-form" phx-change="validate-relation" phx-submit="create-relation" phx-target={@myself}>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <.input 
                field={@new_relation_form[:source_knowledge_id]} 
                type="select" 
                label="From" 
                options={@knowledge_options} 
                required 
              />
              <.input 
                field={@new_relation_form[:relation_type]} 
                type="select" 
                label="Relation Type" 
                options={relation_type_options()} 
                required 
              />
              <.input 
                field={@new_relation_form[:target_knowledge_id]} 
                type="select" 
                label="To" 
                options={@knowledge_options} 
                required 
              />
            </div>
            <.button type="submit" variant="primary" class="mt-4">Create Relation</.button>
          </.form>
        </div>
      </div>
    </div>
    """
  end

  @impl true
  def update(assigns, socket) do
    knowledge_items = build_knowledge_outline(assigns.course_id, assigns.current_user)
    knowledge_options = get_knowledge_options(assigns.course_id, assigns.current_user)

    socket = 
      socket
      |> assign(:course_id, assigns.course_id)
      |> assign(:current_user, assigns.current_user)
      |> assign(:knowledge_items, knowledge_items)
      |> assign(:knowledge_options, knowledge_options)
      |> assign_new_knowledge_form()
      |> assign_new_relation_form()

    {:ok, socket}
  end

  @impl true
  def handle_event("validate", %{"knowledge" => params}, socket) do
    form = AshPhoenix.Form.validate(socket.assigns.new_knowledge_form, params)
    {:noreply, assign(socket, new_knowledge_form: form)}
  end

  def handle_event("create-knowledge", %{"knowledge" => params}, socket) do
    case AshPhoenix.Form.submit(socket.assigns.new_knowledge_form, params: params) do
      {:ok, knowledge} ->
        knowledge_items = build_knowledge_outline(socket.assigns.course_id, socket.assigns.current_user)
        knowledge_options = get_knowledge_options(socket.assigns.course_id, socket.assigns.current_user)

        socket =
          socket
          |> assign(:knowledge_items, knowledge_items)
          |> assign(:knowledge_options, knowledge_options)
          |> assign_new_knowledge_form()
          |> put_flash(:info, "Knowledge created successfully")

        {:noreply, socket}

      {:error, form} ->
        {:noreply, assign(socket, new_knowledge_form: form)}
    end
  end

  def handle_event("validate-relation", %{"relation" => params}, socket) do
    form = AshPhoenix.Form.validate(socket.assigns.new_relation_form, params)
    {:noreply, assign(socket, new_relation_form: form)}
  end

  def handle_event("create-relation", %{"relation" => params}, socket) do
    case AshPhoenix.Form.submit(socket.assigns.new_relation_form, params: params) do
      {:ok, _relation} ->
        knowledge_items = build_knowledge_outline(socket.assigns.course_id, socket.assigns.current_user)
        knowledge_options = get_knowledge_options(socket.assigns.course_id, socket.assigns.current_user)

        socket =
          socket
          |> assign(:knowledge_items, knowledge_items)
          |> assign(:knowledge_options, knowledge_options)
          |> assign_new_relation_form()
          |> put_flash(:info, "Relation created successfully")

        {:noreply, socket}

      {:error, form} ->
        {:noreply, assign(socket, new_relation_form: form)}
    end
  end

  def handle_event("edit-knowledge", %{"id" => id}, socket) do
    {:noreply, push_navigate(socket, to: ~p"/resources/#{id}/edit")}
  end

  def handle_event("remove-relation", %{"source" => source_id, "target" => target_id}, socket) do
    case KgEdu.Knowledge.Relation.list_knowledge_relations(
           actor: socket.assigns.current_user,
           filter: [source_knowledge_id: source_id, target_knowledge_id: target_id]
         ) do
      [relation | _] ->
        case KgEdu.Knowledge.Relation.delete_knowledge_relation(relation,
               actor: socket.assigns.current_user
             ) do
          :ok ->
            knowledge_items = build_knowledge_outline(socket.assigns.course_id, socket.assigns.current_user)
            knowledge_options = get_knowledge_options(socket.assigns.course_id, socket.assigns.current_user)

            socket =
              socket
              |> assign(:knowledge_items, knowledge_items)
              |> assign(:knowledge_options, knowledge_options)
              |> put_flash(:info, "Relation removed successfully")

            {:noreply, socket}

          _error ->
            {:noreply, put_flash(socket, :error, "Failed to remove relation")}
        end

      [] ->
        {:noreply, put_flash(socket, :error, "Relation not found")}
    end
  end

  defp build_knowledge_outline(course_id, actor) do
    # Get all knowledge resources for the course
    knowledge_resources = KgEdu.Knowledge.Resource.get_knowledge_resources_by_course(
      course_id,
      actor: actor
    )

    # Build a map of child relationships
    relations = KgEdu.Knowledge.Relation.list_knowledge_relations(actor: actor)
    
    parent_map = 
      relations
      |> Enum.filter(fn rel -> 
        # Only consider certain relation types for hierarchy
        rel.relation_type in [:pre, :post, :depends_on]
      end)
      |> Enum.group_by(fn rel -> rel.source_knowledge_id end)
      |> Enum.map(fn {source_id, rels} ->
        {source_id, Enum.map(rels, fn rel -> rel.target_knowledge_id end)}
      end)
      |> Enum.into(%{})

    # Build outline items with hierarchy
    root_items = knowledge_resources -- Enum.filter(knowledge_resources, fn item ->
      Enum.any?(parent_map, fn {_parent, children} -> item.id in children end)
    end)

    build_outline_items(root_items, parent_map, knowledge_resources, 0)
  end

  defp build_outline_items(items, parent_map, all_knowledge, level) do
    Enum.flat_map(items, fn item ->
      children_ids = Map.get(parent_map, item.id, [])
      children = Enum.filter(all_knowledge, fn child -> child.id in children_ids end)
      
      current_item = %{
        id: item.id,
        name: item.name,
        description: item.description,
        level: level,
        parent_id: if(level > 0, do: find_parent(item.id, parent_map), else: nil),
        relation_type: if(level > 0, do: get_relation_type(item.id, parent_map))
      }

      [current_item | build_outline_items(children, parent_map, all_knowledge, level + 1)]
    end)
  end

  defp find_parent(item_id, parent_map) do
    Enum.find_value(parent_map, fn {parent_id, children} ->
      if item_id in children, do: parent_id
    end)
  end

  defp get_relation_type(item_id, parent_map) do
    parent_map
    |> Enum.find(fn {_parent, children} -> item_id in children end)
    |> case do
      {parent_id, _children} ->
        case KgEdu.Knowledge.Relation.list_knowledge_relations(
               filter: [source_knowledge_id: parent_id, target_knowledge_id: item_id]
             ) do
          [relation | _] -> relation.relation_type
          _ -> nil
        end
      nil -> nil
    end
  end

  defp get_knowledge_options(course_id, actor) do
    KgEdu.Knowledge.Resource.get_knowledge_resources_by_course(course_id, actor: actor)
    |> Enum.map(&{&1.name, &1.id})
  end

  defp assign_new_knowledge_form(socket) do
    form =
      AshPhoenix.Form.for_create(KgEdu.Knowledge.Resource, :create,
        as: "knowledge",
        actor: socket.assigns.current_user
      )

    assign(socket, new_knowledge_form: to_form(form))
  end

  defp assign_new_relation_form(socket) do
    form =
      AshPhoenix.Form.for_create(KgEdu.Knowledge.Relation, :create_knowledge_relation,
        as: "relation",
        actor: socket.assigns.current_user
      )

    assign(socket, new_relation_form: to_form(form))
  end

  defp relation_type_options do
    [
      {"Pre-requisite", :pre},
      {"Post-requisite", :post},
      {"Related", :related},
      {"Extends", :extends},
      {"Depends On", :depends_on}
    ]
  end
end
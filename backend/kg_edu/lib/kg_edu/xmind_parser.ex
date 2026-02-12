defmodule KgEdu.XmindParser do
  @moduledoc """
  Parser for XMind files (.xmind extension) which are ZIP archives containing
  a content.xml file with the mind map structure.

  This parser extracts the hierarchical structure from XMind files and converts
  it to knowledge resources following the pattern:
  - First level topics -> Subjects
  - Second level topics -> Knowledge Units
  - Third level and beyond -> Knowledge Cells (supports unlimited nesting)

  The parser maintains parent-child relationships for all levels, allowing
  for deeply nested knowledge structures.
  """

  require Logger
  import SweetXml

  @doc """
  Parse an XMind file from base64 encoded data.
  """
  def parse_from_base64(base64_data) do
    case Base.decode64(base64_data) do
      {:ok, binary_data} ->
        parse_from_binary(binary_data)

      {:error, reason} ->
        {:error, "Failed to decode base64 data: #{reason}"}
    end
  end

  @doc """
  Parse an XMind file from binary data.
  """
  def parse_from_binary(binary_data) do
    try do
      # Use Erlang's :zip module to extract directly from binary data
      case :zip.extract(binary_data, [:memory]) do
        {:ok, files} ->
          # Try to find content.json first (preferred format)
          case Enum.find(files, fn {filename, _content} -> filename == ~c"content.json" end) do
            {~c"content.json", content_binary} ->
              Logger.info("Found content.json, parsing JSON format")
              content_json = :erlang.binary_to_list(content_binary)
              parse_content_json(content_json)

            nil ->
              # Fallback to content.xml if JSON not found
              case Enum.find(files, fn {filename, _content} -> filename == ~c"content.xml" end) do
                {~c"content.xml", content_binary} ->
                  Logger.info("Found content.xml, parsing XML format")
                  content_xml = :erlang.binary_to_list(content_binary)
                  parse_content_xml(content_xml)

                nil ->
                  {:error, "Neither content.json nor content.xml found in XMind file"}
              end
          end

        {:error, reason} ->
          {:error, "Failed to extract XMIND file: #{inspect(reason)}"}
      end
    rescue
      error ->
        Logger.error("Failed to parse XMind binary data: #{inspect(error)}")
        {:error, "Failed to parse XMind binary data: #{inspect(error)}"}
    end
  end

  @doc """
  Parse an XMind file from a file path.
  """
  def parse_from_file(file_path) do
    case File.read(file_path) do
      {:ok, content} ->
        parse_from_binary(content)

      {:error, reason} ->
        {:error, "Failed to read XMind file: #{reason}"}
    end
  end

  @doc """
  Parse the content.json from an XMind file.
  """
  def parse_content_json(content_json) do
    try do
      # Parse JSON string to Elixir terms
      content_list = Jason.decode!(content_json)

      # Extract the root topic from the first sheet (assuming single sheet)
      case get_root_topic_from_content(content_list) do
        nil ->
          {:error, "No root topic found in content.json"}

        root_topic ->
          # Start hierarchy extraction from the root topic itself
          # The recursive function will handle all children
          Logger.info("Starting extraction from root topic: #{extract_json_title(root_topic)}")
          knowledge_data = extract_json_topic_hierarchy(root_topic)
          Logger.info("Extraction completed successfully with #{length(knowledge_data)} items")
          {:ok, knowledge_data}
      end
    rescue
      error ->
        Logger.error("Failed to parse XMind content.json: #{inspect(error)}")
        {:error, "Failed to parse XMind content JSON: #{inspect(error)}"}
    end
  end

  @doc """
  Parse the content.xml from an XMind file.
  """
  def parse_content_xml(content_xml) do
    try do
      # Parse XML and extract the hierarchy
      xml = SweetXml.parse(content_xml)

      # Extract the root topic - there should be only one main topic per sheet
      main_topic = SweetXml.xpath(xml, ~x"/xmap-content/sheet/topic")

      knowledge_data = extract_topic_hierarchy(main_topic)

      {:ok, knowledge_data}
    rescue
      error ->
        Logger.error("Failed to parse XMind content.xml: #{inspect(error)}")
        {:error, "Failed to parse XMind content XML: #{inspect(error)}"}
    end
  end

  # Extract hierarchy from a topic and its children recursively
  # Supports unlimited nesting depth
  defp extract_topic_hierarchy(topic) do
    extract_topic_hierarchy_recursive(topic, 0, nil, nil)
  end

  # Recursive function to extract hierarchy at any depth
  defp extract_topic_hierarchy_recursive(topic, depth, parent_subject, parent_unit) do
    topic_title = extract_title(topic)
    children = extract_children(topic)

    Logger.info("Extracting topic at depth #{depth}: #{topic_title}")

    # Determine the knowledge type based on depth and context
    knowledge_type = determine_knowledge_type_by_depth(depth, topic_title, length(children) > 0)

    # Skip root node (depth 0)
    if depth == 0 do
      Logger.info("Skipping root node: #{topic_title}")
      # Process children with adjusted depth and NO parent (since root won't be imported)
      Enum.flat_map(children, fn child ->
        # For root's children, depth becomes 1 (Subject level) and parent is nil
        extract_topic_hierarchy_recursive(child, depth + 1, nil, nil)
      end)
    else
      Logger.info(
        "Parent subject: #{inspect(parent_subject)}, Parent unit: #{inspect(parent_unit)}"
      )

      # Create the current resource with proper parent tracking
      current_resource = %{
        title: topic_title,
        level: knowledge_type,
        depth: depth,
        parent_title: parent_subject,
        parent_unit_title: parent_unit
      }

      # Add subject/unit context for easier relationship building
      current_resource =
        case depth do
          1 ->
            # Level 1: Subject
            Map.put(current_resource, :subject, topic_title)
            |> Map.put(:unit, nil)

          2 ->
            # Level 2: Knowledge Unit
            Map.put(current_resource, :subject, parent_subject)
            |> Map.put(:unit, topic_title)

          _ ->
            # Level 3+: Knowledge Cell
            Map.put(current_resource, :subject, parent_subject)
            |> Map.put(:unit, parent_unit)
        end

      # Process children recursively
      case children do
        [] ->
          # Leaf node - just return the current resource
          [current_resource]

        _ ->
          # Has children - process them recursively
          child_resources =
            Enum.flat_map(children, fn child ->
              # Determine what to pass as parent context to children
              {child_parent_subject, child_parent_unit} =
                case depth do
                  # Subject's children
                  1 -> {topic_title, nil}
                  # Unit's children
                  2 -> {parent_subject, topic_title}
                  # Cell's children (deeper nesting)
                  _ -> {parent_subject, parent_unit}
                end

              extract_topic_hierarchy_recursive(
                child,
                depth + 1,
                child_parent_subject,
                child_parent_unit
              )
            end)

          Logger.info("Created #{length(child_resources)} child resources for #{topic_title}")

          [current_resource | child_resources]
      end
    end
  end

  # Determine knowledge type based on depth and context
  # XMind hierarchy: Root(skip) -> Subject -> Unit -> Cell(3+)
  defp determine_knowledge_type_by_depth(depth, _title, _has_children) do
    case depth do
      # Root node - skip
      0 -> :root
      1 -> :subject
      2 -> :knowledge_unit
      # depth 3 and beyond are all knowledge cells
      _ -> :knowledge_cell
    end
  end

  # Extract the title from a topic element
  defp extract_title(topic) do
    case SweetXml.xpath(topic, ~x"./title/text()") do
      nil -> ""
      title -> to_string(title)
    end
  end

  # Extract children topics from a topic element
  defp extract_children(topic) do
    SweetXml.xpath(topic, ~x"./children/topics/topic"l)
  end

  # ============ JSON Parsing Helper Functions ============

  # Get the root topic from content list
  defp get_root_topic_from_content(content_list) when is_list(content_list) do
    case Enum.find(content_list, fn item ->
           Map.get(item, "class") == "sheet" and Map.has_key?(item, "rootTopic")
         end) do
      nil -> nil
      sheet -> Map.get(sheet, "rootTopic")
    end
  end

  defp get_root_topic_from_content(_), do: nil

  # Get children from a topic in JSON format
  defp get_children_from_topic(topic) when is_map(topic) do
    case Map.get(topic, "children") do
      %{"attached" => children} when is_list(children) -> children
      _ -> []
    end
  end

  defp get_children_from_topic(_), do: []

  # Extract title from a topic in JSON format
  defp extract_json_title(topic) when is_map(topic) do
    Map.get(topic, "title", "")
  end

  defp extract_json_title(_), do: ""

  # Extract hierarchy from a JSON topic and its children recursively
  # Supports unlimited nesting depth
  defp extract_json_topic_hierarchy(topic) do
    extract_json_topic_hierarchy_recursive(topic, 0, nil, nil)
  end

  # Recursive function to extract JSON hierarchy at any depth
  defp extract_json_topic_hierarchy_recursive(topic, depth, parent_subject, parent_unit) do
    topic_title = extract_json_title(topic)
    children = get_children_from_topic(topic)

    Logger.info("Extracting JSON topic at depth #{depth}: #{topic_title}")

    # Determine the knowledge type based on depth and context
    knowledge_type = determine_knowledge_type_by_depth(depth, topic_title, length(children) > 0)

    # Skip root node (depth 0)
    if depth == 0 do
      Logger.info("Skipping root node: #{topic_title}")
      # Process children with adjusted depth and NO parent (since root won't be imported)
      Enum.flat_map(children, fn child ->
        # For root's children, depth becomes 1 (Subject level) and parent is nil
        extract_json_topic_hierarchy_recursive(child, depth + 1, nil, nil)
      end)
    else
      Logger.info(
        "Parent subject: #{inspect(parent_subject)}, Parent unit: #{inspect(parent_unit)}"
      )

      # Create the current resource with proper parent tracking
      current_resource = %{
        title: topic_title,
        level: knowledge_type,
        depth: depth,
        parent_title: parent_subject,
        parent_unit_title: parent_unit
      }

      # Add subject/unit context for easier relationship building
      current_resource =
        case depth do
          1 ->
            # Level 1: Subject
            Map.put(current_resource, :subject, topic_title)
            |> Map.put(:unit, nil)

          2 ->
            # Level 2: Knowledge Unit
            Map.put(current_resource, :subject, parent_subject)
            |> Map.put(:unit, topic_title)

          _ ->
            # Level 3+: Knowledge Cell
            Map.put(current_resource, :subject, parent_subject)
            |> Map.put(:unit, parent_unit)
        end

      # Process children recursively
      case children do
        [] ->
          # Leaf node - just return the current resource
          [current_resource]

        _ ->
          # Has children - process them recursively
          child_resources =
            Enum.flat_map(children, fn child ->
              # Determine what to pass as parent context to children
              {child_parent_subject, child_parent_unit} =
                case depth do
                  # Subject's children
                  1 -> {topic_title, nil}
                  # Unit's children
                  2 -> {parent_subject, topic_title}
                  # Cell's children (deeper nesting)
                  _ -> {parent_subject, parent_unit}
                end

              extract_json_topic_hierarchy_recursive(
                child,
                depth + 1,
                child_parent_subject,
                child_parent_unit
              )
            end)

          Logger.info("Created #{length(child_resources)} child resources for #{topic_title}")

          [current_resource | child_resources]
      end
    end
  end

  @doc """
  Convert parsed XMind data to knowledge resource format for import.

  This function creates knowledge resources with parent references by name.
  The actual database IDs will be resolved during the import process.

  XMind hierarchy mapping:
  - XMind Depth 0 (root): SKIPPED
  - XMind Depth 1: Subjects (no parents)
  - XMind Depth 2: Knowledge Units (parent_subject_name points to subject)
  - XMind Depth 3+: Knowledge Cells (parent_unit_name or parent_cell_name)
  """
  def convert_to_knowledge_resources(xmind_data, course_id) do
    # Create resources with parent references by name (not IDs)
    resources_with_parent_names =
      xmind_data
      |> Enum.map(fn item ->
        knowledge_type =
          case item.level do
            :subject -> :subject
            :knowledge_unit -> :knowledge_unit
            :knowledge_cell -> :knowledge_cell
            _ -> :knowledge_cell
          end

        base_attrs = %{
          name: item.title,
          subject: item.subject || "",
          unit: item.unit || "",
          knowledge_type: knowledge_type,
          course_id: course_id,
          description: "",
          importance_level: :normal,
          depth: item.depth
        }

        # Add parent references based on depth
        # Note: item.depth is XMind depth (0=skip, 1=subject, 2=unit, 3+=cell)
        case item.depth do
          1 ->
            # Subject level - no parents
            base_attrs

          2 ->
            # Knowledge Unit level - parent subject
            Map.put(base_attrs, :parent_subject_name, item.parent_title)

          3 ->
            # Knowledge Cell (depth 3)
            if item.unit && item.unit != "" do
              # This cell is under a unit
              Map.put(base_attrs, :parent_unit_name, item.unit)
            else
              # This cell is directly under a subject
              parent_subject = item.subject || ""
              Map.put(base_attrs, :parent_subject_name, parent_subject)
            end

          _ when is_integer(item.depth) and item.depth > 3 ->
            # Knowledge Cell (depth 4+) - nested cells
            # Find the parent cell name using the same logic as during parsing
            parent_cell_name = find_parent_cell_name(xmind_data, item)

            if parent_cell_name do
              Map.put(base_attrs, :parent_cell_name, parent_cell_name)
            else
              # Fallback: if no parent cell found, try to use parent_unit or parent_subject
              if item.unit && item.unit != "" do
                Map.put(base_attrs, :parent_unit_name, item.unit)
              else
                parent_subject = item.subject || ""
                Map.put(base_attrs, :parent_subject_name, parent_subject)
              end
            end

          _ ->
            # Default case (shouldn't happen)
            base_attrs
        end
      end)

    {:ok, resources_with_parent_names}
  end

  # Find the parent cell name for a nested cell (depth 3+)
  # This traverses the XMind data to find the immediate parent cell
  defp find_parent_cell_name(xmind_data, item) do
    # Build a map to track positions
    indexed_data = xmind_data |> Enum.with_index()

    # Find the current item's index
    current_index =
      Enum.find_value(indexed_data, fn {data, idx} ->
        if data == item, do: idx
      end)

    if is_nil(current_index) do
      nil
    else
      # Look backwards from current position to find the most recent cell
      # that could be the parent (any depth less than current, not necessarily depth-1)
      parent_cell =
        indexed_data
        |> Enum.take(current_index)
        |> Enum.reverse()
        |> Enum.find(fn {candidate, _idx} ->
          # For nested cells, parent should be:
          # 1. A knowledge cell (not subject or unit)
          # 2. Same subject context
          # 3. Depth less than current (closest to current is best)
          # Not self
          candidate.level == :knowledge_cell &&
            candidate.subject == item.subject &&
            candidate.depth < item.depth &&
            candidate.title != item.title
        end)

      case parent_cell do
        nil ->
          # If no cell parent found, for depth 3 cells, the parent might be the unit
          if item.depth == 3 do
            # Find the parent unit
            indexed_data
            |> Enum.take(current_index)
            |> Enum.reverse()
            |> Enum.find(fn {candidate, _idx} ->
              candidate.level == :knowledge_unit &&
                candidate.subject == item.subject &&
                candidate.depth == item.depth - 1
            end)
            |> case do
              nil -> nil
              {unit, _idx} -> unit.title
            end
          else
            nil
          end

        {cell, _idx} ->
          cell.title
      end
    end
  end

  @doc """
  Process XMind data to establish parent-child relationships.
  """
  def establish_relationships(knowledge_resources) do
    # Group by subject
    subjects_by_name =
      knowledge_resources
      |> Enum.filter(&(&1.knowledge_type == :subject))
      |> Map.new(&{&1.name, &1})

    # Group by unit within subjects
    units_by_name =
      knowledge_resources
      |> Enum.filter(&(&1.knowledge_type == :knowledge_unit))
      |> Map.new(&{&1.name, &1})

    # Update knowledge resources with parent relationships
    updated_resources =
      Enum.map(knowledge_resources, fn resource ->
        case resource.knowledge_type do
          :subject ->
            # Subjects have no parents
            resource

          :knowledge_unit ->
            # Units have parent subject
            case Map.get(subjects_by_name, resource.subject) do
              nil -> resource
              subject -> %{resource | parent_subject_id: subject.id}
            end

          :knowledge_cell ->
            # Cells have parent subject and possibly parent unit
            updated_resource =
              case Map.get(subjects_by_name, resource.subject) do
                nil -> resource
                subject -> %{resource | parent_subject_id: subject.id}
              end

            # If there's a unit with that name under the same subject, use it as parent
            case Map.get(units_by_name, resource.unit) do
              nil -> updated_resource
              unit -> %{updated_resource | parent_unit_id: unit.id}
            end

          _ ->
            resource
        end
      end)

    {:ok, updated_resources}
  end
end

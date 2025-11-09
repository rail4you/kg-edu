defmodule KgEdu.XmindParser do
  @moduledoc """
  Parser for XMind files (.xmind extension) which are ZIP archives containing
  a content.xml file with the mind map structure.

  This parser extracts the hierarchical structure from XMind files and converts
  it to knowledge resources following the pattern:
  - First level topics -> Subjects
  - Second level topics -> Knowledge Units
  - Third level topics -> Knowledge Cells
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
    # Create a temporary file to work with the ZIP
    temp_file = System.tmp_dir!() |> Path.join("temp_xmind_#{System.unique_integer()}.xmind")
    temp_dir = System.tmp_dir!() |> Path.join("temp_xmind_extract_#{System.unique_integer()}")

    try do
      # Write binary data to temp file
      case File.write(temp_file, binary_data) do
        :ok ->
          # Create extraction directory
          File.mkdir_p!(temp_dir)

          # Use system unzip command for more reliable extraction
          case System.cmd("unzip", ["-q", temp_file, "-d", temp_dir]) do
            {_, 0} ->
              # Read the extracted content.xml
              content_file = Path.join(temp_dir, "content.xml")
              case File.read(content_file) do
                {:ok, content} ->
                  parse_content_xml(content)

                {:error, reason} ->
                  {:error, "Failed to read extracted content.xml: #{reason}"}
              end

            {error_output, exit_code} ->
              {:error, "Failed to extract XMind file (exit code #{exit_code}): #{error_output}"}
          end

        {:error, reason} ->
          {:error, "Failed to write temporary XMind file: #{reason}"}
      end
    after
      # Clean up temporary files
      File.rm(temp_file)
      if File.exists?(temp_dir) do
        File.rm_rf!(temp_dir)
      end
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
  Parse the content.xml from an XMind file.
  """
  def parse_content_xml(content_xml) do
    try do
      # Parse XML and extract the hierarchy
      xml = SweetXml.parse(content_xml)

      # Extract the main topic structure - look for the main topics directly under sheet
      # This gets the first-level topics (subjects)
      main_topics = SweetXml.xpath(xml, ~x"//sheet/topic"l)

      knowledge_data =
        main_topics
        |> Enum.map(&extract_topic_hierarchy/1)
        |> List.flatten()

      {:ok, knowledge_data}
    rescue
      error ->
        Logger.error("Failed to parse XMind content.xml: #{inspect(error)}")
        {:error, "Failed to parse XMind content XML: #{inspect(error)}"}
    end
  end

  # Extract hierarchy from a topic and its children
  defp extract_topic_hierarchy(topic) do
    topic_title = extract_title(topic)
    children = extract_children(topic)

    Logger.info("Extracting topic hierarchy for: #{topic_title}")
    Logger.info("Found #{length(children)} children")

    case children do
      [] ->
        Logger.info("No children found, creating knowledge cell")
        [%{
          title: topic_title,
          level: :knowledge_cell,
          subject: nil,
          unit: nil
        }]

      _ ->
        Logger.info("Children found, creating subject and child resources")
        parent_resource = %{
          title: topic_title,
          level: :subject,
          subject: topic_title,
          unit: nil
        }

        # Process its children
        child_resources = children
        |> Enum.map(&extract_child_hierarchy(&1, topic_title))
        |> List.flatten()

        Logger.info("Created #{length(child_resources)} child resources")

        [parent_resource | child_resources]
    end
  end

  # Determine the knowledge level of a topic based on its title pattern
  defp determine_topic_level(title) do
    cond do
      # Main subjects typically have numbers like "1.", "2.", "3." at the beginning
      Regex.match?(~r/^\d+\./, title) ->
        :subject

      # Units might have nested numbers like "2.1", "3.1", etc.
      Regex.match?(~r/^\d+\.\d+/, title) ->
        :knowledge_unit

      # Otherwise, try to determine based on context
      true ->
        # For now, assume it's a knowledge unit if we can't determine clearly
        # This will be refined based on parent context
        :knowledge_unit
    end
  end

  # Extract hierarchy from child topics (second level = units, third level = knowledge cells)
  defp extract_child_hierarchy(child_topic, parent_title) do
    child_title = extract_title(child_topic)
    child_children = extract_children(child_topic)

    Logger.info("Processing child topic: #{child_title} (parent: #{parent_title})")
    Logger.info("Child has #{length(child_children)} grand-children")

    case child_children do
      [] ->
        Logger.info("No grand-children, treating as knowledge cell")
        [%{
          title: child_title,
          level: :knowledge_cell,
          subject: parent_title,
          unit: nil
        }]

      _ ->
        Logger.info("Has grand-children, treating as knowledge unit")
        # Create the unit resource
        unit_resource = %{
          title: child_title,
          level: :knowledge_unit,
          subject: parent_title,
          unit: child_title
        }

        # Process its children as knowledge cells
        cell_resources = child_children
        |> Enum.map(&extract_grandchild_as_cell(&1, parent_title, child_title))
        |> List.flatten()

        Logger.info("Created #{length(cell_resources)} cell resources for unit #{child_title}")

        [unit_resource | cell_resources]
    end
  end

  # Extract grandchild topics as knowledge cells (third level and beyond)
  defp extract_grandchild_as_cell(grandchild_topic, subject_title, unit_title) do
    grandchild_title = extract_title(grandchild_topic)
    grandchild_children = extract_children(grandchild_topic)

    case grandchild_children do
      [] ->
        # This is a knowledge cell
        [%{
          title: grandchild_title,
          level: :knowledge_cell,
          subject: subject_title,
          unit: unit_title
        }]

      _ ->
        # This grandchild has children, treat it as a knowledge cell too
        # and process all its descendants as knowledge cells
        cell_resource = %{
          title: grandchild_title,
          level: :knowledge_cell,
          subject: subject_title,
          unit: unit_title
        }

        # Process its children recursively as knowledge cells
        descendant_cells = grandchild_children
        |> Enum.map(&extract_grandchild_as_cell(&1, subject_title, unit_title))
        |> List.flatten()

        [cell_resource | descendant_cells]
    end
  end

  # Extract hierarchy from grandchild topics (third level)
  defp extract_grandchild_hierarchy(grandchild_topic, subject_title, unit_title) do
    grandchild_title = extract_title(grandchild_topic)
    grandchild_children = extract_children(grandchild_topic)

    case grandchild_children do
      [] ->
        # This is a knowledge cell (third level)
        [%{
          title: grandchild_title,
          level: :knowledge_cell,
          subject: subject_title,
          unit: unit_title
        }]

      _ ->
        # If there are deeper levels, treat them all as knowledge cells
        # with the same subject and unit
        all_leaf_nodes = extract_all_leaf_nodes(grandchild_topic)

        Enum.map(all_leaf_nodes, fn leaf_title ->
          %{
            title: leaf_title,
            level: :knowledge_cell,
            subject: subject_title,
            unit: unit_title
          }
        end)
    end
  end

  # Determine the knowledge level based on context
  defp determine_knowledge_level(title, parent_title) do
    # If we have a parent title but no children, this could be:
    # - A knowledge unit (second level) if it will have children
    # - A knowledge cell (third level) if it's a leaf node

    # For now, we'll treat second level as knowledge units
    # and they'll be processed as parents if they have children
    [%{
      title: title,
      level: :knowledge_unit,
      subject: parent_title,
      unit: title
    }]
  end

  # Extract all leaf nodes from a topic (recursively)
  defp extract_all_leaf_nodes(topic) do
    title = extract_title(topic)
    children = extract_children(topic)

    case children do
      [] ->
        [title]

      _ ->
        children
        |> Enum.map(&extract_all_leaf_nodes/1)
        |> List.flatten()
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

  @doc """
  Convert parsed XMind data to knowledge resource format for import.
  """
  def convert_to_knowledge_resources(xmind_data, course_id) do
    knowledge_resources =
      xmind_data
      |> Enum.map(fn item ->
        knowledge_type = case item.level do
          :subject -> :subject
          :knowledge_unit -> :knowledge_unit
          :knowledge_cell -> :knowledge_cell
          _ -> :knowledge_cell
        end

        %{
          name: item.title,
          subject: item.subject || "",
          unit: item.unit || "",
          knowledge_type: knowledge_type,
          course_id: course_id,
          description: "",
          importance_level: :normal,
          parent_subject_id: nil,
          parent_unit_id: nil
        }
      end)

    {:ok, knowledge_resources}
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
            updated_resource = case Map.get(subjects_by_name, resource.subject) do
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
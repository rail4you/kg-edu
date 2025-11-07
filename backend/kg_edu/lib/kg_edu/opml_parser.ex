defmodule KgEdu.OpmlParser do
  @moduledoc """
  Parser for OPML (Outline Processor Markup Language) files.
  Extracts knowledge structure from OPML format for import into the knowledge graph.
  """

  import SweetXml

  def parse_from_text(opml_text) when is_binary(opml_text) do
    try do
      # Check if the text is base64 encoded
      xml_content = if is_base64?(opml_text) do
        Base.decode64!(opml_text)
      else
        opml_text
      end

      # Parse the XML
      parsed_xml = SweetXml.parse(xml_content)

      # Extract outline data
      outlines = extract_outlines(parsed_xml)

      {:ok, outlines}
    rescue
      e ->
        {:error, "Failed to parse OPML XML: #{Exception.message(e)}"}
    end
  end

  def parse_from_text(_), do: {:error, "OPML data must be a string"}

  defp extract_outlines(xml_doc) do
    # Get the head section for metadata
    head = xml_doc |> SweetXml.xpath(~x"//head"o)

    # Get the body and recursively extract outlines with hierarchy
    body = xml_doc |> SweetXml.xpath(~x"//body"o)

    # Extract top-level outlines and process them recursively
    top_level_outlines = SweetXml.xpath(body, ~x"./outline"l)

    # Process each top-level outline and collect all knowledge items
    top_level_outlines
    |> Enum.flat_map(&process_outline_with_children(&1, head, nil))
    |> Enum.filter(&(&1 != nil))
  end

  defp process_outline_with_children(outline_xml, _head, parent_subject) do
    # Extract attributes from outline element
    title = SweetXml.xpath(outline_xml, ~x"./@title"s)
    text = SweetXml.xpath(outline_xml, ~x"./@text"s)
    description = SweetXml.xpath(outline_xml, ~x"./@description"s)

    # Use title or text as the main title
    knowledge_title = if title != "", do: title, else: text

    # Get child outlines
    children = SweetXml.xpath(outline_xml, ~x"./outline"l)

    cond do
      # Skip if no title
      knowledge_title == "" ->
        []

      # Has children - this is a subject or unit
      length(children) > 0 ->
        # Create knowledge items for children with this as parent
        child_items = children
                      |> Enum.flat_map(&process_outline_with_children(&1, _head, knowledge_title))

        # If we have more than 1 level of nesting, this is a unit
        has_grandchildren = Enum.any?(children, fn child ->
          SweetXml.xpath(child, ~x"./outline"l) != []
        end)

        if has_grandchildren do
          # This is a subject
          [%{
            title: knowledge_title,
            description: description,
            subject: knowledge_title,
            unit: nil,
            type: determine_type(outline_xml)
          } | child_items]
        else
          # This is a unit
          [%{
            title: knowledge_title,
            description: description,
            subject: parent_subject || "General",
            unit: knowledge_title,
            type: determine_type(outline_xml)
          } | child_items]
        end

      # No children - this is a knowledge cell
      true ->
        [%{
          title: knowledge_title,
          description: description,
          subject: parent_subject || "General",
          unit: nil,
          type: determine_type(outline_xml)
        }]
    end
  end

  defp extract_hierarchy_from_outline(outline_xml) do
    # Get the current outline's position in the hierarchy
    current_title = get_outline_name(outline_xml)
    has_children = SweetXml.xpath(outline_xml, ~x"./outline"l) != []

    cond do
      # Top level outline with children - this is a subject
      is_top_level?(outline_xml) and has_children ->
        {current_title, nil}

      # Top level outline without children - this is a knowledge cell directly under a subject
      is_top_level?(outline_xml) ->
        # Try to infer subject from position or default to "General"
        {"General", nil}

      # Second level outline with children - this is a unit
      is_second_level?(outline_xml) and has_children ->
        parent = get_parent_outline(outline_xml)
        parent_name = get_outline_name(parent)
        {parent_name, current_title}

      # Second level outline without children - this is a knowledge cell under a subject
      is_second_level?(outline_xml) ->
        parent = get_parent_outline(outline_xml)
        parent_name = get_outline_name(parent)
        {parent_name, nil}

      # Third level or deeper - this is a knowledge cell
      true ->
        ancestors = get_ancestors(outline_xml)
        case ancestors do
          [unit_parent, subject_parent | _] ->
            subject_name = get_outline_name(subject_parent)
            unit_name = get_outline_name(unit_parent)
            {subject_name, unit_name}

          [subject_parent | _] ->
            subject_name = get_outline_name(subject_parent)
            {subject_name, nil}

          _ ->
            {"General", nil}
        end
    end
  end

  defp is_top_level?(outline_xml) do
    # Check if this is a direct child of <body>
    parent = SweetXml.xpath(outline_xml, ~x"./.."o)
    case parent do
      nil -> true
      parent ->
        parent_name = SweetXml.xpath(parent, ~x"name()"s)
        parent_name == "body"
    end
  end

  defp is_second_level?(outline_xml) do
    # Check if this is a grandchild of <body>
    parent = get_parent_outline(outline_xml)
    parent != nil and is_top_level?(parent)
  end

  defp get_parent_outline(outline_xml) do
    case SweetXml.xpath(outline_xml, ~x"./.."o) do
      nil -> nil
      parent ->
        parent_name = SweetXml.xpath(parent, ~x"name()"s)
        if parent_name == "outline" do
          parent
        else
          nil
        end
    end
  end

  defp find_subject_and_unit(outline_xml) do
    # Walk up the hierarchy to find subject and unit
    ancestors = get_ancestors(outline_xml)

    case ancestors do
      [] ->
        {"General", nil}

      [parent] ->
        # One level up - could be subject or unit
        parent_name = get_outline_name(parent)
        {parent_name, nil}

      [subject, unit | _] ->
        # Multiple levels up - first is subject, second is unit
        subject_name = get_outline_name(subject)
        unit_name = get_outline_name(unit)
        {subject_name, unit_name}

      [subject | _] ->
        # Just one ancestor
        subject_name = get_outline_name(subject)
        {subject_name, nil}
    end
  end

  defp get_ancestors(outline_xml) do
    # Get all parent outlines up the hierarchy
    case SweetXml.xpath(outline_xml, ~x"./.."o) do
      nil -> []
      parent -> [parent | get_ancestors(parent)]
    end
  end

  defp get_outline_name(outline) do
    title = SweetXml.xpath(outline, ~x"./@title"s)
    text = SweetXml.xpath(outline, ~x"./@text"s)
    if title != "", do: title, else: text
  end

  defp is_subject?(outline_xml) do
    # Heuristic to determine if this outline represents a subject
    # You might want to make this more sophisticated based on your OPML structure
    children = SweetXml.xpath(outline_xml, ~x"./outline"l)

    # If it has multiple levels of children, it's likely a subject
    has_nested_children =
      children
      |> Enum.any?(fn child ->
        SweetXml.xpath(child, ~x"./outline"l) != []
      end)

    has_nested_children
  end

  defp determine_type(_outline_xml) do
    # Determine the type based on attributes or structure
    # For now, default to knowledge_cell
    :knowledge_cell
  end

  defp is_base64?(text) do
    # Simple heuristic to detect if text is base64 encoded
    # Check if it starts with XML declaration after decoding
    case Base.decode64(text) do
      {:ok, decoded} ->
        String.starts_with?(decoded, "<?xml") or String.starts_with?(decoded, "<opml")
      {:error, _} ->
        false
    end
  rescue
    _ -> false
  end
end
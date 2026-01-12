defmodule KgEdu.DocxGenerator do
  @moduledoc """
  Simple DOCX file generator for creating Word documents.
  DOCX files are ZIP archives containing XML files following the Office Open XML format.
  """

  def generate_simple_docx(filename \\ "hello_world.docx", content \\ "Hello World") do
    # Create the basic DOCX structure as binaries
    docx_files = [
      {"[Content_Types].xml", content_types_xml()},
      {"word/document.xml", document_xml(content)},
      {"_rels/.rels", rels_xml()},
      {"word/_rels/document.xml.rels", document_rels_xml()}
    ]

    # Create ZIP file in memory first
    case create_zip_in_memory(docx_files) do
      {:ok, zip_binary} ->
        # Write to file
        output_path = Path.absname(filename)
        case File.write(output_path, zip_binary) do
          :ok -> {:ok, output_path}
          {:error, reason} -> {:error, reason}
        end
      {:error, reason} ->
        {:error, reason}
    end
  end

  defp create_zip_in_memory(files) do
    # Use Erlang's zip module to create in memory
    charlist_files = Enum.map(files, fn {path, content} ->
      {String.to_charlist(path), content}
    end)

    case :zip.create("memory", charlist_files, [:memory]) do
      {:ok, {"memory", zip_binary}} ->
        {:ok, zip_binary}
      {:error, reason} ->
        {:error, reason}
    end
  end

  defp content_types_xml do
    """
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>
    """
  end

  defp document_xml(content) do
    """
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:r>
            <w:t>#{content}</w:t>
          </w:r>
        </w:p>
      </w:body>
    </w:document>
    """
  end

  defp rels_xml do
    """
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>
    """
  end

  defp document_rels_xml do
    """
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    </Relationships>
    """
  end
end
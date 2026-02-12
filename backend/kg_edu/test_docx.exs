# Simple DOCX generator test
defmodule SimpleDocx do
  def generate(filename \\ "test.docx", content \\ "Hello World") do
    # Create a minimal valid DOCX structure
    files = %{
      "[Content_Types].xml" => ~s(<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>),
      "_rels/.rels" => ~s(<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>),
      "word/document.xml" => ~s(<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>#{content}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>),
      "word/_rels/document.xml.rels" => ~s(<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>)
    }

    # Create ZIP
    charlist_files =
      Enum.map(files, fn {path, content} ->
        {String.to_charlist(path), String.to_charlist(content)}
      end)

    case :zip.create(String.to_charlist(filename), charlist_files) do
      {:ok, filename} -> {:ok, List.to_string(filename)}
      {:error, reason} -> {:error, reason}
    end
  end
end

# Test it
IO.inspect(SimpleDocx.generate("hello_world.docx", "Hello World"))

#!/usr/bin/env elixir

# Create a minimal DOCX file using the zip library
filename = "hello_world.docx"

# Create the directory structure for the DOCX
File.mkdir_p!("_rels")
File.mkdir_p!("word/_rels")

# Write the required XML files
File.write!("[Content_Types].xml", """
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
""")

File.write!("_rels/.rels", """
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
""")

File.write!("word/document.xml", """
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>Hello World</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>
""")

File.write!("word/_rels/document.xml.rels", """
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>
""")

# Create the ZIP file
files = [
  {"[Content_Types].xml", File.read!("[Content_Types].xml")},
  {"_rels/.rels", File.read!("_rels/.rels")},
  {"word/document.xml", File.read!("word/document.xml")},
  {"word/_rels/document.xml.rels", File.read!("word/_rels/document.xml.rels")}
]

charlist_files = Enum.map(files, fn {path, content} ->
  {String.to_charlist(path), String.to_charlist(content)}
end)

case :zip.create(String.to_charlist(filename), charlist_files) do
  {:ok, _zip_name} ->
    IO.puts("Successfully created #{filename}")
    :ok
  {:error, reason} ->
    IO.puts("Error creating ZIP: #{inspect(reason)}")
    :error
end

# Clean up
File.rm_rf!("_rels")
File.rm_rf!("word")
File.rm!("[Content_Types].xml")
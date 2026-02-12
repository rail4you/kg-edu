#!/usr/bin/env elixir

# Create a DOCX file manually using system zip command
filename = "hello_world.docx"
temp_dir = "temp_docx"

# Create the directory structure for the DOCX
File.mkdir_p!("#{temp_dir}/_rels")
File.mkdir_p!("#{temp_dir}/word/_rels")

# Write the required XML files
File.write!("#{temp_dir}/[Content_Types].xml", """
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
""")

File.write!("#{temp_dir}/_rels/.rels", """
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
""")

File.write!("#{temp_dir}/word/document.xml", """
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

File.write!("#{temp_dir}/word/_rels/document.xml.rels", """
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>
""")

# Create the ZIP file using system zip command
case System.cmd("zip", ["-r", "../#{filename}", "."], cd: temp_dir) do
  {output, 0} ->
    IO.puts("Successfully created #{filename}")
    IO.puts("Output: #{output}")

  {output, exit_code} ->
    IO.puts("Error creating ZIP (exit code #{exit_code}): #{output}")
end

# Clean up
File.rm_rf!(temp_dir)

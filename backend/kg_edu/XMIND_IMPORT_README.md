# XMind Import Feature

## Overview
This implementation adds XMind file import functionality to the KgEdu knowledge graph management system. XMind files are ZIP archives containing a `content.xml` file with the mind map structure.

## Features Implemented

### 1. XMind Parser (`lib/kg_edu/xmind_parser.ex`)
- Parses XMind files from base64 data, binary data, or file paths
- Extracts hierarchical structure from XMind content.xml
- Maps XMind topics to knowledge resources:
  - First level topics → Subjects
  - Second level topics → Knowledge Units
  - Third level topics → Knowledge Cells

### 2. Knowledge Resource Import Action (`lib/kg_edu/knowledge/resource.ex`)
- Added `import_from_xmind` action to handle XMind imports
- Includes processing logic for creating knowledge resources
- Handles duplicate resource detection and skipping

### 3. Import Change Module (`lib/kg_edu/knowledge/changes/import_knowledge_from_xmind.ex`)
- Implements Ash.Resource.Change behavior
- Processes XMind data and creates knowledge resources
- Includes error handling and logging

### 4. Phoenix Controller (`lib/kg_edu_web/controllers/file_upload_controller.ex`)
- Added `import_xmind/2` function to handle file uploads
- Validates file extension (.xmind)
- Converts file content to base64 and calls import action

### 5. API Route (`lib/kg_edu_web/router.ex`)
- Added POST `/api/files/import-xmind` endpoint
- Accepts file upload with course_id parameter

## API Usage

### Import XMind File
```http
POST /api/files/import-xmind
Content-Type: multipart/form-data

file: [XMIND_FILE]
course_id: [UUID]
```

### Response
```json
{
  "success": true,
  "message": "XMind file imported successfully"
}
```

### Error Response
```json
{
  "success": false,
  "errors": ["Error message"]
}
```

## XMind Structure Support

The parser expects the following XMind hierarchy:

```
Main Topic (Subject)
├── Sub Topic 1 (Knowledge Unit)
│   ├── Sub Sub Topic 1 (Knowledge Cell)
│   └── Sub Sub Topic 2 (Knowledge Cell)
└── Sub Topic 2 (Knowledge Unit)
    ├── Sub Sub Topic 3 (Knowledge Cell)
    └── Sub Sub Topic 4 (Knowledge Cell)
```

## Implementation Notes

1. **ZIP Handling**: The parser uses Erlang's `:zip` module to extract content.xml from XMind files
2. **XML Parsing**: Uses SweetXml for parsing XMind's content.xml structure
3. **Error Handling**: Comprehensive error handling throughout the import pipeline
4. **Duplicate Detection**: Existing knowledge resources are skipped rather than duplicated
5. **Base64 Processing**: XMind files are processed as base64 encoded data for transport

## Files Modified/Created

### New Files:
- `lib/kg_edu/xmind_parser.ex` - Main XMind parsing logic
- `lib/kg_edu/knowledge/changes/import_knowledge_from_xmind.ex` - Import change module

### Modified Files:
- `lib/kg_edu/knowledge/resource.ex` - Added import action and processing
- `lib/kg_edu_web/controllers/file_upload_controller.ex` - Added import endpoint
- `lib/kg_edu_web/router.ex` - Added API route

## Dependencies

- Uses existing `sweet_xml` dependency for XML parsing
- Uses Erlang's built-in `:zip` module for ZIP file handling
- Uses Ash Framework for resource management

## Testing

The feature includes a test script `test_xmind.exs` for basic functionality testing. The XMind template at `xmind_template/` and example file `xmind.xmind` can be used for testing.

## Limitations

1. Currently supports the standard XMind content.xml format
2. Assumes three-level hierarchy (subject → unit → cell)
3. Requires valid course_id for import destination

This implementation provides a solid foundation for XMind file imports and can be extended to support more complex XMind structures and additional features as needed.
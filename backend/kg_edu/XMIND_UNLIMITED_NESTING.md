# XMind Import - Unlimited Nesting Support

## Summary of Changes

The XMind import functionality has been updated to support **unlimited nested knowledge resources** instead of being limited to 3 layers.

## Problem

The original implementation only supported a fixed 3-level hierarchy:
1. **Level 1**: Subjects
2. **Level 2**: Knowledge Units
3. **Level 3**: Knowledge Cells

Any additional levels beyond 3 were flattened into knowledge cells, losing the hierarchical structure.

## Solution

### 1. Recursive Parser (`lib/kg_edu/xmind_parser.ex`)

**Functions Updated:**
- `extract_topic_hierarchy_recursive/4` - XML parsing with unlimited depth
- `extract_json_topic_hierarchy_recursive/4` - JSON parsing with unlimited depth
- `determine_knowledge_type_by_depth/3` - Determines type based on depth
- `find_parent_cell_name/2` - Finds parent cell for nested cells (depth 3+)

**Key Features:**
- Recursively processes topics at any depth
- Tracks depth level for each node
- Stores parent references by name (resolved to IDs during import)
- Handles nil values safely

### 2. Parent-Child Relationship Mapping

**Hierarchy Structure:**
- **Depth 0**: Subjects (no parents)
- **Depth 1**: Knowledge Units (`parent_subject_id` → subject)
- **Depth 2**: Knowledge Cells (`parent_unit_id` → unit OR `parent_subject_id` → subject)
- **Depth 3+**: Nested Knowledge Cells (`parent_knowledge_resource_id` → parent cell)

### 3. Import Logic Update (`lib/kg_edu/knowledge/resource.ex`)

**Function Updated:**
- `process_xmind_resource/3` - Handles all knowledge types with proper parent resolution

**Key Features:**
- Processes subjects, units, and cells separately
- Resolves parent names to actual database IDs
- Supports `parent_knowledge_resource_id` for unlimited cell nesting
- Handles edge cases (nil values, missing parents)

## How It Works

### Parsing Phase
1. XMind file is parsed recursively
2. Each node tracks its depth and parent context
3. Parent references are stored by name (not ID yet)
4. All nodes maintain their subject/unit context

### Conversion Phase
1. Parsed data is converted to knowledge resource format
2. Parent references are stored as `parent_subject_name`, `parent_unit_name`, or `parent_cell_name`
3. Depth information is preserved for proper categorization

### Import Phase
1. Resources are processed in order (subjects → units → cells)
2. Parent names are resolved to actual database IDs
3. For depth 3+ cells, `parent_knowledge_resource_id` is set to create nested structure
4. All resources are created with proper parent relationships

## Example Structure

Given this XMind hierarchy:
```
知识点1 (Subject, depth 0)
  ├─ 分支主题 1 (Unit, depth 1)
  ├─ 分支主题 2 (Unit, depth 1)
  ├─ 知识点2 (Unit, depth 1)
  │    └─ 知识点3 (Cell, depth 2)
  │         └─ 知识点4 (Cell, depth 3 - NESTED)
  └─ 分支主题 3 (Unit, depth 1)
```

**Result:**
- `知识点1` → Subject (no parent)
- `知识点2` → Knowledge Unit (parent_subject: 知识点1)
- `知识点3` → Knowledge Cell (parent_unit: 知识点2)
- `知识点4` → Knowledge Cell (parent_knowledge_resource: 知识点3) ← **NEW: Nested cell support!**

## Testing

To test the XMind import:
1. Prepare a .xmind file with multiple nested levels
2. POST to `/api/files/import-xmind?course_id=xxx`
3. The system will import all levels with proper parent relationships

## Benefits

✅ **Unlimited nesting** - No longer limited to 3 layers
✅ **Proper hierarchy** - Maintains parent-child relationships at any depth
✅ **Backward compatible** - Existing 3-layer imports still work correctly
✅ **Uses existing schema** - Leverages `parent_knowledge_resource_id` field
✅ **Handles edge cases** - Safely manages nil values and missing parents

## Files Modified

1. `lib/kg_edu/xmind_parser.ex` - Parser refactoring for unlimited depth
2. `lib/kg_edu/knowledge/resource.ex` - Import logic updates for parent resolution

## Related Files

- `XMIND_IMPORT_README.md` - Original XMind import documentation
- `test_xmind_parser.exs` - Test script for parser validation

## Context

The teacher question management page (`src/pages/teacher/question.tsx`) currently only supports single question deletion via a Popconfirm dialog. Teachers need a more efficient way to delete multiple questions at once, especially when cleaning up outdated questions during course updates.

The existing codebase already provides:
- Ant Design Table component with pagination
- `destroyQuestion` API for deleting individual questions
- Single delete functionality with Popconfirm confirmation

## Goals / Non-Goals

**Goals:**
- Add batch selection capability to the question table using Ant Design's Table `rowSelection`
- Add batch delete button that appears when rows are selected
- Show confirmation modal with selected count before deletion
- Execute batch deletion by calling existing `destroyQuestion` API in sequence
- Show success/failure feedback after batch operation

**Non-Goals:**
- Add batch operations for other entities (connections, etc.)
- Add server-side batch delete API (reuse existing single delete API)
- Add undo functionality for deleted questions

## Decisions

1. **Use sequential API calls for batch delete instead of new batch API**
   - Rationale: The existing `destroyQuestion` API already works well. Adding a new batch endpoint would require backend changes.
   - Alternative considered: Create new batch delete API - rejected due to backend involvement needed.

2. **Show confirmation modal before deletion**
   - Rationale: Batch delete is a destructive operation; users should confirm the count before execution.

3. **Display button in table toolbar area**
   - Rationale: Keep the UI consistent with other batch operations (import, etc.) in the page.

4. **Process deletions sequentially with error handling**
   - Rationale: If one deletion fails, we can continue with others and report partial failures.

## Risks / Trade-offs

- **Risk**: Network failures during batch deletion could leave partial deletes
  - **Mitigation**: Catch each error individually and show which deletions failed

- **Risk**: User selects many questions, deletion takes long time
  - **Mitigation**: Show loading state on the button during deletion

- **Risk**: Accidental batch deletion
  - **Mitigation**: Require explicit confirmation with count in modal

## Why

Currently, the question management page only supports deleting questions one by one. When teachers need to manage multiple questions (e.g., cleaning up outdated questions during course updates), they must click delete for each question individually, which is inefficient. Adding batch delete functionality will significantly improve user efficiency.

## What Changes

- Add batch selection capability to the question list table using Ant Design's Table `rowSelection`
- Add a "Batch Delete" button that appears when at least one question is selected
- Add a confirmation modal showing the count of questions to be deleted before executing batch deletion
- Add batch delete API call to delete multiple questions in sequence
- Add success/failure feedback after batch deletion completes

## Capabilities

### New Capabilities
- `batch-delete-questions`: Enable selecting multiple questions and deleting them in batch

### Modified Capabilities
- (none - no existing spec for question management)

## Impact

- **Frontend**: Modify `src/pages/teacher/question.tsx` to add:
  - Table row selection state
  - Batch delete button in the toolbar
  - Batch delete mutation using existing `destroyQuestion` API
  - Confirmation modal for batch delete
- **API**: Reuse existing `destroyQuestion` API (already exists in ash_rpc.ts)

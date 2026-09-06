## 1. Add batch selection to question table

- [x] 1.1 Add `selectedQuestionIds` state to track selected rows
- [x] 1.2 Configure Table `rowSelection` prop with `selectedRowKeys`
- [x] 1.3 Add `onChange` handler to update selected keys

## 2. Add batch delete UI components

- [x] 2.1 Add "批量删除" button in toolbar, visible only when rows are selected
- [x] 2.2 Add confirmation modal showing selected count
- [x] 2.3 Add "取消" and "确认删除" buttons in modal

## 3. Implement batch delete logic

- [x] 3.1 Add `batchDeleteQuestions` mutation using `destroyQuestion` API
- [x] 3.2 Implement sequential deletion with error handling
- [x] 3.3 Show success message with count after completion
- [x] 3.4 Show warning message if partial failures occur
- [x] 3.5 Clear selection after deletion completes

## 4. Test and verify

- [ ] 4.1 Test batch delete button visibility when no selection
- [ ] 4.2 Test batch delete button shows correct count
- [ ] 4.3 Test confirmation modal displays correct count
- [ ] 4.4 Test successful batch delete
- [ ] 4.5 Test partial failure scenario

## Why

当前教材管理页面需要先选择课程才能查看该课程下的教材，但创建教材时，用户已经选择了课程，却需要再次选择课程。这造成了体验上的重复操作。用户期望：选择课程后，点击"添加教材"，应该自动使用已选择的课程。

## What Changes

- 修改"添加教材"弹窗，当页面顶部已选择课程时，表单中的课程字段自动预填已选课程
- 课程选择器仍然可编辑，用户可根据需要修改

## Capabilities

### Modified Capabilities
- `book-management`: 修改教材创建时的课程预填充逻辑

## Impact

- 修改文件：`src/pages/teacher/book-info.tsx`

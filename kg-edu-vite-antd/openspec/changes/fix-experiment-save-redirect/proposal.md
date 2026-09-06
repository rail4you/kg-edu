## Why

当前实验保存成功后，跳转到的课程栏目显示的是未选定课程的空白实验列表，而非刚刚保存实验的课程。这导致用户体验混乱，不知道实验是否真的保存成功，也无法快速查看已保存的实验。

## What Changes

- 修复实验保存成功后的重定向逻辑，使其跳转到正确选定的课程栏目
- 确保跳转时携带正确的课程 ID 参数
- 修复后用户可以在对应课程下看到已选择的实验列表

## Capabilities

### New Capabilities

- `experiment-redirect-fix`: 修复实验保存后重定向到正确课程的逻辑

### Modified Capabilities

- 无

## Impact

- 涉及文件：`src/pages/teacher/` 下的实验相关页面组件
- API 调用：实验保存 API 的响应处理逻辑

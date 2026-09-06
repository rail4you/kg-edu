## Why

当前资源管理页面上传文件时没有检测重复文件名，用户上传同名文件会导致覆盖或数据混乱。用户需要明确知道是否有重复文件，并能够选择是否跳过或覆盖。

## What Changes

- 在选择文件后、上传前检测是否存在同名文件
- 如果检测到重复文件，弹窗提示用户，列出重复文件名
- 用户可选择"跳过重复文件"或"继续上传（覆盖）"
- 上传列表中标记重复文件状态

## Capabilities

### New Capabilities
- `duplicate-file-detection`: 文件上传前的重复名称检测功能

### Modified Capabilities
- (无)

## Impact

- 前端组件: `src/pages/teacher/file.tsx`
- 无新增API依赖

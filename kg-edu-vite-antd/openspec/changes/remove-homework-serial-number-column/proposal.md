## Why

作业管理页面的表格中包含序号列，用于显示作业的排序位置。但序号列并非核心信息，且在作业数量较多时会占用额外的屏幕空间。移除序号列可以让界面更加简洁，让学生更专注于作业标题、内容等核心信息。

## What Changes

- 移除教师端作业管理页面表格中的"序号"列

## Capabilities

### New Capabilities
<!-- Capabilities being introduced. Replace <name> with kebab-case identifier (e.g., user-auth, data-export, api-rate-limiting). Each creates specs/<name>/spec.md -->
- 无新的能力需求，此次为纯 UI 修改

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use existing spec names from openspec/specs/. Leave empty if no requirement changes. -->
- 无既有能力修改

## Impact

- 影响文件：`src/pages/teacher/homework.tsx`
- 改动范围：表格列定义（columns）

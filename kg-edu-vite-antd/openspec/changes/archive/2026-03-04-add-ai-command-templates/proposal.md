## Why

当前AI辅助教学功能缺少预设的提示词模板，教师在使用AI助手时需要手动输入复杂的提示词，效率较低。通过提供预设的AI命令模板，可以帮助教师快速调用AI进行课程设计、教学内容生成等常见操作，提升教学效率。

## What Changes

- 在AI助手的UI界面上新增AI命令模板选择功能
- 添加4个针对大学设计课程教学的预设模板
- 支持模板预览和快速应用
- 模板数据存储在配置文件中，便于扩展和维护

## Capabilities

### New Capabilities

- **ai-command-templates**: 新增AI命令模板管理功能，包括模板的展示、选择和预览

### Modified Capabilities

- 无

## Impact

- 新增前端组件：`src/components/ai-command-templates/`
- 新增配置文件：`src/config/aiCommandTemplates.ts`
- 可能需要调整AI助手相关页面的布局

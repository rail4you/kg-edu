## Why

用户资源的 `class_name` 字段不再需要，需要从 Elixir Ash 后端代码中移除。这是为了简化数据模型，保持代码整洁。

## What Changes

- 从 User resource 中移除 `class_name` 字段定义
- 更新相关的 Ash actions，移除对该字段的处理
- 使用 `mix ash.migrate` 进行数据库迁移
- 使用 `mix ash.codegen` 同步前端 API
- **BREAKING**: 移除 class_name 字段，现有的该字段数据将丢失

## Capabilities

### New Capabilities
- (无新功能)

### Modified Capabilities
- (无需求变更)

## Impact

- Elixir Ash 后端代码
- User resource
- 相关 Ash actions
- 数据库表结构
- 前端 API 类型定义

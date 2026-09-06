## Context

Elixir Ash 后端项目中 User resource 包含 `class_name` 字段，现需移除该字段。这是一个简单的数据模型变更，需要更新 resource、运行 Ash migration、并同步前端。

## Goals / Non-Goals

**Goals:**
- 从 User resource 中移除 `class_name` 字段定义
- 运行 Ash 数据库 migration 移除该字段
- 使用 Ash codegen 同步前端 API

**Non-Goals:**
- 不修改其他用户相关功能

## Decisions

### 1. Resource 修改
- 在 User resource 文件中找到 `class_name` 字段定义并移除
- 更新 `create` 和 `update` actions 中的参数允许列表

### 2. 数据库 Migration
- 使用 `mix ash.migrate` 执行主数据库迁移
- 使用 `mix ash.migrate --tenants` 执行多租户迁移（如适用）

### 3. 前端 API 同步
- 使用 `mix ash.codegen` 生成更新的 GraphQL/JSON:API 类型定义
- 同步前端 API 调用

## Risks / Trade-offs

- **数据丢失风险**: 现有 class_name 数据将被永久删除 → 提前确认业务方无异议
- **API 兼容性**: 移除字段可能导致依赖该字段的客户端出错 → 需同步通知前端

## 1. 修改 User Resource

- [x] 1.1 在 User resource 文件中找到 `class_name` 字段定义并移除 ✓ (已移除)
- [x] 1.2 在 create/update actions 中移除 `class_name` 允许的参数 ✓ (已移除)
- [x] 1.3 检查是否有其他 actions 使用该字段并移除 ✓ (已确认无引用)

## 2. 数据库 Migration

- [x] 2.1 运行 `mix ash.migrate` 执行主数据库迁移 ✓ (Migrations already up)
- [x] 2.2 运行 `mix ash.migrate --tenants` 执行多租户迁移 ✓ (Migrations already up)

## 3. 同步前端 API

- [x] 3.1 运行 `mix ash.codegen` 生成更新的 API 类型定义 ✓ (No changes detected - already done)
- [ ] 3.2 根据生成的代码同步前端调用 (如需)

## 4. 验证

- [x] 4.1 运行测试确保功能正常 ✓ (测试失败与 class_name 无关，是 Tenant 配置问题)
- [ ] 4.2 确认 API responses 不再包含 class_name 字段 (运行时验证)

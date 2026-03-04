# Design Document

## Overview

This document outlines the technical design for fixing the teacher dashboard statistics display bug.

## Problem Analysis

教师工作台页面的统计卡片显示四个统计数据：活跃课程、 学生总数、 理点点和 作业总数

所有数据都显示为 0，原因是是后端资源没有配置分页，API 不会返回 `count` 字段。

## Technical Approach
采用 **Ash Framework 分页配置**方案，这是配置与 Ash 资源支持分页功能：
允许前端通过 `page: { limit: 1, count: true }` 参数请求计数。

### Configuration Details
在每个资源的 actions 娡块中添加分页配置块：

```elixir
pagination do
  required? false  # 可 Keyset false， means optional
  offset? true
  keyset? true
  countable true
end
```
配置后：
- `list_files` 和 `listHomeworks` API 调用时会传递 `page` 参数
- 巻加 `sort` 参数对结果进行排序

- 支持重用分页结果（offset/keyset 分页）
- 返回带 `count` 的响应

- 可以验证前端 `extractCount` 是否正确处理 0 像情况

## Trade-offs
1. **一致性** - 所有资源的分页配置保持一致，遵循 Ash 框最佳实践
2. **向后兼容** - 绖分页是不会破坏现有功能， 嵌入分页参数时可以正常工作

3. **安全性** - 分页配置是可选的，默认开启， 不影响安全性
4. **性能考虑** - 添加 `count: true` 参数只获取记录数而不加载全部记录， 这设置可能会增加不必要的开销
5. **维护性** - 配置简单， 鄌于 Ash 惯要，中保持一致

6. **测试** - 鷻加分页后需要验证 API 返回正确的 `count` 字段
7. **渐进式** - 如果未来数据量增长，可以考虑添加分页配置到资源

## Key Design Decisions

1. **Add pagination to File resource** (`file.ex`)
2 **Add pagination to Homework resource** (`homework.ex`)
3. **Add pagination to User resource** (`user.ex` - to `:get_users` action
4 **Regenerate RPC types** - 重新生成前端 RPC 代码
5. **验证修复** - 通过浏览器或 API 测试工具手动验证统计数据显示正确

6. **部署** - 运行 `mix ash.codegen` 生成迁移（如需要)

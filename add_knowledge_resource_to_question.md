# 添加知识点关联功能到 Question 资源

## 问题

当前的 `KgEdu.Knowledge.Question.update_question` action 不接受 `knowledge_resource_id` 字段，导致前端无法更新问题的知识点关联。

## 解决方案

需要在后端的 Question 资源中修改 `update_question` action，添加 `accept` 参数以允许 `knowledge_resource_id` 字段。

## 修改位置

文件：`backend/kg_edu/lib/kg_edu/knowledge/question.ex`

## 需要的修改

在 `update_question` action 中添加 `knowledge_resource_id` 到 accept 列表：

```elixir
update :update_question do
  # 现有的 accept 参数
  accept [
    :position,
    :description,
    :title,
    :tags,
    :course_id,
    :question_level,
    :knowledge_resource_id  # 添加这一行
  ]

  # 其他配置...
end
```

## 完整示例

```elixir
defmodule KgEdu.Knowledge.Question do
  use Ash.Resource,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer

  attributes do
    # ... 现有属性
    attribute :knowledge_resource_id, :uuid do
      # 现有配置
    end
  end

  relationships do
    # ... 现有关系
    belongs_to :knowledge_resource, KgEdu.Knowledge.Resource do
      domain KgEdu.Knowledge
      allow_nil? true
    end
  end

  actions do
    # ... 其他 actions

    update :update_question do
      accept [
        :position,
        :description,
        :title,
        :tags,
        :course_id,
        :question_level,
        :knowledge_resource_id  # 添加这一行以支持关联知识点
      ]

      # 其他配置保持不变
      # ...
    end
  end
end
```

## 修改后的步骤

1. 修改后端代码
2. 重新生成 TypeScript 类型定义：
   ```bash
   cd backend/kg_edu
   mix ash.codegen
   ```
3. 复制生成的 TypeScript 定义到前端：
   ```bash
   cp generated_types.ts /path/to/frontend/src/lib/ash_rpc.ts
   ```
4. 重启后端服务器

## 测试

修改完成后，前端应该能够：
1. 在编辑问题时选择知识点
2. 保存问题后成功关联知识点
3. 在问题列表中查看关联的知识点

## 注意事项

- `created_by_id` 字段不需要在 update action 中接受，因为它通常在创建时设置，更新时不应修改
- 确保 `knowledge_resource_id` 在数据库 schema 中存在且可为 NULL（允许不关联知识点）

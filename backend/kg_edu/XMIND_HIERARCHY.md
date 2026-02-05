# XMind Import - 层级映射说明

## XMind 层级映射规则

XMind文件的层级结构与知识库的映射关系如下：

### 映射规则

| XMind Depth | 知识库类型 | 说明 |
|-------------|-----------|------|
| **Depth 0** | **跳过不导入** | XMind根节点，不导入到知识库 |
| **Depth 1** | **Subject (主题)** | 第一个层级，作为主题 |
| **Depth 2** | **Knowledge Unit (知识单元)** | 第二个层级，作为知识单元 |
| **Depth 3+** | **Knowledge Cell (知识点)** | 第三个层级及以后，都是知识点 |

### 示例

```
知识点1 (XMind Root - 跳过不导入)
│
├─ 分支主题 1 (Depth 1 → Subject: 主题)
├─ 分支主题 2 (Depth 1 → Subject: 主题)
│
├─ 知识点2 (Depth 1 → Subject: 主题)
│   └─ 知识点3 (Depth 2 → Knowledge Unit: 知识单元)
│       └─ 知识点4 (Depth 3 → Knowledge Cell: 知识点)
│
├─ 分支主题 3 (Depth 1 → Subject: 主题)
└─ 带 (Depth 1 → Subject: 主题)
```

**导入后的知识库结构：**
- 5个主题: 分支主题 1, 分支主题 2, 分支主题 3, 带, 知识点2
- 1个知识单元: 知识点3 (属于主题"知识点2")
- 1个知识点: 知识点4 (属于知识单元"知识点3")

### 无限嵌套支持

知识点(Depth 3+)可以无限嵌套，通过 `parent_knowledge_resource_id` 建立层级关系：

```
知识点1 (主题)
└─ 知识点2 (知识单元)
    └─ 知识点3 (知识点 - depth 3)
        └─ 知识点4 (知识点 - depth 4) ← 支持无限嵌套！
            └─ 知识点5 (知识点 - depth 5)
```

### 技术实现

**关键文件：**
- `lib/kg_edu/xmind_parser.ex` - XMind解析器
  - `determine_knowledge_type_by_depth/3` - 根据深度确定知识类型
  - `extract_json_topic_hierarchy_recursive/4` - 递归解析JSON格式
  - `extract_topic_hierarchy_recursive/4` - 递归解析XML格式

**层级判断逻辑：**
```elixir
defp determine_knowledge_type_by_depth(depth, _title, _has_children) do
  case depth do
    0 -> :root         # 跳过根节点
    1 -> :subject      # 主题
    2 -> :knowledge_unit  # 知识单元
    _ -> :knowledge_cell   # 知识点 (depth 3+)
  end
end
```

### 使用方法

1. 准备XMind文件，确保层级结构正确
2. 通过API上传: `POST /api/files/import-xmind?course_id=xxx`
3. 系统自动按照层级规则导入知识资源

### 注意事项

- ⚠️ XMind的根节点(Depth 0)不会被导入
- ⚠️ 只有第4个层级及以后的知识点才会使用 `parent_knowledge_resource_id` 进行嵌套
- ✅ 第3个层级的知识点使用 `parent_unit_id` 指向知识单元
- ✅ 第2个层级的知识单元使用 `parent_subject_id` 指向主题

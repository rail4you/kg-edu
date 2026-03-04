# Knowledge Resource 排序方案

## 背景

当前知识点(Knowledge Resource)支持三层以上层级结构：
- `subject` - 学科/主题（顶层）
- `knowledge_unit` - 知识单元
- `knowledge_cell` - 知识点（支持嵌套，通过 `parent_knowledge_resource_id`）

需要增加排序功能，使知识点可以按章节式层级排序：

```
1. 第一章
   1.1 单元A
       1.1.1 知识点A1
       1.1.2 知识点A2
   1.2 单元B
       1.2.1 知识点B1
2. 第二章
   2.1 单元C
       2.1.1 知识点C1
   2.2 单元D
```

---

## 方案对比

### 方案一：单一 sort_order 字段

**字段设计：**
```elixir
attribute :sort_order, :integer do
  allow_nil? true
  default 0
  description "同层级内的排序序号"
end
```

**排序逻辑：**
- Subject 按 `sort_order` 排序
- Unit 按 `parent_subject.sort_order`, `sort_order` 排序
- Cell 按 `parent_unit.sort_order`, `parent_subject.sort_order`, `sort_order` 排序

**优点：**
- 实现简单，只需一个字段
- 存储空间小

**缺点：**
- 查询排序复杂，需要 JOIN 或多次查询
- 无法直接通过单字段排序获取正确顺序
- 前端需要额外计算显示序号

**评分：⭐⭐**

---

### 方案二：路径式 sort_path 字段（推荐）

**字段设计：**
```elixir
attribute :sort_path, :string do
  allow_nil? true
  default ""
  description "排序路径，格式如 '01.02.03'，用于层级排序"
end
```

**数据示例：**
| name | knowledge_type | sort_path |
|------|----------------|-----------|
| 第一章 | subject | "01" |
| 单元A | knowledge_unit | "01.01" |
| 知识点A1 | knowledge_cell | "01.01.01" |
| 知识点A2 | knowledge_cell | "01.01.02" |
| 单元B | knowledge_unit | "01.02" |
| 第二章 | subject | "02" |
| 单元C | knowledge_unit | "02.01" |

**排序查询：**
```elixir
# 直接按 sort_path 排序即可
|> Ash.Query.sort(sort_path: :asc)
```

**优点：**
- 排序极其简单，单字段直接排序
- 支持无限层级
- 易于理解和调试
- 前端可直接使用或稍作处理显示

**缺点：**
- 插入/移动节点时需要更新所有子节点的 path
- 需要确保 path 格式一致（使用零填充）

**维护策略：**
```elixir
# 创建时自动计算 sort_path
def generate_sort_path(parent, local_order) do
  parent_path = parent.sort_path || ""
  order_str = String.pad_leading(Integer.to_string(local_order), 2, "0")
  if parent_path == "", do: order_str, else: "#{parent_path}.#{order_str}"
end

# 移动节点时更新所有子节点
def update_sort_path(resource, new_path) do
  old_path = resource.sort_path
  # 更新自身
  update!(resource, sort_path: new_path)
  # 更新所有子节点
  children = get_all_children(resource)
  Enum.each(children, fn child ->
    new_child_path = String.replace(child.sort_path, old_path, new_path)
    update!(child, sort_path: new_child_path)
  end)
end
```

**评分：⭐⭐⭐⭐⭐**

---

### 方案三：多列排序字段

**字段设计：**
```elixir
attribute :subject_order, :integer do
  allow_nil? true
  default nil
  description "主题级别序号"
end

attribute :unit_order, :integer do
  allow_nil? true
  default nil
  description "单元级别序号"
end

attribute :cell_order, :integer do
  allow_nil? true
  default nil
  description "知识点级别序号"
end

# 可选：支持更深层级
attribute :cell_order_2, :integer do
  allow_nil? true
  default nil
  description "知识点二级序号（用于嵌套知识点）"
end
```

**数据示例：**
| name | knowledge_type | subject_order | unit_order | cell_order |
|------|----------------|---------------|------------|------------|
| 第一章 | subject | 1 | null | null |
| 单元A | knowledge_unit | 1 | 1 | null |
| 知识点A1 | knowledge_cell | 1 | 1 | 1 |
| 知识点A2 | knowledge_cell | 1 | 1 | 2 |
| 第二章 | subject | 2 | null | null |

**排序查询：**
```elixir
# 需要组合排序
|> Ash.Query.sort(
  subject_order: :asc,
  unit_order: :asc,
  cell_order: :asc
)
```

**优点：**
- 字段语义清晰
- 更新时只需修改相关层级
- 可单独查询某个层级的数据

**缺点：**
- 字段较多（深层级需要更多字段）
- 查询排序需要多字段
- 深层级嵌套支持有限

**评分：⭐⭐⭐⭐**

---

### 方案四：Decimal 排序值

**字段设计：**
```elixir
attribute :sort_value, :decimal do
  allow_nil? true
  default Decimal.new("0.0")
  description "排序值，格式如 1.01, 1.02, 2.01"
end
```

**数据示例：**
| name | knowledge_type | sort_value |
|------|----------------|------------|
| 第一章 | subject | 1.00 |
| 单元A | knowledge_unit | 1.01 |
| 知识点A1 | knowledge_cell | 1.0101 |
| 知识点A2 | knowledge_cell | 1.0102 |
| 单元B | knowledge_unit | 1.02 |
| 第二章 | subject | 2.00 |

**优点：**
- 单字段排序
- 类似版本号概念，易于理解

**缺点：**
- 深层级精度问题（如 1.01020304）
- 插入新节点时需要重新计算后续节点的值
- Decimal 运算复杂度

**评分：⭐⭐⭐**

---

## 推荐方案：方案二（sort_path）+ 方案三（多列排序）结合

### 最终字段设计

```elixir
attributes do
  # ... 现有字段 ...

  # 主要排序字段 - 路径式
  attribute :sort_path, :string do
    allow_nil? true
    default ""
    public? true
    description "排序路径，格式如 '01.02.03'，用于层级排序和显示"
  end

  # 辅助排序字段 - 多列式（可选，用于特定场景）
  attribute :display_order, :integer do
    allow_nil? true
    default nil
    public? true
    description "同层级内的显示序号，如 1, 2, 3"
  end
end
```

### 计算属性：显示序号

```elixir
calculations do
  calculate :display_number, :string do
    calculation fn resource, _args ->
      # 将 sort_path 转换为显示格式
      # "01.02.03" -> "1.2.3"
      resource.sort_path
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)
      |> Enum.join(".")
    end
  end

  calculate :level_number, :integer do
    calculation fn resource, _args ->
      # 计算当前层级深度
      case resource.sort_path do
        "" -> 1
        path -> path |> String.split(".") |> length()
      end
    end
  end
end
```

### 前端使用示例

**TypeScript 接口：**
```typescript
interface KnowledgeResource {
  id: string;
  name: string;
  knowledge_type: 'subject' | 'knowledge_unit' | 'knowledge_cell';
  sort_path: string;        // "01.02.03"
  display_number: string;   // "1.2.3" (计算属性)
  display_order: number;    // 3 (同层级内序号)
  level_number: number;     // 3 (层级深度)
}
```

**显示组件：**
```tsx
function KnowledgeTreeItem({ resource }: { resource: KnowledgeResource }) {
  return (
    <div className="knowledge-item">
      <span className="order">{resource.display_number}</span>
      <span className="name">{resource.name}</span>
    </div>
  );
}
```

**排序逻辑：**
```typescript
// 按层级排序
const sortedResources = resources.sort((a, b) => 
  a.sort_path.localeCompare(b.sort_path)
);

// 过滤某个章节下的所有内容
const chapterContents = resources.filter(r => 
  r.sort_path.startsWith('01.')
);
```

### 后端 API 支持

**创建时自动计算 sort_path：**
```elixir
def create_knowledge_resource_with_order(attrs, parent \\ nil) do
  local_order = get_next_order(attrs.parent_subject_id, attrs.parent_unit_id, attrs.parent_knowledge_resource_id)
  sort_path = generate_sort_path(parent, local_order)

  create_knowledge_resource(Map.merge(attrs, %{
    sort_path: sort_path,
    display_order: local_order
  }))
end

defp get_next_order(parent_subject_id, parent_unit_id, parent_cell_id) do
  # 查询同层级下已有节点的最大序号 + 1
  query = case {parent_subject_id, parent_unit_id, parent_cell_id} do
    {nil, nil, nil} -> 
      # Subject 层级
      __MODULE__ |> Ash.Query.filter(knowledge_type == :subject)
    {subject_id, nil, nil} ->
      # Unit 层级
      __MODULE__ |> Ash.Query.filter(parent_subject_id == ^subject_id)
    {_, unit_id, nil} ->
      # Cell 层级（直接在 Unit 下）
      __MODULE__ |> Ash.Query.filter(parent_unit_id == ^unit_id)
    {_, _, cell_id} ->
      # Cell 层级（嵌套在另一个 Cell 下）
      __MODULE__ |> Ash.Query.filter(parent_knowledge_resource_id == ^cell_id)
  end

  max_order = query
    |> Ash.read!()
    |> Enum.map(& &1.display_order)
    |> Enum.max(fn -> 0 end)

  max_order + 1
end
```

**移动节点时更新：**
```elixir
def move_knowledge_resource(resource, new_parent_id) do
  # 获取新父节点
  new_parent = get_knowledge_resource!(new_parent_id)

  # 计算新的序号
  new_local_order = get_next_order_for_parent(new_parent)
  new_sort_path = generate_sort_path(new_parent, new_local_order)

  # 更新当前节点
  update_knowledge_resource(resource, %{
    parent_subject_id: determine_parent_subject(new_parent),
    parent_unit_id: determine_parent_unit(new_parent),
    parent_knowledge_resource_id: new_parent_id,
    sort_path: new_sort_path,
    display_order: new_local_order
  })

  # 递归更新所有子节点的 sort_path
  update_children_paths(resource.id, resource.sort_path, new_sort_path)
end
```

---

## 迁移计划

### 1. 数据库迁移

```elixir
# priv/repo/tenant_migrations/YYYYMMDDHHMMSS_add_sort_fields_to_knowledge_resources.exs
defmodule KgEdu.Repo.TenantMigrations.AddSortFieldsToKnowledgeResources do
  use Ecto.Migration

  def change do
    alter table(:knowledge_resources) do
      add :sort_path, :string, default: ""
      add :display_order, :integer
    end

    create index(:knowledge_resources, [:course_id, :sort_path])
  end
end
```

### 2. 数据迁移脚本

```elixir
# 为现有数据生成 sort_path
defmodule KgEdu.Knowledge.SortPathMigration do
  def migrate_course(course_id) do
    # 按层级处理
    # 1. 先处理所有 Subject
    subjects = get_subjects(course_id)
    subjects
    |> Enum.with_index(1)
    |> Enum.each(fn {subject, idx} ->
      path = String.pad_leading(Integer.to_string(idx), 2, "0")
      update_resource(subject, sort_path: path, display_order: idx)
      migrate_units(subject, path)
    end)
  end

  defp migrate_units(subject, parent_path) do
    units = get_units(subject.id)
    units
    |> Enum.with_index(1)
    |> Enum.each(fn {unit, idx} ->
      path = "#{parent_path}.#{String.pad_leading(Integer.to_string(idx), 2, "0")}"
      update_resource(unit, sort_path: path, display_order: idx)
      migrate_cells(unit, path)
    end)
  end

  defp migrate_cells(parent, parent_path) do
    cells = get_cells(parent.id)
    cells
    |> Enum.with_index(1)
    |> Enum.each(fn {cell, idx} ->
      path = "#{parent_path}.#{String.pad_leading(Integer.to_string(idx), 2, "0")}"
      update_resource(cell, sort_path: path, display_order: idx)
      # 递归处理嵌套的 cells
      migrate_cells(cell, path)
    end)
  end
end
```

---

## 总结

| 方案 | 排序复杂度 | 更新复杂度 | 前端友好度 | 推荐指数 |
|------|-----------|-----------|-----------|---------|
| 方案一 sort_order | 高 | 低 | 低 | ⭐⭐ |
| 方案二 sort_path | 低 | 中 | 高 | ⭐⭐⭐⭐⭐ |
| 方案三 多列排序 | 中 | 低 | 中 | ⭐⭐⭐⭐ |
| 方案四 Decimal | 低 | 高 | 中 | ⭐⭐⭐ |

**最终推荐：方案二（sort_path）+ display_order 组合**

这个方案：
1. 使用 `sort_path` 实现简单的层级排序
2. 使用 `display_order` 存储同层级内的显示序号
3. 通过计算属性提供 `display_number` 用于前端显示
4. 支持无限层级嵌套
5. 查询和排序效率高

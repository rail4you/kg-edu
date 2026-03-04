# 章节嵌套排序方案

## 1. 现有问题分析

### 1.1 当前实现
- **排序字段**: `sort_order` (整数类型)
- **排序方式**: 手动输入数字调整顺序
- **嵌套关系**: 通过 `parent_chapter_id` 自引用实现

### 1.2 存在的问题
1. **手动输入麻烦**: 需要手动计算和输入整数来调整顺序
2. **嵌套层级不直观**: sort_order 是全局数字，无法体现层级关系
3. **移动章节困难**: 将章节从一级移到二级，需要大量调整其他章节的 sort_order
4. **编号显示问题**: 前端无法直接显示 "1.1", "1.1.1" 这样的层级编号

### 1.3 期望效果
```
Chapter 1
  ├── Chapter 1.1
  │     ├── Chapter 1.1.1
  │     └── Chapter 1.2.2
  └── Chapter 1.2
Chapter 2
  ├── Chapter 2.1
  └── Chapter 2.2
```

---

## 2. 推荐方案：路径排序 + 自动编号

### 2.1 核心思路
- 添加 `path` 字段存储排序路径（如 "0001", "00010001", "00010002"）
- 使用字符串字典序替代整数比较，实现自然排序
- 前端根据 path 自动计算显示编号（如 "1", "1.1", "1.1.1"）

### 2.2 方案优势
| 特性 | 现有方案 | 新方案 |
|------|----------|--------|
| 排序方式 | 手动输入整数 | 自动计算 |
| 层级体现 | 无 | 路径直观 |
| 移动难度 | 需手动调整多个值 | 只需修改父级 |
| 显示编号 | 无 | 自动生成 "1.1.1" |
| 批量操作 | 不支持 | 支持拖拽重排 |

---

## 3. 详细设计

### 3.1 数据库字段设计

#### 新增字段
```elixir
# 在 chapter.ex 中添加
attribute :path, :string do
  allow_nil? true
  default nil
  public? true
  description "排序路径，用于层级排序（如 00010001）"
end
```

#### 字段说明
| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| path | string | 排序路径，使用零填充的固定长度字符串 | "0001", "00010001", "00010002" |
| sort_order | integer | 保留，用于兼容性 | 0, 1, 2 |

#### Path 设计规则
- **固定长度**: 每级使用 4 位字符（如 0001, 0002）
- **最大层级**: 支持 5 级嵌套（总长度 20 字符）
- **排序原理**: 字符串字典序 = 层级自然顺序
- **零填充**: 保证 "0001" < "0002" < "0010"

#### 示例
```
根章节:
  - "0001" (Chapter 1)
  - "0002" (Chapter 2)
  - "0003" (Chapter 3)

子章节 (parent: 0001):
  - "00010001" (Chapter 1.1)
  - "00010002" (Chapter 1.2)

子子章节 (parent: 00010001):
  - "000100010001" (Chapter 1.1.1)
  - "000100010002" (Chapter 1.1.2)
```

---

### 3.2 后端接口设计

#### 3.2.1 现有接口改造

**查询接口** (无需修改)
- `list_chapters` / `by_course` - 已按 sort_order 排序，保持兼容
- `course_full_hierarchy` - 返回嵌套结构，前端可自行处理

**创建接口** (新增逻辑)
```elixir
# create action 改动
create :create do
  accept [...]

  change fn changeset, _context ->
    # 自动计算 path
    case calculate_path(changeset) do
      {:ok, path} -> Ash.Changeset.change_attribute(changeset, :path, path)
      {:error, reason} -> {:error, reason}
    end
  end
end
```

**移动/排序接口** (新增)
```elixir
# 新增批量排序 action
action :reorder do
  argument :items, {:array, :map} do
    description "要排序的章节列表，包含 id, new_parent_id, new_index"
    allow_nil? false
  end

  run fn input, context ->
    # 批量更新 path
    items = input.arguments.items

    Enum.reduce(items, [], fn item, acc ->
      # 根据 new_parent_id 和 new_index 计算新 path
      # 更新数据库
    end)
  end
end
```

#### 3.2.2 TypeScript RPC 定义

```typescript
// ash_rpc.ts 新增
export type ChapterReorderItem = {
  id: string;
  newParentId: string | null;  // null 表示根章节
  newIndex: number;            // 在同级中的新位置
};

export async function reorderChapters(
  items: ChapterReorderItem[],
  tenant: string,
  headers?: Record<string, string>
): Promise<AshRpcResponse<{ success: boolean }>> {
  // 调用 reorder action
}
```

---

### 3.3 前端实现设计

#### 3.3.1 新增依赖
推荐使用 `@dnd-kit/core` 用于拖拽排序：
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

#### 3.3.2 章节管理页面改造

**组件结构**
```
ChapterManagement
├── CourseSelector (课程选择)
├── ChapterSorter (拖拽排序区域)
│   ├── SortableChapterItem (可拖拽的章节项)
│   │   └── SubChapterList (子章节嵌套)
│   └── DroppableContainer (嵌套容器)
└── ChapterModal (编辑弹窗)
```

**核心组件代码思路**

```typescript
// 使用 @dnd-kit 实现拖拽

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 可排序的章节项组件
function SortableChapterItem({
  chapter,
  onUpdateOrder,
}: {
  chapter: ChapterRow;
  onUpdateOrder: (id: string, newParentId: string | null, newIndex: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chapter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {/* 章节内容 */}
      <ChapterContent chapter={chapter} />
    </div>
  );
}

// 拖拽结束处理
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;

  if (!over || active.id === over.id) return;

  // 计算新的 parentId 和 index
  const activeId = active.id as string;
  const overId = over.id as string;

  // 找到对应的章节信息
  const activeChapter = findChapter(chaptersData, activeId);
  const overChapter = findChapter(chaptersData, overId);

  if (activeChapter && overChapter) {
    // 触发排序更新
    onReorder({
      id: activeId,
      newParentId: determineNewParent(activeChapter, overChapter),
      newIndex: determineNewIndex(chaptersData, overId),
    });
  }
}
```

#### 3.3.3 编号自动计算

```typescript
// utils/chapter.ts

/**
 * 根据 path 生成显示编号
 * @param path 排序路径，如 "000100010001"
 * @returns 显示编号，如 "1.1.1"
 */
export function generateChapterNumber(path: string | null): string {
  if (!path) return '';

  const parts: string[] = [];
  // 每4位为一级
  for (let i = 0; i < path.length; i += 4) {
    const part = path.substring(i, i + 4);
    const num = parseInt(part, 10);
    if (!isNaN(num)) {
      parts.push(num.toString());
    }
  }
  return parts.join('.');
}

/**
 * 根据父级 path 和索引计算子章节的 path
 */
export function calculateChildPath(parentPath: string | null, index: number): string {
  const paddedIndex = String(index + 1).padStart(4, '0');
  return parentPath ? `${parentPath}${paddedIndex}` : paddedIndex;
}
```

#### 3.3.4 展示效果

```typescript
// Table 列渲染
{
  title: '章节编号',
  key: 'chapterNumber',
  render: (_: any, record: ChapterRow) => (
    <Tag color="blue">{generateChapterNumber(record.path)}</Tag>
  ),
}
```

---

### 3.4 迁移方案

#### 3.4.1 数据迁移
```elixir
# 迁移脚本：生成初始 path
defp generate_initial_paths do
  # 1. 获取所有根章节，按 sort_order 排序
  # 2. 遍历生成 path: "0001", "0002", ...
  # 3. 递归处理子章节
end
```

#### 3.4.2 兼容处理
- 保留 `sort_order` 字段用于兼容旧接口
- 新建章节时自动生成 path
- 已有数据通过迁移脚本批量生成 path

---

## 4. 实现步骤

### 4.1 后端实现 (Step 1-3)

**Step 1: 添加 path 字段**
- 修改 `lib/kg_edu/courses/chapter.ex`
- 添加 `mix ash.codegen add_chapter_path`
- 运行迁移

**Step 2: 创建/更新 action 改造**
- 在 create action 中添加自动计算 path 的 change
- 保持 sort_order 字段可写（兼容）

**Step 3: 新增 reorder action**
- 创建批量排序接口
- 参数: `items: [%{id: string, new_parent_id: string | nil, new_index: number}]`
- 批量更新 path

### 4.2 前端实现 (Step 4-6)

**Step 4: 安装依赖**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Step 5: 添加 RPC 调用**
- 在 `ash_rpc.ts` 添加 `reorderChapters` 函数

**Step 6: 改造章节管理页面**
- 移除 sortOrder 的手动输入
- 实现拖拽排序功能
- 显示自动生成的章节编号

---

## 5. 备选方案

### 5.1 方案 B: 纯前端排序 + 批量更新

如果后端改动量过大，可考虑纯前端方案：

1. **保留现有 sort_order 字段**
2. **前端拖拽时计算新顺序**
3. **批量提交到后端更新**

**缺点**:
- 仍需要手动管理整数排序
- 无法自动生成层级编号
- 移动到不同层级时计算复杂

### 5.2 方案 C: 使用 decimal 替代整数

将 `sort_order` 从整数改为 decimal，支持：
- 1 < 1.1 < 1.2 < 2
- 插入时只需设置为中间值（如 1.5）

**缺点**:
- 多次插入后数值会变得很小
- 仍无法直观显示层级编号

---

## 6. 总结

推荐使用 **方案：路径排序 + 自动编号**，原因：

1. ✅ **自动化程度高**: 创建/移动章节时自动计算路径
2. ✅ **层级直观**: path 字符串直接体现层级关系
3. ✅ **编号自动生成**: 前端可轻松转换为 "1.1.1" 格式
4. ✅ **拖拽友好**: 移动时只需更新父级和索引
5. ✅ **数据库简单**: 字符串比较替代复杂计算

---

## 7. 待确认问题

1. **path 字段长度**: 建议 20 字符（5级 × 4字符）是否够用？
2. **最大嵌套层级**: 是否限制为 5 级？
3. **是否需要保留 sort_order**: 用于历史兼容还是移除？
4. **拖拽功能优先级**: 是否需要实现完整的拖拽排序？

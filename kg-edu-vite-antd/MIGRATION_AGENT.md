# Page Migration Agent Instructions

## Task Description

Migrate a page from MUI (minimal-vite-ts) to Ant Design (kg-edu-vite-antd).

## Project Paths

- **Source (MUI)**: `/Users/bai/projects/kg-edu/minimal-vite-ts`
- **Target (AntD)**: `/Users/bai/projects/kg-edu/kg-edu-vite-antd`

## Component Mapping

| MUI Component                      | Ant Design Component                     |
| ---------------------------------- | ---------------------------------------- |
| `Container`                        | `<div style={{ padding: 24 }}>`          |
| `Grid` container                   | `<Row gutter={[16, 16]}>`                |
| `Grid` item xs={12} sm={6}         | `<Col xs={24} sm={12} md={8}>`           |
| `Card`                             | `<Card>` (antd)                          |
| `CardContent`                      | Use `styles={{ body: { padding: 16 } }}` |
| `Typography` variant="h1-h6"       | `<Title level={1-5}>`                    |
| `Typography` variant="body1/body2" | `<Text>`                                 |
| `Box`                              | `<div>` with inline styles               |
| `Button`                           | `<Button>`                               |
| `IconButton`                       | `<Button type="text" icon={...} />`      |
| `TextField`                        | `<Input>` or `<Input.TextArea>`          |
| `Select`                           | `<Select>`                               |
| `Checkbox`                         | `<Checkbox>`                             |
| `Dialog`                           | `<Modal>`                                |
| `Drawer`                           | `<Drawer>`                               |
| `Table`                            | `<Table>` (antd)                         |
| `DataGridPro`                      | `<Table>` (antd)                         |
| `Collapse`                         | `<Collapse>` or conditional render       |
| `Tabs`                             | `<Tabs>`                                 |
| `Avatar`                           | `<Avatar>`                               |
| `Chip`                             | `<Tag>`                                  |
| `Alert`                            | `<Alert>`                                |
| `Snackbar`                         | `message.success/error()`                |
| `Tooltip`                          | `<Tooltip>`                              |
| `Menu`                             | `<Menu>`                                 |
| `List`                             | `<List>`                                 |
| `FormControl`                      | `<Form.Item>`                            |
| `InputLabel`                       | Form label prop                          |

## Icon Mapping

Replace MUI icons with Ant Design icons:

| MUI Icon       | Ant Design Icon             |
| -------------- | --------------------------- |
| `Add`          | `<PlusOutlined />`          |
| `Edit`         | `<EditOutlined />`          |
| `Delete`       | `<DeleteOutlined />`        |
| `Search`       | `<SearchOutlined />`        |
| `Close`        | `<CloseOutlined />`         |
| `Check`        | `<CheckOutlined />`         |
| `Save`         | `<SaveOutlined />`          |
| `Cancel`       | `<CloseOutlined />`         |
| `MoreVert`     | `<MoreOutlined />`          |
| `ArrowForward` | `<ArrowRightOutlined />`    |
| `ArrowBack`    | `<ArrowLeftOutlined />`     |
| `ExpandMore`   | `<DownOutlined />`          |
| `ExpandLess`   | `<UpOutlined />`            |
| `Menu`         | `<MenuOutlined />`          |
| `Home`         | `<HomeOutlined />`          |
| `Settings`     | `<SettingOutlined />`       |
| `Person`       | `<UserOutlined />`          |
| `Group`        | `<TeamOutlined />`          |
| `Book`         | `<BookOutlined />`          |
| `Description`  | `<FileTextOutlined />`      |
| `Folder`       | `<FolderOutlined />`        |
| `Upload`       | `<UploadOutlined />`        |
| `Download`     | `<DownloadOutlined />`      |
| `Refresh`      | `<ReloadOutlined />`        |
| `Filter`       | `<FilterOutlined />`        |
| `Sort`         | `<SortAscendingOutlined />` |

## Required Imports

```typescript
// Ant Design components
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  Input,
  Select,
  Table,
  Modal,
  Form,
  message,
  Tag,
  Space,
  Dropdown,
  Avatar,
  Tooltip,
  Alert,
  Tabs,
  Collapse,
  List,
  Statistic,
  Empty,
  Spin,
  Popconfirm,
  Drawer,
  Checkbox,
  Radio,
  Switch,
  DatePicker,
  TimePicker,
  Upload,
  Progress,
  Badge,
  Divider,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  CloseOutlined,
  CheckOutlined,
  SaveOutlined,
  MoreOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  DownOutlined,
  UpOutlined,
  MenuOutlined,
  HomeOutlined,
  SettingOutlined,
  UserOutlined,
  TeamOutlined,
  BookOutlined,
  FileTextOutlined,
  FolderOutlined,
  UploadOutlined,
  DownloadOutlined,
  ReloadOutlined,
  FilterOutlined,
  ReadOutlined,
  PartitionOutlined,
  ScheduleOutlined,
  LogoutOutlined,
} from "@ant-design/icons";

// React Router
import { useNavigate, useParams, useLocation } from "react-router-dom";

// React Query
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// API
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import {
  extractArrayData,
  extractCount,
  getHeaders,
} from "@/utils/api-helpers";
// Import specific API functions as needed
```

## API Helper Utilities

**IMPORTANT**: Use the shared API helpers from `@/utils/api-helpers`:

```typescript
import {
  extractArrayData,
  extractCount,
  getHeaders,
} from "@/utils/api-helpers";
```

### extractArrayData

API responses may come in different formats. Always use `extractArrayData` to handle all cases:

```typescript
// Handles all these formats:
// - Direct array: [{id, title}]
// - Success object: { success: true, data: [...] }
// - Paginated: { success: true, data: { results: [...] } }

const { data: courses = [] } = useQuery({
  queryKey: ["courses", tenant],
  queryFn: async () => {
    const result = await listCourses({
      tenant,
      fields: ["id", "title"],
      headers: getHeaders(user),
    });
    return extractArrayData(result);
  },
  enabled: !!tenant && !!user,
});
```

### extractCount

For paginated responses with count:

```typescript
const count = extractCount(data); // Returns 0 if not found
```

### getHeaders

Use instead of manually casting `getAuthHeaders`:

```typescript
headers: getHeaders(user), // Instead of getAuthHeaders(user) as Record<string, string>
```

## React Hooks Rules (CRITICAL)

**All hooks MUST be called BEFORE any conditional returns:**

```typescript
// ❌ WRONG - hooks after conditional return
export default function MyPage() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) return <Spin />;
  if (!user) return <Alert message="请登录" />;

  // ❌ These hooks may not be called on every render
  const { data } = useQuery({ ... });
  const mutation = useMutation({ ... });
}

// ✅ CORRECT - all hooks before conditional returns
export default function MyPage() {
  const { user, loading: authLoading } = useAuth();
  const tenant = getCurrentTenant()?.schemaName || "";

  // ✅ All hooks called unconditionally
  const { data } = useQuery({
    queryKey: ["resource", tenant],
    queryFn: async () => { ... },
    enabled: !!tenant && !!user, // Use enabled to control when to fetch
  });

  const mutation = useMutation({ ... });

  // ✅ Conditional returns AFTER all hooks
  if (authLoading) return <Spin />;
  if (!user) return <Alert message="请登录" />;
  if (!tenant) return <Alert message="未选择租户" />;

  return <div>...</div>;
}
```

### Query Enabled Condition

Always include both `tenant` and `user` checks:

```typescript
enabled: !!tenant && !!user,  // ✅ Correct
enabled: !!tenant,             // ❌ Missing user check - may cause errors
```

## API Pattern

```typescript
// In component
const { user } = useAuth();
const tenant = getCurrentTenant()?.schemaName;
const queryClient = useQueryClient();

// Query with auth
const { data, isLoading, error } = useQuery({
  queryKey: ["resourceName", tenant, filter],
  queryFn: () =>
    listResource({
      tenant: tenant || "",
      fields: ["id", "name", "status"],
      filter: { status: "active" },
      sort: "-createdAt",
      page: { limit: 20, offset: 0, count: true },
      headers: getHeaders(user),
    }),
  enabled: !!tenant && !!user,
});

// Mutation with auth
const createMutation = useMutation({
  mutationFn: (input: ResourceInput) =>
    createResource({
      tenant: tenant || "",
      input,
      fields: ["id", "name"],
      headers: getAuthHeaders(user) as Record<string, string>,
    }),
  onSuccess: () => {
    message.success("创建成功");
    queryClient.invalidateQueries({ queryKey: ["resourceName"] });
  },
  onError: (error: any) => {
    message.error(error?.message || "操作失败");
  },
});

// Update mutation (primaryKey separate from input)
const updateMutation = useMutation({
  mutationFn: ({ id, input }: { id: string; input: Partial<ResourceInput> }) =>
    updateResource({
      tenant: tenant || "",
      primaryKey: id,
      input,
      fields: ["id", "name"],
      headers: getAuthHeaders(user) as Record<string, string>,
    }),
  onSuccess: () => {
    message.success("更新成功");
    queryClient.invalidateQueries({ queryKey: ["resourceName"] });
  },
});

// Delete mutation
const deleteMutation = useMutation({
  mutationFn: (id: string) =>
    destroyResource({
      tenant: tenant || "",
      primaryKey: id,
      fields: [],
      headers: getAuthHeaders(user) as Record<string, string>,
    }),
  onSuccess: () => {
    message.success("删除成功");
    queryClient.invalidateQueries({ queryKey: ["resourceName"] });
  },
});
```

## Remove These

1. **Framer Motion** - Remove all animations:
   - `import { MotionContainer, varFade } from 'src/components/animate'`
   - `import { m } from 'framer-motion'`
   - `<MotionContainer>`, `<m.div>`, `varFade('inUp')`
   - Replace with CSS transitions: `style={{ transition: "all 0.3s" }}`

2. **MUI Theme sx prop** - Convert to inline styles:

   ```typescript
   // MUI
   <Box sx={{ p: 2, mb: 3, color: 'primary.main' }}>

   // Ant Design
   <div style={{ padding: 16, marginBottom: 16, color: '#1890ff' }}>
   ```

3. **Alpha function** - Replace with rgba:

   ```typescript
   // MUI
   alpha(theme.palette.primary.main, 0.1);

   // Ant Design
   ("rgba(24, 144, 255, 0.1)");
   ```

4. **Custom components from MUI project**:
   - `DashboardLayout` → Remove (use layout from route)
   - `Iconify` → Use Ant Design icons
   - `Label` → `<Tag color="...">`
   - `Scrollbars` → Remove or use native scroll
   - `LoadingScreen` → `<Spin>` or `loading` prop

## Table Pattern (DataGrid → Ant Design Table)

```typescript
// Columns definition
const columns = [
  {
    title: "名称",
    dataIndex: "name",
    key: "name",
    sorter: true,
  },
  {
    title: "状态",
    dataIndex: "status",
    key: "status",
    render: (status: string) => (
      <Tag color={status === "active" ? "green" : "red"}>
        {status === "active" ? "启用" : "禁用"}
      </Tag>
    ),
  },
  {
    title: "操作",
    key: "action",
    render: (_: any, record: DataType) => (
      <Space>
        <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
          编辑
        </Button>
        <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
          <Button type="link" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      </Space>
    ),
  },
];

// Table component
<Table
  columns={columns}
  dataSource={data?.results || []}
  rowKey="id"
  loading={isLoading}
  pagination={{
    current: page,
    pageSize: pageSize,
    total: data?.count || 0,
    showSizeChanger: true,
    showTotal: (total) => `共 ${total} 条`,
  }}
  onChange={handleTableChange}
/>
```

## Form Pattern (React Hook Form → Ant Design Form)

```typescript
// Ant Design Form
const [form] = Form.useForm();

const handleSubmit = async (values: FormValues) => {
  try {
    await createMutation.mutateAsync(values);
    form.resetFields();
    setIsModalOpen(false);
  } catch (error) {
    // Error handled in mutation
  }
};

// Form JSX
<Form
  form={form}
  layout="vertical"
  onFinish={handleSubmit}
  initialValues={{ status: "active" }}
>
  <Form.Item
    name="name"
    label="名称"
    rules={[{ required: true, message: "请输入名称" }]}
  >
    <Input placeholder="请输入名称" />
  </Form.Item>

  <Form.Item name="description" label="描述">
    <Input.TextArea rows={4} placeholder="请输入描述" />
  </Form.Item>

  <Form.Item>
    <Space>
      <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
        提交
      </Button>
      <Button onClick={() => form.resetFields()}>
        重置
      </Button>
    </Space>
  </Form.Item>
</Form>
```

## Tree Pattern (MUI TreeView → Ant Design Tree)

```typescript
import { Tree } from "antd";
import type { TreeDataNode } from "antd";

const treeData: TreeDataNode[] = [
  {
    title: "根节点",
    key: "root",
    children: [
      { title: "子节点1", key: "child-1" },
      { title: "子节点2", key: "child-2" },
    ],
  },
];

<Tree
  treeData={treeData}
  defaultExpandAll
  onSelect={handleSelect}
  onDrop={handleDrop}
  draggable
/>
```

## Modal Pattern

```typescript
const [isModalOpen, setIsModalOpen] = useState(false);
const [editingItem, setEditingItem] = useState<DataType | null>(null);

const handleCreate = () => {
  setEditingItem(null);
  form.resetFields();
  setIsModalOpen(true);
};

const handleEdit = (record: DataType) => {
  setEditingItem(record);
  form.setFieldsValue(record);
  setIsModalOpen(true);
};

// Modal JSX
<Modal
  title={editingItem ? "编辑" : "新建"}
  open={isModalOpen}
  onCancel={() => setIsModalOpen(false)}
  footer={null}
  width={600}
>
  <Form form={form} onFinish={handleSubmit}>
    {/* form fields */}
  </Form>
</Modal>
```

## Common Styles

```typescript
// Page container
const pageStyle = { padding: 24, minHeight: "100vh" };

// Card hover effect
const cardHoverStyle = {
  transition: "transform 0.3s, box-shadow 0.3s",
  cursor: "pointer",
};

// Gradient backgrounds
const gradients = {
  blue: "linear-gradient(135deg, rgba(24, 144, 255, 0.1) 0%, #fff 100%)",
  green: "linear-gradient(135deg, rgba(82, 196, 26, 0.1) 0%, #fff 100%)",
  orange: "linear-gradient(135deg, rgba(250, 173, 20, 0.1) 0%, #fff 100%)",
  red: "linear-gradient(135deg, rgba(255, 77, 79, 0.1) 0%, #fff 100%)",
};

// Statistic colors
const statisticColors = {
  blue: "#1890ff",
  green: "#52c41a",
  orange: "#faad14",
  red: "#ff4d4f",
  purple: "#722ed1",
};
```

## File Structure

```
src/pages/teacher/
├── dashboard.tsx           # Main dashboard
├── course.tsx              # Course management
├── student-enrollment.tsx  # Student management
├── knowledge-resource.tsx  # Knowledge points
├── knowledge-relation.tsx  # Knowledge relations
├── exercise.tsx            # Exercise management
└── exam-management.tsx     # Exam management
```

## Migration Checklist

For each page, verify:

- [ ] All MUI imports removed
- [ ] Ant Design imports added
- [ ] Components converted to Ant Design
- [ ] Icons replaced with Ant Design icons
- [ ] Framer Motion animations removed
- [ ] API calls use `getAuthHeaders(user)`
- [ ] API calls include `tenant` parameter
- [ ] `sx` props converted to inline styles
- [ ] Theme references replaced with hardcoded colors
- [ ] Custom MUI components replaced
- [ ] Form validation works
- [ ] Navigation works with `useNavigate`
- [ ] Loading states use `<Spin>` or `loading` prop
- [ ] Error messages use `message.error()`
- [ ] Success messages use `message.success()`

## Agent Task Template

When migrating a page, follow these steps:

1. **Read the source file** from `/Users/bai/projects/kg-edu/minimal-vite-ts/src/pages/teacher/dashboard/{filename}.tsx`

2. **Check the target file** at `/Users/bai/projects/kg-edu/kg-edu-vite-antd/src/pages/teacher/{filename}.tsx`

3. **Identify MUI components** used in the source file

4. **Create the migrated file** with:
   - Ant Design imports
   - Converted components
   - API integration with auth headers
   - Proper tenant handling

5. **Write the file** to the target location

6. **Report** any issues or missing patterns

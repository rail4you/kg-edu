# Excel 按角色拆分导入方案

## 需求
将现有统一 Excel 导入拆分为三个角色专属导入：
- 教师导入（无角色列）
- 学生导入（无角色列）
- 管理员导入（无角色列）

每个角色有独立的 Excel 模板和导入入口。

## 当前实现

### 文件清单
| 文件 | 作用 |
|------|------|
| `backend/kg_edu/lib/kg_edu/accounts/user.ex` (L931-1077) | `import_users_from_excel` action，接收 base64 Excel 文件 |
| `backend/kg_edu/lib/kg_edu/accounts/user/changes/import_from_excel.ex` | 解析 Excel、校验、upsert 用户逻辑 |
| `backend/kg_edu/lib/kg_edu/excel_import.ex` | 通用 Excel 解析工具（Base64→Xlsxir→行数据） |
| `kg-edu-vite-antd/src/lib/user-import-export.ts` | 前端导入导出工具（parseUserFile、importUsersFromExcel、downloadUserTemplate） |
| `kg-edu-vite-antd/src/components/admin/import-user-modal.tsx` | 导入用户弹窗组件 |
| `kg-edu-vite-antd/src/pages/admin/users.tsx` | 管理员用户管理页（使用导入弹窗） |

### 当前 Excel 格式（10列）
| A列 | B列 | C列 | D列 | E列 | F列 | G列 | H列 | I列 | J列 |
|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| 工号 | 姓名 | 电话 | 邮箱 | 密码 | 角色 | 学校 | 学院 | 专业 | 班级 |

## 目标格式

### 教师模板 (teacher_import_template.xlsx) — 9列，无角色列
| A列 | B列 | C列 | D列 | E列 | F列 | G列 | H列 | I列 |
|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| 工号 | 姓名 | 电话 | 电子邮件 | 密码 | 学校 | 学院 | 专业 | - |

后端属性: `[:member_id, :name, :phone, :email, :password, :school, :colledge, :major]`
角色自动设为: `teacher`

### 学生模板 (student_import_template.xlsx) — 9列，无角色列
| A列 | B列 | C列 | D列 | E列 | F列 | G列 | H列 | I列 |
|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| 工号 | 姓名 | 电话 | 电子邮件 | 密码 | 学校 | 学院 | 专业 | 班级 |

后端属性: `[:member_id, :name, :phone, :email, :password, :school, :colledge, :major, :class]`
角色自动设为: `user`
班级列会用于查找/创建班级并关联

### 管理员模板 (admin_import_template.xlsx) — 8列，无角色列
| A列 | B列 | C列 | D列 | E列 | F列 | G列 | H列 |
|-----|-----|-----|-----|-----|-----|-----|-----|
| 工号 | 姓名 | 电话 | 电子邮件 | 密码 | 学校 | 学院 | 专业 |

后端属性: `[:member_id, :name, :phone, :email, :password, :school, :colledge, :major]`
角色自动设为: `admin`

## 实现方案

### 1. 后端改动

#### `user.ex` — 给 `import_users_from_excel` action 增加 `role` 参数

```elixir
# 在 import_users_from_excel action 的 arguments 块中新增:
argument :role, :string do
  description("The role to assign all imported users (admin/teacher/user)")
  allow_nil?(true)
end

# 在 run 函数中，获取 role 参数:
import_role = Map.get(input.arguments, :role)
# 传递给 parse_excel:
KgEdu.Accounts.User.ImportFromExcel.parse_excel(excel_file, attributes, tenant_to_use, import_role)
```

#### `import_from_excel.ex` — 接受 role 参数并注入

```elixir
# parse_excel/4 新增 role 参数
def parse_excel(excel_file, attributes, tenant_schema, role \\ nil) do
  # ...
end

# 在 process_user_data 中，如果有 role 参数，直接使用，忽略 Excel 中的角色列
defp process_user_data(user_map, tenant_schema, import_role) do
  # 如果有 import_role，注入到 user_map
  user_map = if import_role, do: Map.put(user_map, :role, import_role), else: user_map
  # ... 后续校验逻辑不变
end
```

### 2. 前端改动

#### `user-import-export.ts`

```typescript
// 新增角色参数
export async function importUsersFromExcel(
  tenantId: string,
  fileBase64: string,
  role: "admin" | "teacher" | "user"
): Promise<UserImportResult> {
  const result = await importExcel({
    tenant: tenantId,
    input: { excelFile: fileBase64, role },
  });
  // ...
}

// parseUserFile 不再解析角色列，由调用方传入角色
export async function parseUserFile(file: File): Promise<UserImportData[]> {
  // 新格式: 工号(A), 姓名(B), 电话(C), 邮箱(D), 密码(E), 学校(F), 学院(G), 专业(H), 班级(I)
  // 不再读取 F列 作为角色
}

// 模板生成（使用 XLSX 库在客户端生成）
export function downloadRoleTemplate(role: "admin" | "teacher" | "user") {
  const headers = getTemplateHeaders(role);
  const exampleRow = getTemplateExampleRow(role);
  // 使用 XLSX.utils 生成并下载
}

// 三个模板各自的列定义
function getTemplateHeaders(role) {
  switch(role) {
    case "teacher": return ["工号", "姓名", "电话", "电子邮件", "密码", "学校", "学院", "专业"];
    case "user":    return ["工号", "姓名", "电话", "电子邮件", "密码", "学校", "学院", "专业", "班级"];
    case "admin":   return ["工号", "姓名", "电话", "电子邮件", "密码", "学校", "学院", "专业"];
  }
}
```

#### `import-user-modal.tsx` — 增加 `role` 属性

```typescript
interface ImportUserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  role: "admin" | "teacher" | "user";  // 新增
}
```

- 根据 `role` 显示不同的标题（"导入教师"/"导入学生"/"导入管理员"）
- 预览表格根据 `role` 显示不同的列（学生有班级列，教师/管理员没有）
- 调用 `importUsersFromExcel` 时传入 `role`
- 格式说明表格根据 `role` 动态生成

#### `users.tsx` — 三个导入按钮 + 三个下载模板按钮

```tsx
<Space>
  <Button onClick={() => downloadRoleTemplate("teacher")}>下载教师模板</Button>
  <Button onClick={() => downloadRoleTemplate("user")}>下载学生模板</Button>
  <Button onClick={() => downloadRoleTemplate("admin")}>下载管理员模板</Button>
  <Button onClick={() => setTeacherImportOpen(true)}>导入教师</Button>
  <Button onClick={() => setStudentImportOpen(true)}>导入学生</Button>
  <Button onClick={() => setAdminImportOpen(true)}>导入管理员</Button>
  <Button type="primary" onClick={handleCreate}>添加用户</Button>
</Space>

{/* 三个导入弹窗 */}
<ImportUserModal open={teacherImportOpen} role="teacher" ... />
<ImportUserModal open={studentImportOpen} role="user" ... />
<ImportUserModal open={adminImportOpen} role="admin" ... />
```

## 实施顺序

1. 后端 `user.ex`: 增加 `role` argument
2. 后端 `import_from_excel.ex`: `parse_excel/4` 接受 role，`process_user_data` 注入 role
3. 前端 `user-import-export.ts`: 角色化 parse/import/template 函数
4. 前端 `import-user-modal.tsx`: 角色化弹窗
5. 前端 `users.tsx`: 三个入口
6. 测试验证

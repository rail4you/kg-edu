# Excel 按角色拆分导入方案

## 需求
将现有统一 Excel 导入（含角色列）拆分为三个角色专属导入：
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
| `backend/kg_edu/lib/kg_edu/excel_import.ex` | 通用 Excel 解析工具（Base64->Xlsxir->行数据） |
| `kg-edu-vite-antd/src/lib/user-import-export.ts` | 前端导入导出工具（parseUserFile、importUsersFromExcel、downloadUserTemplate） |
| `kg-edu-vite-antd/src/components/admin/import-user-modal.tsx` | 导入用户弹窗组件 |
| `kg-edu-vite-antd/src/pages/admin/users.tsx` | 管理员用户管理页（使用导入弹窗） |

### 当前 Excel 格式（10列）
| A列 | B列 | C列 | D列 | E列 | F列 | G列 | H列 | I列 | J列 |
|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| 工号 | 姓名 | 电话 | 邮箱 | 密码 | 角色 | 学校 | 学院 | 专业 | 班级 |

### 当前问题
1. 角色列容易出错（用户填错值或格式不标准）
2. 一个模板混合所有角色，不够直观
3. 学生才有班级列，教师/管理员不需要

## 改动方案

### 1. 后端改动

#### `user.ex` — `import_users_from_excel` action
- 增加 `role` argument（string类型，可选值 admin/teacher/user）
- 修改 `attributes` 默认值，去掉 `:role`
- 将 `role` 参数传递给 `ImportFromExcel.parse_excel/3`

```elixir
argument :role, :string do
  description("Force role for all imported users")
  allow_nil?(true)
  default("user")
end
```

#### `import_from_excel.ex` — `parse_excel/3`
- `parse_excel(excel_file, attributes, tenant_schema)` 改为 `parse_excel(excel_file, attributes, tenant_schema, role)`
- `create_single_user` 中将 `role` 注入 user_map：
  ```elixir
  user_map = Map.put(user_map, :role, role || "user")
  ```
- `process_user_data` 中的角色解析逻辑改为：优先使用传入的 role 参数，不再从 Excel 列解析

### 2. 前端改动

#### `user-import-export.ts`
- `parseUserFile(file)` 改为 `parseUserFile(file, role)`：
  - 解析时不再读角色列
  - `role` 由参数注入
- `importUsersFromExcel(tenantId, fileBase64)` 改为 `importUsersFromExcel(tenantId, fileBase64, role)`
  - RPC 调用增加 `role` 参数
- 新增 `downloadRoleTemplate(role)` 函数，用 xlsx 库在前端生成模板：
  ```typescript
  function downloadRoleTemplate(role: "admin" | "teacher" | "user") {
    const columns = getColumnsForRole(role);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([columns.header, ...columns.example]);
    XLSX.utils.book_append_sheet(wb, ws, "用户导入");
    XLSX.writeFile(wb, `${role}_import_template.xlsx`);
  }
  ```

#### `import-user-modal.tsx`
- 新增 `role` prop
- 标题根据 role 显示："导入教师"/"导入学生"/"导入管理员"
- 格式说明表格根据 role 动态生成
- 预览表格根据 role 显示/隐藏班级列

#### `users.tsx` — 三个按钮组
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

<ImportUserModal open={teacherImportOpen} role="teacher" ... />
<ImportUserModal open={studentImportOpen} role="user" ... />
<ImportUserModal open={adminImportOpen} role="admin" ... />
```

## Excel 模板列定义

### 教师模板
| A列 | B列 | C列 | D列 | E列 |
|-----|-----|-----|-----|-----|
| 工号 | 姓名 | 电话 | 邮箱 | 密码 |

示例: `teacher001 | 张老师 | 13800001111 | zhang@school.edu | 12345678`

### 学生模板
| A列 | B列 | C列 | D列 | E列 |
|-----|-----|-----|-----|-----|
| 工号 | 姓名 | 电话 | 邮箱 | 密码 |

示例: `student001 | 李同学 | 13900002222 | li@school.edu | 12345678`

（班级通过选课自动分配，无需在导入时指定）

### 管理员模板
| A列 | B列 | C列 | D列 | E列 |
|-----|-----|-----|-----|-----|
| 工号 | 姓名 | 电话 | 邮箱 | 密码 |

示例: `admin001 | 王管理 | 13700003333 | wang@school.edu | 12345678`

## 实施顺序
1. 后端 `user.ex` 增加 role argument
2. 后端 `import_from_excel.ex` 接受 role 参数，注入 user_map
3. 前端 `user-import-export.ts` 改造 parseUserFile/importUsersFromExcel/downloadRoleTemplate
4. 前端 `import-user-modal.tsx` 增加 role prop
5. 前端 `users.tsx` 拆分为三个按钮 + 三个弹窗
6. 验证 lint + build
7. 测试导入

## 注意事项
- 密码长度：后端校验 >= 8 位
- 角色值映射：前端 "user" -> 学生， "teacher" -> 教师， "admin" -> 管理员
- 班级分配：学生角色导入时如果有班级列数据仍然支持自动分配班级
- 向后兼容：如果 Excel 中包含角色列也能解析（role 参数优先）

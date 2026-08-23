# 教师编辑权限（使用期限）功能开发方案

## 1. 需求理解

在**超级管理员端**和**管理员端**的"教师管理"中，为每个教师配置一个"编辑权限 / 使用期限"模块：

- **开关**：是否启用教师编辑权限（`编辑权限开关`）
- **时间段**：允许编辑的起止日期，例如 `2026.08.05 ~ 2027.08.05`

**生效规则**（仅对 `teacher` 角色生效）：

| 条件 | 结果 |
|------|------|
| 开关关闭 (`edit_enabled=false`) | 教师**只读**（原因：已关闭） |
| 今天 < 起始日期 | 教师**只读**（原因：未到开始时间） |
| 今天 > 截止日期 | 教师**只读**（原因：已过期） |
| 在时间段内且开关开启 | 正常编辑 |
| 未设置开关/时间（存量教师，默认值） | 正常编辑（向后兼容） |

**只读的含义**：教师可以正常登录、可以查看全部资源（课程、章节、视频、文件、习题、知识图谱、统计等），但**所有写操作被禁止**——创建、编辑、删除、导入、AI 生成、上传、发布、调整顺序、批改等一律拦截。

**不受影响**：
- 学生（`user` 角色）：照常学习，无需任何处理。
- 管理员 / 超级管理员：完全不受影响。
- 登录行为：不拦截（教师仍可登录并进入教师端，只是看到只读提示）。

---

## 2. 现状分析（已确认）

### 后端（Phoenix + Ash）
- 用户模型：`backend/kg_edu/lib/kg_edu/accounts/user.ex`
  - 角色枚举：`[:super_admin, :admin, :user, :teacher]`（`user` = 学生）
  - `code_interface` 已有 `update_user` → `:update`、`create_user` → `:create_user`、`get_current_user` 等
  - 多租户：`multitenancy strategy(:context)`，数据在 `users` 表（各租户 schema 内）
- 前端所有 CRUD 走 **AshTypescript RPC**：`POST /rpc/run`，payload 格式 `{"action":"create_course","tenant":"org_xxx","input":{...}}`（见 `ash_rpc.ts` 生成的 `createCourse`）
- RPC 执行管线：`deps/ash_typescript/lib/ash_typescript/rpc.ex` → `Pipeline.parse_request` → `discover_action` 根据 `action` 名在全域范围内解析出 `{resource, action, rpc_action}`，`action.type` 为 `:read | :create | :update | :destroy | :action`
- 认证 actor 加载：`KgEduWeb.Plugs.LoadActor`（`router.ex:1`），写入 `conn.private.ash_actor` 与 `conn.assigns`
- 用户资源 policies 目前几乎全放行（`authorize_if always()`），没有细粒度写权限控制
- 迁移：`./dev.sh codegen <name>` → `./dev.sh migrate`（含 `--tenants`）
- TS 客户端再生成：`mix ash_typescript.codegen`

### 前端（React + TS + AntD）
- 管理端教师管理：`src/pages/admin/teachers.tsx` + `src/components/admin/teacher-form.tsx`
  - **管理员端**与**超级管理员端**共用同一页面（超管在 AdminLayout 中先选租户，见 `admin-menu-config.tsx` standardItems 包含"教师管理"），因此**一套改动同时覆盖两端**。
- 教师端布局：`src/layouts/teacher-layout.tsx`，教师页 ~50 个，均在 `src/pages/teacher/*`
- 登录/会话：`src/auth/auth-context.tsx`，`user_data` 存于 `sessionStorage`；登录返回的 user 结构会包含 User 资源的所有 public 字段（`sign_in_tenant` 为 `returns(:map)`，返回完整 user struct）
- RPC 拦截钩子：`src/lib/rpcHooks.ts` 的 `beforeRequest` / `afterRequest`（自动注入 JWT、处理 401/403）
- 生成的客户端函数命名有规律：`createXxx / updateXxx / deleteXxx / destroyXxx / importXxx / bulkXxx / removeXxx / ...`，可用于前端写操作识别

---

## 3. 数据模型设计

在 `KgEdu.Accounts.User` 新增 3 个 public 字段：

```elixir
attribute :edit_enabled, :boolean do
  default(true)
  public?(true)
  description("教师端编辑权限开关（默认开启）")
end

attribute :edit_period_start, :date do
  allow_nil?(true)
  public?(true)
  description("教师可编辑起始日期，空表示不限")
end

attribute :edit_period_end, :date do
  allow_nil?(true)
  public?(true)
  description("教师可编辑截止日期，空表示不限")
end
```

校验：
- `edit_period_end >= edit_period_start`（两者都存在时）
- 对非 `teacher` 角色这些字段无意义（不拦截，但仍可存储；不强制）

改动动作的 `accept`/`set_attribute` 列表：
- `update :update`（管理员改教师 + 教师改自己资料共用）：**accept 中加入 3 个字段**，但需加保护（见 §5.4）
- `create :create_user`（管理员创建教师）：`set_attribute` 加入 3 个字段
- 批量 Excel 导入默认 `edit_enabled=true`（由数据库默认值兜底），无需改导入逻辑
- `update_student / create_student` 不加入（学生无编辑权限概念）

---

## 4. 权限判定引擎（后端核心）

新增纯模块 `backend/kg_edu/lib/kg_edu/accounts/edit_permission.ex`：

```elixir
defmodule KgEdu.Accounts.EditPermission do
  @type status ::
          :ok
          | :not_applicable            # 非教师 / 无 actor
          | {:locked, :disabled | :not_started | :expired}

  def status(actor, today \\ Date.utc_today())

  def readonly?(actor, today \\ Date.utc_today())

  def ensure_editable!(actor, today \\ Date.utc_today())
  # 返回 :ok | {:error, "当前处于只读模式，编辑权限已被限制，请联系管理员"}
end
```

判定逻辑（`status/2`）：

```
actor == nil                                     → :not_applicable
actor.role != :teacher                           → :not_applicable
actor.edit_enabled == false                      → {:locked, :disabled}
actor.edit_period_start != nil and today < start → {:locked, :not_started}
actor.edit_period_end   != nil and today > end   → {:locked, :expired}
otherwise                                        → :ok
```

只读提示文案按原因区分（前端展示用）：
- 已关闭：`编辑权限已被管理员关闭，当前仅可查看`
- 未开始：`编辑权限将于 {start} 开始生效，当前仅可查看`
- 已过期：`编辑权限已于 {end} 到期，当前仅可查看`

**以服务器时间（`Date.utc_today/0`）为准**；前端仅做展示与提前拦截（近似本地时间），真正拦截在服务端。

---

## 5. 后端强制拦截（权威层，三层）

> 目标：**即使前端被绕过，后端也保证教师无法写入任何数据。**

### 5.1 第一层：RPC 端点拦截（覆盖前端全部 CRUD，最主要）

新增 Plug `backend/kg_edu/lib/kg_edu_web/plugs/enforce_edit_window.ex`，挂到 `:api` pipeline（`router.ex:72`，放在 `LoadActor` 之后）：

- 快速路径：`EditPermission.status(actor)` 返回 `:ok` 或 `:not_applicable` 直接放行。
- 命中锁定教师后：
  - **`POST /rpc/run`**：从 body 取 `"action"`，复用 `discover_action` 相同的查找逻辑（`Ash.Info.domains` + `AshTypescript.Rpc.Info.typescript_rpc`）解析出 `{resource, action}`，检查 `action.type`：
    - `:create | :update | :destroy` → **一律拦截**
    - `:action`（通用动作）→ 按**受控名单**拦截写类动作（见下）
    - `:read` → 放行
  - **`POST /rpc/validate`**（表单校验）：同样拦截（避免校验通过后再执行失败）
- 拦截响应体（**HTTP 200 + success:false**，避免触发前端 `afterRequest` 的 403 登出逻辑）：

```json
{ "success": false,
  "errors": [{ "type": "forbidden",
               "message": "当前处于只读模式，编辑权限已被限制，请联系管理员" }] }
```

（前端所有 mutation 已能处理 `!result.success` 并展示 `errors[0].message`，无需改造各页面错误处理。）

**通用 `:action` 写类动作名单**（在 Plug 中维护，实施时从生成的 `ash_rpc.ts` 前缀统计结果筛出，示例）：
- 导入/导入类：`import_*`
- 生成类（AI 生成会写库）：`generate_*`、`regenerate_*`
- 上传/链接：`upload_*`、`link_*`、`unlink_*`、`replace_*`
- 增删改：`add_*`、`remove_*`、`delete_*`、`destroy_*`、`bulk_*`、`move_*`、`reorder_*`、`clone_*`、`copy_*`、`restore_*`
- 状态变更：`publish_*`、`unpublish_*`、`activate_*`、`close_*`、`complete_*`、`start_*`、`submit_*`、`grade_*`、`mark_*`、`approve_*`、`reject_*`、`revoke_*`、`apply_*`、`enroll_*`、`unenroll_*`、`assign_*`、`send_*`、`reset_*`、`change_*`、`trigger_*`
- **放行白名单**（虽像写操作但不拦截）：`sign_out`、`refresh_session`、`change_password`、`check_in`、`checkIn`、`get_*`、`list_*`、`read_*`、`search_*`、`count_*`、`download_*`、`preview_*`、`validate_*`、`calculate_*`、`send_verification*` 等。

> 名单以"黑名单前缀 + 白名单例外"形式实现，实施时基于真实生成的客户端函数名逐条核对。

### 5.2 第二层：直连控制器拦截（非 RPC 的写端点）

在以下写类 controller 入口调用 `KgEdu.Accounts.EditPermission.ensure_editable!(conn.private.ash_actor)`（不满足则返回 403 + body 含 `code: "edit_locked"`）：

- `FileUploadController`（上传 OSS 文件）
- `UploadVideoController`（视频上传、章节关联/解绑）
- `ImportController`（xmind / excel 导入）
- `GenerationController`（AI 练习题、能力图谱、课程体系生成、课程文档上传、AI 岗位图谱）
- 文件模板下载 `DownloadController`：只读，**不拦截**

前端 `fetch-interceptor.ts` 需识别 `code === "edit_locked"` 的 403：弹出 `message.warning` 而非跳转登录（防止被误判为鉴权失败登出）。

### 5.3 第三层：JSON API / LiveView（加固，可选）

- `/api/json/*`（AshJsonApi）scope 追加同一 Plug：锁定教师禁止 `POST/PATCH/DELETE`（JSON API 写方法），`GET` 放行。
- `/live/*` 与 AshAdmin 为内部管理台（浏览器会话），实施时可加 `on_mount` 守卫或暂缓（低优先级）。
- 长期加固：抽一个 `Ash.Policy.Check`（`TeacherEditAllowed`），在主要写资源（course/chapter/video/file/exercise/question/homework/exam/knowledge resource/relation/group_task/experiment/micro_major/major 等）的 policy 里各加一行 `forbid_if`。**列为第二阶段加固项**，因涉及 ~30 个资源文件，改动机械但量大。

### 5.4 字段自保护（防止教师/管理员篡改编辑权限）

`update :update` 动作同时被"管理员改教师/管理员"和"角色改自己资料"使用。新增 change（`protect_edit_permission.ex`）：

```elixir
# 仅 super_admin 可修改 edit_enabled / edit_period_start / edit_period_end；
# update 路径：其他角色修改时强制还原为原值；
# create_user 路径：非 super_admin 创建用户时强制重置为默认（开启、不限期限）。
```

保证教师/管理员无法自行开启或延长自己的编辑权限，且普通管理员无法在创建用户时顺带配置使用时限。

---

## 6. 前端改动 — 管理端 / 超级管理员端

> 两端共用 `teachers.tsx` + `teacher-form.tsx`，一处实现、两端生效。

### 6.1 教师表单新增"编辑权限 / 使用期限"模块（`teacher-form.tsx`）

在表单底部新增卡片/区域（antd `Switch` + `DatePicker.RangePicker`）：

- **编辑权限**：`Switch`，绑定 `editEnabled`（默认开启）；关闭时显示说明"关闭后教师将无法进行任何编辑操作，仅可查看"
- **编辑使用期限**：`DatePicker.RangePicker`，可选；`editPeriodStart` / `editPeriodEnd`
  - 提示文案：`不设置期限表示不限时间；超出设置期限后教师仅可查看，无法编辑`
- 校验：结束日期 >= 开始日期
- 提交时并入 `data`，create/update payload 携带 `editEnabled / editPeriodStart / editPeriodEnd`

> **权限说明（2026-02 收紧）**：编辑权限/使用期限的**配置能力仅超级管理员开放**。
> - 普通管理员的表单中该模块为只读展示（`Switch`/`RangePicker` 禁用 + "仅超级管理员可设置"提示），提交 payload 不携带这些字段；
> - 列表/详情仍展示只读状态标签（`EditPermissionTag`），供管理员查看；
> - 「批量设置期限」按钮仅超级管理员可见可点；
> - 后端 `bulk_update_edit_permission`、`ProtectEditPermission`（update/create 两条路径）均仅放行 `super_admin`，管理员即使直接调 RPC 也会被拒绝或还原。

### 6.2 教师列表与详情展示（`teachers.tsx`）

- 新增列 **"编辑权限"**：根据 `edit_enabled` + 起止日期 + 当天渲染 Tag：
  - 正常（绿 `正常`）
  - 已关闭（红 `已关闭`）
  - 未开始（橙 `未开始 · {start}`）
  - 已过期（红 `已过期 · {end}`）
  - 永久（未设期限且开启 → `不限时`）
- 详情 Drawer（`Descriptions`）中增加对应展示。
- `transformAshUser` 与 `IUserItem` 类型补充新字段。
- 教师列表查询 `fields` 加入 `editEnabled/editPeriodStart/editPeriodEnd`。

---

## 7. 前端改动 — 教师端（只读模式体验）

### 7.1 用户类型与会话

- `src/auth/auth-context.tsx`：`User` 类型增加 `editEnabled/editPeriodStart/editPeriodEnd`；登录后从响应解析并存入 `sessionStorage`。
- 新增 hook `src/hooks/use-edit-permission.ts`：
  - 基于 `useAuth().user` + 今天计算
  - 返回 `{ canEdit, status, statusText, start, end }`
- 存量会话兼容：教师端布局挂载时调用一次 `getCurrentUser`（RPC，读操作，不受拦截）刷新用户信息 → 更新 auth context，保证已登录教师**无需重新登录**即可立即进入只读状态。

### 7.2 教师端全局只读横幅（`teacher-layout.tsx`）

`canEdit === false` 时，在内容区顶部渲染 `Alert` 横幅（含状态图标与 `statusText`，如"编辑权限已于 2027.08.05 到期，当前仅可查看"）。

### 7.3 写操作集中拦截（`rpcHooks.ts` `beforeRequest`）

- 维护与后端一致的**写动作前缀集合**（`create*/update*/delete*/destroy*/import*/...`）。
- `beforeRequest` 中：当前用户为 teacher 且 `!canEdit` 且 actionName 命中写前缀 → **直接短路返回** `{ success:false, errors:[{ message: 只读提示 }] }`，不发请求。
- 优点：任何页面、任何写按钮，即使漏改 UI，也会被集中拦截，且**即时反馈**。

### 7.4 教师页写按钮的隐藏/禁用（核心 UI 要求，已考虑）

> 明确策略：**"操作列"写按钮一律灰色禁用 + Tooltip 说明；"新增/导入"等顶部工具栏按钮隐藏**。这样教师能看到哪里有编辑入口、为何点不了（比直接隐藏更友好），同时视觉上一目了然处于只读态。

**统一注入方式（全局，无需逐页手写 `canEdit ? ...`）**：

1. 新增 `EditPermissionProvider`（挂在 `TeacherLayout` 内），通过 React Context 暴露 `{ canEdit, statusText }`，并提供 `useEditPermission()` hook。
2. 新增**通用只读控件**（复用于改造与新代码）：
   - `<ReadonlyActionButton tooltip="只读模式下不可编辑">` —— 内部用 `useEditPermission()`，`!canEdit` 时渲染 `disabled` 的灰色 Button 并包 Tooltip（内容为 `statusText`）。
   - 只读态下点击被禁用的按钮时，AntD `disabled` 天然阻断事件，无需额外逻辑；Tooltip 说明原因。
3. **批量改造方式（提高效率）**：教师页的"操作列"代码高度相似（多为 `<Button ... icon={<EditOutlined/>}/>` + `<Popconfirm>` 删除），开发时以 `rg` 定位每页的 `EditOutlined/DeleteOutlined/PlusOutlined/UploadOutlined` 所在列，把写按钮替换为 `ReadonlyActionButton` 或包一层 `disabled={!canEdit}`，并用 `<Tooltip>` 包裹；新增/导入按钮按 `canEdit` 条件渲染（不满足直接 `null`）。

**分阶段**：
- **第一阶段（必须）**：高频内容页约 25 个——课程、章节、视频、文件、习题、题库、作业、考试管理、知识资源、知识关系、实验管理、小组管理、小组任务、AI 练习题/文件/指令、课程分类、链接、教材信息、课程信息、讨论、课程评价、邮件配置、模板管理、微专业/专业管理。每页统一处理：操作列（编辑/删除/关联/调整顺序/发布）灰色禁用 + 顶部"新增/导入/生成"按钮隐藏。
- **第二阶段**：其余低风险页（统计、查看类天然只读，仅需核对无写入口；若有"发布/删除/下载模板编辑"等写入口同样处理）。
- **兜底保证**：即使某页漏改或通过 URL/DevTools 强行触发，7.3 的集中拦截（`rpcHooks.beforeRequest`）+ 后端 Plug 拦截仍保证写不出去；若 `canEdit` 状态滞后（如缓存会话），后端是最终权威。

---

## 8. 迁移与客户端再生成

1. `user.ex` 增加字段 + 校验 + `accept` 列表
2. 新增 `EditPermission` 模块、`EnforceEditWindow` Plug、`ProtectEditPermission` change
3. 迁移：
   ```bash
   ./dev.sh codegen add_teacher_edit_permission   # 生成迁移
   ./dev.sh migrate                               # mix ash.migrate + --tenants
   ```
4. 重新生成 TS 客户端（让新字段进入 `ash_rpc.ts` 类型与 `getCurrentUser`/登录响应）：
   ```bash
   cd backend/kg_edu && mix ash_typescript.codegen
   ```
5. 重启后端：`./dev.sh restart backend`

---

## 9. 测试方案

### 后端
- 单元测试 `EditPermissionTest`：`status/2` 全分支（未启用/未开始/已过期/正常/非教师）。
- 集成测试（`KgEduWeb.Router` + `/rpc/run`）：
  - 锁定教师 actor 调 `create_course` → `success:false` + 只读错误
  - 锁定教师 actor 调 `list_courses` / `get_current_user` → 放行
  - 管理员 actor 调 `create_course` → 放行
  - 教师 actor 调 `update_user` 改自己的 `edit_enabled` → 被还原
- 控制器测试：锁定教师调 `/api/upload`、`/api/generate_ai_exercise` → 403 + `code: edit_locked`。

### 前端
- `npm run lint`、`npm run build` 通过。

### 手工验收清单
1. 管理员创建教师并设置 `2026.08.05~2027.08.05` → 列表/详情正确显示
2. 用该教师登录 → 顶部出现只读横幅；课程/习题等页面新增、编辑、删除按钮消失或禁用
3. 尝试直接调 `/rpc/run create_course`（绕过前端）→ 返回只读错误
4. 学生账号登录 → 正常学习，无任何变化
5. 管理员/超管登录 → 完全正常
6. 教师改自己资料 → 保存成功但不影响其编辑权限字段

---

## 10. 实施步骤顺序

| # | 内容 | 依赖 |
|---|------|------|
| 1 | 后端：User 字段 + 校验 + change 自保护 | - |
| 2 | 后端：`EditPermission` 判定模块 + 单元测试 | 1 |
| 3 | 后端：`EnforceEditWindow` Plug（RPC 拦截）+ controller 拦截 + JSON API 加固 | 2 |
| 4 | 迁移 + `mix ash_typescript.codegen` | 1-3 |
| 5 | 前端：类型/会话/`useEditPermission`/教师端横幅 | 4 |
| 6 | 前端：rpcHooks 集中写拦截 + fetch-interceptor 403 处理 | 2,5 |
| 7 | 前端：管理端表单模块 + 列表/详情展示 | 5 |
| 8 | 前端：教师页写按钮渐进式隐藏（阶段一） | 5,6 |
| 9 | 集成测试 + 手工验收 | 全部 |

**工作量评估**：后端拦截与判定 ~1/3；前端管理端 ~1/4；前端教师端（含 25 页按钮改造）~1/2，且 7.3 集中拦截可先行上线兜底。

---

## 11. 风险与注意事项

1. **403 误登出**：RPC 拦截统一返回 HTTP 200 + `success:false`，直连控制器 403 带 `code: edit_locked`，前端拦截器据此区分，避免把只读误判为鉴权失败而强制登出。
2. **时间基准**：以服务器 UTC 日期为准；国内使用时如以自然日为准可改为 `Asia/Shanghai` 时区换算（实现时确认口径）。
3. **`update` 动作共用**：必须加字段自保护，防止教师自行解锁。
4. **通用 `:action` 写名单**：需与生成的 `ash_rpc.ts` 实际函数名逐条核对，白名单优先（漏判放行可接受，误判误拦会误伤）。
5. **存量数据**：迁移默认 `edit_enabled=true`、日期为空 → 存量教师不受影响。
6. **LiveView 管理台 / AshAdmin**：作为内部控制台，第一阶段不强制拦截，文档标注。
7. **学生端无改动**：所有逻辑以 `role == :teacher` 为前提，学生路径天然豁免。

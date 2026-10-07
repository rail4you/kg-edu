## 1. 后端资源与接口（Elixir/Ash）

- [x] 1.1 新增 `KgEdu.SystemConfig.SmartPortalLayout` 资源（public schema、key=default 单条 upsert、`layout: :map`、`enabled`）
- [x] 1.2 在 `KgEdu.SystemConfig` 域注册资源（并按需注册 `rpc_action`）
- [x] 1.3 `PageController` 新增 `@default_layout` 常量与 `get_smart_portal_layout` / `update_smart_portal_layout` 动作（公开读 + 超级管理员写，含首次种子）
- [x] 1.4 `router.ex` 的 `/api` scope 新增 `GET/PUT /smart-portal/layout`
- [x] 1.5 生成并执行迁移：`./dev.sh codegen <task>` + `./dev.sh migrate`

## 2. 前端类型与数据层

- [x] 2.1 新增 `src/lib/smart-portal.ts`：`PortalBlock` / `SmartPortalLayout` / `BlockType` 类型，`fetchSmartPortalLayout` / `fetchSmartPortalLayoutAdmin` / `saveSmartPortalLayout`（含读取容错与默认值补齐）
- [x] 2.2 新增 `src/components/smart-portal/use-smart-portal-data.ts`：并行拉取租户课程/视频/习题/学生计数与知识点，`Promise.allSettled` + `useQuery` 缓存，支持传入预览租户

## 3. 组件库与渲染器

- [x] 3.1 新增 `src/components/smart-portal/registry.tsx`：`BlockDef` / `FieldDef` 类型与 `BLOCK_REGISTRY`
- [x] 3.2 实现组件：`stats`、`chart`（echarts bar/pie/line）、`course-list`（card/text/table）、`knowledge-points`、`carousel`、`text`、`image`、`video`、`icon-nav`、`table`、`search`（联动列表过滤）、`date`、`ip`、`map`、`plugin`
- [x] 3.3 新增 `src/components/smart-portal/ConfigForm.tsx`：按 `configFields` 渲染 text/number/textarea/select/switch/options 参数编辑
- [x] 3.4 新增 `src/components/smart-portal/SmartPortalRenderer.tsx`：`Row`/`Col` 栅格渲染、未知类型降级、echarts 自适应 resize

## 4. 管理端编辑器

- [x] 4.1 新增 `src/pages/admin/smart-portal.tsx`：加载/保存布局、三栏布局（组件面板 / 画布 / 配置抽屉）
- [x] 4.2 用 `@dnd-kit` 实现面板拖入与画布内拖拽排序（`SortableContext` / `useSortable`）
- [x] 4.3 右侧配置抽屉：编辑标题、`span` 宽度、组件私有参数；支持删除/复制块
- [x] 4.4 顶部工具栏：预览开关（只读渲染）、预览租户选择、保存、重置
- [x] 4.5 `admin-menu-config.tsx` 超级管理员项新增「智慧门户」；`use-page-title.ts` 增加标题

## 5. 学生端页面与入口

- [x] 5.1 新增 `src/pages/student/smart-portal.tsx`：读取布局并用 `SmartPortalRenderer` 渲染（含空态）
- [x] 5.2 `App.tsx` 新增路由 `/admin/dashboard/smart-portal` 与 `/dashboard/smart-portal`
- [x] 5.3 `student-layout.tsx` 的 `navGroups`「内容」组新增「智能门户」导航项
- [x] 5.4 `user-menu.tsx` 学生操作区新增「智能门户」按钮

## 6. 验证

- [x] 6.1 后端接口冒烟：`curl` 读取与保存 `/api/smart-portal/layout`
- [x] 6.2 管理端：添加/配置/保存/预览全流程（browser 验证）
- [x] 6.3 学生端：`/dashboard/smart-portal` 渲染租户动态数据与图表（browser 验证）
- [x] 6.4 学生菜单「智能门户」入口跳转可用
- [x] 6.5 `npm run build` 通过；`npm run lint`（若存在）通过

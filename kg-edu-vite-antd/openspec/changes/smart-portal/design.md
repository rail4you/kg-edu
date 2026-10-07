## Context

系统已有两类「门户」相关能力可作为基础：

- 全局配置资源模式：`KgEdu.SystemConfig.SiteContentConfig` / `BrandingConfig`（public schema、单条 key upsert、超级管理员可写、公开可读），对应路由在 `lib/kg_edu_web/router.ex` 的 `scope "/api"`，控制器逻辑在 `lib/kg_edu_web/controllers/page_controller.ex`。
- 前端组件化数据展示先例：`src/pages/portal-showcase.tsx` 已演示如何通过 `/rpc/run` 拉取租户的 `list_courses` / `list_users` / `list_videos` / `list_exercises` 并用 `echarts` 出图。

已有依赖：`echarts` ^6、`@dnd-kit/core` ^6 / `@dnd-kit/sortable` ^10 / `@dnd-kit/utilities` ^3（目前仅 `teacher/chapter.tsx` 使用）。前端无页面搭建/JSON Schema 表单库。

## Goals / Non-Goals

**Goals:**
- 管理员通过拖放/分栏组合可配置组件，拼装智慧门户页面
- 组件参数可配置（数据来源、条数、图表类型、宽度、标题等）
- 组件数据来自当前租户的动态内容（课程、知识点、习题、视频等），图表可见
- 管理端提供实时预览；学生端展示同一布局
- 学生账户菜单与学生导航提供「智能门户」入口
- 复用现有全局配置与 RPC 模式，最小化后端改动

**Non-Goals:**
- 不做多套布局/多版本发布与回滚（仅单条全局布局 + 草稿即保存）
- 不做任意 HTML/JS 注入或第三方插件运行时
- 不做真正的自由像素级画布（采用 12 栅格 + 拖拽排序，而非绝对定位）
- 不做门户的 A/B 测试或按角色差异化布局（本迭代所有学生共享同一布局）

## Decisions

### 1. 数据模型：全局单条 JSON 布局

新增 `KgEdu.SystemConfig.SmartPortalLayout`（public schema，非租户），字段：

```elixir
attribute :key, :string                 # 固定 "default"，upsert 幂等
attribute :name, :string                # 布局名称（默认「智慧门户」）
attribute :layout, :map                 # JSON：{ version, blocks: [...] }
attribute :enabled, :boolean, default: true
timestamps()
```

理由：布局是「呈现配置」，与站点内容/品牌一样属于平台级配置，由超级管理员维护；租户动态数据在**渲染时**按访问者租户拉取，无需把数据写进配置。避免为每个租户维护独立布局的复杂度（列入 Non-Goals）。

`layout` JSON 结构：

```ts
interface SmartPortalLayout {
  version: 1;
  blocks: PortalBlock[];
}
interface PortalBlock {
  id: string;            // 前端生成的稳定 id
  type: BlockType;       // "stats" | "chart" | "course-list" | ...
  title?: string;
  span: number;          // 1..24（Ant Design 栅格，响应式 xs=24）
  config: Record<string, unknown>; // 组件私有参数
}
```

### 2. 后端接口（沿用 page_controller 模式）

| Method | Path | 权限 | 说明 |
|--------|------|------|------|
| GET | `/api/smart-portal/layout` | 公开 | 读取布局；无记录时写入并返回默认布局 |
| PUT | `/api/smart-portal/layout` | 超级管理员 | 全量保存 `{ name, layout, enabled }` |
| GET | `/api/client-ip` | 公开 | 返回调用方 IP（X-Forwarded-For → remote_ip），供 IP 组件展示 |

默认布局由控制器内 `@default_layout` 常量提供（与 `@default_pages` 同模式），保证首次读取即有内容。可选：在 `KgEdu.SystemConfig` 域注册 `rpc_action`，保持与其它系统配置一致（如注册 `get_smart_portal_layout` / `save_smart_portal_layout`）。

### 3. 前端组件注册表（registry）驱动一切

`src/components/smart-portal/registry.tsx` 导出：

```ts
interface BlockDef<C = any> {
  type: BlockType;
  label: string;                       // 组件面板显示名
  icon: ReactNode;
  defaultSpan: number;
  defaultTitle?: string;
  createDefault: () => C;              // 新增时的默认参数
  configFields: FieldDef[];            // 参数配置表单描述（标题/宽度 + 私有参数）
  Render: React.FC<{ block: PortalBlock; data: PortalData }>;
}
const BLOCK_REGISTRY: Record<BlockType, BlockDef>;
const BLOCK_FIELD_TYPES = ...          // "text" | "number" | "textarea" | "select" | "switch" | "options"
```

组件（Block）类型（首版）：

| type | 说明 | 关键参数 |
|------|------|----------|
| `stats` | 数据统计条 | `metrics: ("courses"\|"students"\|"videos"\|"exercises")[]` |
| `chart` | 图表（echarts） | `chartType: bar\|pie\|line`、`metrics` |
| `course-list` | 课程列表 | `limit`、`layout: card\|text\|table` |
| `knowledge-points` | 知识点列表 | `limit`、`source` |
| `carousel` | 轮播图 | `limit`、`autoPlay`（数据源：租户课程） |
| `text` | 图文/文本 | `content`（支持 Markdown 简版）、`align` |
| `image` | 图片 | `src`、`link`、`caption` |
| `video` | 视频 | `src`、`poster` |
| `icon-nav` | 图标导航 | `items: {label, icon, to}[]` |
| `table` | 表格 | `source: courses\|students`、`limit` |
| `search` | 搜索条 | `placeholder`（设置门户内关键词，列表类组件消费） |
| `date` | 日期 | `mode: date\|time`、`showWeekday`、`showTime` |
| `ip` | IP | `label`（优先后端 `/api/client-ip`，回退公共 IP 服务） |
| `map` | 地图 | `bbox`、`height`（OpenStreetMap 嵌入） |
| `plugin` | 插件槽位 | `label`、`description`（只读演示，无跳转） |

渲染器 `SmartPortalRenderer` 用 `Row`/`Col`（`span` + `xs=24`）布局，遍历 `blocks` 按 registry 分派 `Render`，未知类型降级为占位提示。

参数表单由 `configFields` 描述 + 一个通用 `ConfigForm` 渲染（textarea/number/select/switch/options 编辑器），避免引入重量级表单库。

### 4. 租户数据获取：统一 data hook

`src/components/smart-portal/use-smart-portal-data.ts`：

- 复用 `portal-showcase.tsx` 的 `/rpc/run` 调用方式（`getAuthHeaders` + `sessionStorage` 的 `tenant` / `jwt_access_token`）
- 并行拉取：课程列表（`list_courses`）、视频数（`list_videos`）、习题数（`list_exercises`）、学生数（`list_users`）；知识点使用 `list_knowledges` 并过滤 `knowledge_type == knowledge_cell`（真实课程知识点），携带 `course_id` 并与课程列表 join 出课程名
- 使用 `Promise.allSettled`，单源失败不阻塞；返回 `{ loading, courses, stats, knowledgePoints, errorSources }`
- 通过 `useQuery`（项目已用 `@tanstack/react-query`）缓存，`queryKey` 含 `tenant`

编辑器的「预览」通过传入一个可选的预览租户（下拉选择当前账号可见租户或手动填 schema）复用同一 hook。

### 5. 编辑器架构（管理端）

`src/pages/admin/smart-portal.tsx`：

- 三栏：左 `BlockPalette`（组件面板，点击或 `dnd-kit` 拖入画布）、中 `BlockCanvas`（`SortableContext` + `useSortable`，支持拖拽排序；每块显示标题/类型/宽度，悬停出现删除、复制、编辑）、右 `ConfigDrawer`（通用 `ConfigForm` 编辑选中块的标题/宽度/参数）
- 顶部工具栏：租户/预览数据选择 + 「预览」开关（开启时中栏替换为只读 `SmartPortalRenderer`）+ 保存 + 重置
- 保存调用 `saveSmartPortalLayout`；加载用 `fetchSmartPortalLayoutAdmin`
- 拖拽放置实现：用 `dnd-kit` 的 `DndContext` 区分「面板拖入」与「画布内排序」（不同 `id` 前缀 / `data.current.type`）

### 6. 学生端页面与入口

- `src/pages/student/smart-portal.tsx`：`/dashboard/smart-portal`，`fetchSmartPortalLayout()` 拿布局，`SmartPortalRenderer` 渲染；布局为空/失败时展示友好空态
- 入口 A：`student-layout.tsx` 的 `navGroups`「内容」组新增 `{ key: "/dashboard/smart-portal", label: "智能门户", icon: <AppstoreOutlined /> }`
- 入口 B：`user-menu.tsx` 中 `role === "student"` 的操作区新增「智能门户」按钮，`navigate("/dashboard/smart-portal")`
- 管理端入口：`admin-menu-config.tsx` 超级管理员项新增 `{ key: "smart-portal", label: "智慧门户", ... }`，路由 `/admin/dashboard/smart-portal`
- 标题：`use-page-title.ts` 增加 `smart-portal → 智慧门户`

### 7. 复用而非新建

- 不修改 `/teacher/dashboard/portal`（`portal-showcase`）现有演示页；新功能落在 `smart-portal` 命名空间，避免混淆
- 图表统一用 `echarts`，与全站一致；拖拽统一用 `@dnd-kit`
- 后端沿用 `PageController`（REST `/api/*`）而非 Ash RPC，与 `site-content` / `portal-config` 一致

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| `layout` 存 `:map` 但不做 schema 校验，旧/脏数据可能渲染异常 | 前端读取时做容错：过滤未知 `type`、补齐 `span`/`config` 默认值；后端保存前仅做基本结构校验 |
| 组件越多，编辑器的参数表单越复杂 | 用 `configFields` 描述式表单，新增组件只改 registry，不改编辑器 |
| 租户动态数据在预览时需管理员处于对应租户上下文 | 预览提供租户选择；管理员若无该租户权限则回退为「仅结构预览（无数据）」 |
| echarts 在栅格变宽/预览切换时不重绘 | Renderer 用 `ResizeObserver` / `chart.resize()`（参考 `@/components/PanoramaGraph`）|
| 单条全局布局无法满足多租户差异化 | 明确列入 Non-Goals，后续可扩展 layout 按 tenant 维度（预留 `key` 字段） |

## Migration Plan

1. 新增资源与迁移（`mix ash.codegen` / `./dev.sh codegen`，`./dev.sh migrate`）
2. 上线后首次 `GET /api/smart-portal/layout` 自动写入默认布局，学生端立即可用
3. 前端编辑器/学生端灰度不影响现有门户首页与 `portal-showcase`

## Open Questions

- 知识点数据源用「知识层级嵌套接口」还是 `list_knowledge_points` RPC？（实现时以实际可用接口为准）
- 是否需要「按角色/年级显示不同布局」？（当前 Non-Goals，视反馈再定）

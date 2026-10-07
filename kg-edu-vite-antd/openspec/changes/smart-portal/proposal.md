## Why

当前系统的「门户」是两套割裂的实现：面向公众的门户首页（`home.tsx` + 模板页）用关系型配置驱动，但结构固定；而 `portal-showcase.tsx`（`/teacher/dashboard/portal`）只是一个硬编码的组件演示页，无法配置、无法组合、也不对学生开放。

用户需要一个真正可配置的「智慧门户」：管理员可以像搭积木一样选择组件（课程列表、知识点、图表、轮播、文本、视频等），为每个组件配置参数（数据来源、条数、图表类型、宽度等），以拖放或分栏组合的方式拼装成一个页面，并能实时预览效果。该页面在学生端展示，数据取自学生所在租户的动态内容（课程、知识点、习题等），并在学生账户菜单提供「智能门户」入口。

## What Changes

1. **新增可配置的智慧门户布局（后端）**
   - 新增全局配置资源 `SmartPortalLayout`（存储 JSON 布局），沿用现有 `SiteContentConfig` 的单条 upsert 模式
   - 提供公开读取接口（学生端渲染）与超级管理员读写接口（编辑器）
   - 首次读取时写入一份默认布局（课程列表 + 数据统计 + 图表 + 文本）

2. **新增门户组件库 + 渲染器（前端）**
   - 定义组件（Block）类型与参数 schema：数据统计、图表、课程列表、知识点列表、轮播、图文/文本、图片、视频、图标导航、表格、搜索条、日期、IP、地图、插件槽位等
   - `SmartPortalRenderer` 按 12 栅格布局渲染 Block；每个 Block 独立拉取租户动态数据（复用现有 `/rpc/run` 与知识层级接口）
   - 统一的数据 Hook 缓存各数据源，单个数据源失败不影响其它组件

3. **新增管理端「智慧门户」编排编辑器**
   - 左侧组件面板（点击/拖放添加），中间画布（`@dnd-kit` 拖拽排序 + 宽度分栏），右侧参数配置抽屉
   - 支持编辑组件标题、栅格宽度、以及组件各自参数
   - 提供「预览」开关，可在编辑器内以选定租户数据实时预览最终效果
   - 保存/重置布局

4. **新增学生端智慧门户页与入口**
   - 学生端路由 `/dashboard/smart-portal` 渲染已保存布局
   - 学生账户菜单（`UserMenu`）与学生侧边导航新增「智能门户」入口

## Capabilities

### New Capabilities
- `smart-portal`: 可配置的智慧门户——组件化、参数化、可拖放编排，管理端实时预览，学生端展示租户动态数据与图表，并提供学生端入口。

## Impact

- **后端 (Elixir/Ash)**: 新增 `SystemConfig.SmartPortalLayout` 资源、路由与 `PageController` 动作、数据库迁移
- **前端**: 新增 `src/lib/smart-portal.ts`、`src/components/smart-portal/*`（registry / renderer / widgets / 数据 hook）、管理端编辑器页、学生端展示页
- **路由/菜单**: `App.tsx` 新增 `/admin/dashboard/smart-portal` 与 `/dashboard/smart-portal`；`admin-menu-config.tsx`、`student-layout.tsx`、`user-menu.tsx`、`use-page-title.ts` 增加入口
- **依赖**: 复用已有 `echarts` 与 `@dnd-kit/*`，无需新增依赖

# 学生端页面 · 交互原型风格改造（设计与进度文档）

参照物：`易课程-完整交互原型.html`（角色 `student`）。
要求：保留全部数据对接与功能，仅调整前端样式/布局。

## 原型样式基线（已抽取为设计系统）

- 设计变量与工具类：`src/styles/proto-ui.css`（`--pu-*` 变量、`.pu-page/.pu-card/.pu-stat/.pu-tabs/.pu-item/...`）
- 通用组件：`src/components/proto/index.tsx`（`PageHead / ProtoCard / StatGrid / ProtoTabs / ListItem / ProtoTag / ProgressBar / ProtoEmpty / MetricList`）
- 在 `src/main.tsx` 全局引入，页面根节点加 `className="pu-page"` 即可获得统一的卡片/表格/标签页/分页antd 覆盖样式。

## 页面处理顺序（按原型学生端导航）

| # | 原型页面 | 前端路由 | 文件 | 状态 |
|---|----------|----------|------|------|
| 1 | 课程概述 | `/dashboard/overview` | `src/pages/student/overview.tsx` | ✅ 已完成 |
| 2 | 课程概览 | `/dashboard/intro` | `src/pages/student/course-intro.tsx` | ✅ 已完成 |
| 3 | 图谱总览 | `/dashboard/graph` | `src/pages/student/graph.tsx` | ✅ 已完成 |
| 4 | 课程视频 | `/dashboard/course-video` | `src/pages/student/course-video.tsx` | ✅ 已完成 |
| 5 | 认知目标 | `/dashboard/knowledge-cognitive-goals` | `src/pages/student/knowledge-cognitive-goals.tsx` | ✅ 已完成 |
| 6 | 教学资源 | `/dashboard/resource` | `src/pages/student/resource.tsx` | ✅ 已完成 |
| 7 | 学习推荐 | `/dashboard/learning-recommendations` | `src/pages/student/learning-recommendations.tsx` | ✅ 已完成 |
| 8 | 互动课堂 | `/dashboard/interaction` | `src/pages/student/interaction-hub.tsx` | ✅ 已完成 |
| 9 | 考试系统 | `/dashboard/exam-courses` | `src/pages/student/exam-courses.tsx` | ✅ 已完成 |
| 10 | 实验系统 | `/dashboard/experiment-courses` | `src/pages/student/experiment-courses.tsx` | ✅ 已完成 |
| 11 | 数据表单 | `/dashboard/data-forms` | `src/pages/student/data-forms.tsx` | ✅ 已完成 |
| 12 | 教师团队 | `/dashboard/teacher` | `src/pages/student/course-teachers.tsx` | ✅ 已完成 |
| 13 | 邮件问答 | `/dashboard/email-qa` | `src/pages/student/email-qa.tsx` | ✅ 已完成 |
| 14 | AI 助手 | `/dashboard/chat` | `src/pages/student/chat.tsx` | ✅ 已完成 |
| 15 | 我的微专业 | `/dashboard/micro-majors` | `src/pages/student/micro-majors.tsx` | ✅ 已完成 |

## 附属页面（二级）

| 原型场景 | 前端路由 | 文件 | 状态 |
|----------|----------|------|------|
| 考试作答 | `/dashboard/exam-taking/:examId` | `exam-taking.tsx` | ✅ 已完成 |
| 考试列表 | `/dashboard/exam-list/:courseId` | `exam-list.tsx` | ✅ 已完成 |
| 实验详情 | `/dashboard/experiment-detail/:id` | `experiment-detail.tsx` | ✅ 已完成 |
| 我的表单 | `/dashboard/my-forms` | `my-forms.tsx` | ✅ 已完成 |
| 图谱层级 | `/dashboard/graph-layer` | `graph-layer.tsx` | ✅ 已完成 |
| 课程知识体系 | `/dashboard/graph-category` | `graph-category.tsx` | ✅ 已完成 |
| 使用手册 | `/dashboard/manual` | `manual.tsx` | ✅ 已完成 |
| 智能门户 | `/dashboard/smart-portal` | `smart-portal.tsx` | ✅ 已完成 |
| 互动故事 | `/dashboard/ai-qa` | `ai-qa.tsx` | ✅ 已完成 |

## 顺带修复的前端 bug（非样式，但阻塞页面渲染）

- `micro-majors.tsx`：`certPreviewOpen` / `setCertPreviewOpen` / `previewCert` / `setPreviewCert` 未声明，导致整页 `ReferenceError: certPreviewOpen is not defined` 白屏。已补上 `useState`。
- `micro-majors.tsx`：`<Card>` 上重复写了两个 `style` 属性（后者覆盖前者，`opacity` 丢失）。已合并。

## 校验

- `tsc --noEmit`：错误数 276 → 258（未引入新错误）
- `npm run build`：通过
- `eslint`：改动文件未新增未使用变量/导入（对比改造前后 eslint 输出）
- 路由冒烟（Playwright，登录 `chen / cjr123456`）：24 条学生端路由全部渲染，**0 个 pageerror**
- 移动端（390×844）抽查：卡片、统计栅格、标签页均正常降级

## 设计要点速查

| 元素 | 规格 |
|------|------|
| 卡片 | `#fff` + `1px solid #e3e9f1` + `14px` 圆角 + `24px` 内边距，无重阴影 |
| 页面头 | 29px/650 标题 + 14px `#64748b` 说明，右侧操作区 |
| 指标卡 | 数字 32px/650，图标在右上角浅蓝底方块 |
| 标签页 | 下划线式，激活项 3px 主色下边框 + 650 字重 |
| 表格 | 表头 `#f6f8fc` / `#64748b` 14px；单元格 17px × 14px；分割线 `#edf0f5` |
| 标签 pill | 圆角 5px，12px，绿/蓝/琥珀/灰/红五色 |
| 列表行 | `.pu-item` 15px 分隔线 + 35px 圆角序号块 |
| 进度条 | 6px 高，`#edf1f7` 底 + 主色填充 |
| 欢迎横幅 | `#eef3fb` 底 + `#e4ebf4` 边框 + 14px 圆角，左右分栏 |

## 尚未改造的页面（下一批）

以下 8 个页面**可以点进去使用**，本轮未改造，样式仍为改造前的状态：

| 页面 | 入口 / 路由 | 文件 | 说明 |
|------|-------------|------|------|
| 课堂讨论 | 互动课堂 → 进入讨论；`/student/discussion/:tenantSchema/:token` | `discussion.tsx` | 内嵌模式（`embedded`）时在互动课堂卡片内渲染 |
| 小组任务 | 互动课堂 → 进入任务；`/student/group-task/:tenantSchema/:token` | `group-task.tsx` | 同上 |
| 岗位能力图谱 | 图谱总览 → 岗位能力图谱 Tab | `job-competency-graph.tsx` | 作为子组件被 `graph.tsx` 引用，仅外层卡片已随图谱页统一 |
| 课程信息 | `/dashboard/course-info/:courseId` | `course-info.tsx` | 兼容旧链接 |
| 课程体系 | `/dashboard/curriculum` | `curriculum.tsx` | 微专业课程体系 |
| 微专业课程 | `/student/mm-course` | `mm-course-page.tsx` | 独立路由（不在学生端 Layout 内） |
| 学习动态 | 我的微专业 → 学习动态；`/student/mm-timeline` | `mm-timeline.tsx` | 独立路由 |
| 课堂签到 | 二维码链接 `/student/check-in/:tenantSchema/:token` | `check-in.tsx` | 免登录公开页，面向手机 |

### 无需处理

- `front.tsx`（课程落地页 `/dashboard/front`）：已按门户风格单独改版。
- 死代码（全项目无引用，不受影响）：`knowledge.tsx`、`course-summary.tsx`、`dashboard.tsx`、`mm-course.tsx`。
- `discussion-hub.tsx`、`group-task-hub.tsx`、`graph-competency.tsx`：`App.tsx` 中有 import 但未挂到任何 Route，实际不可达。

改造方式与已完成页面一致：不动数据逻辑，只套用 `src/styles/proto-ui.css` + `src/components/proto` 的 `PageHead / ProtoCard / ProtoTag / ProtoTabs / ListItem / StatGrid` 与 `.pu-*` 工具类。

## 截图对照

- 改造前：`/tmp/shots/before/*.png`
- 改造后：`/tmp/shots/after/*.png`
- 截图脚本：`/tmp/shots/shot.mjs`（自动登录 `chen / cjr123456` + 选择租户）

# KgEdu 三大功能模块开发计划

> 生成日期: 2026-05-12
> 基于: 教师需求反馈，三个功能方向

---

## 开发进度

### 阶段一：分组任务 - 后端已完成，前端已完成

**后端已完成文件：**
- `backend/kg_edu/lib/kg_edu/group_task.ex` - 域定义 (Domain)
- `backend/kg_edu/lib/kg_edu/group_task/group.ex` - 学习小组资源
- `backend/kg_edu/lib/kg_edu/group_task/group_member.ex` - 小组成员关联
- `backend/kg_edu/lib/kg_edu/group_task/task.ex` - 分组任务资源
- `backend/kg_edu/lib/kg_edu/group_task/task_group.ex` - 任务-小组关联
- `backend/kg_edu/lib/kg_edu/group_task/task_submission.ex` - 任务提交资源
- `config/config.exs` - 添加 KgEdu.GroupTask 到 ash_domains
- `lib/kg_edu_web/ash_json_api_router.ex` - 添加到 API 路由

**前端已完成文件：**
- `kg-edu-vite-antd/src/pages/teacher/group-management.tsx` - 分组管理页面
- `kg-edu-vite-antd/src/pages/teacher/group-task.tsx` - 分组任务管理页面
- `kg-edu-vite-antd/src/pages/student/group-task.tsx` - 学生扫码任务页面
- `kg-edu-vite-antd/src/App.tsx` - 路由注册
- `kg-edu-vite-antd/src/layouts/teacher-layout.tsx` - 菜单注册
- `kg-edu-vite-antd/src/locales/use-locales.ts` - 国际化翻译

**后端已完成文件：**
- `backend/kg_edu/lib/kg_edu/major_analysis.ex` - 域定义
- `backend/kg_edu/lib/kg_edu/major_analysis/major.ex` - 专业资源
- `backend/kg_edu/lib/kg_edu/major_analysis/job_position.ex` - 岗位信息（含 AI 分析 action）
- `backend/kg_edu/lib/kg_edu/major_analysis/major_competency.ex` - 专业能力素质（树形结构）
- `backend/kg_edu/lib/kg_edu/major_analysis/curriculum_design.ex` - 课程体系设计（含 AI 生成）
- `backend/kg_edu/lib/kg_edu/major_analysis/analysis_report.ex` - 分析报告（含 AI 生成）
- `config/config.exs` - 添加 KgEdu.MajorAnalysis 到 ash_domains
- `lib/kg_edu_web/ash_json_api_router.ex` - 添加到 API 路由

**前端已完成文件：**
- `kg-edu-vite-antd/src/pages/teacher/major-list.tsx` - 专业管理页面
- `kg-edu-vite-antd/src/pages/teacher/major-detail.tsx` - 专业详情总览（含子模块入口卡片）
- `kg-edu-vite-antd/src/pages/teacher/major-jobs.tsx` - 岗位管理与分析页面
- `kg-edu-vite-antd/src/pages/teacher/major-competency.tsx` - 能力图谱构建页面
- `kg-edu-vite-antd/src/pages/teacher/major-curriculum.tsx` - 课程体系设计页面
- `kg-edu-vite-antd/src/pages/teacher/major-report.tsx` - 分析报告页面
- `kg-edu-vite-antd/src/App.tsx` - 路由注册
- `kg-edu-vite-antd/src/layouts/teacher-layout.tsx` - 菜单注册
- `kg-edu-vite-antd/src/locales/use-locales.ts` - 国际化翻译
**所有阶段通用待完成：**
- [ ] 运行 `mix ash.codegen add_group_task_and_major_analysis` 生成数据库迁移
- [ ] 运行 `mix ash.migrate` 执行迁移
- [ ] 重启后端服务: `./dev.sh restart backend`
- [ ] 重新生成前端 RPC 类型: `mix ash_typescript.generate`

### 阶段二：学生学情画像 - 后端已完成，前端已完成

**后端已完成文件：**
- `backend/kg_edu/lib/kg_edu/knowledge/student_profile.ex` - 学生画像聚合服务模块
- `backend/kg_edu/lib/kg_edu/knowledge/student_knowledge_mastery.ex` - 添加 6 个画像查询 action
- `backend/kg_edu/lib/kg_edu/knowledge.ex` - 注册画像 RPC actions

**前端已完成文件：**
- `kg-edu-vite-antd/src/pages/teacher/student-profile.tsx` - 学情画像页面（雷达图+饼图+趋势图+柱状图+薄弱知识点表格）
- `kg-edu-vite-antd/src/App.tsx` - 路由注册
- `kg-edu-vite-antd/src/layouts/teacher-layout.tsx` - 菜单注册
- `kg-edu-vite-antd/src/locales/use-locales.ts` - 国际化翻译

### 阶段三：专业分析 - 后端已完成，前端已完成


---



---

## 目录

1. [功能一：分组任务](#功能一分组任务)
2. [功能二：学生学情画像](#功能二学生学情画像)
3. [功能三：专业分析](#功能三专业分析)
4. [技术架构概览](#技术架构概览)
5. [实施顺序与里程碑](#实施顺序与里程碑)

---

## 技术架构概览

### 现有技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端 | Phoenix + Ash Framework | Ash Resource 域模型, AshTypescript RPC 通信 |
| 数据库 | PostgreSQL | 多租户架构 (tenant context) |
| 前端 | Vite + React + TypeScript + Ant Design | ProLayout, ECharts 图表 |
| AI 服务 | .NET (F#) 独立服务 | AI 生成、流式聊天 |
| 通信 | AshTypescript RPC + JSON API | 类型安全的 API 调用 |

### 现有相关模式参考

| 功能模式 | 参考文件 | 说明 |
|----------|----------|------|
| 二维码分发 | `attendance/check_in_session.ex` | token + QRCode，学生扫码参与 |
| 学习分析 | `knowledge/learning_analyzer.ex` | 考试/练习数据分析，掌握度更新 |
| 知识掌握度 | `knowledge/student_knowledge_mastery.ex` | 学生知识点掌握度追踪 |
| 图表展示 | `pages/teacher/study-summary.tsx` | ECharts 图表（柱状图、饼图、趋势图）|
| 能力模型 | `knowledge/main_ability.ex`, `sub_ability.ex` | 主能力 → 子能力层级结构 |
| AI Agent | `ai-agent/KgAgent/` | .NET 服务，AI 生成能力 |

### 关键目录结构

```
backend/kg_edu/lib/kg_edu/          # 后端 Ash 资源
  ├── courses/                       # 课程相关资源
  ├── knowledge/                     # 知识/能力/考试/学习分析
  ├── activity/                      # 活动日志
  ├── attendance/                    # 签到（token+QR模式参考）
  ├── ai/                            # AI 命令
  └── accounts/                      # 用户/组织/班级

kg-edu-vite-antd/src/               # 前端
  ├── pages/teacher/                 # 教师端页面
  ├── pages/student/                 # 学生端页面
  ├── lib/ash_rpc.ts                 # AshTypescript 生成的 RPC 客户端
  ├── lib/agent_api.ts               # AI Agent API 封装
  ├── layouts/teacher-layout.tsx     # 教师端菜单布局
  └── hooks/                         # 自定义 Hooks

ai-agent/KgAgent/                    # .NET AI 服务
  ├── Controllers/
  ├── Services/
  └── Models/
```

---

## 功能一：分组任务

### 需求描述

教师在课堂互动中创建学生分组，布置分组任务，通过二维码分发给学学生参与，教师端可跟踪每组/每人的完成情况和进度。

### 数据模型设计

#### 1. 学习小组 (Group)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | string | 小组名称 |
| course_id | UUID | 所属课程 |
| description | text | 小组描述 |
| max_members | integer | 最大人数（可选） |
| created_by | UUID | 创建者（教师） |
| tenant | context | 多租户 |

关系：
- has_many: group_members (GroupMember)
- has_many: group_tasks (GroupTask)
- belongs_to: course (Course)
- belongs_to: created_by (User)

#### 2. 小组成员 (GroupMember)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| group_id | UUID | 所属小组 |
| student_id | UUID | 学生用户 ID |
| role | atom | 角色: leader / member |
| joined_at | datetime | 加入时间 |

#### 3. 分组任务 (GroupTask)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| title | string | 任务标题 |
| description | text | 任务描述 |
| course_id | UUID | 所属课程 |
| task_type | atom | 类型: submission / discussion / survey / file_upload |
| status | atom | 状态: draft / active / closed |
| token | string | 唯一 token（用于二维码分发） |
| due_date | datetime | 截止日期 |
| created_by | UUID | 创建者 |
| publish_at | datetime | 发布时间 |

#### 4. 任务提交 (GroupTaskSubmission)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| task_id | UUID | 关联任务 |
| group_id | UUID | 关联小组 |
| student_id | UUID | 提交学生 |
| content | text | 提交内容（文本） |
| file_url | string | 附件 URL |
| status | atom | 状态: pending / submitted / graded |
| score | float | 评分（可选） |
| feedback | text | 教师反馈 |
| submitted_at | datetime | 提交时间 |

### 后端实现

#### 新建 Ash 域：`KgEdu.GroupTask`

文件列表：
```
backend/kg_edu/lib/kg_edu/
  ├── group_task.ex                          # 域定义 (Domain)
  └── group_task/
      ├── group.ex                           # 学习小组资源
      ├── group_member.ex                    # 小组成员资源
      ├── task.ex                            # 分组任务资源
      └── task_submission.ex                 # 任务提交资源
```

**域定义** (`group_task.ex`)：
- 注册 JSON API 路由
- 注册 AshTypescript RPC actions
- 配置 code_interface

**Group 资源** (`group.ex`)：
- CRUD actions: create, read, update, destroy
- 自定义 actions:
  - `add_members` - 批量添加成员
  - `remove_member` - 移除成员
  - `random_grouping` - 随机分组（将课程学生随机分成 N 组）
  - `by_course` - 按课程查询小组
- Relationships: members, tasks, course, creator
- 多租户: `strategy :context`

**GroupMember 资源** (`group_member.ex`)：
- CRUD actions
- 自定义 actions:
  - `by_group` - 按小组查询成员
  - `by_student` - 查询学生所在的所有小组
- 唯一约束: group_id + student_id

**Task 资源** (`task.ex`)：
- CRUD actions
- 自定义 actions:
  - `publish` - 发布任务（生成 token，设置状态为 active）
  - `close` - 关闭任务
  - `by_token` - 通过 token 查询（学生扫码入口）
  - `by_course` - 按课程查询任务
  - `get_progress` - 获取任务完成进度统计
- Token 生成逻辑参考 `check_in_session.ex`

**TaskSubmission 资源** (`task_submission.ex`)：
- CRUD actions
- 自定义 actions:
  - `submit` - 学生提交任务
  - `grade` - 教师评分
  - `by_task` - 按任务查询提交
  - `by_task_and_group` - 按任务+小组查询提交
  - `get_submission_stats` - 获取提交统计

#### 路由注册

在 `lib/kg_edu_web/router.ex` 中添加:
```elixir
# GroupTask JSON API routes (在 api pipeline 中)
scope "/api", KgEduWeb do
  # ... existing routes
end
```

在 AshJsonApi 和 AshTypescript RPC 中注册路由。

#### 数据库迁移

```bash
mix ash.codegen add_group_task_module
```

### 前端实现

#### 教师端页面

| 页面文件 | 路由 | 功能 |
|----------|------|------|
| `pages/teacher/group-management.tsx` | `/teacher/dashboard/group-management` | 小组管理（创建、编辑、分配成员） |
| `pages/teacher/group-task.tsx` | `/teacher/dashboard/group-task` | 分组任务管理（创建任务、查看进度） |
| `pages/teacher/group-task-progress.tsx` | `/teacher/dashboard/group-task-progress/:taskId` | 任务进度详情（查看各组提交情况） |

**group-management.tsx 功能**：
- 课程选择器 → 显示该课程下的所有小组
- 创建小组（手动选择学生 / 随机分组）
- 编辑小组（添加/移除成员，设置组长）
- 小组列表展示（成员头像、人数、任务数）

**group-task.tsx 功能**：
- 任务列表（状态标签：草稿/进行中/已结束）
- 创建/编辑任务表单
  - 关联课程 → 选择参与小组
  - 任务类型：提交类/讨论类/投票类/文件上传类
  - 截止日期
- 发布任务 → 生成二维码弹窗
  - 二维码内容: `{frontend_url}/student/group-task/:tenantSchema/:token`
  - 复制链接按钮
- 进度概览（每组完成率、提交数统计）

**group-task-progress.tsx 功能**：
- 各组提交情况表格
  - 组名、已提交人数/总人数、最新提交时间
  - 展开查看每个学生的提交详情
  - 评分、反馈功能
- 整体进度图表（ECharts 环形图）

#### 学生端页面

| 页面文件 | 路由 | 功能 |
|----------|------|------|
| `pages/student/group-task.tsx` | `/student/group-task/:tenantSchema/:token` | 扫码入口（无需登录或轻量认证） |
| `pages/student/group-tasks.tsx` | `/dashboard/group-tasks` | 我的分组任务列表（登录后） |

**group-task.tsx (扫码入口)**：
- 通过 token 获取任务信息
- 显示任务标题、描述、截止日期、所属小组
- 提交表单（文本 + 文件上传）
- 显示提交状态

**group-tasks.tsx (任务列表)**：
- 显示当前学生参与的未完成/已完成任务
- 任务卡片（标题、状态、截止日期、小组成员）

#### 导航菜单

在 `teacher-layout.tsx` 的 `课堂互动` 菜单组中添加:
```tsx
{
  path: "/teacher/dashboard/group-management",
  name: t("menu.groupManagement"),
  icon: <TeamOutlined />,
},
{
  path: "/teacher/dashboard/group-task",
  name: t("menu.groupTask"),
  icon: <CheckSquareOutlined />,
},
```

在 `App.tsx` 中注册路由。

#### 国际化

在 `locales/` 中添加菜单翻译:
```json
{
  "menu.groupManagement": "分组管理",
  "menu.groupTask": "分组任务"
}
```

---

## 功能二：学生学情画像

### 需求描述

整合学生多维度学习数据，构建动态数字画像，立体呈现学员知识掌握、学习行为与能力素养。

### 数据整合方案

基于已有数据源进行聚合分析：

| 数据源 | 现有资源 | 整合内容 |
|--------|----------|----------|
| 知识掌握度 | `StudentKnowledgeMastery` | 各知识点掌握率、薄弱知识点 |
| 考试成绩 | `StudentExam` | 考试分数、正确率、趋势 |
| 练习记录 | `ActivityLog` (exercise_submit) | 练习频率、正确率 |
| 视频学习 | `ActivityLog` (video_view) | 视频观看时长、完成率 |
| 文件访问 | `ActivityLog` (file_view) | 资料查阅频率 |
| 作业提交 | `ActivityLog` (homework_submit) | 作业完成率、及时性 |
| 能力维度 | `MainAbility` + `SubAbility` | 能力维度掌握情况 |
| 签到记录 | `CheckInRecord` | 出勤率 |
| 讨论参与 | `DiscussionReply` | 讨论参与度 |

### 后端实现

#### 扩展 Ash 资源/域

在 `KgEdu.Knowledge` 域中新增：

```
backend/kg_edu/lib/kg_edu/knowledge/
  └── student_profile.ex          # 学生画像聚合服务
```

**StudentProfile 模块** (非 Ash Resource，纯服务模块)：

```elixir
defmodule KgEdu.Knowledge.StudentProfile do
  # 聚合学生全维度学习数据
  def get_student_profile(student_id, course_id, opts)
  # 获取知识点掌握雷达图数据
  def get_knowledge_radar(student_id, course_id, opts)
  # 获取学习行为时间线
  def get_learning_timeline(student_id, course_id, opts)
  # 获取能力维度评估
  def get_ability_assessment(student_id, course_id, opts)
  # 获取学习趋势数据
  def get_learning_trend(student_id, course_id, opts)
  # 获取班级排名对比
  def get_class_comparison(student_id, course_id, opts)
end
```

每个函数内部通过 Ash.Query 聚合多个数据源的数据，返回结构化的统计结果。

**数据聚合逻辑**：

1. `get_student_profile/3` - 总览数据
   - 知识点总数 / 已掌握数 / 薄弱知识点数
   - 平均掌握度
   - 考试平均分 / 最高分 / 最低分
   - 活跃度指数（综合视频、文件、讨论等行为频率）
   - 出勤率
   - 作业完成率

2. `get_knowledge_radar/3` - 雷达图数据
   - 按主能力维度聚合子能力掌握度
   - 输出格式适配 ECharts radar

3. `get_ability_assessment/3` - 能力维度
   - 关联 MainAbility → SubAbility → KnowledgeResource → StudentKnowledgeMastery
   - 计算每个能力维度的加权得分

4. `get_learning_trend/3` - 学习趋势
   - 按周/月聚合活动日志
   - 学习时长趋势、练习正确率趋势

5. `get_class_comparison/3` - 班级对比
   - 聚合同课程/同班级所有学生的关键指标
   - 计算排名、百分位

#### 在 Knowledge 域注册 RPC

在 `lib/kg_edu/knowledge.ex` 的 `typescript_rpc` 块中添加:
```elixir
# StudentProfile 相关的 RPC actions
# (通过自定义 read action 暴露)
```

可以在 `StudentKnowledgeMastery` 资源上添加聚合查询 action:
- `student_profile_overview` - 画像总览
- `student_knowledge_radar` - 雷达图数据
- `student_ability_assessment` - 能力评估
- `student_learning_trend` - 学习趋势
- `student_class_comparison` - 班级对比

### 前端实现

#### 教师端页面

| 页面文件 | 路由 | 功能 |
|----------|------|------|
| `pages/teacher/student-profile.tsx` | `/teacher/dashboard/student-profile` | 学生学情画像总览 |

**student-profile.tsx 功能**：

1. **课程选择** + **学生选择**（顶部筛选器）

2. **总览卡片**（4 个统计指标）
   - 知识掌握度（百分比 + 进度条）
   - 学习活跃度（活跃指数 0-100）
   - 考试成绩（平均分 + 趋势箭头）
   - 出勤率（百分比）

3. **知识掌握雷达图**（ECharts Radar）
   - 维度：各主能力维度
   - 数据：学生对每个能力维度的平均掌握度
   - 对比：班级平均线叠加

4. **知识点热力图**（ECharts Heatmap）
   - 横轴：知识模块
   - 纵轴：知识点
   - 颜色：掌握度（红→黄→绿）

5. **学习趋势图**（ECharts Line）
   - X 轴：时间（按周）
   - Y 轴：学习时长 / 练习题数 / 正确率
   - 多折线叠加

6. **能力维度柱状图**（ECharts Bar）
   - 各子能力的掌握度
   - 与班级平均对比

7. **学习行为饼图**（ECharts Pie）
   - 视频学习 / 文件阅读 / 练习 / 讨论 时间占比

8. **薄弱知识点列表**（Table）
   - 掌握度低于阈值的知识点
   - 建议学习资源链接

#### 导航菜单

在 `teacher-layout.tsx` 的 `教学分析` 菜单组中添加:
```tsx
{
  path: "/teacher/dashboard/student-profile",
  name: t("menu.studentProfile"),
  icon: <UserOutlined />,
},
```

---

## 功能三：专业分析

### 需求描述

独立模块，基于录入的专业信息，调用 AI 服务开展岗位分析、能力分析，构建专业能力素质图谱，AI 辅助人才培养设计（课程体系设计等），生成分析报告。

### 数据模型设计

#### 1. 专业 (Major)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | string | 专业名称 |
| code | string | 专业代码 |
| description | text | 专业描述 |
| college | string | 所属学院 |
| degree_type | string | 学位类型 (本科/硕士/博士) |
| duration | integer | 学制年限 |
| status | atom | 状态: draft / active / archived |

#### 2. 岗位信息 (JobPosition)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| major_id | UUID | 关联专业 |
| title | string | 岗位名称 |
| description | text | 岗位描述 |
| requirements | text | 岗位要求 |
| salary_range | string | 薪资范围 |
| source | string | 来源 |
| ai_analysis | text | AI 分析结果 (JSON) |

#### 3. 专业能力素质 (MajorCompetency)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| major_id | UUID | 关联专业 |
| name | string | 能力名称 |
| category | atom | 类别: professional / general / practical |
| level | string | 要求级别 |
| description | text | 能力描述 |
| weight | float | 权重 |
| parent_id | UUID | 父级能力（层级结构） |
| ai_generated | boolean | 是否 AI 生成 |

#### 4. 课程体系设计 (CurriculumDesign)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| major_id | UUID | 关联专业 |
| title | string | 方案标题 |
| description | text | 方案描述 |
| design_data | json | 结构化课程体系数据 |
| ai_generated | boolean | 是否 AI 生成 |
| version | integer | 版本号 |
| status | atom | 状态: draft / published |

#### 5. 分析报告 (AnalysisReport)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| major_id | UUID | 关联专业 |
| title | string | 报告标题 |
| report_type | atom | 类型: job_analysis / competency / curriculum / comprehensive |
| content | text | 报告内容 (Markdown) |
| ai_generated | boolean | 是否 AI 生成 |
| generated_at | datetime | 生成时间 |

### 后端实现

#### 新建 Ash 域：`KgEdu.MajorAnalysis`

```
backend/kg_edu/lib/kg_edu/
  ├── major_analysis.ex                      # 域定义
  └── major_analysis/
      ├── major.ex                           # 专业
      ├── job_position.ex                    # 岗位信息
      ├── major_competency.ex                # 专业能力素质
      ├── curriculum_design.ex               # 课程体系设计
      └── analysis_report.ex                 # 分析报告
```

**Major 资源** (`major.ex`)：
- CRUD actions
- 自定义 actions:
  - `by_college` - 按学院查询
  - `get_comprehensive_analysis` - 获取专业综合分析概览
- Relationships: job_positions, competencies, curriculum_designs, reports

**JobPosition 资源** (`job_position.ex`)：
- CRUD + 批量导入
- 自定义 actions:
  - `trigger_ai_analysis` - 触发 AI 岗位分析
  - `batch_import` - 批量导入岗位数据

**MajorCompetency 资源** (`major_competency.ex`)：
- 树形结构（parent_id 自引用）
- CRUD actions
- 自定义 actions:
  - `get_tree` - 获取能力树
  - `ai_generate_competencies` - AI 生成能力图谱

**CurriculumDesign 资源** (`curriculum_design.ex`)：
- CRUD actions
- 自定义 actions:
  - `ai_generate_curriculum` - AI 生成课程体系
  - `publish` - 发布方案

**AnalysisReport 资源** (`analysis_report.ex`)：
- CRUD actions
- 自定义 actions:
  - `generate_report` - AI 生成报告
  - `export_pdf` - 导出 PDF

### AI Agent 扩展

在 `ai-agent/KgAgent/` 中添加新的 Controller/Service：

```
ai-agent/KgAgent/
  ├── Controllers/
  │   └── MajorAnalysisController.fs    # 专业分析 API
  └── Services/
      └── MajorAnalysisService.fs       # 专业分析服务
```

**新增 AI API 端点**：

| 端点 | 方法 | 功能 |
|------|------|------|
| `/agent/analyze_jobs` | POST | AI 岗位分析 |
| `/agent/generate_competency_graph` | POST | AI 生成能力图谱 |
| `/agent/generate_curriculum` | POST | AI 生成课程体系 |
| `/agent/generate_analysis_report` | POST | AI 生成分析报告 |

**Prompt 设计**：

1. **岗位分析 Prompt**:
   - 输入: 专业信息 + 岗位列表
   - 输出: 各岗位的核心能力要求、技能需求、发展前景
   - 结构化 JSON

2. **能力图谱 Prompt**:
   - 输入: 专业信息 + 岗位分析结果
   - 输出: 分层能力体系（专业能力/通用能力/实践能力）
   - 带权重的层级结构

3. **课程体系设计 Prompt**:
   - 输入: 专业信息 + 能力图谱
   - 输出: 课程体系（基础课/专业基础课/专业课/实践课）
   - 含学分、学时、开课学期

4. **综合分析报告 Prompt**:
   - 输入: 上述所有数据
   - 输出: Markdown 格式综合报告

### 前端实现

#### 教师端页面

| 页面文件 | 路由 | 功能 |
|----------|------|------|
| `pages/teacher/major-list.tsx` | `/teacher/dashboard/major-list` | 专业管理（增删改查） |
| `pages/teacher/major-detail.tsx` | `/teacher/dashboard/major-detail/:id` | 专业详情总览 |
| `pages/teacher/major-jobs.tsx` | `/teacher/dashboard/major-jobs/:majorId` | 岗位管理与分析 |
| `pages/teacher/major-competency.tsx` | `/teacher/dashboard/major-competency/:majorId` | 能力图谱构建与展示 |
| `pages/teacher/major-curriculum.tsx` | `/teacher/dashboard/major-curriculum/:majorId` | 课程体系设计 |
| `pages/teacher/major-report.tsx` | `/teacher/dashboard/major-report/:majorId` | 分析报告列表与查看 |

**major-list.tsx 功能**：
- 专业列表（卡片/表格切换）
- 创建/编辑专业表单
- 快速进入各分析模块

**major-detail.tsx 功能**：
- 专业信息总览
- 四个分析模块入口卡片
  - 岗位分析（岗位数量、已分析数量）
  - 能力图谱（能力节点数）
  - 课程体系（已有方案数）
  - 分析报告（报告列表）

**major-jobs.tsx 功能**：
- 岗位列表管理
- 手动添加 / Excel 批量导入岗位
- AI 分析按钮 → 流式展示分析过程
- 岗位分析结果卡片（能力要求词云、薪资分布图）

**major-competency.tsx 功能**：
- 能力图谱可视化（树形图/放射状图，复用现有 GraphLayout）
- AI 一键生成能力图谱
- 手动编辑能力节点
- 能力权重配置

**major-curriculum.tsx 功能**：
- AI 辅助课程体系设计
  - 输入: 能力图谱 + 专业参数
  - 输出: 结构化课程体系
- 课程体系表格展示（按学期分组）
- 版本对比
- 课程体系图谱（关联能力维度）

**major-report.tsx 功能**：
- 报告列表（类型筛选）
- AI 生成报告按钮
- 报告在线预览（Markdown 渲染）
- 报告导出（PDF）

#### 导航菜单

在 `teacher-layout.tsx` 中新增菜单组:
```tsx
{
  path: "/teacher/major-analysis",
  name: t("menu.majorAnalysis"),
  icon: <ApartmentOutlined />,
  routes: [
    {
      path: "/teacher/dashboard/major-list",
      name: t("menu.majorManagement"),
      icon: <ApartmentOutlined />,
    },
  ],
},
```

---

## 实施顺序与里程碑

### 阶段一：分组任务

**优先级：高** — 课堂互动核心功能，模式成熟（参考签到模块）

**开发步骤**：

1. **后端资源开发**
   - 创建 `KgEdu.GroupTask` 域和 4 个 Ash Resource
   - 生成数据库迁移并执行
   - 注册 JSON API 路由和 RPC actions
   - 测试 code_interface

2. **前端教师端页面**
   - 分组管理页面
   - 分组任务管理页面
   - 任务进度跟踪页面
   - 二维码生成弹窗

3. **前端学生端页面**
   - 扫码任务入口页面
   - 我的分组任务列表

4. **集成测试**
   - 教师创建分组 → 布置任务 → 生成二维码
   - 学生扫码 → 提交任务
   - 教师查看进度 → 评分反馈

**关键文件清单**：
```
新增文件:
  backend/kg_edu/lib/kg_edu/group_task.ex
  backend/kg_edu/lib/kg_edu/group_task/group.ex
  backend/kg_edu/lib/kg_edu/group_task/group_member.ex
  backend/kg_edu/lib/kg_edu/group_task/task.ex
  backend/kg_edu/lib/kg_edu/group_task/task_submission.ex
  kg-edu-vite-antd/src/pages/teacher/group-management.tsx
  kg-edu-vite-antd/src/pages/teacher/group-task.tsx
  kg-edu-vite-antd/src/pages/teacher/group-task-progress.tsx
  kg-edu-vite-antd/src/pages/student/group-task.tsx
  kg-edu-vite-antd/src/pages/student/group-tasks.tsx

修改文件:
  backend/kg_edu/lib/kg_edu_web/router.ex              # 添加路由
  kg-edu-vite-antd/src/App.tsx                         # 添加路由
  kg-edu-vite-antd/src/layouts/teacher-layout.tsx      # 添加菜单
  kg-edu-vite-antd/src/locales/*.json                  # 添加翻译
```

### 阶段二：学生学情画像

**优先级：高** — 教学分析核心功能，数据源已就绪

**开发步骤**：

1. **后端聚合服务**
   - 创建 `StudentProfile` 服务模块
   - 在 `StudentKnowledgeMastery` 资源上添加聚合 action
   - 注册 RPC 接口

2. **前端画像页面**
   - 总览卡片组件
   - 雷达图组件（知识掌握维度）
   - 热力图组件（知识点分布）
   - 趋势图组件（学习轨迹）
   - 柱状图组件（能力维度对比）
   - 饼图组件（学习行为分布）
   - 薄弱知识点列表组件

3. **集成测试**
   - 选择课程+学生 → 验证各维度数据展示
   - 验证图表交互（缩放、筛选）
   - 验证班级对比数据

**关键文件清单**：
```
新增文件:
  backend/kg_edu/lib/kg_edu/knowledge/student_profile.ex
  kg-edu-vite-antd/src/pages/teacher/student-profile.tsx

修改文件:
  backend/kg_edu/lib/kg_edu/knowledge/student_knowledge_mastery.ex  # 添加聚合 actions
  backend/kg_edu/lib/kg_edu/knowledge.ex                             # 注册 RPC
  kg-edu-vite-antd/src/App.tsx                                       # 添加路由
  kg-edu-vite-antd/src/layouts/teacher-layout.tsx                    # 添加菜单
  kg-edu-vite-antd/src/locales/*.json                                # 添加翻译
```

### 阶段三：专业分析

**优先级：中** — 独立模块，依赖 AI Agent 扩展

**开发步骤**：

1. **后端资源开发**
   - 创建 `KgEdu.MajorAnalysis` 域和 5 个 Ash Resource
   - 生成数据库迁移并执行
   - 注册 JSON API 路由和 RPC actions

2. **AI Agent 扩展**
   - 新增 `MajorAnalysisController` 和 `MajorAnalysisService`
   - 实现 4 个 AI 分析端点
   - 设计专业分析的 Prompt 模板

3. **前端页面开发**
   - 专业管理页面
   - 岗位管理与分析页面
   - 能力图谱页面
   - 课程体系设计页面
   - 分析报告页面

4. **集成测试**
   - 录入专业信息 → 触发 AI 分析
   - 验证能力图谱生成
   - 验证课程体系设计
   - 验证报告生成和导出

**关键文件清单**：
```
新增文件:
  backend/kg_edu/lib/kg_edu/major_analysis.ex
  backend/kg_edu/lib/kg_edu/major_analysis/major.ex
  backend/kg_edu/lib/kg_edu/major_analysis/job_position.ex
  backend/kg_edu/lib/kg_edu/major_analysis/major_competency.ex
  backend/kg_edu/lib/kg_edu/major_analysis/curriculum_design.ex
  backend/kg_edu/lib/kg_edu/major_analysis/analysis_report.ex
  ai-agent/KgAgent/Controllers/MajorAnalysisController.fs
  ai-agent/KgAgent/Services/MajorAnalysisService.fs
  kg-edu-vite-antd/src/pages/teacher/major-list.tsx
  kg-edu-vite-antd/src/pages/teacher/major-detail.tsx
  kg-edu-vite-antd/src/pages/teacher/major-jobs.tsx
  kg-edu-vite-antd/src/pages/teacher/major-competency.tsx
  kg-edu-vite-antd/src/pages/teacher/major-curriculum.tsx
  kg-edu-vite-antd/src/pages/teacher/major-report.tsx

修改文件:
  backend/kg_edu/lib/kg_edu_web/router.ex              # 添加路由
  kg-edu-vite-antd/src/App.tsx                         # 添加路由
  kg-edu-vite-antd/src/layouts/teacher-layout.tsx      # 添加菜单
  kg-edu-vite-antd/src/locales/*.json                  # 添加翻译
  kg-edu-vite-antd/src/lib/agent_api.ts                # 添加 AI API 调用
```

---

## 验证方案

### 分组任务验证

1. 启动后端: `./dev.sh start backend`
2. 创建课程 → 选择课程 → 手动创建小组（添加学生成员）
3. 创建分组任务 → 发布 → 验证二维码生成
4. 模拟学生扫码 → 提交任务内容
5. 教师端查看进度 → 评分反馈

### 学生学情画像验证

1. 确保有考试、练习、视频等学习数据（可用 `create_demo.exs`）
2. 选择课程+学生 → 查看画像页面
3. 验证雷达图、热力图、趋势图数据正确
4. 对比不同学生的画像差异

### 专业分析验证

1. 创建专业信息
2. 添加/导入岗位数据
3. 触发 AI 岗位分析 → 验证分析结果
4. AI 生成能力图谱 → 验证树形结构
5. AI 生成课程体系 → 验证结构合理性
6. 生成分析报告 → 验证内容质量

---

## 技术决策说明

| 决策 | 方案 | 理由 |
|------|------|------|
| 分组任务 token 机制 | 复用签到 session 的 token 模式 | 成熟方案，已有 QRCode 组件 |
| 学生画像数据聚合 | 后端聚合服务 + ECharts 展示 | 减少前端计算压力，数据一致性好 |
| 能力图谱可视化 | 复用现有 GraphLayout 组件 | 已有知识图谱、能力图谱的前端实现 |
| AI 分析服务 | 扩展现有 .NET Agent 服务 | 统一 AI 服务入口，已有流式聊天框架 |
| 报告生成 | Markdown + PDF 导出 | 灵活的格式，易于 AI 生成和前端渲染 |
| 分组方式 | 手动分组 + 随机分组 | 覆盖常见教学场景 |
| 多租户 | 所有新资源继承 context 策略 | 保持与现有架构一致 |

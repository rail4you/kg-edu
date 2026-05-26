# 学生端微专业改造 - 实现方案

## 概述

改造学生微专业页面，从"智慧课程关联"模式改为"微专业独立课程"模式。学生看到卡片式微专业列表 → 点击进入详情 → 查看微专业课程列表 → 进入课程学习页面（视频/习题/资源），所有操作记录到活动日志，支持时间轴查看和教师端运营分析。

---

## 架构图

```
┌──────────────────────────────────────────────────────┐
│                 学生端微专业改造                          │
├──────────────────────────────────────────────────────┤
│  ┌──────────┐   ┌──────────┐   ┌───────────────────┐ │
│  │ 微专业列表 │ → │ 微专业详情 │ → │ 微专业课程详情页      │ │
│  │ (卡片)    │   │ (课程列表) │   │ ┌───┬───┬───┬───┐ │ │
│  └──────────┘   └──────────┘   │ │介绍│视频│习题│资源│ │ │
│                                 │ └───┴───┴───┴───┘ │ │
│                                 └───────────────────┘ │
├──────────────────────────────────────────────────────┤
│               活动日志 → 时间轴 / 教师运营面板           │
└──────────────────────────────────────────────────────┘
```

---

## 数据流

### 后端数据模型

```
MicroMajor
  ├── MicroMajorCourse (独立课程, 含 title/imageUrl/semester/credits)
  │     ├── MicroMajorChapter (自引用 parent_chapter_id)
  │     │     ├── MicroMajorVideo (关联 chapter_id)
  │     │     ├── MicroMajorExercise (关联 chapter_id)
  │     │     └── MicroMajorResource (关联 chapter_id)
  │     └── (直接关联的视频/习题/资源)
  └── MicroMajorEnrollment (学生选课记录)
```

### 学生端页面路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/micro-majors` | 学生微专业首页 | 卡片列表 |
| `/micro-majors/:tenant/:id` | 微专业详情 | 微专业介绍 + 课程列表 (已有路由) |
| `/student/mm-course?mmCourseId=xxx` | 课程学习页面 | 四个 Tab |

---

## 任务 1: 学生微专业首页卡片化

**文件**: `src/pages/student/micro-majors.tsx`

**改动**:
- 左栏"我的微专业"列表 → 改为**Card 网格布局**
- 每个卡片：封面图、名称、学习周期、进度条
- 点击卡片 → 进入 `/micro-majors/:tenant/:mmId`

**关键数据源**: `myMicroMajorEnrollments`（已含嵌套 microMajor）

---

## 任务 2: 微专业详情页 - 微专业课程列表

**文件**: `src/pages/micro-major-detail.tsx`

**改动**:
- 使用 `listCoursesByMicroMajor` 获取课程列表
- 课程卡片展示：标题、描述、学分、学时
- 点击 → `/student/mm-course?mmCourseId=xxx&mmId=yyy`

---

## 任务 3: 核心学习页面

**文件**: `src/pages/student/mm-course.tsx`（新建）
**路由**: `<Route path="/student/mm-course" element={<StudentMMCoursePage/>} />` + wrapper

### Tab 结构

| Tab | 数据源 | 功能 |
|-----|--------|------|
| 课程介绍 | `getMmCourseFullHierarchy` | 课程信息 + 章节树 |
| 视频学习 | `listMmVideosByChapter` | 章节导航 + 视频播放器 |
| 习题练习 | `listMmExercisesByChapter` | 提交 + 答案 + 统计 |
| 资源下载 | `listMmResourcesByChapter` | 文件列表 + 下载 |

### 视频播放
- 左侧章节树（`getMmCourseFullHierarchy`）
- 右侧视频列表 + `<video>` 播放器
- 选择章节 → 过滤视频 → 点击播放
- 观看时调用 `logVideoView`

### 习题练习
- 按章节分组
- 选择题：选项 + Radio → 提交 → 显示正确答案 + 统计
- 填空题/问答题：输入框 → 提交 → 显示参考答案
- 提交时调用 `logExerciseSubmit`

### 资源下载
- 资源列表：文件名、类型、大小
- `listMmResourcesByChapter`
- `<a download>` 下载
- 下载时调用 `logFileView` 或自定义活动

---

## 任务 4: ActivityLog 扩展

**后端**: `backend/kg_edu/lib/kg_edu/activity/activity_log.ex`

- 添加字段: `micro_major_course_id`, `micro_major_course_title`, `micro_major_id`, `micro_major_name`
- 新增 action: `log_mm_video_view`, `log_mm_exercise_submit`, `log_mm_file_download`
- 或复用现有 action + context 参数

---

## 任务 5: 学习时间轴

- `/micro-majors/:tenant/:id` 详情页新增"学习动态"Tab
- 使用 ActivityLog 数据，按日期分组
- Ant Design `<Timeline>` 组件

---

## 任务 6: 教师端运营面板

- 侧边栏新增「运营分析」
- 维度：微专业 → 课程 → 学生
- 数据：选课人数、视频观看、习题完成率、资源下载
- 使用 ActivityLog + 分析接口

---

## 执行顺序

```
任务 1 → 任务 2 → 任务 3 (核心) → 任务 4 (活动日志) → 任务 5 → 任务 6
```

当前阶段：实现 **任务 1 + 任务 2 + 任务 3**

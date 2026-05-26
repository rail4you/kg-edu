# 微专业模块开发 TODO

## 状态说明
- [ ] 未开始
- [~] 进行中
- [x] 已完成（reviewer 已验证）

---

## Phase 1: 后端数据模型（Backend）

### 1.1 [x] 新建 MicroMajorCourse 独立课程资源
- 替换现有的关联表模型为独立课程实体
- 新建 `lib/kg_edu/major_analysis/micro_major_course.ex`
- 字段: id, micro_major_id, title, description, cover_url, teacher_id, sort_order, status, source_course_id(可选,用于追踪导入来源)
- 表名: `micro_major_courses`
- **验证**: 代码编译通过

### 1.2 [x] 新建 MicroMajorChapter 章节资源
- 新建 `lib/kg_edu/major_analysis/micro_major_chapter.ex`
- 字段: id, micro_major_course_id, title, description, parent_chapter_id, sort_order, path
- 支持多级嵌套(自引用 parent_chapter_id)
- 表名: `micro_major_chapters`
- **验证**: 代码编译通过

### 1.3 [x] 新建 MicroMajorVideo 视频资源
- 新建 `lib/kg_edu/major_analysis/micro_major_video.ex`
- 字段: id, micro_major_course_id, micro_major_chapter_id(可选), title, asset_id, playback_id, duration, thumbnail, source_video_id(可选)
- 表名: `micro_major_videos`
- **验证**: 代码编译通过

### 1.4 [x] 新建 MicroMajorExercise 习题资源
- 新建 `lib/kg_edu/major_analysis/micro_major_exercise.ex`
- 字段: id, micro_major_course_id, micro_major_chapter_id(可选), title, question_content, answer, question_type, options, difficulty, position, answer_explanation, source_exercise_id(可选)
- 表名: `micro_major_exercises`
- **验证**: 代码编译通过

### 1.5 [x] 新建 MicroMajorResource 资源/文件资源
- 新建 `lib/kg_edu/major_analysis/micro_major_resource.ex`
- 字段: id, micro_major_course_id, micro_major_chapter_id(可选), filename, path, size, file_type, description, source_file_id(可选)
- 表名: `micro_major_resources`
- **验证**: 代码编译通过

### 1.6 [x] 更新 MicroMajor 资源关联
- 修改 `micro_major.ex` 的 relationships, 移除旧的 many_to_many :courses 关联
- 添加 has_many :micro_major_courses (新的独立课程)
- **验证**: 代码编译通过

### 1.7 [x] 更新 MajorAnalysis Domain
- 在 `major_analysis.ex` 中注册新资源
- 添加 typescript_rpc 配置
- **验证**: 代码编译通过

### 1.8 [x] 数据库迁移
- 创建 tenant migration: 删除旧 micro_major_courses 表, 创建新表 + 新增表
- `./dev.sh migrate` 执行成功
- **验证**: 迁移执行无报错

### 1.9 [x] 后端整体编译验证 — ✅ reviewer 通过
- `mix compile` 无错误无警告
- **验证**: 编译通过

---

## Phase 2: 前端首页与导航重构（Frontend Layout）

### 2.1 [x] 新建模块选择首页
- 创建 `pages/teacher/module-home.tsx`
- 两个卡片: 智慧课程 / 微专业
- **验证**: 页面可访问

### 2.2 [x] 新建微专业模块 Layout
- 创建 `layouts/micro-major-layout.tsx`
- 左侧导航: 微专业列表、返回首页
- 顶部栏与教师端共享
- **验证**: 布局渲染正常

### 2.3 [x] 配置路由
- 在 `App.tsx` 中添加微专业模块路由组
- `/teacher/micro-major-home` → 模块首页
- `/teacher/micro-major/*` → 微专业模块各页面
- **验证**: 路由跳转正常

### 2.4 [x] 前端整体编译验证 — ✅ tsc 通过
- `bun run build` 或开发服务器无编译错误
- **验证**: 编译通过

---

## Phase 3: 前端微专业课程管理页面（Frontend Pages）

### 3.1 [x] 微专业列表页
- 新建/重构微专业列表页面
- 显示微专业卡片, 点击进入微专业详情
- **验证**: 列表数据加载正常

### 3.2 [x] 微专业课程管理页
- 微专业下的课程列表 + 新增/编辑/删除
- 新建 `pages/teacher/mm-course-list.tsx`
- **验证**: CRUD 操作正常

### 3.3 [x] 微专业课程详情页（Tab 切换）
- 新建 `pages/teacher/mm-course-detail.tsx`
- Tabs: 章节管理 / 视频管理 / 习题管理 / 资源管理
- **验证**: Tab 切换正常

### 3.4 [x] 章节管理页面
- 新建 `pages/teacher/mm-chapter.tsx`
- 树形结构, 支持拖拽排序
- **验证**: 章节 CRUD + 排序

### 3.5 [x] 视频管理页面
- 新建 `pages/teacher/mm-video.tsx`
- 视频上传 + 列表管理
- **验证**: 视频上传 + 列表显示

### 3.6 [x] 习题管理页面
- 新建 `pages/teacher/mm-exercise.tsx`
- 习题 CRUD, 支持多种题型
- **验证**: 习题 CRUD

### 3.7 [x] 资源管理页面
- 新建 `pages/teacher/mm-resource.tsx`
- 文件上传 + 列表管理
- **验证**: 文件上传 + 列表

### 3.8 [x] 前端整体编译验证 — ✅ tsc 通过
- 所有新页面编译通过
- **验证**: 编译通过

---

## Phase 4: 导入功能（Import Feature）

### 4.1 [x] 通用导入弹窗组件
- 新建 `components/micro-major/import-modal.tsx`
- 支持选择智慧课程 → 加载对应数据 → 多选 → 确认导入
- **验证**: 弹窗交互正常

### 4.2 [x] 视频导入
- 视频管理页添加 [从智慧课程导入] 按钮
- 调用后端 import API
- **验证**: 导入流程完整

### 4.3 [x] 习题导入
- 习题管理页添加 [从智慧课程导入] 按钮
- **验证**: 导入流程完整

### 4.4 [x] 资源导入
- 资源管理页添加 [从智慧课程导入] 按钮
- **验证**: 导入流程完整

---

## Phase 5: 集成测试与优化

### 5.1 [ ] 端到端流程验证
### 5.2 [ ] 错误处理与边界情况
### 5.3 [ ] 样式统一

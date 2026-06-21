# 代码清理计划

> 基于 `mix compile` 的 140 条警告 + 遗留项目分析

---

## 一、遗留项目清理（agent-server + old frontend）

### 1.1 agent-server 完全迁移确认

| agent-server 路由 | Phoenix 后端对应 | 状态 |
|---|---|---|
| `/debug-env` | 无 | ❌ 无需迁移（调试用） |
| `/health` | `/api/health` | ✅ 已迁移 |
| `/info` | 无 | ❌ 无需迁移 |
| `/api/chat` | ChatController | ✅ 已迁移 |
| `/api/skills/generate-pptx` | GenerationController + document_tools | ✅ 已迁移 |
| `/api/skills/generate-docx` | GenerationController + document_tools | ✅ 已迁移 |
| `/competency-graph/generate` | GenerationController | ✅ 已迁移 |
| `/api/curriculum/jobs` | GenerationController | ✅ 已迁移 |
| `/api/curriculum/jobs/:jobId` | GenerationController | ✅ 已迁移 |
| `/curriculum/generate` | GenerationController | ✅ 已迁移 |
| `/api/generate_ai_exercise` | GenerationController | ✅ 已迁移 |
| `/import-chapters` | ImportController | ✅ 已迁移 |
| `/import` | ImportController | ✅ 已迁移 |
| `/api/curriculum/upload` | GenerationController | ✅ 已迁移 |

**结论：agent-server 所有路由已迁移，可以整体删除。**

### 1.2 待清理项

| 项目 | 操作 | 说明 |
|---|---|---|
| `agent-server/` 整个目录 | **删除** | 所有功能已迁移到 Phoenix；含 docs/pptx/docx 生成、curriculum、exercise 等 |
| `docker-compose.yml` 中的 `nextjs-ts` frontend 服务 | **删除** | 旧的 Next.js 前端，已被 `kg-edu-vite-antd` 替代 |
| `docker-compose.yml` 中的 `frontend` 服务定义（port 3000） | **删除** | 不再需要独立前端容器 |
| `docker-compose.yml` 中 nginx `conf.d` 挂载 | **修正** | prod 版已不用 conf.d，dev 版应统一 |
| `config/deploy.yml` 中的 3000 端口配置 | **清理** | 如果有旧的 healthcheck 配置 |

---

## 二、Elixir 代码库警告清理（~140 条）

### 分类 A：未使用变量（`_` 前缀） — 低风险，机械修改

| 文件 | 变量 | 行号 |
|---|---|---|
| `lib/kg_edu/agent/tools/course_tools.ex` | `params` | 12 |
| `lib/kg_edu/tenant_manager.ex` | `tenant_id` | 36 |
| `lib/kg_edu_web/uploaders/file.ex` | `version`×3, `file` | 20, 25, 30 |
| `lib/kg_edu_web/uploaders/video.ex` | `version`×2, `file` | 21, 26 |
| `lib/kg_edu_web/router.ex` | `claims` | 26 |
| `lib/kg_edu/activity/changes/log_homework_submit.ex` | `changeset` | 31 |
| `lib/kg_edu/activity/changes/log_exercise_submit.ex` | `changeset` | 31 |
| `lib/kg_edu/activity/changes/log_file_view.ex` | `changeset` | 29 |
| `lib/kg_edu/activity/changes/log_video_view.ex` | `changeset` | 29 |
| `lib/kg_edu_web/controllers/generation_controller.ex` | `e` | 200 |
| `lib/kg_edu/knowledge_example.ex` | `angles` ... `quadratic_eq` 共8个 | 71-165 |
| `lib/kg_edu/accounts/user/changes/create_user.ex` | `context`, `password` | 23, 28 |
| `lib/kg_edu_web/controllers/chat_controller.ex` | `tenant`, `state` | 105, 192 |
| `lib/kg_edu/knowledge/recommendation_engine.ex` | `mastery_or_resource` | 588 |
| `lib/kg_edu/major_analysis/job_position.ex` | `position` | 165 |
| `lib/kg_edu_web/controllers/import_controller.ex` | `file_name` | 68 |
| `lib/kg_edu/migration_manager.ex` | `tenant_config`, `migrations`, `version` | 147, 153 |
| `lib/kg_edu/knowledge/resource.ex` | `col7`-`col14`, `row`×2, `relations_to_create`, `unit_id` | 2108-2779 |
| `lib/kg_edu/agent/job_manager.ex` | `updated` | 48 |
| `lib/kg_edu/ash_migration_manager.ex` | `changeset` | ？？ |
| `lib/kg_edu/opml_parser.ex` | `_head`×2（应重命名） | 79, 96 |
| `lib/kg_edu_web/live/knowledge_outline.ex` | `knowledge` | 229 |
| `lib/kg_edu/backup_manager.ex` | `output` | 413 |

### 分类 B：未使用函数（死代码） — 需确认是否可大胆删除

| 文件 | 函数 | 说明 |
|---|---|---|
| `lib/kg_edu/knowledge/changes/import_questions_from_xlsx.ex` | `import_questions_from_excel/2` `import_question_from_excel/3` | 遗留导入逻辑 |
| `lib/kg_edu/knowledge/changes/import_knowledge_from_xlsx.ex` | `import_resources_from_excel/2` `import_resource_from_excel/2` | 遗留导入逻辑 |
| `lib/kg_edu/accounts/user/changes/import_from_excel.ex` | `import_users_from_excel/3` | 遗留导入逻辑 |
| `lib/kg_edu/courses/file_example.ex` | `generate_audio_transcript_content/0` | 示例代码 |
| `lib/kg_edu/accounts/user/changes/create_user.ex` | `hash_password/2` | 创建用户时的哈希 |
| `lib/kg_edu/demo/import_from_llm.ex` | `create_or_get_demo_course/0` | Demo 代码 |
| `lib/kg_edu/agent/oss_upload.ex` | `encoded_path/1` | OSS 上传 |
| `lib/kg_edu/excel_import.ex` | `has_required_basic_fields?/1` | Excel 导入校验 |
| `lib/kg_edu/knowledge/resource.ex` | `validate_course_exists/2` `process_relations/5` `parse_importance_level/1` `get_or_create_unit/3` `get_or_create_subject_for_level/2` `do_get_or_create_subject/2` `detect_tenant_for_course/1` `create_or_update_knowledge_resource/10` | 知识资源导入遗留 |
| `lib/kg_edu/opml_parser.ex` | `is_top_level?/1` `is_subject?/1` `is_second_level?/1` `get_parent_outline/1` `get_outline_name/1` `get_ancestors/1` `find_subject_and_unit/1` `extract_hierarchy_from_outline/1` | OPML 解析遗留 |
| `lib/kg_edu/knowledge/relation.ex` | `process_relation_row/2` | 关系导入 |

### 分类 C：未使用 imports/aliases — 直接删除

| 文件 | 未使用导入 |
|---|---|
| `lib/kg_edu/knowledge/student_exam.ex` | `import Ash.Changeset` `import Ash.Query` |
| `lib/kg_edu/knowledge/recommendation_api.ex` | `import Ash.Query` |
| `lib/kg_edu_web/controllers/chat_controller.ex` | `alias Jido.AI.Reasoning.ReAct` |
| `lib/kg_edu/courses/discussion_session.ex` | `import Ash.Query` |
| `lib/kg_edu/knowledge/resource.ex` | `import Ecto.Query` `import Logger, only: [info: 1]` |
| `lib/kg_edu/knowledge/relation.ex` | `alias ElixirSense.Log` `import Logger, only: [info: 1]` |

### 分类 D：永远不匹配的 clause（逻辑 bug） — 需仔细分析

| 文件 | 行号 | 说明 |
|---|---|---|
| `lib/kg_edu/demo/recommendation_demo.ex` | 133 | `{:error, e}` 永不匹配（函数始终返回 `{:ok, ...}`） |
| `lib/kg_edu/knowledge/exercise/changes/generate_ai_exercise.ex` | 325 | `{:error, reason}` 永不匹配 |
| `lib/kg_edu/xmind_parser.ex` | 27 | `{:error, reason}` 在 `Base.decode64` 之后永不匹配 |
| `lib/kg_edu/knowledge/recommendation_api.ex` | 89 | pattern match 类型不匹配 |
| `lib/kg_edu/knowledge/learning_analyzer.ex` | 52 | `{:error, reason}` 永不匹配 |
| `lib/kg_edu/knowledge/changes/import_knowledge_from_xmind.ex` | 53, 108, 109 | 多个永不匹配的 clause |
| `lib/kg_edu/knowledge/resource.ex` | 1733, 1747, 2079 | 3个永不匹配的 clause（类型系统检测到） |
| `lib/kg_edu/opml_parser.ex` | 277 | `{:error, _}` 永不匹配 |
| `lib/kg_edu_web/plug/set_tenant_from_token.ex` | 108 | `{:error, reason}` 永不匹配 |

### 分类 E：Clauses 未分组 — 代码整理

| 文件 | 函数 |
|---|---|
| `lib/kg_edu/knowledge/resource.ex` | `safe_get/2`, `safe_strip/1`, `find_deepest_level/1`, `parse_importance_from_tags/1`, `process_relations/5` |
| `lib/kg_edu/excel_import.ex` | `map_row_to_attributes/2` |

### 分类 F：API 断裂（undefined/private 调用） — 需要修或删

| 调用位置 | 调用 | 建议 |
|---|---|---|
| `generate_ai_exercise.ex:318` | `Ash.Changeset.fetch_context/2` | 应改用 `Ash.Changeset.get_context/1` |
| `file_example.ex:64` | `KgEdu.Courses.File.write/2` | 示例代码，可删除该文件 |
| `video_uploader.ex` | `Mux.client/2` `Mux.Video.Uploads.create/2` | Mux 库未安装/不可用 |
| `upload_video_controller.ex` | `Mux.Webhooks.verify_header/3` | Mux 库未安装 |
| `learning_analyzer.ex` | `StudentKnowledgeMastery.update_from_exercise/1`等 | 方法名可能已变更，需核对 |
| `exercise_live/form.ex` | `Resource.list_knowledge_resources!/0` | 方法名已变更 |
| `resource.ex` + `import_service.ex` | `ExcelParser.parse_from_base64/1` | 参数不匹配，应加 `tenant` |

### 分类 G：现代 Elixir 写法

| 文件 | 问题 | 修正 |
|---|---|---|
| `recommendation_engine.ex:256` | `Logger.warn/1` 已废弃 | `require Logger; Logger.warning(...)` |
| `competency_tools.ex:192` | `Logger.warning/1`（缺少 require） | `require Logger` |
| `curriculum_tools.ex:171` | `Logger.warning/1`（缺少 require） | `require Logger` |
| `resource.ex:3519` | `0..-5` 写法 | `0..-5//-1` |
| `chat_controller.ex` | `@doc` 在 `defp` 上 (×2) | 删除 `@doc` 或改为 `def` |
| `excel_import.ex` | `@doc` 在 `defp` 上 (×7) | 删除 `@doc` |
| `check_in_session.ex` | 多 clause + 默认值 | 添加函数头 |
| `knowledge_hierarchy_helper.ex:38` | `length(cells) > 0` | `cells != []` |
| `student_exam.ex:552,571` | `length(...) > 0` | `... != []` |

### 分类 H：缺失实现

| 模块 | 问题 |
|---|---|
| `lib/kg_edu/knowledge/nested_hierarchy_rpc.ex` | `read/4` callback 未实现（`Ash.Resource.ManualRead`） |
| `mix.exs` 中 `warnings_as_errors` 已废弃 | 应改为 `--warnings-as-errors` CLI flag |

---

## 三、清理顺序（建议）

### 第一批：机械清理（低风险，可直接执行）

1. **删除 `agent-server/` 整个目录**
2. **清理 `docker-compose.yml`**（删除 nextjs-ts frontend 服务、port 3000）
3. **分类 A：所有未使用变量加 `_` 前缀** — 纯机械替换
4. **分类 C：删除未使用的 imports/aliases**
5. **分类 G：现代化写法修正**（`@doc`删除、`length()`替换、`Logger.warn`替换、`0..-5//-1`）
6. **分类 E：group clauses**

### 第二批：死代码删除（需确认）

7. **分类 B：删除所有未使用函数**

### 第三批：逻辑修复（需仔细审查）

8. **分类 F：修复 API 断裂**
9. **分类 D：修复/删除永不匹配的 clause**
10. **分类 H：实现缺失的回调**

---

## 四、其他可清理项

- `backend/kg_edu/lib/kg_edu/courses/file_example.ex` — 纯示例代码
- `backend/kg_edu/lib/kg_edu/demo/` — demo 目录
- `backend/kg_edu/lib/kg_edu/knowledge_example.ex` — 示例数据
- `backend/kg_edu/priv/models_dev/` — 开发环境 LLM 模型配置
- Vite proxy 中 `:3000` 的 `/api/copilotkit` 转发（可能已不需要）
- `agent-server/` 目录被 `.gitignore` 忽略了吗？需确认 git 状态

---

## 执行状态 (2026-06-21)

### ✅ 已完成

| 批次 | 内容 | 减少 |
|---|---|---|
| 第一批 | 删除 agent-server/ (全部 14 条路由已迁移) | ✅ |
| 第一批 | 清理 docker-compose.yml (删除 old nextjs-ts) | ✅ |
| 第一批 | 未使用变量加 `_` 前缀 (~70 处) | ✅ |
| 第一批 | 删除未使用 imports/aliases (8 处) | ✅ |
| 第一批 | `Logger.warn` → `Logger.warning` | ✅ |
| 第一批 | `@doc` 删除/转注释 (excel_import, chat_controller) | ✅ |
| 第一批 | `length()` → pattern match (3 处) | ✅ |
| 第一批 | `0..-5` → `0..-5//-1` | ✅ |
| 第一批 | 删除 resource.ex 重复函数定义 | ✅ |
| 第一批 | Clauses 分组 (map_row_to_attributes) | ✅ |
| 第一批 | 删除确认未使用函数 (hash_password/2 等) | ✅ |
| 第二批 | 删除 OPML parser 未使用函数 (8 个函数) | ✅ |
| 第三批 | 修复 API 断裂: Ash.Changeset.fetch_context | ✅ |
| 第三批 | 修复 API 断裂: ExcelParser.parse_from_base64/1→/2 | ✅ |
| 第三批 | 修复 API 断裂: File.write 模块解析 | ✅ |
| 第三批 | 修复 API 断裂: StudentKnowledgeMastery 方法名 | ✅ |
| 第三批 | 修复 API 断裂: LearningRecommendation 方法名 | ✅ |
| 第三批 | 修复 API 断裂: Resource.list_knowledge_resources! | ✅ |

### ⚠️ 保留（需要业务决策）

| 类别 | 数量 | 说明 |
|---|---|---|
| Mux 库未安装 | 3 | `video_uploader.ex`、`upload_video_controller.ex` 引用 Mux，但依赖未安装 |
| 未使用函数（死代码链） | ~19 | resource.ex 和 opml_parser.ex 中的遗留导入 pipeline 函数 |
| `check_in_session.ex` get_by_token | 1 | Ash define 与手动定义冲突，纯 cosmetic |
| `ash_migration_manager.ex` map update | 1 | 类型推断问题 |
| 永不匹配 clause | 1 | xmind_parser Base.decode64 pattern |
| 永不匹配 pattern | 1 | recommendation_api |
| `NestedHierarchyRpc.read/4` | 1 | Ash.ManualRead 回调未实现 |
| `unused import Ash.Query` | 1 | `^` 操作符需要 import（编译器误报） |

### 最终指标

- **初始**: 140 条警告
- **现在**: ~40 条（其中 ~19 条是死代码，~3 条是 Mux 未安装，其余是 cosmetic/架构性问题）
- **错误**: 0
- **编译**: ✅ 通过

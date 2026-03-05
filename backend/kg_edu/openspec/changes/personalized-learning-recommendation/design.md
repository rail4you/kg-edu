## Context

当前系统已有以下数据基础设施：
- **ActivityLog**: 记录用户查看文件、视频、提交练习等行为
- **KnowledgeResource**: 知识点层次结构（subject/unit/cell），包含 importance_level 字段
- **Exercise**: 练习题，关联 KnowledgeResource
- **StudentExamAnswer**: 学生答题记录，包含是否正确、得分
- **CourseEnrollment**: 课程选修关系

前端已有"待学习推荐、正在学习推荐、已完成推荐"的UI，但后端缺少API支持。

## Goals / Non-Goals

**Goals:**
- 实现知识点薄弱程度分析（基于答题错误率）
- 实现基于同课程学生学习行为的资源推荐
- 支持推荐资源的三种状态：待学习、进行中、已完成
- 支持用户标记推荐资源为已完成

**Non-Goals:**
- 复杂的机器学习推荐算法
- 实时推荐（初期采用基于统计的简单推荐）
- 推荐结果的精确度优化

## Decisions

### 1. 数据模型设计

**方案A: 新建专用表**
- 创建 `user_learning_recommendations` 表存储推荐记录
- 创建 `knowledge_point_mastery` 表存储知识点掌握度

**方案B: 基于现有表计算**
- 直接通过 ActivityLog 和 StudentExamAnswer 计算
- 优点：无需新增表，灵活
- 缺点：每次查询需要计算，性能可能受影响

**决策**: 采用方案A + 方案B混合
- 推荐记录用新表 `user_learning_recommendations` 存储（支持标记完成、避免重复推荐）
- 知识点掌握度实时计算（数据量不大时足够）

### 2. 知识点薄弱程度计算

```elixir
# 错误率 = 该知识点答题错误次数 / 该知识点答题总次数
error_rate = wrong_answers_count / total_answers_count

# 薄弱程度等级
- 高 (error_rate > 0.5): 需要重点推荐
- 中 (0.3 < error_rate <= 0.5): 建议复习
- 低 (error_rate <= 0.3): 掌握良好
```

### 3. 资源推荐逻辑

```elixir
# 待学习资源 = 同学课程学生查看多的资源 - 当前用户已查看的资源
recommended = (同课程学生查看最多的N个资源) - (当前用户已查看的资源)

# 进行中资源 = 当前用户已查看但未标记完成的资源
in_progress = 用户已查看的资源中未标记完成的

# 已完成资源 = 用户标记完成的资源
completed = 用户标记完成的资源
```

### 4. API 端点设计

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/learning_recommendations` | GET | 获取用户的学习推荐 |
| `/api/learning_recommendations/:id/complete` | POST | 标记推荐资源为已完成 |
| `/api/knowledge_points/weakness` | GET | 获取知识点薄弱分析 |
| `/api/knowledge_points/:id/mastery` | GET | 获取特定知识点的掌握度 |

## Risks / Trade-offs

- [风险] 推荐数据可能过期 → [缓解] 定期刷新推荐或基于请求时计算
- [风险] 同课程学生数据不足 → [缓解] 设置最低学生数阈值，不足时使用课程默认推荐
- [风险] 知识点与练习题关联可能不完整 → [缓解] 只推荐有关联练习题的知识点

## Open Questions

- 推荐刷新频率：是实时计算还是定时任务？
- 推荐数量限制：每个类别推荐多少条？
- 是否需要教师手动调整推荐？

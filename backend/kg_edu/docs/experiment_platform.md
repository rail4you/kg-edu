# 课程实践平台 (Experiment Platform) - 设计文档

## 一、概述

课程实践平台是 KgEdu 系统中的实验管理模块，用于管理课程中的实验项目。实验可以是线上（虚拟实验室）或线下（实体实验室）类型。

## 二、数据模型

### 2.1 Experiment (实验)

主资源，表示一个实验项目。

| 字段 | 类型 | 说明 |
|--------|------|------|
| id | UUID | 主键 |
| title | string | 实验名称 (必填) |
| description | string | 实验概述/详细描述 |
| experiment_type | atom | 实验类型: `:online` (线上) / `:offline` (线下) |
| duration_hours | integer | 预计学时 |
| difficulty_level | atom | 难度级别: `:easy` / `:medium` / `:hard` |
| objectives | string | 实验目标 |
| requirements | string | 实验要求/前置条件 |
| equipment | string | 所需设备/环境说明 |
| status | atom | 发布状态: `:draft` / `:published` / `:archived` |
| sort_order | integer | 排序序号 (同课程内显示顺序) |
| guide_url | string | 实验指导书URL |
| guide_title | string | 实验指导书标题 |
| course_id | UUID (FK) | 关联课程 (必填) |
| chapter_id | UUID (FK) | 关联章节 (可选) |
| created_by_id | UUID (FK) | 创建者 |

### 2.2 ExperimentKnowledgeResource (实验-知识点关联)

关联表，连接实验和知识点资源。

| 字段 | 类型 | 说明 |
|--------|------|------|
| id | UUID | 主键 |
| experiment_id | UUID (FK) | 实验 ID |
| knowledge_resource_id | UUID (FK) | 知识点 ID |

### 2.3 ExperimentAbility (实验-能力目标关联)

关联表，连接实验和能力目标。

| 字段 | 类型 | 说明 |
|--------|------|------|
| id | UUID | 主键 |
| experiment_id | UUID (FK) | 实验 ID |
| ability_type | atom | 能力类型: `:main_ability` / `:sub_ability` |
| main_ability_id | UUID (FK) | 主能力 ID (可选) |
| sub_ability_id | UUID (FK) | 子能力 ID (可选) |

## 三、API 接口

### 3.1 实验 CRUD

| 动作 | 方法 | 说明 |
|------|--------|------|
| create_experiment | create | 创建实验 |
| update_experiment | update | 更新实验 |
| destroy_experiment | destroy | 删除实验 |
| get_experiment | read | 获取单个实验 |
| list_experiments | read | 获取实验列表 |
| get_experiments_by_course | by_course | 获取课程的所有实验 |
| get_experiments_by_chapter | by_chapter | 获取章节的所有实验 |
| get_experiments_by_creator | by_creator | 获取创建者的实验 |
| get_published_experiments | published | 获取已发布的实验 |

### 3.2 关联管理

| 动作 | 说明 |
|------|------|
| add_knowledge_resource | 添加知识点关联 |
| remove_knowledge_resource | 移除知识点关联 |
| add_ability | 添加能力目标关联 |
| remove_ability | 移除能力目标关联 |
| update_guide_file | 更新实验指导书文件 |

## 四、数据库表结构

```sql
-- experiments 表
CREATE TABLE experiments (
    id UUID PRIMARY KEY,
    title VARCHAR NOT NULL,
    description TEXT,
    experiment_type VARCHAR NOT NULL DEFAULT 'online',
    duration_hours INTEGER,
    difficulty_level VARCHAR NOT NULL DEFAULT 'medium',
    objectives TEXT,
    requirements TEXT,
    equipment TEXT,
    status VARCHAR NOT NULL DEFAULT 'draft',
    sort_order INTEGER DEFAULT 1,
    guide_url TEXT,
    guide_title TEXT,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    inserted_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- experiment_knowledge_resources 表
CREATE TABLE experiment_knowledge_resources (
    id UUID PRIMARY KEY,
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    knowledge_resource_id UUID NOT NULL REFERENCES knowledge_resources(id) ON DELETE CASCADE,
    inserted_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- experiment_abilities 表
CREATE TABLE experiment_abilities (
    id UUID PRIMARY KEY,
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    ability_type VARCHAR NOT NULL,
    main_ability_id UUID REFERENCES main_abilities(id) ON DELETE CASCADE,
    sub_ability_id UUID REFERENCES sub_abilities(id) ON DELETE CASCADE,
    inserted_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

## 五、文件结构

```
lib/kg_edu/knowledge/
├── experiment.ex                    # 实验主资源
├── experiment_knowledge_resource.ex  # 实验-知识点关联
└── experiment_ability.ex            # 实验-能力目标关联
```

## 六、前端对接

### 6.1 TypeScript 类型定义

生成的类型定义可以在前端使用：

```typescript
// Experiment 类型
interface Experiment {
  id: string;
  title: string;
  description?: string;
  experimentType: 'online' | 'offline';
  durationHours?: number;
  difficultyLevel: 'easy' | 'medium' | 'hard';
  objectives?: string;
  requirements?: string;
  equipment?: string;
  status: 'draft' | 'published' | 'archived';
  sortOrder?: number;
  guideUrl?: string;
  guideTitle?: string;
  courseId: string;
  chapterId?: string;
  createdById?: string;
  knowledgeResourcesCount?: number;
}

// ExperimentAbility 类型
interface ExperimentAbility {
  id: string;
  experimentId: string;
  abilityType: 'main_ability' | 'sub_ability';
  mainAbilityId?: string;
  subAbilityId?: string;
}
```

### 6.2 RPC 调用示例

```typescript
// 创建实验
const experiment = await KnowledgeRpc.createExperiment({
  title: '单链表的实现',
  description: '本实验要求学生使用C/C++实现单链表的基本操作',
  experimentType: 'online',
  difficultyLevel: 'medium',
  durationHours: 2,
  objectives: '掌握单链表的基本操作',
  courseId: course_id,
  createdById: user_id,
  knowledgeResourceIds: [resource_id_1, resource_id_2],
  abilityIds: [
    { abilityType: 'main_ability', mainAbilityId: ability_id_1 },
    { abilityType: 'sub_ability', subAbilityId: ability_id_2 }
  ]
});

// 获取课程的实验列表
const experiments = await KnowledgeRpc.getExperimentsByCourse({ courseId: course_id });

// 添加知识点关联
await KnowledgeRpc.addKnowledgeResourceToExperiment({
  id: experiment_id,
  knowledgeResourceId: resource_id
});
```

## 七、使用说明

1. **创建实验**: 调用 `create_experiment` 创建新实验
2. **更新实验**: 调用 `update_experiment` 更新实验信息
3. **添加关联**: 使用 `add_knowledge_resource` 和 `add_ability` 添加知识点和能力目标
4. **更新指导书**: 使用 `update_guide_file` 更新实验指导书文件URL

## 八、后续扩展

1. 实验提交与评价
2. 实验进度跟踪
3. 实验报告管理
4. 实验数据统计

## ADDED Requirements

### Requirement: AI命令模板选择功能
系统SHALL在AI命令管理页面提供预设模板选择功能，教师可以浏览并使用预设模板快速创建AI命令。

#### Scenario: 显示模板选择入口
- **WHEN** 教师打开AI命令管理页面
- **THEN** 页面显示"使用模板"按钮或模板选择区域

#### Scenario: 浏览预设模板列表
- **WHEN** 教师点击模板选择入口
- **THEN** 系统展示4个预设模板的列表，包括模板名称和简短描述

#### Scenario: 预览模板内容
- **WHEN** 教师鼠标悬停在某个模板上或点击预览
- **THEN** 系统显示该模板的完整内容（system prompt和user prompt）

#### Scenario: 使用模板创建命令
- **WHEN** 教师选择某个模板并确认使用
- **THEN** 系统自动填充表单字段（title、user、system），教师可以进一步编辑后保存

### Requirement: 预设模板内容
系统MUST提供4个针对大学设计课程教学的预设AI命令模板。

#### Scenario: 课程设计助手模板
- **WHEN** 教师选择"课程设计助手"模板
- **THEN** 模板包含：
  - 名称：课程设计助手
  - 描述：帮助设计课程大纲、教学活动和评估方式
  - System Prompt：设定AI为课程设计专家角色
  - User Prompt：课程设计相关的提问模板

#### Scenario: 教学内容生成模板
- **WHEN** 教师选择"教学内容生成"模板
- **THEN** 模板包含：
  - 名称：教学内容生成助手
  - 描述：根据课程目标生成教学材料和内容
  - System Prompt：设定AI为教学内容创作专家
  - User Prompt：教学内容生成相关的提问模板

#### Scenario: 作业批改助手模板
- **WHEN** 教师选择"作业批改助手"模板
- **THEN** 模板包含：
  - 名称：作业批改助手
  - 描述：帮助批改学生作业并提供反馈
  - System Prompt：设定AI为作业批改专家角色
  - User Prompt：作业批改相关的提问模板

#### Scenario: 教学问答助手模板
- **WHEN** 教师选择"教学问答助手"模板
- **THEN** 模板包含：
  - 名称：教学问答助手
  - 描述：回答学生提出的课程相关问题
  - System Prompt：设定AI为课程问答专家角色
  - User Prompt：问答相关的提问模板

### Requirement: 模板配置管理
预设模板数据SHALL通过配置文件管理，便于维护和扩展。

#### Scenario: 模板数据存储
- **WHEN** 系统加载AI命令管理页面
- **THEN** 预设模板数据从配置文件（如aiCommandTemplates.ts）加载

#### Scenario: 模板数据结构
- **WHEN** 系统加载模板数据
- **THEN** 每个模板包含id、name、description、systemPrompt、userPrompt五个字段

## ADDED Requirements

### Requirement: 表格描述列文本截断
能力管理表格中的描述列 SHALL 在文本超出宽度时自动截断，并显示省略号。

#### Scenario: 描述文本过长时截断显示
- **WHEN** 能力管理表格中描述字段的文本超过列宽
- **THEN** 文本显示部分内容并以省略号结尾，完整文本在鼠标悬停时通过 Tooltip 显示

#### Scenario: 描述文本正常时完整显示
- **WHEN** 能力管理表格中描述字段的文本未超过列宽
- **THEN** 文本完整显示，不显示 Tooltip

### Requirement: 图谱节点悬停显示描述
能力图谱中的节点 SHALL 在鼠标悬停时显示完整的描述信息。

#### Scenario: 主能力节点悬停显示描述
- **WHEN** 用户鼠标悬停在能力图谱的主能力节点上
- **THEN** Tooltip 显示节点名称和描述文本（如果有）

#### Scenario: 子能力节点悬停显示描述
- **WHEN** 用户鼠标悬停在能力图谱的子能力节点上
- **THEN** Tooltip 显示节点名称和描述文本（如果有）

#### Scenario: 知识点节点悬停显示描述
- **WHEN** 用户鼠标悬停在能力图谱的知识点节点上
- **THEN** Tooltip 显示节点名称和描述文本（如果有）

### Requirement: 无描述时 tooltip 显示逻辑
当节点没有描述文本时，Tooltip SHALL 显示合适的提示信息。

#### Scenario: 节点无描述时显示节点类型提示
- **WHEN** 能力节点没有设置描述文本
- **THEN** Tooltip 仅显示节点名称和类别，不显示空描述

## ADDED Requirements

### Requirement: 创建考试时时间输入格式
用户创建考试时 SHALL 使用统一的日期时间格式进行输入。

#### Scenario: 输入考试时间
- **WHEN** 用户在创建考试表单中输入考试时间
- **THEN** 时间输入使用 "YYYY-MM-DD HH:mm" 格式

### Requirement: 表格展示时间格式
试卷列表表格中的考试时间和截止时间 SHALL 使用与创建时相同的格式显示。

#### Scenario: 查看考试时间
- **WHEN** 用户查看试卷列表
- **THEN** 考试时间和截止时间列使用 "YYYY-MM-DD HH:mm" 格式显示

### Requirement: 时间格式一致性
创建考试时输入的时间和表格展示的时间 SHALL 保持格式一致。

#### Scenario: 验证时间一致性
- **WHEN** 用户创建一场考试后查看试卷列表
- **THEN** 列表中显示的考试时间和截止时间与创建时输入的时间格式和数值一致

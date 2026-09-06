## ADDED Requirements

### Requirement: 选择题正确答案得满分
AI批改选择题时，学生答案与正确答案一致 SHALL 获得该题满分。

#### Scenario: 选择题答案正确
- **WHEN** AI批改一道选择题，学生答案与正确答案一致
- **THEN** 该题得分等于该题设定的分值

### Requirement: 选择题答案错误得0分
AI批改选择题时，学生答案与正确答案不一致 SHALL 获得0分。

#### Scenario: 选择题答案错误
- **WHEN** AI批改一道选择题，学生答案与正确答案不一致
- **THEN** 该题得分为0

### Requirement: 选择题判分逻辑准确
选择题判分 SHALL 正确比对答案并计算得分。

#### Scenario: AI准确判分
- **WHEN** AI对包含多道选择题的试卷进行批改
- **THEN** 每道题根据答案是否正确得相应分数，总分为各题得分之和

## ADDED Requirements

### Requirement: Student can self-enroll in a course
已登录学生可以在课程详情页点击"立即选课"按钮完成选课操作。

#### Scenario: Student clicks enroll button
- **WHEN** 登录学生查看未选课程详情页，点击"立即选课"按钮
- **THEN** 系统调用选课 API，完成后显示成功提示并跳转到课程学习页面

#### Scenario: Enrollment fails
- **WHEN** 选课 API 调用失败
- **THEN** 系统显示错误提示，按钮恢复可点击状态

#### Scenario: Enrollment in progress
- **WHEN** 学生点击"立即选课"按钮后
- **THEN** 按钮显示加载状态，禁止重复点击

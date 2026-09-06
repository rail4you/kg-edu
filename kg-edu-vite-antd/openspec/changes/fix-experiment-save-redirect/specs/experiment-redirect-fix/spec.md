## ADDED Requirements

### Requirement: 实验保存后重定向到正确课程
实验创建或更新成功后，系统 SHALL 自动跳转到对应课程的实验管理页面，并自动选中该课程显示实验列表。

#### Scenario: 创建实验后重定向
- **WHEN** 教师在实验表单页面填写实验信息并点击保存
- **AND** 后端返回保存成功
- **THEN** 系统 SHALL 跳转到 `/teacher/dashboard/experiment-management?courseId=<实验所属课程ID>`
- **AND** 页面加载后自动选中对应课程并显示该课程的实验列表

#### Scenario: 更新实验后重定向
- **WHEN** 教师在实验表单页面修改实验信息并点击保存
- **AND** 后端返回更新成功
- **THEN** 系统 SHALL 跳转到 `/teacher/dashboard/experiment-management?courseId=<实验所属课程ID>`
- **AND** 页面加载后自动选中对应课程并显示该课程的实验列表

#### Scenario: 从课程页面直接创建实验
- **WHEN** 教师在课程详情页面点击"添加实验"按钮
- **AND** 在实验表单中保存实验
- **THEN** 保存成功后 SHALL 跳转到该课程的实验管理页面

### Requirement: 实验管理页面支持 URL 参数初始化课程选中状态
实验管理页面 SHALL 支持从 URL query 参数读取课程 ID 并初始化选中状态。

#### Scenario: URL 包含 courseId 参数
- **WHEN** 用户访问 `/teacher/dashboard/experiment-management?courseId=xxx`
- **THEN** 页面 SHALL 自动设置 `selectedCourseId` 为 URL 中的 courseId 值
- **AND** 页面显示该课程的实验列表

#### Scenario: URL 不包含 courseId 参数
- **WHEN** 用户访问 `/teacher/dashboard/experiment-management` (无参数)
- **THEN** 页面 SHALL 保持默认状态，不选中任何课程

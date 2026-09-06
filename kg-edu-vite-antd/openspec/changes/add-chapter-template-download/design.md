## Context

当前章节管理页面(chapter.tsx)缺少批量导入功能，教师需要手动逐个创建章节。已有的模板管理系统(template-management.tsx)支持多种类型的文件模板下载(如exercise、knowledge等)，需要复用此能力添加章节模板支持。

## Goals / Non-Goals

**Goals:**
- 在模板管理页面添加 chapter 模板类型
- 在章节管理页面添加下载章节模板按钮
- 实现模板查询和下载功能

**Non-Goals:**
- 不实现章节批量导入功能(仅提供模板下载)
- 不修改后端API

## Decisions

1. **复用现有模板系统**: 使用已有的 `getFileTemplateBySection` API 获取模板文件，与其他模板(exercise、knowledge等)保持一致的实现模式

2. **UI位置**: 在章节管理页面的工具栏区域添加"下载模板"按钮，参考 exercise.tsx 的实现方式

3. **模板类型定义**: 在 template-management.tsx 的 TEMPLATE_SECTIONS 中添加 chapter 类型，label 为"章节"

## Risks / Trade-offs

无重大风险。此功能为增量功能，不影响现有功能。

## Why

目前章节管理页面(chapter.tsx)仅支持手动创建和编辑章节内容，缺少批量导入功能。教师需要一种便捷的方式来批量创建章节结构，特别是在创建新课程或需要快速搭建章节框架时。通过增加章节模板下载功能，教师可以下载预定义的章节模板Excel文件，根据模板格式填写后批量导入章节。

## What Changes

1. 在模板管理页面的 `TEMPLATE_SECTIONS` 中新增 `chapter` (章节) 类型
2. 在章节管理页面增加"下载章节模板"按钮
3. 实现章节模板查询和下载功能，通过 `getFileTemplateBySection` API 获取模板文件

## Capabilities

### New Capabilities
- `chapter-template-download`: 章节模板下载功能，允许教师从章节管理页面下载章节导入模板

### Modified Capabilities
- 无

## Impact

- 修改文件: `src/pages/teacher/template-management.tsx` - 添加 chapter 到 TEMPLATE_SECTIONS
- 修改文件: `src/pages/teacher/chapter.tsx` - 添加下载模板按钮和下载逻辑

## 1. Add Chapter Template Section

- [x] 1.1 Add `chapter` to TEMPLATE_SECTIONS in `src/pages/teacher/template-management.tsx`

## 2. Add Download Button to Chapter Page

- [x] 2.1 Import `getFileTemplateBySection` from `@/lib/ash_rpc` in `src/pages/teacher/chapter.tsx`
- [x] 2.2 Import `DownloadOutlined` icon from `@ant-design/icons`
- [x] 2.3 Add "下载章节模板" button to the chapter page toolbar (next to existing buttons)
- [x] 2.4 Implement `handleDownloadTemplate` function using `getFileTemplateBySection` API with section "chapter"
- [x] 2.5 Handle success case: create download link and trigger download with filename "chapter_import_template.xlsx"
- [x] 2.6 Handle error case: display error message when template not found or download fails

---
name: teaching-docx
description: Generate KgEdu teaching DOCX documents with OSS link and database persistence. Use when the user asks for teaching documents, lesson plans, teaching notes, or curriculum text that should be exported as DOCX.
---

# Teaching DOCX

## Workflow

1. Call `kg_get_courses` and confirm the course.
2. If the document is tied to a knowledge point, call `kg_get_knowledge_resources` and match the knowledge point.
3. Draft the document content in Chinese.
4. Call `kg_generate_docx` with `content`, `courseId`, and when available `knowledgeResourceId`.
5. Call `kg_list_ai_generated_files_by_course` to confirm the generated DOCX is visible in AI files.

## Requirements

- `courseId` is mandatory.
- When the user asks for a downloadable document, include the returned URL.
- Keep the final answer concise and do not expose internal identifiers unless requested.

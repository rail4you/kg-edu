---
name: pptx-courseware
description: Generate KgEdu PPTX courseware for a course or knowledge point with stable post-checks. Use when the user asks to create PPT, PPTX, slides, lesson courseware, or a presentation for a course or knowledge point.
---

# PPTX Courseware

## Workflow

1. Call `kg_get_courses` and match the target course.
2. If the user mentions a knowledge point, call `kg_get_knowledge_resources` and match that knowledge point.
3. Call `kg_generate_pptx` with `courseName`, `courseId`, and when available `knowledgeName` and `knowledgeResourceId`.
4. After generation, call `kg_list_ai_generated_files_by_course` to confirm the file is visible in AI files.

## Requirements

- Prefer passing both `courseId` and `knowledgeResourceId` when you have them.
- Do not claim generation succeeded unless the tool returns success.
- In the final answer, include the PPTX URL and state that the file has been recorded in AI files after the post-check passes.

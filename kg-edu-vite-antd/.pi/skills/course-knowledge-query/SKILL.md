---
name: course-knowledge-query
description: Query courses, knowledge resources, and knowledge counts for KgEdu teacher assistant tasks. Use when the user asks about available courses, course knowledge points, or wants to verify counts such as how many knowledge points a course has.
---

# Course Knowledge Query

## Rules

- Always call `kg_get_courses` before assuming a course exists.
- When the user refers to a specific knowledge point, call `kg_get_knowledge_resources` for the matched course and verify the knowledge point by name.
- When the user asks for a count, call `kg_count_knowledge_resources`. Do not estimate.
- Hide internal UUIDs in the final answer unless the user explicitly asks for identifiers.

## Output

- Return concise Chinese answers.
- If a course or knowledge point is not found, say so directly.

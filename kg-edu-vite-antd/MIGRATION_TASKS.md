# Batch Migration Tasks

## Migration Command

For each page, spawn an agent with this task:

```
Migrate page from MUI to Ant Design.

Source: /Users/bai/projects/kg-edu/minimal-vite-ts/src/pages/teacher/dashboard/{SOURCE_FILE}
Target: /Users/bai/projects/kg-edu/kg-edu-vite-antd/src/pages/teacher/{TARGET_FILE}

Follow instructions in: /Users/bai/projects/kg-edu/kg-edu-vite-antd/MIGRATION_AGENT.md
```

## Pages to Migrate

### High Priority (Core Features)

| #   | Source File              | Target File              | Status     | Agent Task |
| --- | ------------------------ | ------------------------ | ---------- | ---------- |
| 1   | `index.tsx`              | `dashboard.tsx`          | ✅ Done    | -          |
| 2   | `course.tsx`             | `course.tsx`             | ⏳ Pending | -          |
| 3   | `student-enrollment.tsx` | `student-enrollment.tsx` | ⏳ Pending | -          |
| 4   | `knowledge-resource.tsx` | `knowledge-resource.tsx` | ⏳ Pending | -          |
| 5   | `knowledge-relation.tsx` | `knowledge-relation.tsx` | ⏳ Pending | -          |
| 6   | `exercise.tsx`           | `exercise.tsx`           | ⏳ Pending | -          |
| 7   | `exam-management.tsx`    | `exam-management.tsx`    | ⏳ Pending | -          |

### Medium Priority (Extended Features)

| #   | Source File       | Target File       | Status     |
| --- | ----------------- | ----------------- | ---------- |
| 8   | `chapter.tsx`     | `chapter.tsx`     | ⏳ Pending |
| 9   | `file.tsx`        | `file.tsx`        | ⏳ Pending |
| 10  | `question.tsx`    | `question.tsx`    | ⏳ Pending |
| 11  | `homework.tsx`    | `homework.tsx`    | ⏳ Pending |
| 12  | `ai_exercise.tsx` | `ai-exercise.tsx` | ⏳ Pending |
| 13  | `ai-file.tsx`     | `ai-file.tsx`     | ⏳ Pending |
| 14  | `chat.tsx`        | `chat.tsx`        | ⏳ Pending |
| 15  | `settings.tsx`    | `settings.tsx`    | ⏳ Pending |

### Low Priority (Advanced Features)

| #   | Source File            | Target File            | Status     |
| --- | ---------------------- | ---------------------- | ---------- |
| 16  | `graph-knowledge.tsx`  | `graph-knowledge.tsx`  | ⏳ Pending |
| 17  | `graph-tree.tsx`       | `graph-tree.tsx`       | ⏳ Pending |
| 18  | `graph-competency.tsx` | `graph-competency.tsx` | ⏳ Pending |
| 19  | `exam-statistics.tsx`  | `exam-statistics.tsx`  | ⏳ Pending |
| 20  | `exam-grading.tsx`     | `exam-grading.tsx`     | ⏳ Pending |
| 21  | `video.tsx`            | `video.tsx`            | ⏳ Pending |
| 22  | `course-video.tsx`     | `course-video.tsx`     | ⏳ Pending |

## Running Batch Migration

### Option 1: Sequential (Safe)

Migrate one page at a time, test, then move to next.

### Option 2: Parallel (Fast)

Spawn multiple agents for independent pages:

```bash
# Run these in parallel (no dependencies between them)
- course.tsx
- exercise.tsx
- exam-management.tsx
- knowledge-relation.tsx
```

### Option 3: Grouped (Balanced)

Group related pages and migrate together:

**Group A - Course Management:**

- course.tsx
- chapter.tsx
- student-enrollment.tsx

**Group B - Knowledge:**

- knowledge-resource.tsx
- knowledge-relation.tsx
- graph-knowledge.tsx

**Group C - Assessment:**

- exercise.tsx
- question.tsx
- exam-management.tsx
- homework.tsx

**Group D - Resources:**

- file.tsx
- video.tsx
- course-video.tsx

**Group E - AI Features:**

- ai_exercise.tsx
- ai-file.tsx
- chat.tsx

## Notes

1. **Dependencies**: Some pages may share components or utilities - check before migrating
2. **Testing**: After migration, run `npm run dev` and test each page
3. **API Changes**: Ensure API functions exist in `ash_rpc.ts` for new project
4. **Auth**: Always use `getAuthHeaders(user)` and `tenant` parameter

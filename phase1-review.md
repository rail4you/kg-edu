# Phase 1 Backend Review: Micro-Major Module Redesign

**Date**: 2025-05-25  
**Reviewer**: Automated Code Review  
**Scope**: All new and modified Ash resources, domain registration, and tenant migration

---

## Review

### Correct

1. **New independent course entity (MicroMajorCourse)** — The resource correctly defines a standalone course with its own title, description, cover_url, teacher_id, sort_order, status, and source_course_id. The old join-table pattern (micro_major_id + course_id) has been completely replaced.  
   *Evidence*: `micro_major_course.ex` lines 1–170; diff shows removal of `course_id`, `credit`, `period`, `semester`, `course_type` attributes and `belongs_to :course` relationship.

2. **4 new sub-resources follow existing patterns**:
   - `MicroMajorChapter` mirrors `Courses.Chapter` (self-referential parent, sort_order, path, course_full_hierarchy action)
   - `MicroMajorVideo` mirrors `Courses.Video` (asset_id, playback_id, duration, thumbnail)
   - `MicroMajorExercise` mirrors `Knowledge.Exercise` (question_type atom with same 7 variants, options map, difficulty, position)
   - `MicroMajorResource` mirrors `Courses.File` (filename, path, size, file_type)
   *Evidence*: Compared attribute-by-attribute with `courses/video.ex`, `courses/chapter.ex`, `knowledge/exercise.ex`, `courses/file.ex`.

3. **Cross-references are correct**:
   - `MicroMajorCourse` → has_many chapters/videos/exercises/resources with `destination_attribute: :micro_major_course_id` ✓
   - `MicroMajorChapter` → has_many subchapters (self-ref via `parent_chapter_id`), videos/exercises/resources (via `micro_major_chapter_id`) ✓
   - `MicroMajorVideo/Exercise/Resource` → belongs_to `micro_major_course` and `micro_major_chapter` ✓
   - `MicroMajor` → has_many `micro_major_courses` via `destination_attribute: :micro_major_id` ✓
   - `MicroMajorEnrollment` → has_many `micro_major_courses` via source/dest `micro_major_id` (correctly gives all courses for the enrolled micro-major) ✓

4. **Migration table structure matches Ash resource attributes**:
   - Every attribute in each resource has a corresponding column in the migration with correct types:
     - Ash `:string` → PG `text` or `:string` (both valid; Ash maps `:string` to PG `text`)
     - Ash `:atom` → PG `:string` (correct: atoms stored as strings)
     - Ash `:map` → PG `:jsonb` ✓
     - Ash `:float` → PG `:float` ✓
     - Ash `:integer` → PG `:integer` ✓
     - Ash `:uuid` → PG `:uuid` ✓
   - Foreign keys and `on_delete` constraints match between Ash `references` blocks and migration `references()` calls ✓
   - Migration correctly creates indexes on all foreign key columns ✓

5. **Domain registration is complete**:
   - All 5 new resources registered in `resources` block ✓
   - All RPC actions registered in `typescript_rpc` block ✓
   - Old `replace_micro_major_courses` RPC action removed ✓
   - New actions (`by_id` on Course, all Chapter/Video/Exercise/Resource actions) registered ✓

6. **Import actions reference correct source models**:
   - `MicroMajorVideo.import_from_course` → reads from `KgEdu.Courses.Video` ✓
   - `MicroMajorExercise.import_from_course` → reads from `KgEdu.Knowledge.Exercise` ✓
   - `MicroMajorResource.import_from_course` → reads from `KgEdu.Courses.File` ✓
   - All source attribute names match verified source models ✓
   - Import correctly passes `tenant: tenant` since source models also use context-based multitenancy ✓

7. **Old relationship cleanup**:
   - `MicroMajor` removed `many_to_many :courses` through join resource ✓
   - `MicroMajor.by_id` and `by_teacher` no longer load `:courses` ✓
   - `MicroMajorEnrollment.my_enrollments` no longer loads `courses: [:micro_major_courses]` ✓

8. **Tenant migration follows project conventions**:
   - Does not use `prefix()` — consistent with recent tenant migrations (e.g., `20260114101854`, `20260507020000`, `20260525000000`) where Ash handles the tenant prefix automatically ✓
   - Module name follows `KgEdu.Repo.TenantMigrations.*` pattern ✓

---

### Note

1. **MicroMajorCourse publish/unpublish not registered as RPC actions**  
   `MicroMajorCourse` defines `publish` and `unpublish` update actions (lines ~82–89) but neither is registered as an RPC action in the domain. This is likely intentional since the generic `update` action accepts `:status`, but if the frontend needs dedicated publish/unpublish endpoints, they'll need to be added.  
   *Location*: `major_analysis.ex`, `MicroMajorCourse` RPC block (no `publish_micro_major_course` or `unpublish_micro_major_course`)

2. **Migration `down` is destructive and produces schema/resource mismatch**  
   The `down` function drops all 5 new tables and recreates the old `micro_major_courses` join table (with `course_id`, `credit`, `period`, etc.). However, the Ash resource module `MicroMajorCourse` has been completely rewritten and no longer matches the old schema. Rolling back this migration without also reverting the resource code would cause runtime errors. This is acceptable for a deliberate schema redesign but should be documented.

3. **MicroMajor publish action has redundant `accept [:status]`**  
   `MicroMajor.publish` accepts `:status` via `accept` but immediately overrides it with `set_attribute(:status, :active)`. The `accept [:status]` is harmless but misleading — removing it would clarify intent. Same for `unpublish`.  
   *Location*: `micro_major.ex` lines ~110–121

4. **MicroMajorEnrollment.micro_major_courses relationship is a cross-entity has_many**  
   The `has_many :micro_major_courses` on `MicroMajorEnrollment` goes from enrollment's `micro_major_id` to `MicroMajorCourse.micro_major_id`. This works correctly but is unusual — it gives all courses for the micro-major, not courses specific to the enrollment. This is semantically correct for the current design (enrollments are per micro-major, not per course), but worth noting for future reference.

5. **MicroMajorChapter.create uses `get_argument` for `sort_order` default**  
   The create action uses a custom change to default `sort_order` to 0. This works, but a simpler approach would be to rely on the attribute-level `default: 0` that's already defined. The `get_argument` check handles the case where `sort_order` is explicitly passed as `nil`, but Ash's `default` should handle the `nil` case already. Minor redundancy, not a bug.

6. **No JSON API routes for new resources**  
   The new resources only have RPC actions, no JSON API routes. This is consistent with how micro-major resources were handled before (they were always RPC-only). If REST API access is needed later, routes can be added.

---

### Blocker

None found. The implementation is complete and consistent.

---

## Summary

The Phase 1 backend implementation is well-structured and follows established project patterns. All 5 new resources are correctly defined, cross-referenced, and registered in the domain. The migration matches the resource schemas. The old join-table pattern has been cleanly replaced with independent course entities. The import actions correctly reference source models and handle multi-tenancy. No compilation blockers or data integrity issues were found.

**Verdict**: ✅ Ready for Phase 2

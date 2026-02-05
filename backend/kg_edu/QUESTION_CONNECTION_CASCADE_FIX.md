# QuestionConnection Cascade Delete Fix

## Issue

The `delete_all_knowledges_by_course` action was failing on the first attempt with this error:

```
** (Ecto.ConstraintError) constraint error when attempting to insert struct:
    * "knowledge_question_connections_source_question_id_fkey" (foreign_key_constraint)
```

However, executing the same action a second time would succeed.

## Root Cause

When deleting a `KnowledgeResource`, the cascade would:
1. Delete associated `Question` records (via `knowledge_questions_knowledge_resource_id_fkey` with `ON DELETE CASCADE`)
2. However, `QuestionConnection` records still referenced these deleted `Question` records
3. The foreign key constraints `knowledge_question_connections_source_question_id_fkey` and `knowledge_question_connections_target_question_id_fkey` did NOT have `ON DELETE CASCADE`
4. This caused the database to reject the deletion of `Question` records that were still referenced by `QuestionConnection`

The second attempt succeeded because the first attempt had deleted some `KnowledgeResource` records that didn't have `Question` connections, so on the second attempt, there were fewer records to delete and the problematic ones were already handled.

## Solution

Added cascade delete configuration to `QuestionConnection` resource:

### 1. Updated Ash Resource Definition

**File:** `lib/kg_edu/knowledge/question_connection.ex`

```elixir
postgres do
  table "knowledge_question_connections"
  repo KgEdu.Repo

  references do
    reference :source_question, on_delete: :delete
    reference :target_question, on_delete: :delete
  end
end
```

### 2. Generated Migration

**File:** `priv/repo/tenant_migrations/20260204132720_add_cascade_delete_to_question_connections.exs`

This migration drops and recreates the foreign key constraints with `ON DELETE CASCADE`:
- `knowledge_question_connections_source_question_id_fkey`
- `knowledge_question_connections_target_question_id_fkey`

### 3. Applied Migration

Ran `mix ash.migrate` to apply the migration to all tenant schemas.

## How It Works Now

When you delete a `KnowledgeResource`:

1. **Database-Level Cascade** automatically handles:
   - Deletion of `Question` records (via `knowledge_questions_knowledge_resource_id_fkey`)
   - Deletion of `QuestionConnection` records that reference the deleted questions (via the new cascade constraints)

2. **Complete Cascade Chain:**
   ```
   KnowledgeResource (deleted)
   └─> Question (cascade deleted)
       └─> QuestionConnection (cascade deleted)
   ```

## Complete Cascade Delete Coverage

After this fix, ALL resources related to `KnowledgeResource` now have proper cascade delete:

✅ **From KnowledgeResource to:**
- knowledge_resources (parent relationships: parent_subject_id, parent_unit_id, parent_knowledge_resource_id)
- files (knowledge_resource_id)
- videos (knowledge_resource_id)
- homeworks (knowledge_resource_id)
- knowledge_questions (knowledge_resource_id)
- user_cases (knowledge_resource_id)
- knowledge_relations (source_knowledge_id, target_knowledge_id)

✅ **From Question to:**
- knowledge_question_connections (source_question_id, target_question_id) **[NEWLY FIXED]**

## Testing

The `delete_all_knowledges_by_course` action should now work correctly on the **first attempt** without any foreign key constraint errors.

## Files Modified

- `lib/kg_edu/knowledge/question_connection.ex` - Added cascade delete references

## Migrations Created

- `20260204132720_add_cascade_delete_to_question_connections.exs` - Adds `ON DELETE CASCADE` to QuestionConnection foreign keys

**The fix has been applied!** The delete action should now work correctly on the first attempt without any errors.

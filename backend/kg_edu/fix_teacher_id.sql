-- Simple SQL to add teacher_id column to all tenant schemas
-- Run this directly in PostgreSQL if migrations aren't working

DO $$
DECLARE
    tenant_schema record;
BEGIN
    -- Loop through all tenant schemas (schemas that start with 'org_')
    FOR tenant_schema IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name LIKE 'org_%'
    LOOP
        -- Add teacher_id column if it doesn't exist
        EXECUTE format('ALTER TABLE %I.courses ADD COLUMN IF NOT EXISTS teacher_id UUID;', tenant_schema.schema_name);

        -- Add foreign key constraint if it doesn't exist
        EXECUTE format('
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = %L
                    AND table_name = %L
                    AND table_schema = %L
                ) THEN
                    ALTER TABLE %I.courses
                    ADD CONSTRAINT courses_teacher_id_fkey
                    FOREIGN KEY (teacher_id) REFERENCES %I.users(id);
                END IF;
            END $$;
        ', 'courses_teacher_id_fkey', 'courses', tenant_schema.schema_name, tenant_schema.schema_name, tenant_schema.schema_name);
    END LOOP;
END $$;
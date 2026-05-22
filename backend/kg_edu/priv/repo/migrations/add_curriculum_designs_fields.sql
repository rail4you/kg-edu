-- 为所有租户添加 curriculum_designs 表的新字段
-- 执行方式: psql -U postgres -d kg_edu -f this_script.sql

-- 获取所有租户 schema
DO $$
DECLARE
  tenant_schema TEXT;
BEGIN
  FOR tenant_schema IN 
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name LIKE 'org_%'
  LOOP
    -- 检查表是否存在
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = tenant_schema 
      AND table_name = 'curriculum_designs'
    ) THEN
      -- 添加新字段（如果不存在）
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = tenant_schema 
        AND table_name = 'curriculum_designs' 
        AND column_name = 'file_url'
      ) THEN
        EXECUTE format('ALTER TABLE %I.curriculum_designs ADD COLUMN file_url TEXT', tenant_schema);
        RAISE NOTICE 'Added file_url to %.curriculum_designs', tenant_schema;
      END IF;
      
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = tenant_schema 
        AND table_name = 'curriculum_designs' 
        AND column_name = 'markdown_content'
      ) THEN
        EXECUTE format('ALTER TABLE %I.curriculum_designs ADD COLUMN markdown_content TEXT', tenant_schema);
        RAISE NOTICE 'Added markdown_content to %.curriculum_designs', tenant_schema;
      END IF;
    ELSE
      RAISE NOTICE 'Table %.curriculum_designs does not exist, skipping', tenant_schema;
    END IF;
  END LOOP;
END $$;

-- 验证结果
SELECT 
  table_schema as schema_name,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'curriculum_designs'
  AND column_name IN ('file_url', 'markdown_content')
ORDER BY table_schema, table_name, ordinal_position;
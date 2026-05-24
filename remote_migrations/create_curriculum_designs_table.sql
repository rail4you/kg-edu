-- 为所有租户创建 curriculum_designs 表
-- 执行方式: psql -U postgres -d kg_edu -f create_curriculum_designs_table.sql

DO $$
DECLARE
  tenant_schema TEXT;
BEGIN
  FOR tenant_schema IN 
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name LIKE 'org_%'
  LOOP
    -- 检查表是否已存在
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = tenant_schema 
      AND table_name = 'curriculum_designs'
    ) THEN
      -- 创建表
      EXECUTE format('
        CREATE TABLE %I.curriculum_designs (
          id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
          title varchar NOT NULL,
          description text,
          design_data text,
          file_url text,
          markdown_content text,
          ai_generated boolean DEFAULT false NOT NULL,
          version integer DEFAULT 1 NOT NULL,
          status varchar DEFAULT ''draft'',
          major_id uuid NOT NULL,
          inserted_at timestamp NOT NULL DEFAULT NOW(),
          updated_at timestamp NOT NULL DEFAULT NOW()
        )', tenant_schema);
      
      -- 添加外键约束
      EXECUTE format('
        ALTER TABLE %I.curriculum_designs 
        ADD CONSTRAINT curriculum_designs_major_id_fkey 
        FOREIGN KEY (major_id) 
        REFERENCES %I.majors(id) 
        ON DELETE CASCADE', tenant_schema, tenant_schema);
      
      RAISE NOTICE 'Created curriculum_designs table in schema %', tenant_schema;
    ELSE
      RAISE NOTICE 'Table %.curriculum_designs already exists, skipping', tenant_schema;
    END IF;
  END LOOP;
END $$;

-- 验证结果
SELECT 
  table_schema as schema_name,
  COUNT(*) as columns
FROM information_schema.columns
WHERE table_name = 'curriculum_designs'
GROUP BY table_schema
ORDER BY schema_name;

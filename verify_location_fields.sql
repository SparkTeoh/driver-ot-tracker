-- ============================================================================
-- 验证 check_in_location 和 check_out_location 字段是否存在
-- Run this in Supabase SQL Editor to check if the fields exist
-- ============================================================================

SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'work_logs' 
  AND column_name IN ('check_in_location', 'check_out_location')
ORDER BY column_name;

-- 如果上面的查询返回 2 行，说明字段已存在 ✅
-- 如果返回 0 行，说明需要运行 database_migration.sql ⚠️


-- ============================================================================
-- 仅添加 location 字段的 SQL 脚本
-- 如果只需要添加 check_in_location 和 check_out_location 字段
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Add check_in_location field (stores full address string where work started)
-- 添加入职位置字段（存储工作开始的完整地址字符串）
ALTER TABLE work_logs
ADD COLUMN IF NOT EXISTS check_in_location TEXT;

-- Add check_out_location field (stores full address string where work ended)
-- 添加离职位置字段（存储工作结束的完整地址字符串）
ALTER TABLE work_logs
ADD COLUMN IF NOT EXISTS check_out_location TEXT;

-- Add comments for documentation
COMMENT ON COLUMN work_logs.check_in_location IS 'Full address string where work started (derived from coordinates via reverse geocoding)';
COMMENT ON COLUMN work_logs.check_out_location IS 'Full address string where work ended (derived from coordinates via reverse geocoding)';

-- Verify the fields were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'work_logs' 
  AND column_name IN ('check_in_location', 'check_out_location')
ORDER BY column_name;


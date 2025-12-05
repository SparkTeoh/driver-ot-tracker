-- ============================================================================
-- Migration script to add new fields to work_logs table for detailed activity view
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- REQUIRED FIELDS (必须添加的字段)
-- ----------------------------------------------------------------------------

-- Add check_in_location field (stores full address string where work started)
-- 添加入职位置字段（存储工作开始的完整地址字符串）
ALTER TABLE work_logs
ADD COLUMN IF NOT EXISTS check_in_location TEXT;

-- Add check_out_location field (stores full address string where work ended)
-- 添加离职位置字段（存储工作结束的完整地址字符串）
ALTER TABLE work_logs
ADD COLUMN IF NOT EXISTS check_out_location TEXT;

-- Add is_outstation field (boolean to trigger RM 30 meal allowance)
-- 添加是否外派字段（布尔值，用于触发 RM 30 餐费津贴）
ALTER TABLE work_logs
ADD COLUMN IF NOT EXISTS is_outstation BOOLEAN DEFAULT FALSE;

-- Add day_type field (stores: 'weekday', 'weekend', or 'public_holiday')
-- 添加日期类型字段（存储：工作日、周末或公共假期）
-- Using CHECK constraint to ensure only valid values
-- 使用 CHECK 约束确保只接受有效值
ALTER TABLE work_logs
ADD COLUMN IF NOT EXISTS day_type TEXT 
  CHECK (day_type IS NULL OR day_type IN ('weekday', 'weekend', 'public_holiday'));

-- ----------------------------------------------------------------------------
-- OPTIONAL FIELDS (可选字段 - 仅在需要时取消注释)
-- ----------------------------------------------------------------------------

-- Note: check_in_time and check_out_time are NOT recommended because they
-- duplicate clock_in and clock_out fields. If you still want them for API
-- compatibility, uncomment the following lines:
-- 
-- ALTER TABLE work_logs
-- ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ;
-- 
-- ALTER TABLE work_logs
-- ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMPTZ;

-- ----------------------------------------------------------------------------
-- DOCUMENTATION (字段说明)
-- ----------------------------------------------------------------------------

COMMENT ON COLUMN work_logs.check_in_location IS 'Full address string where work started (derived from coordinates via reverse geocoding)';
COMMENT ON COLUMN work_logs.check_out_location IS 'Full address string where work ended (derived from coordinates via reverse geocoding)';
COMMENT ON COLUMN work_logs.is_outstation IS 'Whether this is an outstation overnight shift (triggers RM 30 meal allowance)';
COMMENT ON COLUMN work_logs.day_type IS 'Type of day: weekday, weekend, or public_holiday (used for OT calculation rates)';

-- ----------------------------------------------------------------------------
-- INDEXES (索引 - 用于提高查询性能)
-- ----------------------------------------------------------------------------

-- Create index on day_type for better query performance when filtering by day type
CREATE INDEX IF NOT EXISTS idx_work_logs_day_type ON work_logs(day_type);

-- Create index on is_outstation for filtering outstation records
CREATE INDEX IF NOT EXISTS idx_work_logs_is_outstation ON work_logs(is_outstation);

-- Optional: Composite index for common queries (e.g., filtering by day_type and is_outstation)
-- CREATE INDEX IF NOT EXISTS idx_work_logs_day_type_outstation ON work_logs(day_type, is_outstation);

-- ----------------------------------------------------------------------------
-- VERIFICATION (验证 - 检查字段是否添加成功)
-- ----------------------------------------------------------------------------

-- Uncomment to verify the new columns exist:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'work_logs'
-- ORDER BY ordinal_position;


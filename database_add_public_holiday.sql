-- ============================================================================
-- Add is_public_holiday field to work_logs table
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Add is_public_holiday field (boolean to mark if the day is a public holiday)
ALTER TABLE work_logs
ADD COLUMN IF NOT EXISTS is_public_holiday BOOLEAN DEFAULT FALSE;

-- Add comment to document the field
COMMENT ON COLUMN work_logs.is_public_holiday IS 'Boolean to mark if the day is a public holiday (manually set during check-in)';

-- Create index for better query performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_work_logs_is_public_holiday ON work_logs(is_public_holiday);

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'work_logs' AND column_name = 'is_public_holiday';


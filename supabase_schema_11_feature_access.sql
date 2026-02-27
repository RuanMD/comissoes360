-- =============================================
-- Feature Access Management
-- Adds feature_keys to plans, plan_id + feature_overrides to users
-- =============================================

-- 1. Add feature_keys column to plans table
ALTER TABLE plans ADD COLUMN IF NOT EXISTS feature_keys text[] DEFAULT '{}';

-- 2. Add plan_id and feature_overrides columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES plans(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS feature_overrides jsonb DEFAULT '{}';

-- 3. Create index for faster plan lookups
CREATE INDEX IF NOT EXISTS idx_users_plan_id ON users(plan_id);

-- Add pricing columns to models table for cost estimation
ALTER TABLE models ADD COLUMN input_price_per_mtok VARCHAR(20);
ALTER TABLE models ADD COLUMN output_price_per_mtok VARCHAR(20);

-- Add indexes for statistics query performance
CREATE INDEX idx_model_call_logs_created_at ON model_call_logs (created_at);
CREATE INDEX idx_model_call_logs_model_created ON model_call_logs (model_id, created_at);
CREATE INDEX idx_model_call_logs_user_created ON model_call_logs (user_id, created_at);

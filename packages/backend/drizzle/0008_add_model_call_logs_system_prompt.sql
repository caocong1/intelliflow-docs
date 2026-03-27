-- Phase 25-02: Add system_prompt column to model_call_logs for dual prompt support
ALTER TABLE "model_call_logs" ADD COLUMN "system_prompt" text;

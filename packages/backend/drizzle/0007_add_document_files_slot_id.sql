-- Add slot_id column to document_files for file slot semantics
ALTER TABLE "document_files" ADD COLUMN "slot_id" varchar(100);

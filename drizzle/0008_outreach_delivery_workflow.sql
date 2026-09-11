ALTER TABLE admin_campaign_batches ADD COLUMN destination_status TEXT NOT NULL DEFAULT 'REQUIRED';
ALTER TABLE admin_campaign_batches ADD COLUMN destination_channel TEXT;
ALTER TABLE admin_campaign_batches ADD COLUMN destination_name TEXT;
ALTER TABLE admin_campaign_batches ADD COLUMN destination_address TEXT;
ALTER TABLE admin_campaign_batches ADD COLUMN destination_source_url TEXT;
ALTER TABLE admin_campaign_batches ADD COLUMN draft_status TEXT NOT NULL DEFAULT 'REQUIRED';
ALTER TABLE admin_campaign_batches ADD COLUMN draft_subject TEXT;
ALTER TABLE admin_campaign_batches ADD COLUMN draft_body TEXT;
ALTER TABLE admin_campaign_batches ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE admin_campaign_batches ADD COLUMN delivered_at TEXT;

CREATE INDEX IF NOT EXISTS idx_admin_campaign_workflow
ON admin_campaign_batches(destination_status, draft_status, approval_status);

PRAGMA optimize;

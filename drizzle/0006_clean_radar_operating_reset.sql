DELETE FROM `admin_radar_signals`;
--> statement-breakpoint
DELETE FROM `admin_monitor_batches`;
--> statement-breakpoint
DELETE FROM `admin_activity_log` WHERE `entity_type` IN ('RADAR_SIGNAL','MONITOR_BATCH','RADAR_DISCOVERY');
--> statement-breakpoint
UPDATE `admin_radar_endpoints`
SET `pulls`=0,
    `changes`=0,
    `relevant_changes`=0,
    `research_escalations`=0,
    `case_contributions`=0,
    `publishable_events`=0,
    `last_checked_at`=NULL,
    `last_changed_at`=NULL,
    `content_fingerprint`=NULL,
    `content_excerpt`=NULL,
    `last_http_status`=NULL,
    `last_error`=NULL,
    `yield_score`=0;

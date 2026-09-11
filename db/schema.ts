import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const matters = sqliteTable(
  "matters",
  {
    id: text("id").primaryKey(),
    targetQuery: text("target_query").notNull(),
    jurisdiction: text("jurisdiction").notNull(),
    vendor: text("vendor").notNull().default("Flock Safety"),
    system: text("system").notNull().default("ALPR"),
    status: text("status").notNull().default("checkout_pending"),
    reportVersion: text("report_version").notNull().default("grand-island-v1"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("matters_status_created_idx").on(table.status, table.createdAt)],
);

export const purchases = sqliteTable(
  "purchases",
  {
    id: text("id").primaryKey(),
    matterId: text("matter_id").notNull(),
    tier: text("tier").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    status: text("status").notNull().default("pending"),
    buyerEmail: text("buyer_email"),
    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    accessTokenHash: text("access_token_hash"),
    accessCodeHash: text("access_code_hash"),
    accessExpiresAt: text("access_expires_at"),
    emailDeliveryStatus: text("email_delivery_status").notNull().default("pending"),
    emailDeliveredAt: text("email_delivered_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    paidAt: text("paid_at"),
  },
  (table) => [
    index("purchases_matter_idx").on(table.matterId),
    index("purchases_status_created_idx").on(table.status, table.createdAt),
    uniqueIndex("purchases_stripe_session_uidx").on(table.stripeSessionId),
    uniqueIndex("purchases_access_token_uidx").on(table.accessTokenHash),
  ],
);

export const researchRequests = sqliteTable(
  "research_requests",
  {
    id: text("id").primaryKey(),
    jurisdiction: text("jurisdiction").notNull(),
    normalizedJurisdiction: text("normalized_jurisdiction").notNull(),
    requesterEmail: text("requester_email").notNull(),
    status: text("status").notNull().default("requested"),
    sourceTargetSlug: text("source_target_slug"),
    acknowledgementSentAt: text("acknowledgement_sent_at"),
    notifiedAt: text("notified_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("research_requests_jurisdiction_email_uidx").on(
      table.normalizedJurisdiction,
      table.requesterEmail,
    ),
    index("research_requests_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const campaignDeliveryTargets = sqliteTable(
  "admin_campaign_delivery_targets",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id").notNull(),
    platform: text("platform").notNull(),
    destinationName: text("destination_name"),
    destinationUrl: text("destination_url"),
    sourceUrl: text("source_url"),
    postTitle: text("post_title"),
    postBody: text("post_body"),
    status: text("status").notNull().default("NEEDS_DESTINATION"),
    deliveredAt: text("delivered_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("admin_campaign_delivery_targets_campaign_platform_uidx").on(table.campaignId, table.platform),
    index("admin_campaign_delivery_targets_status_idx").on(table.status, table.updatedAt),
  ],
);

export const officialContacts = sqliteTable(
  "admin_official_contacts",
  {
    id: text("id").primaryKey(), jurisdiction: text("jurisdiction").notNull(), normalizedJurisdiction: text("normalized_jurisdiction").notNull(),
    name: text("name").notNull(), title: text("title"), organization: text("organization"), email: text("email").notNull(), phone: text("phone"),
    sourceUrl: text("source_url").notNull(), status: text("status").notNull().default("VERIFIED"), verifiedAt: text("verified_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("admin_official_contacts_jurisdiction_email_uidx").on(table.normalizedJurisdiction, table.email), index("admin_official_contacts_status_idx").on(table.status, table.updatedAt)],
);

export const marketGenerations = sqliteTable(
  "admin_market_generations",
  {
    id: text("id").primaryKey(),
    status: text("status").notNull().default("ACTIVE"),
    reason: text("reason").notNull(),
    archivedCountsJson: text("archived_counts_json").notNull().default("{}"),
    scanResultsJson: text("scan_results_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at"),
  },
  (table) => [index("admin_market_generations_status_idx").on(table.status, table.createdAt)],
);

export const marketGenerationRows = sqliteTable(
  "admin_market_generation_rows",
  {
    id: text("id").primaryKey(), generationId: text("generation_id").notNull(), tableName: text("table_name").notNull(),
    recordId: text("record_id"), payloadJson: text("payload_json").notNull(), archivedAt: text("archived_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("admin_market_generation_rows_generation_idx").on(table.generationId, table.tableName)],
);

export const marketCandidates = sqliteTable(
  "admin_market_candidates",
  {
    id: text("id").primaryKey(), generationId: text("generation_id").notNull(), clusterKey: text("cluster_key").notNull(), jurisdiction: text("jurisdiction").notNull(),
    issueType: text("issue_type").notNull(), qualificationState: text("qualification_state").notNull(), score: integer("score").notNull(), sourceCount: integer("source_count").notNull(),
    independentSourceCount: integer("independent_source_count").notNull(), sourceStrengthScore: integer("source_strength_score").notNull(), discrepancyScore: integer("discrepancy_score").notNull(),
    recencyScore: integer("recency_score").notNull(), quantifiedScore: integer("quantified_score").notNull(), officialActionScore: integer("official_action_score").notNull(),
    audienceScore: integer("audience_score").notNull(), contactScore: integer("contact_score").notNull(), metricCount: integer("metric_count").notNull().default(0),
    sourceUrlsJson: text("source_urls_json").notNull().default("[]"), newestSourceAt: text("newest_source_at"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("admin_market_candidates_generation_cluster_uidx").on(table.generationId, table.clusterKey), index("admin_market_candidates_state_score_idx").on(table.qualificationState, table.score)],
);

export const frictionOpportunities = sqliteTable(
  "admin_friction_opportunities",
  {
    id: text("id").primaryKey(), generationId: text("generation_id").notNull(), clusterKey: text("cluster_key").notNull(), jurisdiction: text("jurisdiction").notNull(),
    issueType: text("issue_type").notNull(), voiceType: text("voice_type").notNull(), voiceName: text("voice_name"), complaintSummary: text("complaint_summary").notNull(),
    originUrl: text("origin_url").notNull(), channel: text("channel").notNull(), publishedAt: text("published_at"), sourceCount: integer("source_count").notNull().default(1),
    independentSourceCount: integer("independent_source_count").notNull().default(1), specificityScore: integer("specificity_score").notNull(), harmScore: integer("harm_score").notNull(),
    corroborationScore: integer("corroboration_score").notNull(), officialResponseScore: integer("official_response_score").notNull(), reachabilityScore: integer("reachability_score").notNull(),
    recencyScore: integer("recency_score").notNull(), frictionScore: integer("friction_score").notNull(), state: text("state").notNull(), sourceUrlsJson: text("source_urls_json").notNull().default("[]"),
    auditStartedAt: text("audit_started_at"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("admin_friction_generation_cluster_uidx").on(table.generationId, table.clusterKey), index("admin_friction_state_score_idx").on(table.state, table.frictionScore)],
);

export const jurisdictionMetrics = sqliteTable(
  "admin_jurisdiction_metrics",
  {
    id: text("id").primaryKey(), normalizedJurisdiction: text("normalized_jurisdiction").notNull(), jurisdiction: text("jurisdiction").notNull(),
    metricKey: text("metric_key").notNull(), value: text("value").notNull(), label: text("label").notNull(), sourceUrl: text("source_url").notNull(), sourceDate: text("source_date"), excerpt: text("excerpt"), confidence: text("confidence").notNull().default("HIGH"),
    verificationStatus: text("verification_status").notNull().default("SOURCE_VERIFIED"), verifiedAt: text("verified_at").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("admin_jurisdiction_metrics_jurisdiction_key_uidx").on(table.normalizedJurisdiction, table.metricKey), index("admin_jurisdiction_metrics_verified_idx").on(table.verificationStatus, table.verifiedAt)],
);

export const jurisdictionAudits = sqliteTable(
  "admin_jurisdiction_audits",
  { id: text("id").primaryKey(), frictionId: text("friction_id").notNull(), censusId: text("census_id"), generationId: text("generation_id").notNull(), jurisdiction: text("jurisdiction").notNull(), normalizedJurisdiction: text("normalized_jurisdiction").notNull(), agency: text("agency"), status: text("status").notNull().default("ACQUISITION_REQUIRED"), sourceCount: integer("source_count").notNull().default(0), metricCount: integer("metric_count").notNull().default(0), authorityText: text("authority_text"), authoritySourceUrl: text("authority_source_url"), observedText: text("observed_text"), observedSourceUrl: text("observed_source_url"), discrepancyText: text("discrepancy_text"), missingProof: text("missing_proof"), sourceUrlsJson: text("source_urls_json").notNull().default("[]"), errorsJson: text("errors_json").notNull().default("[]"), startedAt: text("started_at"), completedAt: text("completed_at"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`) },
  (table) => [uniqueIndex("admin_jurisdiction_audits_friction_uidx").on(table.frictionId), index("admin_jurisdiction_audits_status_idx").on(table.status, table.updatedAt), index("admin_jurisdiction_audits_census_idx").on(table.censusId)],
);

export const jurisdictionEvidence = sqliteTable(
  "admin_jurisdiction_evidence",
  {
    id: text("id").primaryKey(), auditId: text("audit_id").notNull(), frictionId: text("friction_id").notNull(),
    jurisdiction: text("jurisdiction").notNull(), normalizedJurisdiction: text("normalized_jurisdiction").notNull(),
    evidenceType: text("evidence_type").notNull(), title: text("title"), sourceUrl: text("source_url").notNull(),
    publisherDomain: text("publisher_domain").notNull(), sourceClass: text("source_class").notNull(),
    status: text("status").notNull(), excerpt: text("excerpt"), failureReason: text("failure_reason"),
    discoveredAt: text("discovered_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    verifiedAt: text("verified_at"), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("admin_jurisdiction_evidence_audit_url_uidx").on(table.auditId, table.sourceUrl),
    index("admin_jurisdiction_evidence_audit_status_idx").on(table.auditId, table.status),
    index("admin_jurisdiction_evidence_jurisdiction_type_idx").on(table.normalizedJurisdiction, table.evidenceType),
  ],
);

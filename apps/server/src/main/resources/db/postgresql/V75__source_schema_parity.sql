-- CANDIDATE: run only in isolated rehearsal until main alignment and collation acceptance.
-- Preserves deprecated historical columns; does not reactivate removed APIs.
CREATE TABLE llm_api_keys (
  "id" varchar(255) NOT NULL,
  "created_at" timestamptz(6) NOT NULL,
  "enabled" boolean NOT NULL,
  "key_hash" varchar(80) NOT NULL,
  "key_prefix" varchar(16) NOT NULL,
  "last_used_at" timestamptz(6),
  "name" varchar(255) NOT NULL,
  "revoked_at" timestamptz(6),
  "total_calls" bigint NOT NULL,
  "total_tokens" bigint NOT NULL,
  "updated_at" timestamptz(6) NOT NULL,
  "user_id" varchar(255) NOT NULL
);
ALTER TABLE "ai_model_providers" ADD COLUMN "key_hash" varchar(80);
ALTER TABLE "ai_model_providers" ADD COLUMN "key_prefix" varchar(16);
ALTER TABLE "ai_model_providers" ADD COLUMN "key_revoked_at" timestamptz(6);
ALTER TABLE "aep_credit_campaigns" ALTER COLUMN "expires_at" SET NOT NULL;
ALTER TABLE "aep_credit_campaigns" ALTER COLUMN "starts_at" SET NOT NULL;
ALTER TABLE "aep_credit_campaigns" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "aep_credit_grants" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "aep_credit_grants" ALTER COLUMN "expires_at" SET NOT NULL;
ALTER TABLE "aep_credit_resource_reservations" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "aep_model_charges" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "aep_model_discounts" ALTER COLUMN "expires_at" SET NOT NULL;
ALTER TABLE "aep_model_discounts" ALTER COLUMN "starts_at" SET NOT NULL;
ALTER TABLE "aep_model_discounts" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "aep_model_prices" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "ai_model_providers" ALTER COLUMN "total_billable_seconds" SET NOT NULL;
ALTER TABLE "ai_model_providers" ALTER COLUMN "total_billable_units" SET NOT NULL;
ALTER TABLE "ai_model_providers" ALTER COLUMN "unit_price_micros" SET NOT NULL;
ALTER TABLE "ip_library_record" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "ip_library_record" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "aep_credit_campaigns" ALTER COLUMN "issued" SET DEFAULT 0;
ALTER TABLE "aep_credit_campaigns" ALTER COLUMN "resource_reserved" SET DEFAULT 0.000000000;
ALTER TABLE "aep_credit_campaigns" ALTER COLUMN "resource_used" SET DEFAULT 0.000000000;
ALTER TABLE "aep_credit_campaigns" ALTER COLUMN "version" SET DEFAULT 0;
ALTER TABLE "aep_credit_grant_holds" ALTER COLUMN "consumed" SET DEFAULT 0;
ALTER TABLE "aep_credit_grant_holds" ALTER COLUMN "released" SET DEFAULT 0;
ALTER TABLE "aep_credit_grants" ALTER COLUMN "expired" SET DEFAULT 0;
ALTER TABLE "aep_credit_grants" ALTER COLUMN "frozen" SET DEFAULT 0;
ALTER TABLE "aep_credit_grants" ALTER COLUMN "spent" SET DEFAULT 0;
ALTER TABLE "aep_credit_resource_reservations" ALTER COLUMN "released" SET DEFAULT 0.000000000;
ALTER TABLE "aep_credit_resource_reservations" ALTER COLUMN "used" SET DEFAULT 0.000000000;
ALTER TABLE "aep_enterprise_billing_authorizations" ALTER COLUMN "amount" SET DEFAULT 0;
ALTER TABLE "aep_enterprise_credit_lot_holds" ALTER COLUMN "frozen" SET DEFAULT 0;
ALTER TABLE "aep_enterprise_credit_lot_holds" ALTER COLUMN "original_amount" SET DEFAULT 0;
ALTER TABLE "aep_enterprise_credit_lot_holds" ALTER COLUMN "released_amount" SET DEFAULT 0;
ALTER TABLE "aep_enterprise_credit_lots" ALTER COLUMN "available" SET DEFAULT 0;
ALTER TABLE "aep_enterprise_credit_lots" ALTER COLUMN "frozen" SET DEFAULT 0;
ALTER TABLE "aep_enterprise_members" ALTER COLUMN "billing_read" SET DEFAULT false;
ALTER TABLE "aep_enterprise_members" ALTER COLUMN "points_manage" SET DEFAULT false;
ALTER TABLE "aep_enterprise_members" ALTER COLUMN "recharge_request" SET DEFAULT false;
ALTER TABLE "aep_enterprise_members" ALTER COLUMN "version" SET DEFAULT 0;
ALTER TABLE "aep_enterprise_ownership_transfers" ALTER COLUMN "from_owner_version" SET DEFAULT 0;
ALTER TABLE "aep_enterprise_points_batches" ALTER COLUMN "total_amount" SET DEFAULT 0;
ALTER TABLE "aep_enterprise_points_transfers" ALTER COLUMN "amount" SET DEFAULT 0;
ALTER TABLE "aep_enterprise_points_transfers" ALTER COLUMN "from_gift" SET DEFAULT 0;
ALTER TABLE "aep_enterprise_points_transfers" ALTER COLUMN "from_license" SET DEFAULT 0;
ALTER TABLE "aep_enterprise_points_transfers" ALTER COLUMN "from_recharge" SET DEFAULT 0;
ALTER TABLE "aep_enterprise_policies" ALTER COLUMN "max_active_jobs" SET DEFAULT 0;
ALTER TABLE "aep_enterprise_policies" ALTER COLUMN "version" SET DEFAULT 0;
ALTER TABLE "aep_enterprises" ALTER COLUMN "version" SET DEFAULT 0;
ALTER TABLE "aep_model_charges" ALTER COLUMN "settled_base_credits" SET DEFAULT 0;
ALTER TABLE "aep_model_charges" ALTER COLUMN "settled_output_quantity" SET DEFAULT 0.000000000;
ALTER TABLE "aep_model_charges" ALTER COLUMN "settled_payable_credits" SET DEFAULT 0;
ALTER TABLE "aep_model_charges" ALTER COLUMN "settled_quantity" SET DEFAULT 0.000000000;
ALTER TABLE "aep_model_charges" ALTER COLUMN "settled_scoped_credits" SET DEFAULT 0;
ALTER TABLE "aep_model_charges" ALTER COLUMN "settled_wallet_credits" SET DEFAULT 0;
ALTER TABLE "aep_model_discounts" ALTER COLUMN "version" SET DEFAULT 0;
ALTER TABLE "aep_model_prices" ALTER COLUMN "version" SET DEFAULT 0;
ALTER TABLE "aep_publish_jobs" ALTER COLUMN "retry_count" SET DEFAULT 0;
ALTER TABLE "aep_wallets" ALTER COLUMN "account_type" SET DEFAULT 'personal';
ALTER TABLE "card_profile" ALTER COLUMN "status" SET DEFAULT 'draft';
ALTER TABLE "clip_asset" ALTER COLUMN "bytes" SET DEFAULT 0;
ALTER TABLE "clip_asset" ALTER COLUMN "duration_sec" SET DEFAULT 0;
ALTER TABLE "clip_asset" ALTER COLUMN "preset" SET DEFAULT false;
ALTER TABLE "clip_asset" ALTER COLUMN "used_count" SET DEFAULT 0;
ALTER TABLE "clip_project" ALTER COLUMN "avatar_seconds" SET DEFAULT 0;
ALTER TABLE "clip_project" ALTER COLUMN "credits_held" SET DEFAULT 0;
ALTER TABLE "clip_project" ALTER COLUMN "duration_sec" SET DEFAULT 0;
ALTER TABLE "clip_project" ALTER COLUMN "progress" SET DEFAULT 0;
ALTER TABLE "clip_project" ALTER COLUMN "segment_count" SET DEFAULT 0;
ALTER TABLE "clip_project" ALTER COLUMN "status" SET DEFAULT 'draft';
ALTER TABLE "clip_project" ALTER COLUMN "step" SET DEFAULT 1;
ALTER TABLE "clip_render_job" ALTER COLUMN "credits_held" SET DEFAULT 0;
ALTER TABLE "clip_render_job" ALTER COLUMN "duration_sec" SET DEFAULT 0;
ALTER TABLE "clip_render_job" ALTER COLUMN "mock" SET DEFAULT false;
ALTER TABLE "clip_render_job" ALTER COLUMN "output_bytes" SET DEFAULT 0;
ALTER TABLE "clip_render_job" ALTER COLUMN "progress" SET DEFAULT 0;
ALTER TABLE "clip_render_job" ALTER COLUMN "stage" SET DEFAULT 'tts';
ALTER TABLE "clip_render_job" ALTER COLUMN "status" SET DEFAULT 'queued';
ALTER TABLE "clip_shot_job" ALTER COLUMN "artifact_duration_sec" SET DEFAULT 0;
ALTER TABLE "clip_shot_job" ALTER COLUMN "credits" SET DEFAULT 0;
ALTER TABLE "clip_shot_job" ALTER COLUMN "mock" SET DEFAULT false;
ALTER TABLE "clip_shot_job" ALTER COLUMN "progress" SET DEFAULT 0;
ALTER TABLE "clip_shot_job" ALTER COLUMN "quoted_credits" SET DEFAULT 0;
ALTER TABLE "clip_shot_job" ALTER COLUMN "status" SET DEFAULT 'queued';
ALTER TABLE "clip_template" ALTER COLUMN "avatar_sec_hint" SET DEFAULT 0;
ALTER TABLE "clip_template" ALTER COLUMN "est_duration_sec" SET DEFAULT 0;
ALTER TABLE "clip_template" ALTER COLUMN "owner_scope" SET DEFAULT 'official';
ALTER TABLE "clip_template" ALTER COLUMN "ratio" SET DEFAULT '9:16';
ALTER TABLE "clip_template" ALTER COLUMN "status" SET DEFAULT 'draft';
ALTER TABLE "clip_tts_preview" ALTER COLUMN "attempts" SET DEFAULT 0;
ALTER TABLE "clip_tts_preview" ALTER COLUMN "credits" SET DEFAULT 0;
ALTER TABLE "clip_tts_preview" ALTER COLUMN "status" SET DEFAULT 'generating';
ALTER TABLE "clip_tts_preview" ALTER COLUMN "total_duration_sec" SET DEFAULT 0;
ALTER TABLE "clip_upload_session" ALTER COLUMN "status" SET DEFAULT 'issued';
ALTER TABLE "dap_consent" ALTER COLUMN "period_months" SET DEFAULT 24;
ALTER TABLE "dap_license" ALTER COLUMN "certificate_version" SET DEFAULT 0;
ALTER TABLE "director_work" ALTER COLUMN "active" SET DEFAULT false;
ALTER TABLE "director_work" ALTER COLUMN "revision" SET DEFAULT 0;
ALTER TABLE "drama_canvas_run" ALTER COLUMN "cost" SET DEFAULT 0;
ALTER TABLE "ip_demo_template" ALTER COLUMN "enabled" SET DEFAULT true;
ALTER TABLE "ip_demo_template" ALTER COLUMN "kind" SET DEFAULT 'example';
ALTER TABLE "ip_demo_template" ALTER COLUMN "sort_order" SET DEFAULT 0;
ALTER TABLE "ip_demo_template" ALTER COLUMN "visibility" SET DEFAULT 'official';
ALTER TABLE "ip_dialogue_message" ALTER COLUMN "settling" SET DEFAULT false;
ALTER TABLE "ip_dialogue_thread" ALTER COLUMN "event_floor_seq" SET DEFAULT 0;
ALTER TABLE "ip_dialogue_thread" ALTER COLUMN "history_summary_seq" SET DEFAULT 0;
ALTER TABLE "ip_dialogue_thread" ALTER COLUMN "last_seq" SET DEFAULT 0;
ALTER TABLE "ip_dialogue_thread" ALTER COLUMN "message_seq" SET DEFAULT 0;
ALTER TABLE "ip_dialogue_thread" ALTER COLUMN "plan_revision" SET DEFAULT 0;
ALTER TABLE "ip_plan_execution" ALTER COLUMN "in_flight" SET DEFAULT 0;
ALTER TABLE "ip_plan_execution" ALTER COLUMN "lease_version" SET DEFAULT 0;
ALTER TABLE "ip_plan_execution" ALTER COLUMN "spent" SET DEFAULT 0;
ALTER TABLE "ip_project" ALTER COLUMN "status" SET DEFAULT 'draft';
ALTER TABLE "ip_run" ALTER COLUMN "cancel_requested" SET DEFAULT false;
ALTER TABLE "ip_run" ALTER COLUMN "cost" SET DEFAULT 0;
ALTER TABLE "ip_run" ALTER COLUMN "pct" SET DEFAULT 0;
ALTER TABLE "recharge_order" ALTER COLUMN "refunded_price_cents" SET DEFAULT 0;
ALTER TABLE "recharge_order" ALTER COLUMN "requested_price_cents" SET DEFAULT 0;
ALTER TABLE "video_studio_prompt_optimization" ALTER COLUMN "credits_held" SET DEFAULT 0;
ALTER TABLE "video_studio_prompt_optimization" ALTER COLUMN "status" SET DEFAULT 'queued';
ALTER TABLE "video_studio_template" ALTER COLUMN "status" SET DEFAULT 'active';
ALTER TABLE "video_studio_template" ALTER COLUMN "use_count" SET DEFAULT 0;
CREATE INDEX "fk_scoped_hold_grant" ON "aep_credit_grant_holds" ("grant_id");
CREATE INDEX "fk_scoped_grant_campaign" ON "aep_credit_grants" ("campaign_id");
CREATE INDEX "idx_scoped_grant_wallet" ON "aep_credit_grants" ("wallet_id", "expires_at", "id");
CREATE INDEX "idx_scoped_resource_daily" ON "aep_credit_resource_reservations" ("campaign_id", "wallet_id", "created_at");
CREATE INDEX "idx_model_discount_target" ON "aep_model_discounts" ("target_key", "active");
CREATE UNIQUE INDEX "uk_ip_dialogue_thread_branch" ON "ip_dialogue_thread" ("owner_user_id", "client_request_id");
CREATE UNIQUE INDEX "uk_ip_dialogue_thread_project" ON "ip_dialogue_thread" ("project_id", "id");
ALTER TABLE "llm_api_keys" ADD PRIMARY KEY ("id");
CREATE INDEX "idx_llm_api_key_prefix" ON "llm_api_keys" ("key_prefix");
CREATE INDEX "idx_llm_api_key_user" ON "llm_api_keys" ("user_id");
ALTER TABLE "aep_credit_grant_holds" ADD CONSTRAINT "fk_scoped_hold_grant" FOREIGN KEY ("grant_id") REFERENCES "aep_credit_grants" ("id");
ALTER TABLE "aep_credit_grants" ADD CONSTRAINT "fk_scoped_grant_campaign" FOREIGN KEY ("campaign_id") REFERENCES "aep_credit_campaigns" ("id");
ALTER TABLE "aep_credit_resource_reservations" ADD CONSTRAINT "fk_scoped_resource_campaign" FOREIGN KEY ("campaign_id") REFERENCES "aep_credit_campaigns" ("id");

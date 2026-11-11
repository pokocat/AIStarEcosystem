-- Source MySQL V75-V79 inspected on 2026-11-10: 195 business tables.
-- Existing PostgreSQL V74-V77 remain immutable. Copy source rows rather than
-- seeding or recreating provider credentials and official portrait approvals.
ALTER TABLE ai_model_providers ADD COLUMN asset_library_id varchar(64) COLLATE "C";
ALTER TABLE ai_model_providers ADD COLUMN chat_reasoning_effort varchar(16) COLLATE "C";

CREATE TABLE video_asset_library (
    id varchar(64) COLLATE "C" PRIMARY KEY,
    name varchar(128) NOT NULL,
    adapter varchar(32) NOT NULL,
    config_json text NOT NULL,
    created_at timestamptz(6) NOT NULL,
    updated_at timestamptz(6) NOT NULL,
    credential_encrypted text
);
CREATE TABLE video_asset_person (
    id varchar(64) COLLATE "C" PRIMARY KEY,
    owner_user_id varchar(128) COLLATE "C" NOT NULL,
    library_id varchar(64) COLLATE "C" NOT NULL,
    name varchar(64) NOT NULL,
    status varchar(32) NOT NULL,
    group_id varchar(128) COLLATE "C",
    token_encrypted text,
    link_encrypted text,
    callback_hash varchar(64) COLLATE "C" NOT NULL,
    agreement_version varchar(64) NOT NULL,
    agreement_text text NOT NULL,
    expires_at timestamptz(6) NOT NULL,
    created_at timestamptz(6) NOT NULL,
    updated_at timestamptz(6) NOT NULL
);
CREATE INDEX idx_video_person_owner ON video_asset_person(owner_user_id, library_id);
CREATE TABLE video_asset_portrait (
    id varchar(64) COLLATE "C" PRIMARY KEY,
    owner_user_id varchar(128) COLLATE "C" NOT NULL,
    library_id varchar(64) COLLATE "C" NOT NULL,
    source_key varchar(512) COLLATE "C" NOT NULL,
    media_type varchar(16) NOT NULL,
    label varchar(128) NOT NULL,
    status varchar(32) NOT NULL,
    placement varchar(16),
    person_id varchar(64) COLLATE "C",
    asset_id varchar(128) COLLATE "C",
    declared_by varchar(128) COLLATE "C",
    declared_at timestamptz(6),
    declaration_text text,
    error_code varchar(128),
    created_at timestamptz(6) NOT NULL,
    updated_at timestamptz(6) NOT NULL
);
CREATE INDEX idx_video_portrait_owner ON video_asset_portrait(owner_user_id, library_id);

-- MySQL V76/V79 extended native ENUMs. Keep the PG allow-list equally strict.
ALTER TABLE ai_app_binding DROP CONSTRAINT ai_app_binding_purpose_check;
ALTER TABLE ai_app_binding ADD CONSTRAINT ai_app_binding_purpose_check CHECK (purpose IN (
    'SCRIPT_DRAFT','SELLING_POINTS','VARIABLE_EXTRACT','VIDEO_GENERATION','SAFETY_REVIEW',
    'VIDEO_REF_ANALYSIS','TEMPLATE_REWRITE','APPEARANCE_FORGE','DRAMA_SCRIPT_DRAFT',
    'IMAGE_GENERATION','DAP_PERSONA','DAP_VIDEO_PROMPT','DAP_IMAGE','DAP_VIDEO','DAP_AUDIO',
    'DAP_LIP_SYNC','DAP_TRANSCRIBE','DAP_VIDEO_UNDERSTAND','DAP_REAL_AVATAR','MUSIC_GENERATION','GENERAL'
));
ALTER TABLE ai_app_endpoint_candidate DROP CONSTRAINT ai_app_endpoint_candidate_purpose_check;
ALTER TABLE ai_app_endpoint_candidate ADD CONSTRAINT ai_app_endpoint_candidate_purpose_check CHECK (purpose IN (
    'SCRIPT_DRAFT','SELLING_POINTS','VARIABLE_EXTRACT','VIDEO_GENERATION','SAFETY_REVIEW',
    'VIDEO_REF_ANALYSIS','TEMPLATE_REWRITE','APPEARANCE_FORGE','DRAMA_SCRIPT_DRAFT',
    'IMAGE_GENERATION','DAP_PERSONA','DAP_VIDEO_PROMPT','DAP_IMAGE','DAP_VIDEO','DAP_AUDIO',
    'DAP_LIP_SYNC','DAP_TRANSCRIBE','DAP_VIDEO_UNDERSTAND','DAP_REAL_AVATAR','MUSIC_GENERATION','GENERAL'
));

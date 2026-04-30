-- ═══════════════════════════════════════════════════════════════════
-- iBallot — Complete PostgreSQL Schema + Optimizations
-- Run this file once on a fresh PostgreSQL database
-- Command: psql -U postgres -d iballot -f iballot_complete.sql
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- SETUP
-- ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for text search on manifesto/names

-- ─────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────
CREATE TYPE "Role" AS ENUM (
  'SUPER_ADMIN',
  'ADMIN',
  'CANDIDATE',
  'VOTER'
);

CREATE TYPE "OtpType" AS ENUM (
  'PHONE_VERIFY',
  'EMAIL_VERIFY',
  'LOGIN',
  'PASSWORD_RESET'
);

CREATE TYPE "ElectionType" AS ENUM (
  'GENERAL',
  'UNIVERSITY',
  'ORGANIZATIONAL',
  'BY_ELECTION'
);

CREATE TYPE "ElectionStatus" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'ACTIVE',
  'PAUSED',
  'CLOSED',
  'RESULTS_PUBLISHED'
);

CREATE TYPE "CandidateStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'WITHDRAWN'
);

CREATE TYPE "FraudAlertType" AS ENUM (
  'DUPLICATE_VOTE_ATTEMPT',
  'SUSPICIOUS_IP',
  'DEVICE_MISMATCH',
  'RAPID_REQUESTS',
  'JAILBREAK_DETECTED'
);

CREATE TYPE "AlertSeverity" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

CREATE TYPE "NotificationType" AS ENUM (
  'ELECTION_STARTED',
  'ELECTION_ENDING_SOON',
  'VOTE_CONFIRMED',
  'RESULTS_PUBLISHED',
  'CANDIDATE_APPROVED',
  'FRAUD_ALERT'
);

-- ─────────────────────────────────────────
-- CONSTITUENCY
-- ─────────────────────────────────────────
CREATE TABLE "Constituency" (
  "id"        UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name"      VARCHAR(255) NOT NULL,
  "code"      VARCHAR(50)  NOT NULL UNIQUE,
  "type"      VARCHAR(100) NOT NULL,
  "createdAt" TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────
CREATE TABLE "User" (
  "id"             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  "cnic"           VARCHAR(15)  UNIQUE,
  "studentId"      VARCHAR(50)  UNIQUE,
  "email"          VARCHAR(255) NOT NULL UNIQUE,
  "phone"          VARCHAR(20)  NOT NULL UNIQUE,
  "passwordHash"   TEXT         NOT NULL,
  "role"           "Role"       NOT NULL DEFAULT 'VOTER',
  "isVerified"     BOOLEAN      NOT NULL DEFAULT FALSE,
  "isActive"       BOOLEAN      NOT NULL DEFAULT TRUE,
  "constituencyId" UUID         REFERENCES "Constituency"("id") ON DELETE SET NULL,
  "createdAt"      TIMESTAMP    NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- SESSIONS
-- ─────────────────────────────────────────
CREATE TABLE "Session" (
  "id"        UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId"    UUID      NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "token"     TEXT      NOT NULL UNIQUE,
  "deviceId"  UUID,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- OTP CODES
-- ─────────────────────────────────────────
CREATE TABLE "OtpCode" (
  "id"        UUID       PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId"    UUID       NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "code"      VARCHAR(10) NOT NULL,
  "type"      "OtpType"  NOT NULL,
  "expiresAt" TIMESTAMP  NOT NULL,
  "isUsed"    BOOLEAN    NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- DEVICES
-- ─────────────────────────────────────────
CREATE TABLE "Device" (
  "id"                UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId"            UUID      NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "deviceFingerprint" TEXT      NOT NULL,
  "platform"          VARCHAR(20) NOT NULL,
  "lastSeen"          TIMESTAMP NOT NULL DEFAULT NOW(),
  "isTrusted"         BOOLEAN   NOT NULL DEFAULT FALSE,
  "createdAt"         TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE("userId", "deviceFingerprint")
);

-- ─────────────────────────────────────────
-- ELECTIONS
-- ─────────────────────────────────────────
CREATE TABLE "Election" (
  "id"                 UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  "title"              VARCHAR(255)     NOT NULL,
  "description"        TEXT,
  "constituencyId"     UUID             REFERENCES "Constituency"("id") ON DELETE SET NULL,
  "type"               "ElectionType"   NOT NULL,
  "status"             "ElectionStatus" NOT NULL DEFAULT 'DRAFT',
  "startDate"          TIMESTAMP        NOT NULL,
  "endDate"            TIMESTAMP        NOT NULL,
  "createdBy"          UUID             NOT NULL,
  "resultsPublishedAt" TIMESTAMP,
  "createdAt"          TIMESTAMP        NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMP        NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- CANDIDATES
-- ─────────────────────────────────────────
CREATE TABLE "Candidate" (
  "id"         UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId"     UUID              NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "electionId" UUID              NOT NULL REFERENCES "Election"("id") ON DELETE CASCADE,
  "status"     "CandidateStatus" NOT NULL DEFAULT 'PENDING',
  "approvedBy" UUID,
  "approvedAt" TIMESTAMP,
  "createdAt"  TIMESTAMP         NOT NULL DEFAULT NOW()
);

CREATE TABLE "CandidateProfile" (
  "id"           UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  "candidateId"  UUID      NOT NULL UNIQUE REFERENCES "Candidate"("id") ON DELETE CASCADE,
  "photoUrl"     TEXT,
  "videoUrl"     TEXT,
  "manifesto"    TEXT,
  "experience"   TEXT,
  "promises"     TEXT[]    DEFAULT '{}',
  "profileViews" INT       NOT NULL DEFAULT 0,
  "updatedAt"    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Denormalized counter — real-time results without counting rows
CREATE TABLE "CandidateVoteCount" (
  "id"          UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  "candidateId" UUID      NOT NULL UNIQUE REFERENCES "Candidate"("id") ON DELETE CASCADE,
  "electionId"  UUID      NOT NULL REFERENCES "Election"("id") ON DELETE CASCADE,
  "count"       INT       NOT NULL DEFAULT 0,
  "updatedAt"   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- VOTING — PRIVACY CRITICAL
-- ─────────────────────────────────────────

-- Anonymous vote record — NO userId ever stored here
CREATE TABLE "Vote" (
  "id"            UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  "electionId"    UUID      NOT NULL REFERENCES "Election"("id") ON DELETE RESTRICT,
  "candidateId"   UUID      NOT NULL REFERENCES "Candidate"("id") ON DELETE RESTRICT,
  "receiptHash"   TEXT      NOT NULL UNIQUE,
  "encryptedData" TEXT,
  "castedAt"      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Participation tracker — proves user voted, never reveals who they voted for
CREATE TABLE "VoteReceipt" (
  "id"          UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId"      UUID      NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "electionId"  UUID      NOT NULL REFERENCES "Election"("id") ON DELETE RESTRICT,
  "receiptHash" TEXT      NOT NULL UNIQUE,
  "castedAt"    TIMESTAMP NOT NULL DEFAULT NOW(),

  -- ★ DUPLICATE VOTE GUARD — enforced at database level
  UNIQUE("userId", "electionId")
);

-- ─────────────────────────────────────────
-- AUDIT LOG — Partitioned by month
-- ─────────────────────────────────────────
CREATE TABLE "AuditLog" (
  "id"         UUID        NOT NULL DEFAULT uuid_generate_v4(),
  "actorId"    UUID        REFERENCES "User"("id") ON DELETE SET NULL,
  "electionId" UUID        REFERENCES "Election"("id") ON DELETE SET NULL,
  "action"     TEXT        NOT NULL,
  "entity"     TEXT        NOT NULL,
  "entityId"   TEXT,
  "metadata"   JSONB,
  "ipAddress"  VARCHAR(45),
  "userAgent"  TEXT,
  "createdAt"  TIMESTAMP   NOT NULL DEFAULT NOW()
) PARTITION BY RANGE ("createdAt");

-- Monthly partitions — add new ones each month
CREATE TABLE "AuditLog_2026_04" PARTITION OF "AuditLog"
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE "AuditLog_2026_05" PARTITION OF "AuditLog"
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE "AuditLog_2026_06" PARTITION OF "AuditLog"
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE "AuditLog_2026_07" PARTITION OF "AuditLog"
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE "AuditLog_2026_08" PARTITION OF "AuditLog"
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE "AuditLog_2026_09" PARTITION OF "AuditLog"
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE "AuditLog_2026_10" PARTITION OF "AuditLog"
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE "AuditLog_2026_11" PARTITION OF "AuditLog"
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE "AuditLog_2026_12" PARTITION OF "AuditLog"
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- ─────────────────────────────────────────
-- FRAUD ALERTS
-- ─────────────────────────────────────────
CREATE TABLE "FraudAlert" (
  "id"          UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId"      UUID             REFERENCES "User"("id") ON DELETE SET NULL,
  "type"        "FraudAlertType" NOT NULL,
  "description" TEXT             NOT NULL,
  "ipAddress"   VARCHAR(45),
  "deviceId"    UUID,
  "severity"    "AlertSeverity"  NOT NULL,
  "isResolved"  BOOLEAN          NOT NULL DEFAULT FALSE,
  "resolvedBy"  UUID,
  "createdAt"   TIMESTAMP        NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────
CREATE TABLE "Notification" (
  "id"        UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId"    UUID               NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "type"      "NotificationType" NOT NULL,
  "title"     VARCHAR(255)       NOT NULL,
  "message"   TEXT               NOT NULL,
  "isRead"    BOOLEAN            NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP          NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- INDEXES — LEVEL 1: Basic Foreign Key Indexes
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX idx_user_cnic            ON "User"("cnic");
CREATE INDEX idx_user_email           ON "User"("email");
CREATE INDEX idx_user_phone           ON "User"("phone");
CREATE INDEX idx_user_constituency    ON "User"("constituencyId");
CREATE INDEX idx_session_user         ON "Session"("userId");
CREATE INDEX idx_otp_user             ON "OtpCode"("userId");
CREATE INDEX idx_device_user          ON "Device"("userId");
CREATE INDEX idx_election_status      ON "Election"("status");
CREATE INDEX idx_election_dates       ON "Election"("startDate", "endDate");
CREATE INDEX idx_candidate_election   ON "Candidate"("electionId");
CREATE INDEX idx_candidate_user       ON "Candidate"("userId");
CREATE INDEX idx_vote_election        ON "Vote"("electionId");
CREATE INDEX idx_vote_candidate       ON "Vote"("candidateId");
CREATE INDEX idx_receipt_user         ON "VoteReceipt"("userId");
CREATE INDEX idx_receipt_election     ON "VoteReceipt"("electionId");
CREATE INDEX idx_audit_actor          ON "AuditLog"("actorId");
CREATE INDEX idx_audit_election       ON "AuditLog"("electionId");
CREATE INDEX idx_notification_user    ON "Notification"("userId");
CREATE INDEX idx_fraud_user           ON "FraudAlert"("userId");
CREATE INDEX idx_votecount_candidate  ON "CandidateVoteCount"("candidateId");
CREATE INDEX idx_votecount_election   ON "CandidateVoteCount"("electionId");

-- ═══════════════════════════════════════════════════════════════════
-- INDEXES — LEVEL 2: Composite Indexes for Common Queries
-- ═══════════════════════════════════════════════════════════════════

-- "Get all active elections for this constituency"
CREATE INDEX idx_election_constituency_status
  ON "Election"("constituencyId", "status");

-- "Get all approved candidates for this election"
CREATE INDEX idx_candidate_election_status
  ON "Candidate"("electionId", "status");

-- "Get unread notifications for this user sorted by time"
CREATE INDEX idx_notification_user_read
  ON "Notification"("userId", "isRead", "createdAt" DESC);

-- "Has this user voted in this election?" — most frequent query
CREATE INDEX idx_receipt_user_election
  ON "VoteReceipt"("userId", "electionId");

-- "Get vote counts for all candidates in an election — real-time results"
CREATE INDEX idx_votecount_election_count
  ON "CandidateVoteCount"("electionId", "count" DESC);

-- "Get audit logs for an election sorted by time"
CREATE INDEX idx_audit_election_time
  ON "AuditLog"("electionId", "createdAt" DESC);

-- "Unresolved fraud alerts by severity"
CREATE INDEX idx_fraud_severity_resolved
  ON "FraudAlert"("severity", "isResolved", "createdAt" DESC);

-- ═══════════════════════════════════════════════════════════════════
-- INDEXES — LEVEL 3: Partial Indexes (only index relevant rows)
-- ═══════════════════════════════════════════════════════════════════

-- Only index currently ACTIVE elections
CREATE INDEX idx_election_active
  ON "Election"("startDate", "endDate")
  WHERE "status" = 'ACTIVE';

-- Only index APPROVED candidates
CREATE INDEX idx_candidate_approved
  ON "Candidate"("electionId")
  WHERE "status" = 'APPROVED';

-- Only index UNREAD notifications
CREATE INDEX idx_notification_unread
  ON "Notification"("userId", "createdAt" DESC)
  WHERE "isRead" = FALSE;

-- Only index UNRESOLVED fraud alerts
CREATE INDEX idx_fraud_unresolved
  ON "FraudAlert"("severity", "createdAt" DESC)
  WHERE "isResolved" = FALSE;

-- Session lookup by token + expiry (filter expired in query, not index)
CREATE INDEX idx_session_token_expires
  ON "Session"("token", "expiresAt");

-- Only index UNUSED OTP codes
CREATE INDEX idx_otp_unused
  ON "OtpCode"("userId", "type", "expiresAt")
  WHERE "isUsed" = FALSE;

-- ═══════════════════════════════════════════════════════════════════
-- INDEXES — LEVEL 4: Full Text Search
-- ═══════════════════════════════════════════════════════════════════

-- Search candidates by name (uses pg_trgm)
CREATE INDEX idx_user_email_trgm
  ON "User" USING GIN ("email" gin_trgm_ops);

-- Search election titles
CREATE INDEX idx_election_title_trgm
  ON "Election" USING GIN ("title" gin_trgm_ops);

-- Search manifesto content
CREATE INDEX idx_profile_manifesto_trgm
  ON "CandidateProfile" USING GIN ("manifesto" gin_trgm_ops);

-- ═══════════════════════════════════════════════════════════════════
-- MATERIALIZED VIEW — Real-Time Election Results
-- ═══════════════════════════════════════════════════════════════════
CREATE MATERIALIZED VIEW "ElectionResults" AS
SELECT
  e."id"                                                          AS "electionId",
  e."title"                                                       AS "electionTitle",
  e."status"                                                      AS "electionStatus",
  c."id"                                                          AS "candidateId",
  u."email"                                                       AS "candidateEmail",
  cp."photoUrl"                                                   AS "candidatePhoto",
  COALESCE(vc."count", 0)                                         AS "voteCount",
  ROUND(
    COALESCE(vc."count", 0) * 100.0 /
    NULLIF(SUM(COALESCE(vc."count", 0)) OVER (PARTITION BY e."id"), 0),
    2
  )                                                               AS "votePercentage",
  RANK() OVER (
    PARTITION BY e."id"
    ORDER BY COALESCE(vc."count", 0) DESC
  )                                                               AS "rank"
FROM "Election" e
JOIN "Candidate" c         ON c."electionId" = e."id"
JOIN "User" u              ON u."id" = c."userId"
LEFT JOIN "CandidateProfile" cp  ON cp."candidateId" = c."id"
LEFT JOIN "CandidateVoteCount" vc ON vc."candidateId" = c."id"
WHERE c."status" = 'APPROVED';

-- Index on the materialized view for fast results lookup
CREATE INDEX idx_results_election_rank
  ON "ElectionResults"("electionId", "rank");

CREATE UNIQUE INDEX idx_results_candidate
  ON "ElectionResults"("candidateId");

-- ═══════════════════════════════════════════════════════════════════
-- AUTO-UPDATE TRIGGERS
-- ═══════════════════════════════════════════════════════════════════

-- Auto-update "updatedAt" on every row update
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_updated_at
  BEFORE UPDATE ON "User"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_election_updated_at
  BEFORE UPDATE ON "Election"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_profile_updated_at
  BEFORE UPDATE ON "CandidateProfile"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_votecount_updated_at
  BEFORE UPDATE ON "CandidateVoteCount"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- STORED PROCEDURE — Safe Vote Casting Transaction
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION cast_vote(
  p_user_id      UUID,
  p_election_id  UUID,
  p_candidate_id UUID,
  p_receipt_hash TEXT
)
RETURNS JSON AS $$
DECLARE
  v_election_status "ElectionStatus";
  v_candidate_status "CandidateStatus";
  v_already_voted BOOLEAN;
BEGIN

  -- Check 1: Election must be ACTIVE
  SELECT "status" INTO v_election_status
  FROM "Election"
  WHERE "id" = p_election_id;

  IF v_election_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Election not found');
  END IF;

  IF v_election_status != 'ACTIVE' THEN
    RETURN json_build_object('success', false, 'error', 'Election is not active');
  END IF;

  -- Check 2: Candidate must be APPROVED and in this election
  SELECT "status" INTO v_candidate_status
  FROM "Candidate"
  WHERE "id" = p_candidate_id
    AND "electionId" = p_election_id;

  IF v_candidate_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Candidate not found in this election');
  END IF;

  IF v_candidate_status != 'APPROVED' THEN
    RETURN json_build_object('success', false, 'error', 'Candidate is not approved');
  END IF;

  -- Check 3: User must not have already voted
  SELECT EXISTS (
    SELECT 1 FROM "VoteReceipt"
    WHERE "userId" = p_user_id
      AND "electionId" = p_election_id
  ) INTO v_already_voted;

  IF v_already_voted THEN
    RETURN json_build_object('success', false, 'error', 'You have already voted in this election');
  END IF;

  -- All checks passed — cast the vote atomically
  BEGIN

    -- Step 1: Record participation (will throw on duplicate — extra safety)
    INSERT INTO "VoteReceipt" ("userId", "electionId", "receiptHash")
    VALUES (p_user_id, p_election_id, p_receipt_hash);

    -- Step 2: Record anonymous vote (no userId)
    INSERT INTO "Vote" ("electionId", "candidateId", "receiptHash")
    VALUES (p_election_id, p_candidate_id, p_receipt_hash);

    -- Step 3: Increment vote counter atomically
    INSERT INTO "CandidateVoteCount" ("candidateId", "electionId", "count")
    VALUES (p_candidate_id, p_election_id, 1)
    ON CONFLICT ("candidateId")
    DO UPDATE SET
      "count" = "CandidateVoteCount"."count" + 1,
      "updatedAt" = NOW();

    -- Step 4: Log to audit trail
    INSERT INTO "AuditLog" ("actorId", "electionId", "action", "entity", "entityId")
    VALUES (p_user_id, p_election_id, 'VOTE_CAST', 'Vote', p_receipt_hash);

    RETURN json_build_object('success', true, 'receiptHash', p_receipt_hash);

  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'Duplicate vote detected');
  END;

END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════
-- FUNCTION — Refresh Results (call every 10s during active election)
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION refresh_election_results()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY "ElectionResults";
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — Voters can only see their own receipts
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE "VoteReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session"      ENABLE ROW LEVEL SECURITY;

CREATE POLICY voter_own_receipts ON "VoteReceipt"
  FOR SELECT
  USING ("userId" = current_setting('app.current_user_id')::UUID);

CREATE POLICY voter_own_notifications ON "Notification"
  FOR SELECT
  USING ("userId" = current_setting('app.current_user_id')::UUID);

CREATE POLICY voter_own_sessions ON "Session"
  FOR SELECT
  USING ("userId" = current_setting('app.current_user_id')::UUID);

-- ═══════════════════════════════════════════════════════════════════
-- SEED — Super Admin (change password hash before production)
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO "User" (
  "email", "phone", "passwordHash", "role", "isVerified"
) VALUES (
  'superadmin@iballot.pk',
  '+923001234567',
  '$2a$12$CHANGE_THIS_TO_REAL_BCRYPT_HASH',
  'SUPER_ADMIN',
  TRUE
);

-- ═══════════════════════════════════════════════════════════════════
-- HOW TO USE
-- ═══════════════════════════════════════════════════════════════════
-- 1. Create database:
--    createdb -U postgres iballot
--
-- 2. Run this file:
--    psql -U postgres -d iballot -f iballot_complete.sql
--
-- 3. Cast a vote safely:
--    SELECT cast_vote(
--      'user-uuid-here',
--      'election-uuid-here',
--      'candidate-uuid-here',
--      'receipt-hash-here'
--    );
--
-- 4. Get real-time results:
--    SELECT * FROM "ElectionResults"
--    WHERE "electionId" = 'election-uuid-here'
--    ORDER BY "rank";
--
-- 5. Refresh results (call from backend every 10s):
--    SELECT refresh_election_results();
--
-- 6. Add new AuditLog partition each month:
--    CREATE TABLE "AuditLog_2027_01" PARTITION OF "AuditLog"
--    FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
-- ═══════════════════════════════════════════════════════════════════

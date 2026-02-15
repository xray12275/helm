# Helm: Security & Privacy

## Overview

Helm handles sensitive match data (unit positions, player identities, video frames) and must protect user privacy while maintaining audit trails for tournament integrity. This document covers data protection, authentication, encryption, and privacy policies.

---

## Data Classification

### Public Data
- Match IDs, player names, army names (with consent)
- Final match results, point totals
- Tournament public leaderboards (opt-in)

### Confidential Data
- Live match state (positions, unit status) — only during match
- Real-time camera feeds and video frames
- Player personal info (email, device ID)
- Rules library metadata (user uploads)

### Sensitive Data
- Video recordings (TTL-based, debug-only)
- Audit logs of overrides (retained for disputes)
- Rules library version history (user-provided content)

---

## Video & Image Data

### Frame Processing

**Default Behavior:**
- Video frames are **NOT stored** by default
- On-device inference only: frame → embedding extracted → frame discarded
- Embeddings (128-D vectors) are sent to cloud for matching/tracking
- No full-resolution video ever touches cloud storage

### Debug Mode (Optional)

If player enables debug mode (for troubleshooting vision issues):
- Frames are captured and uploaded to S3
- TTL (Time To Live): Automatically deleted after **1 hour**
- User must explicitly acknowledge before enabling
- Audit log records debug mode activation/deactivation

```typescript
interface DebugClipRequest {
  matchId: string;
  startTime: ISO8601;
  endTime: ISO8601;
  reason: string;  // e.g., "disputed unit position"
  approvedBy: string;  // Player or referee
}

// Server response
{
  clipId: string;
  uploadedAt: ISO8601;
  expiresAt: ISO8601;  // Now + 1 hour
  downloadUrl: string;
  size: number;  // MB
}
```

**Cleanup Job (automated):**
```python
# Daily cron job: delete expired debug clips
SELECT clip_id, expires_at FROM debug_clips WHERE expires_at < NOW();
DELETE FROM s3 WHERE clip_id IN (...);
DELETE FROM debug_clips WHERE clip_id IN (...);
```

### Fingerprint Storage

Unit fingerprints (128-D embeddings) are stored permanently in PostgreSQL:
- Tied to match + unit ID
- Non-invertible (cannot reconstruct original image from embedding)
- Used for real-time tracking only
- User can request deletion on match end

---

## Encryption

### Data at Rest

**PostgreSQL (Primary Data Store):**
- Transparent Data Encryption (TDE) using AES-256
- Encryption key managed by AWS KMS
- Per-table encryption policy: enable for users, events, audit logs

```sql
-- Enable AES-256 encryption on events table
CREATE TABLE events (
  ...
) WITH (encryption_key_id = 'arn:aws:kms:...');
```

**Redis (Cache & Materialized Views):**
- Redis 6+ with TLS
- No PII stored (only match state snapshots, timestamps)
- Auto-expire keys after match ends (TTL: 24 hours)

**S3 (Debug Clips):**
- Server-Side Encryption (SSE-S3) AES-256
- Bucket policy: deny unencrypted uploads
- Lifecycle policy: delete after 1 hour

### Data in Transit

**HTTPS/TLS 1.3 for all REST endpoints:**
```
POST /match/m123/state
Secure: TLS 1.3
Certificate: *.api.helm.local (issued by Let's Encrypt)
Cipher: TLS_AES_256_GCM_SHA384
```

**WebSocket over TLS:**
```
wss://api.helm.local/match/m123
Same TLS 1.3 cert + cipher
Frames encrypted within WebSocket secure tunnel
```

**HSTS Header (force HTTPS):**
```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

## Authentication & Authorization

### JWT Token Flow

**Login:**
```
POST /auth/login
{
  "deviceId": "iphone-12-abc123",
  "email": "player@example.com",
  "password": "***"
}

Response: 200
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "deviceId": "iphone-12-abc123"
}
```

**Token Payload:**
```json
{
  "sub": "user-id-123",
  "iat": 1708007521,
  "exp": 1708011121,
  "aud": "helm.local",
  "iss": "helm-auth-service",
  "deviceId": "iphone-12-abc123",
  "scopes": ["match:read", "match:write", "vision:upload"]
}
```

**Token Storage (iPhone):**
- Stored in Secure Enclave (iOS Keychain)
- Not accessible to other apps
- Automatically cleared on app uninstall
- Refreshed before expiry (3600s / 1 hour)

### Multi-Device Pairing

**First Device (Registration):**
```
1. User logs in with email + password
2. Server generates pairing code (6 digits, 10-minute TTL)
3. User receives code via SMS
4. Code + device ID → server stores device pairing
5. Device gets long-lived token
```

**Second Device (Trusted Pairing):**
```
POST /auth/device-pair
{
  "email": "player@example.com",
  "pairingCode": "123456",
  "deviceId": "ipad-air-def456"
}

Response:
{
  "accessToken": "...",
  "pairedAt": "2025-02-15T14:30:00Z",
  "trustedUntil": "2025-03-15T14:30:00Z"  // 30-day expiry
}
```

**Device List Management:**
```
GET /auth/devices

{
  "devices": [
    {
      "id": "iphone-12-abc123",
      "name": "iPhone 12",
      "lastSeen": "2025-02-15T14:35:00Z",
      "trusted": true,
      "pairedAt": "2025-01-15T10:00:00Z"
    },
    {
      "id": "ipad-air-def456",
      "name": "iPad Air",
      "lastSeen": "2025-02-10T09:00:00Z",
      "trusted": true,
      "pairedAt": "2025-02-15T14:30:00Z"
    }
  ]
}

POST /auth/devices/{deviceId}/revoke
// Removes device pairing; requires re-pairing to use again
```

### Authorization Scopes

```typescript
interface Scope {
  match:read      // Read match state, events
  match:write     // Create commands, update state
  vision:upload   // Upload calibration, fingerprints
  rules:upload    // Upload rule definitions
  debug:enable    // Enable debug mode (video clips)
  override:apply  // (Referee only) Apply rule overrides
  user:data       // User account settings
}

// Token scopes control what each device can do
const token = JWT.decode(accessToken);
console.log(token.scopes);  // ["match:read", "match:write", "vision:upload"]
```

---

## Rate Limiting & Abuse Prevention

### Endpoint Rate Limits

```typescript
interface RateLimitPolicy {
  endpoint: string;
  limit: number;
  window: string;
}

const policies: RateLimitPolicy[] = [
  { endpoint: "POST /auth/login", limit: 5, window: "5m" },
  { endpoint: "WS /match/:matchId", limit: 100, window: "1s" },
  { endpoint: "POST /vision/fingerprint-scan", limit: 60, window: "1m" },
  { endpoint: "POST /rules-library/upload", limit: 10, window: "1d" },
  { endpoint: "POST /debug/video-clip", limit: 5, window: "1d" },
];
```

**Rate Limit Response:**
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1613396400

{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

### DDoS Protection

- API Gateway (Kong) with rate limiting + IP whitelisting
- CloudFlare CDN for static assets
- Automatic block of IPs with >1000 requests/minute
- Monitoring: alert on spike in 429 responses

### Validation & Input Sanitization

```typescript
function validateCommand(command: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  // Type check
  if (!['MoveUnit', 'Attack', 'RollDice', ...].includes(command.type)) {
    errors.push('Invalid command type');
  }

  // Match ID format
  if (!isUUID(command.matchId)) {
    errors.push('Invalid match ID format');
  }

  // Unit ID format
  if (command.unitId && !isUUID(command.unitId)) {
    errors.push('Invalid unit ID format');
  }

  // Numeric fields
  if (command.targetPosition) {
    if (!isFinite(command.targetPosition.x) || !isFinite(command.targetPosition.y)) {
      errors.push('Invalid position coordinates');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
```

---

## Audit Logging

### What Gets Logged

```typescript
interface AuditLog {
  id: UUID;
  timestamp: ISO8601;
  userId: UUID;
  deviceId: string;
  action: string;  // "login", "match_created", "override_applied", etc.
  resource: string;  // "user:123", "match:m123", etc.
  result: 'success' | 'failure';
  details: Record<string, any>;
  ipAddress: string;
}

// Examples:
const auditLogs = [
  {
    action: 'login',
    userId: 'user-123',
    deviceId: 'iphone-12-abc123',
    result: 'success',
    details: { method: 'email+password' },
    timestamp: '2025-02-15T14:00:00Z'
  },
  {
    action: 'match_created',
    userId: 'user-123',
    resource: 'match:m123',
    result: 'success',
    details: { matchType: 'matched_play', pointLimit: 2000 }
  },
  {
    action: 'override_applied',
    userId: 'referee-456',
    resource: 'match:m123',
    result: 'success',
    details: {
      ruleId: 'CORE.MOVEMENT.DISTANCE_LIMIT',
      decision: 'allowed',
      reason: 'Dispute resolved with photo evidence'
    }
  },
  {
    action: 'debug_mode_enabled',
    userId: 'user-123',
    resource: 'match:m123',
    result: 'success',
    details: { ttl: '1h' }
  }
];
```

**Audit Retention:**
- Temporary logs: 7 days (rotate to archive)
- Override logs: Permanent (tournament appeals)
- Login logs: 90 days
- Rules uploads: Permanent (provenance tracking)

### Querying Audit Logs (Admin/Referee)

```
GET /admin/audit-logs?userId=user-123&resource=match:m123&action=override_applied

Response:
{
  "total": 3,
  "logs": [
    { ... },
    { ... }
  ]
}
```

---

## User Data & GDPR Compliance

### Data Deletion

**User Request:** "I want all my data deleted"

```
POST /user/delete-account
{
  "reason": "optional feedback"
}

Server actions:
1. Mark account as deleted (soft delete, for 30-day recovery period)
2. After 30 days: hard delete (PII removed)
3. Retain audit logs (anonymized) for tournament records
4. Delete debug video clips immediately
5. Delete match state snapshots
6. Keep rule library uploads (user-created content may be public)
```

**Timeline:**
```
Day 0: Deletion request
Days 1-30: Account locked, data retained (can undo deletion)
Day 31: Hard delete PII (email, device ID)
         Audit logs anonymized (userId → "deleted-user-xyz")
         Match records archived (non-personal data)
Day 366: Fully purged from all systems
```

### Data Access Requests

**User Request:** "Export all my data"

```
POST /user/export-data

Response (async, email within 24h):
{
  "requestId": "export-req-123",
  "status": "processing",
  "estimatedDelivery": "2025-02-16T14:00:00Z",
  "format": "json"  // or CSV
}

// Later...
{
  "status": "ready",
  "downloadUrl": "s3://user-exports/user-123-export-20250215.zip",
  "expiresAt": "2025-02-22T14:00:00Z",
  "size": "2.3 MB"
}
```

**Contents:**
- Profile info (name, email, preferences)
- Match history (metadata only, not state snapshots)
- Army rosters (unit lists, points)
- Audit logs involving this user
- Rules libraries they uploaded

### Privacy Settings

```json
{
  "userId": "user-123",
  "privacySettings": {
    "showInLeaderboard": false,
    "allowReplayShare": false,
    "debugModeEnabled": false,
    "dataRetentionDays": 30,  // Auto-delete match data after N days
    "allowAnalytics": false
  }
}
```

---

## Rules Library Provenance & Licensing

### No Copyrighted Content Server-Side

**Principle:** Helm does NOT store copyrighted rule text from Games Workshop, Warhammer+, or third parties.

**What IS stored:**
- Rule ID, category, conditions (structured data)
- User-provided non-copyrighted descriptions
- References to external rule sources (with citation)

**What is NOT stored:**
- Full rule text from copyrighted books
- Page scans or images
- Word-for-word excerpts

### User-Provided Rule Definitions

```json
{
  "id": "rules-lib-001",
  "name": "Warhammer 40K 10th Edition Core Rules",
  "uploadedBy": "admin@helm.local",
  "uploadedAt": "2025-01-15T10:00:00Z",
  "license": "CC-BY-SA-4.0",  // or proprietary, custom, etc.
  "attribution": "Based on Warhammer 40,000 Core Rules (Games Workshop)",
  "rules": [
    {
      "id": "CORE.MOVEMENT.DISTANCE_LIMIT",
      "title": "Movement Distance",
      "description": "Units in the movement phase can move up to 6 inches.",
      "source": {
        "book": "Warhammer 40,000 Core Rules",
        "edition": "10th",
        "page": "34"
      }
    }
  ]
}
```

**Validation on Upload:**
```python
def validate_rules_library(library_data):
  errors = []

  # Check: no copyrighted text detected (TF-IDF similarity against known copyrighted corpus)
  if similarity_score(library_data.description, copyrighted_corpus) > 0.9:
    errors.append("Description appears to contain copyrighted material. Summarize in your own words.")

  # Check: source attribution provided
  if not library_data.attribution:
    errors.append("Please provide attribution to the original rule source.")

  # Check: license specified
  if not library_data.license:
    errors.append("Specify license (CC-BY-SA, custom, proprietary, etc.).")

  return errors
```

---

## Data Breach Response

### Incident Classification

**Severity 1 (Critical):** Auth tokens leaked, user passwords exposed
**Severity 2 (High):** Match state leaked, video frames exposed
**Severity 3 (Medium):** Audit logs leaked (de-identified OK)
**Severity 4 (Low):** Metadata leaked (user names, match counts)

### Response Protocol (48-hour deadline)

1. **Assess:** Identify scope (how many users? what data?)
2. **Contain:** Revoke affected tokens, disable breached accounts
3. **Notify:** Email affected users within 24 hours
4. **Investigate:** Post-mortem, fix root cause
5. **Disclose:** Public security advisory (if Severity 1–2)

### Example Notification

```
Subject: Helm Security Notice

Dear User,

On 2025-02-15 at 14:32 UTC, we detected unauthorized access to
match state data for match ID m123. This may have exposed:
- Unit positions
- Player names
- Match duration

Action taken:
- All affected WebSocket connections terminated
- Session tokens revoked
- Database access logs reviewed

What you should do:
1. Change your password
2. Review your match history (no data loss)
3. Contact support@helm.local if you have questions

Security incident ID: INC-2025-001
Updated details: helm.local/security/INC-2025-001
```

---

## Third-Party Services

### Integrations (No data shared without consent)

| Service | Usage | Data Shared | Consent |
|---------|-------|-------------|---------|
| Whisper (OpenAI) | Speech-to-text | Audio frames only (not match state) | Opt-in, TTL 1h |
| S3 (AWS) | Debug video storage | Video clips (TTL 1h) | Debug mode opt-in |
| Stripe | Payment (future) | Email, name, payment info | Explicit checkout |
| Firebase (Analytics) | Anonymous usage stats | Session duration, feature usage | Opt-in settings |

### Data Processing Agreements

- Signed DPA with OpenAI (Whisper API)
- AWS Data Processing Addendum (DPA) for S3
- No subprocessors without user notice

---

## Security Testing

### Regular Security Audits

- Annual penetration testing
- Quarterly vulnerability scans (automated + manual)
- Code review for security-sensitive changes (PRs)
- OWASP Top 10 compliance checks

### Bug Bounty Program

- HackerOne integration
- Rewards: $100–$5,000 depending on severity
- Responsible disclosure: 90-day grace period before public disclosure

---

## Compliance & Standards

- **OWASP Top 10:** Addressed
- **CWE Top 25:** Addressed
- **GDPR:** User data deletion, privacy settings
- **CCPA:** Opt-out analytics, data export
- **PCI DSS:** N/A (no card data stored; Stripe handles payment)

---

## References

- [ARCHITECTURE.md](ARCHITECTURE.md) — API Gateway auth, TLS configuration
- [API_CONTRACTS.md](API_CONTRACTS.md) — Token refresh, device pairing endpoints
- [MVP_PLAN.md](MVP_PLAN.md) — Security milestones

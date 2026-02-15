# Helm Documentation

Complete technical specification for Helm, the voice-first AI referee for Warhammer 40K tabletop play.

## 📚 Documentation Suite (10 files, 6,070 lines)

All files in this directory form an integrated specification for building Helm.

### Core Documentation

1. **[INDEX.md](INDEX.md)** — Start here. Overview of all docs with cross-references.

2. **[PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md)** (274 lines)
   - Vision statement, north star metrics
   - User personas (new player, veteran, tournament organizer)
   - Core gameplay loops with detailed walkthroughs
   - Key differentiators vs. competitors
   - iPhone scanning flow, AR overlay, web console features
   - Coaching vs. competitive mode

3. **[ARCHITECTURE.md](ARCHITECTURE.md)** (534 lines)
   - System design: iPhone + cloud + web console
   - Service topology (API Gateway, State Engine, Rules Engine, Vision Service, Voice Service, Dice Service)
   - Data flow diagrams
   - Event Store (PostgreSQL) and Materialized Views (Redis)
   - WebSocket and REST protocols
   - Deployment architecture (Kubernetes)

4. **[DATA_MODEL.md](DATA_MODEL.md)** (706 lines)
   - Complete entity schemas with Zod types
   - Match, Player, Army, Unit, Weapon, Ability, Terrain, Objective, Stratagem
   - 12+ event types (MatchStarted, PhaseAdvanced, UnitMoved, AttackDeclared, DiceRolled, AttackResolved, etc.)
   - JSON examples for every entity
   - State mutation rules (phase advancement, unit flag reset)

5. **[API_CONTRACTS.md](API_CONTRACTS.md)** (801 lines)
   - WebSocket message types (commands, state updates, blocks, broadcasts)
   - REST endpoints (match CRUD, army import, rules upload, vision, debug)
   - Request/response JSON examples
   - Command → Legality → Event → Broadcast flow
   - Error responses, rate limiting, deduplication

6. **[VOICE_GRAMMAR.md](VOICE_GRAMMAR.md)** (573 lines)
   - Complete voice command library
   - Phase-specific commands (Movement, Shooting, Charging, Fighting, etc.)
   - Command structure and natural language patterns
   - Ambiguity resolution and error recovery
   - Coaching mode enhancements
   - Competitive mode strictness

7. **[VISION_PIPELINE.md](VISION_PIPELINE.md)** (753 lines)
   - End-to-end computer vision system
   - Unit detection (Hough circles, YOLO, edge detection)
   - Embedding extraction (MobileNet-v3 TensorFlow Lite on-device)
   - Fingerprint matching and roster-constrained identification
   - Real-time tracking (ByteTrack/DeepSORT)
   - Homography calibration (pixel → table coordinates)
   - Terrain scanning (LiDAR + edge detection)
   - Python and Swift code examples
   - Pre-game fingerprint scanning flow (≤5s per unit)

8. **[RULES_ENGINE.md](RULES_ENGINE.md)** (799 lines)
   - Rules evaluation framework
   - Legality checking and hard-stop enforcement
   - Rule definition format (JSON/YAML)
   - Condition evaluator with operators
   - 30+ rule examples by category
   - Override system for referees
   - Reference Library management (user uploads, no copyrighted text)
   - Testing and validation examples

9. **[SECURITY_PRIVACY.md](SECURITY_PRIVACY.md)** (644 lines)
   - Data classification and handling
   - Video/image processing (no frames stored, on-device inference, debug TTL)
   - Encryption (AES-256 at rest, TLS 1.3 in transit)
   - JWT authentication and multi-device pairing
   - Authorization scopes
   - Rate limiting and abuse prevention
   - Audit logging and compliance
   - GDPR/CCPA user data requests
   - Rules library provenance (no copyrighted content)
   - Data breach response protocol
   - Third-party integrations and DPAs

10. **[MVP_PLAN.md](MVP_PLAN.md)** (666 lines)
    - 22-week roadmap (M0–M6)
    - M0: Foundation (repo, Docker, shared types, CI)
    - M1: State Engine (event store, WebSocket, phase advancement)
    - M2: Rules Engine (movement legality, hard-stop enforcement)
    - M3: Shooting phase (target selection, dice, attack resolution, web console)
    - M4: Vision (detection, fingerprints, tracking, homography)
    - M5: Voice (speech-to-text, intent parsing, terrain scanning)
    - M6: Launch prep (army import, full integration, TestFlight)
    - Sprint breakdowns, acceptance criteria, dependencies, risks
    - Testing strategy
    - Post-MVP roadmap (campaigns, tournaments, API)

## 🎯 Key Features Specified

- **Markerless Recognition:** No physical tags; computer vision + roster learning
- **Voice-First:** Natural language PTT commands, text/tap fallback
- **Hard-Stop Enforcement:** Illegal actions blocked before state changes
- **Real-Time AR:** Live overlay of legal ranges, terrain, unit positions
- **Event Sourcing:** Immutable audit trail, full match replay capability
- **Pluggable Rules:** User-provided rule definitions, no copyrighted text embedded
- **Multi-Device Sync:** iPhone on-table, web console for ref/analysis, real-time WebSocket
- **Tournament Ready:** Referee overrides, audit logs, dispute resolution, match export

## 📊 Documentation Statistics

| Metric | Value |
|--------|-------|
| Total Lines | 6,070 |
| Total Size | 220 KB |
| Number of Files | 10 |
| Code Examples | 50+ |
| Diagrams | 15+ |
| Tables | 25+ |
| Entity Types | 30+ |
| Event Types | 15+ |
| API Endpoints | 20+ |
| Rules Examples | 30+ |

## 🚀 How to Use

### Start Here
1. Read [INDEX.md](INDEX.md) for overview and cross-references
2. Read [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) to understand the vision
3. Choose a role below

### By Role

**Product Manager / Designer**
- [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) — personas, UX flows, features
- [VOICE_GRAMMAR.md](VOICE_GRAMMAR.md) — user interactions

**Backend Engineer**
- [ARCHITECTURE.md](ARCHITECTURE.md) — service design
- [DATA_MODEL.md](DATA_MODEL.md) — schemas, events
- [API_CONTRACTS.md](API_CONTRACTS.md) — endpoints, messages
- [RULES_ENGINE.md](RULES_ENGINE.md) — legality logic
- [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md) — auth, encryption

**iOS/Mobile Engineer**
- [VISION_PIPELINE.md](VISION_PIPELINE.md) — unit detection, AR overlay
- [VOICE_GRAMMAR.md](VOICE_GRAMMAR.md) — voice commands
- [API_CONTRACTS.md](API_CONTRACTS.md) — WebSocket protocol

**ML/Vision Engineer**
- [VISION_PIPELINE.md](VISION_PIPELINE.md) — complete pipeline with code

**DevOps Engineer**
- [ARCHITECTURE.md](ARCHITECTURE.md) — deployment topology
- [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md) — encryption, TLS, compliance

**QA / Test Engineer**
- [MVP_PLAN.md](MVP_PLAN.md) — acceptance criteria per milestone
- [RULES_ENGINE.md](RULES_ENGINE.md) — rule validation test cases

**Tournament Organizer / Rules Ref**
- [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) — referee mode
- [RULES_ENGINE.md](RULES_ENGINE.md) — override system
- [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md) — audit logs

## ✨ Key Concepts

- **Event Sourcing:** Every state change is an immutable event; state is reconstructed by replay
- **Hard-Stop Enforcement:** Rules engine validates before state mutation; illegal actions rejected with explanation
- **Markerless Vision:** No physical tags; on-device MobileNet embeddings + roster-constrained matching
- **Voice-First:** Natural language commands; tap UI fallback
- **Pluggable Rules:** User uploads rule definitions; no copyrighted text server-side
- **Real-Time Sync:** WebSocket for live state updates across iPhone + web console
- **Audit Trail:** All overrides and disputes logged for tournament appeals

## 🔗 Cross-Document References

Example: To understand "voice-controlled movement," follow:
1. [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) → Movement phase loop
2. [VOICE_GRAMMAR.md](VOICE_GRAMMAR.md) → "Move X to Y" command
3. [ARCHITECTURE.md](ARCHITECTURE.md) → Voice Service + State Engine
4. [API_CONTRACTS.md](API_CONTRACTS.md) → MoveUnitCommand
5. [DATA_MODEL.md](DATA_MODEL.md) → Unit, UnitMoved event
6. [RULES_ENGINE.md](RULES_ENGINE.md) → Movement legality rules

See [INDEX.md](INDEX.md) for more cross-reference examples.

## 📝 Version

**Documentation Version:** 1.0 (MVP specification)
**Last Updated:** 2025-02-15
**Status:** Ready for implementation

## 📄 License

This documentation is part of the Helm project specification. It describes system design and architecture for the voice-first AI referee for Warhammer 40K.

---

**Next Steps:**
1. Read [INDEX.md](INDEX.md) for overview
2. Review [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) with stakeholders
3. Use [MVP_PLAN.md](MVP_PLAN.md) for development planning
4. Reference specific docs during implementation

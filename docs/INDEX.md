# Helm Documentation Index

Complete documentation for Helm, the voice-first AI referee for Warhammer 40K tabletop play.

---

## Quick Start

**New to Helm?** Start here:
1. [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) — Understand the vision, personas, and core gameplay loops
2. [ARCHITECTURE.md](ARCHITECTURE.md) — See how the system fits together (iPhone + cloud + web)
3. [MVP_PLAN.md](MVP_PLAN.md) — Know the roadmap and current status

**Building Helm?** These are essential:
1. [DATA_MODEL.md](DATA_MODEL.md) — Entity schemas, event types (Zod definitions)
2. [API_CONTRACTS.md](API_CONTRACTS.md) — WebSocket & REST endpoints with examples
3. [RULES_ENGINE.md](RULES_ENGINE.md) — How legality is enforced
4. [VISION_PIPELINE.md](VISION_PIPELINE.md) — Unit detection and tracking details
5. [VOICE_GRAMMAR.md](VOICE_GRAMMAR.md) — Voice command library and parsing
6. [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md) — Data protection and compliance

---

## Documentation Files

### [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) (450 lines)
**Purpose:** North star document for product and design

**Contains:**
- Vision statement and success metrics
- User personas (new player, veteran, tournament organizer)
- Core gameplay loops (pre-match, round, post-match) with detailed walkthroughs
- Key differentiators vs. pen-and-paper and competing apps
- Match flow diagram
- Coaching vs. referee mode specifications
- iPhone scanning flow, AR overlay UX, web console features
- Technical constraints (latency, privacy, terrain, event sourcing, rules library)

**Read this if:** You want to understand Helm's purpose and user experience

---

### [ARCHITECTURE.md](ARCHITECTURE.md) (550 lines)
**Purpose:** System design and service topology

**Contains:**
- High-level architecture diagram (client layer, API gateway, cloud services, persistence)
- Data flow examples (player moves unit on iPhone → cloud processes → desktop updates)
- Service descriptions: API Gateway, State Engine, Rules Engine, Vision Service, Voice Service, Dice Service
- Event Store schema (PostgreSQL) and materialized views (Redis)
- WebSocket protocol and message types
- REST API endpoints
- Offline mode and deployment topology

**Read this if:** You're a backend engineer, architect, or need to understand service boundaries

---

### [DATA_MODEL.md](DATA_MODEL.md) (400 lines)
**Purpose:** Complete data schema definitions with Zod types

**Contains:**
- Core entity schemas: Match, Player, Army, Unit (with detailed status flags), Weapon, Ability, Terrain, Objective, Stratagem
- JSON examples for each entity
- Complete event union type with 12+ event type definitions: MatchStarted, PhaseAdvanced, UnitMoved, AttackDeclared, DiceRolled, AttackResolved, UnitDestroyed, StratagemUsed, IllegalActionBlocked, OverrideApplied, ObjectiveScored, BattleShockTest, etc.
- State mutation rules (phase advancement, unit flag reset)

**Read this if:** You're implementing data serialization, validation, or database schemas

---

### [API_CONTRACTS.md](API_CONTRACTS.md) (380 lines)
**Purpose:** Request/response specifications for all API endpoints

**Contains:**
- WebSocket command types (MoveUnit, AttackCommand, RollDiceCommand, UseStratagem, AdvancePhase, QueryRule) with JSON examples
- WebSocket server message types (ConnectionEstablished, CommandAccepted, CommandBlocked, StateUpdate, PhaseAdvanced, RuleQueryResponse)
- REST endpoints for match CRUD, army management, rules upload, vision calibration, debug video clips
- Command → Legality → Event → Broadcast flow diagram
- Error response format
- Request deduplication protocol (sequence numbers)
- Rate limiting policies

**Read this if:** You're implementing API clients, servers, or testing API behavior

---

### [VOICE_GRAMMAR.md](VOICE_GRAMMAR.md) (420 lines)
**Purpose:** Complete voice command library and natural language handling

**Contains:**
- Voice command structure and principles (natural language first, fallback UI, disambiguation)
- Phase-specific commands: Command (strategems, enhancements), Movement ("move X to objective Y"), Psychic (casting), Shooting (target selection, dice rolling, saves), Charge (declaration, rolls), Fight, phase navigation
- General commands: rules queries, tactical advice, status checks, manual corrections
- Voice grammar reference patterns (unit reference, direction, confirmation)
- Ambiguity resolution and error recovery strategies
- Coaching mode enhancements (suggestions, ability highlighting, opportunity notifications)
- Competitive mode differences

**Read this if:** You're implementing voice UI, intent parsing, or writing test scripts

---

### [VISION_PIPELINE.md](VISION_PIPELINE.md) (500 lines)
**Purpose:** Computer vision system design, unit detection, tracking, terrain mapping

**Contains:**
- End-to-end pipeline: fingerprinting → live tracking → position mapping → terrain scanning
- Detailed steps: base detection (Hough circles, YOLO, edge detection), crop + preprocessing, embedding extraction (MobileNet-v3 TensorFlow Lite), fingerprint matching (cosine similarity, roster constraints, A/B/C labeling), temporal tracking (ByteTrack/DeepSORT), homography calibration (pixel → table coords), terrain scanning (LiDAR + edge detection)
- Pre-game fingerprint scanning flow (≤5s per unit, 4 angles)
- Real-time tracking accuracy metrics
- Performance optimization (on-device, cloud)
- Training data and provenance tracking
- Python/Swift code examples

**Read this if:** You're implementing vision features, training ML models, or optimizing inference

---

### [RULES_ENGINE.md](RULES_ENGINE.md) (450 lines)
**Purpose:** Rules evaluation framework, legality checking, hard-stop enforcement

**Contains:**
- Architecture diagram: command → rules filter → condition evaluation → legality result → hard-stop or allow
- Rule definition format (JSON/YAML): id, category, phase, conditions, effect, explanation, source
- Condition evaluator with operators (>, <, ==, in, contains, any, all, etc.)
- Legality check function: evaluate applicable rules, return isLegal + explanation
- Rule examples by category: Movement (distance, coherency, engagement), Shooting (range, LoS, engagement, advance), Charging (distance, pinned), Fighting, Battle Shock, Strategems
- Override system (referee can allow illegal action, audit trail)
- Reference Library management (user uploads, versioning, no copyrighted content)
- Effect types (hard-stop, soft-block, inform)
- Testing & validation examples

**Read this if:** You're implementing rules evaluation, creating rule definitions, or refereeing matches

---

### [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md) (420 lines)
**Purpose:** Data protection, encryption, authentication, compliance

**Contains:**
- Data classification (public, confidential, sensitive)
- Video/image handling: no frames stored by default, on-device inference, debug mode with TTL, cleanup automation
- Fingerprint storage (128-D vectors, non-invertible, permanent)
- Encryption: AES-256 at rest (PostgreSQL, S3), TLS 1.3 in transit
- JWT token authentication, multi-device pairing flow
- Authorization scopes (match:read/write, vision:upload, rules:upload, override:apply, etc.)
- Rate limiting & DDoS protection
- Input validation and sanitization
- Audit logging (what, when, by whom, result)
- User data deletion (GDPR) and export requests
- Privacy settings and rules library provenance
- Data breach response protocol (48-hour timeline)
- Third-party integrations (Whisper, S3, Stripe, Firebase)
- Compliance standards (OWASP, GDPR, CCPA, PCI DSS)

**Read this if:** You're handling auth, encryption, audit logs, or compliance questions

---

### [MVP_PLAN.md](MVP_PLAN.md) (550 lines)
**Purpose:** Development roadmap from M0 to launch, broken into 22-week milestones

**Contains:**
- Team assumptions (8 core engineers, 2-week sprints, 80% capacity)
- Milestone overview (M0: Foundation → M1: State Engine → M2: Rules → M3: Shooting → M4: Vision → M5: Voice → M6: Launch)
- Detailed sprint breakdowns per milestone: deliverables, acceptance criteria, dependencies, risks
- M0 (Weeks 1–2): Repo setup, Docker, shared types, CI
- M1 (Weeks 3–4): State engine, event store, WebSocket
- M2 (Weeks 5–7): Rules engine, movement legality, hard-stop enforcement
- M3 (Weeks 8–10): Shooting flow, web console dashboard
- M4 (Weeks 11–14): Vision pipeline (detection, fingerprints, tracking, homography)
- M5 (Weeks 15–18): Voice integration, terrain scanning
- M6 (Weeks 19–22): Full integration, army import, launch prep
- Testing strategy (unit, integration, performance, UAT, beta)
- Risk matrix (vision accuracy, voice parsing, rules coverage, etc.) with mitigations
- Acceptance tests per milestone
- Post-MVP roadmap (campaign mode, tournaments, API, etc.)

**Read this if:** You're planning the development timeline, allocating resources, or tracking progress

---

## Cross-References

**Want to understand a feature?** Follow the thread:

### "Voice-controlled movement"
1. [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) - Movement phase loop
2. [VOICE_GRAMMAR.md](VOICE_GRAMMAR.md) - "Move X to Y" command
3. [ARCHITECTURE.md](ARCHITECTURE.md) - Voice Service + State Engine
4. [API_CONTRACTS.md](API_CONTRACTS.md) - MoveUnitCommand type
5. [DATA_MODEL.md](DATA_MODEL.md) - Unit, UnitMoved event
6. [RULES_ENGINE.md](RULES_ENGINE.md) - Movement legality rules

### "Markerless vision detection"
1. [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) - iPhone scanning flow, AR overlay
2. [VISION_PIPELINE.md](VISION_PIPELINE.md) - Full pipeline details
3. [ARCHITECTURE.md](ARCHITECTURE.md) - Vision Service integration
4. [DATA_MODEL.md](DATA_MODEL.md) - Unit visionFingerprint schema
5. [API_CONTRACTS.md](API_CONTRACTS.md) - /vision endpoints

### "Hard-stop rules enforcement"
1. [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) - North star ("hard-stop legality enforcement")
2. [RULES_ENGINE.md](RULES_ENGINE.md) - Full design
3. [ARCHITECTURE.md](ARCHITECTURE.md) - Command pipeline diagram
4. [API_CONTRACTS.md](API_CONTRACTS.md) - CommandBlocked response
5. [DATA_MODEL.md](DATA_MODEL.md) - IllegalActionBlocked, OverrideApplied events

### "Tournament referee workflow"
1. [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) - Referee persona, coach/ref modes, web console
2. [ARCHITECTURE.md](ARCHITECTURE.md) - Multi-table dashboard
3. [API_CONTRACTS.md](API_CONTRACTS.md) - /match/:matchId/manual-override endpoint
4. [RULES_ENGINE.md](RULES_ENGINE.md) - Override system
5. [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md) - Audit logging

---

## Key Concepts

### Event Sourcing
All game state changes are immutable events appended to the Event Store. State is reconstructed by replaying events. See [ARCHITECTURE.md](ARCHITECTURE.md) and [DATA_MODEL.md](DATA_MODEL.md).

### Hard-Stop Enforcement
Every command is evaluated for legality **before** state is mutated. Illegal commands are blocked immediately with explanation + suggestion. See [RULES_ENGINE.md](RULES_ENGINE.md).

### Markerless Recognition
Units are identified via on-device MobileNet embeddings, matched to pre-scanned fingerprints without physical tags or markers. See [VISION_PIPELINE.md](VISION_PIPELINE.md).

### Voice-First
Primary interaction is natural language voice commands (PTT default). Text/tap UI available as fallback. See [VOICE_GRAMMAR.md](VOICE_GRAMMAR.md).

### Pluggable Rules Library
Users upload rule definitions (no copyrighted text). System doesn't embed proprietary rules, enabling compliance and customization. See [RULES_ENGINE.md](RULES_ENGINE.md) and [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md).

---

## Glossary

- **Helm** - The system itself (AI voice-first referee)
- **iPhone** - Client device running vision + voice + AR
- **Web Console** - Browser-based match dashboard (desktop/tablet)
- **Match** - Single game (stores all events, players, units)
- **Unit** - Squad of models (Intercessors, Guardsmen, etc.) with identity, position, status
- **Event** - Immutable record of action (UnitMoved, AttackResolved, etc.)
- **Command** - Player request (MoveUnit, RollDice, etc.) that undergoes legality check
- **Legality Check** - Rules Engine validates command against applicable rules
- **Hard-Stop** - Command is blocked immediately if illegal
- **Fingerprint** - Pre-match embedding scan of unit (4 angles, ≤5s)
- **Embedding** - 128-D vector from MobileNet-v3, non-invertible unit signature
- **Homography** - Pixel-to-table-coordinate transformation (calibrated with ruler images)
- **LoS** - Line of Sight (terrain-aware, rules checked by Rules Engine)
- **AR Overlay** - Real-time augmented reality showing detected units, ranges, terrain
- **WebSocket** - Real-time bidirectional channel for commands + broadcasts
- **Materialized View** - Redis cache of current match state (fast read, updated on events)
- **Reference Library** - User-uploaded rule definitions (JSON/YAML)
- **Override** - Referee decision to allow/deny action (audit-logged)

---

## Document Statistics

| File | Lines | Topics |
|------|-------|--------|
| PRODUCT_OVERVIEW.md | ~450 | Vision, personas, gameplay loops, UX, constraints |
| ARCHITECTURE.md | ~550 | Services, data flow, protocols, deployment |
| DATA_MODEL.md | ~400 | Schemas, events, types, mutations |
| API_CONTRACTS.md | ~380 | WebSocket, REST, messages, errors |
| VOICE_GRAMMAR.md | ~420 | Commands, grammar, parsing, fallbacks |
| VISION_PIPELINE.md | ~500 | Detection, tracking, terrain, ML, code |
| RULES_ENGINE.md | ~450 | Framework, conditions, legality, overrides |
| SECURITY_PRIVACY.md | ~420 | Encryption, auth, audit, compliance |
| MVP_PLAN.md | ~550 | Roadmap, milestones, testing, risks |
| **TOTAL** | **~4,120** | Complete system specification |

---

## How to Use These Docs

### For Product/Design
- Read: PRODUCT_OVERVIEW, VOICE_GRAMMAR
- Reference: ARCHITECTURE for system overview

### For Backend Engineering
- Read: ARCHITECTURE, DATA_MODEL, API_CONTRACTS, RULES_ENGINE
- Reference: MVP_PLAN for timeline, SECURITY_PRIVACY for auth/encryption

### For iOS/Mobile Engineering
- Read: VISION_PIPELINE, VOICE_GRAMMAR, ARCHITECTURE (iPhone section)
- Reference: DATA_MODEL for schemas, API_CONTRACTS for messages

### For DevOps/Infrastructure
- Read: ARCHITECTURE (deployment), MVP_PLAN (milestones)
- Reference: SECURITY_PRIVACY for TLS, encryption, data handling

### For QA/Testing
- Read: MVP_PLAN (acceptance criteria), RULES_ENGINE (rule testing), VISION_PIPELINE (metrics)
- Reference: DATA_MODEL for test data shapes

### For Tournament Organizers
- Read: PRODUCT_OVERVIEW (referee mode), ARCHITECTURE (web console), SECURITY_PRIVACY (audit logs)

---

## Version

**Documentation Version:** 1.0 (MVP specification)
**Last Updated:** 2025-02-15
**Status:** Ready for implementation

---

## Contributing

These docs are living documents. Update them as:
- Requirements change (add note + date)
- Decisions are made (document in ARCHITECTURE or MVP_PLAN)
- Code deviates from spec (sync spec back to reality)

All significant changes should be reviewed by tech lead + product manager.

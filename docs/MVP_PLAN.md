# Helm: MVP Roadmap & Milestones

## Executive Summary

The MVP roadmap spans **22 weeks (M0–M6)** to deliver a fully integrated Helm system: markerless unit detection, voice-first control, hard-stop rules enforcement, and event-sourced match replay. This document outlines milestones, acceptance criteria, and risk assessments.

---

## Team Assumptions

- **Core Team:** 8 engineers (2 iOS, 2 backend, 2 ML/vision, 1 DevOps, 1 QA)
- **Part-time:** 1 product manager, 1 designer, 1 compliance officer
- **Velocity:** 2-week sprints; 80% capacity for feature work, 20% for tech debt/support

---

## Milestone Overview

```
M0 (Weeks 1–2)   : Repo setup, shared types, Docker, CI
                    [FOUNDATION]
                    │
M1 (Weeks 3–4)   : State engine, event store, phase advancement, WebSocket sync
                    [STATE & EVENTS]
                    │
M2 (Weeks 5–7)   : Rules engine framework, movement legality, hard-stop enforcement
                    [RULES FOUNDATION]
                    │
M3 (Weeks 8–10)  : Shooting flow, target eligibility, attack resolution, web console
                    [GAME FLOW]
                    │
M4 (Weeks 11–14) : Vision pipeline v1 (detection, tracking, fingerprints), iPhone UI
                    [VISION]
                    │
M5 (Weeks 15–18) : Voice integration, PTT, intent parsing, terrain scanning
                    [VOICE & PERCEPTION]
                    │
M6 (Weeks 19–22) : Full vertical slice, army import (BattleScribe), polish, launch prep
                    [INTEGRATION & LAUNCH]
```

---

## M0: Foundation (Weeks 1–2)

**Goal:** Establish monorepo, CI/CD pipeline, shared type definitions, local development environment.

### Sprint Breakdown

#### Week 1
- Set up GitHub repo with branch protection (main, develop)
- Create Docker Compose with PostgreSQL, Redis, API Gateway (Kong), S3 (LocalStack)
- Initialize TypeScript shared types package (@helm/types)
- Set up GitHub Actions CI (lint, test, build)
- Create design system figma (Helm icons, colors, fonts)

#### Week 2
- Local dev setup guide (Docker, npm, Xcode)
- Shared test fixtures (mock match state, units, events)
- GitHub Project board (kanban for sprints)
- API versioning strategy (v1 in base URL)
- Design: login flow, match creation UI mockups

### Acceptance Criteria
- [ ] All engineers can run `docker compose up` + `npm install` + local app compiles
- [ ] CI passes on all commits (lint, type check, unit tests ≥80% coverage)
- [ ] Shared types repo deployed to private npm registry
- [ ] Design system Figma shared with team
- [ ] Architecture doc reviewed + signed off by tech lead

### Deliverables
```
helm/
├── services/
│   ├── api-gateway/  (Kong config, stub)
│   ├── state-engine/ (empty, WIP)
│   └── ...
├── packages/
│   └── types/        (Match, Unit, Event types)
├── apps/
│   ├── mobile/       (Xcode project stub)
│   └── web/          (Create React App)
├── docker-compose.yml
├── package.json
└── README.md
```

### Risk: None identified. Foundation work is low-risk, prerequisite for everything else.

---

## M1: State Engine & Event Sourcing (Weeks 3–4)

**Goal:** Implement immutable event store, command pipeline, state reduction, WebSocket real-time sync.

### Sprint Breakdown

#### Week 3
- PostgreSQL event store schema + migrations
- Command pipeline: input validation → legality stub → event append
- State reduction: apply event → update materialized view (Redis)
- WebSocket server (Node.js, ws library), connection handshake
- Unit tests for state reduction logic (10 unit tests)

#### Week 4
- WebSocket broadcast: server sends StateUpdate to all clients
- Client (React) WebSocket connection + message handling
- Offline queue: client buffers commands if disconnected
- Event replay: fetch event log by matchId, reconstruct state at any timestamp
- Integration test: create match → move unit → verify event + state (E2E test in CI)

### Acceptance Criteria
- [ ] Event store holds ≥100 events with 0 data loss
- [ ] StateUpdate broadcasts within 200ms of command commit
- [ ] Offline command queue re-syncs on reconnection without duplication
- [ ] Event replay reconstructs match state accurately (verified by checksum)
- [ ] WebSocket latency < 100ms (P95) in CI/CD environment
- [ ] 85%+ code coverage on state-engine service
- [ ] Load test: 50 concurrent matches, 1000 events each, no degradation

### Deliverables
```
state-engine/
├── src/
│   ├── command-pipeline.ts
│   ├── state-reducer.ts
│   ├── event-store.ts
│   └── websocket.ts
├── tests/
│   ├── command-pipeline.test.ts
│   └── e2e.test.ts
└── migrations/
    └── 001-create-events-table.sql

web-console/
├── src/
│   ├── hooks/useWebSocket.ts
│   ├── pages/MatchPage.tsx
│   └── components/EventLog.tsx
```

### Dependencies
- M0 must be complete (types, Docker)

### Risk
- **WebSocket stability:** May need fallback to polling if WebSocket drops frequently
  - Mitigation: heartbeat ping/pong every 30s, auto-reconnect with exponential backoff

---

## M2: Rules Engine & Movement Legality (Weeks 5–7)

**Goal:** Implement rules evaluation framework, legality checks, hard-stop blocking for movement phase.

### Sprint Breakdown

#### Week 5
- Rules schema (JSON/YAML): id, category, phase, conditions, effect
- Condition evaluator: compare field against operator + value
- Legality check function: filter rules by phase → evaluate conditions → return isLegal + explanation
- Rules loader: parse user-uploaded JSON, validate structure
- 20 movement rules (distance, coherency, engagement, etc.)

#### Week 6
- Hard-stop enforcement in command pipeline: checkLegality() before event commit
- CommandBlocked response: send to client with ruleId + explanation + suggestedFix
- Fallback options: suggest alternatives ("Try 6 inches" or "Use Fall Back")
- Confidence scoring: some rules are warnings (soft-block), not errors
- Unit tests for 15 rules (distance limits, coherency, etc.)

#### Week 7
- Rules override system: referee manually allows illegal move (audit trail)
- Web console: referee UI to view blocked commands, apply overrides
- Rules library versioning: users can upload updated rule sets
- Integration test: attempt illegal moves → verify blocks, then override → verify allow
- Load test: 1000 legality checks/sec, P95 < 50ms

### Acceptance Criteria
- [ ] All movement rules evaluated correctly (manual test + unit tests)
- [ ] CommandBlocked response includes explanation + suggested fix
- [ ] Hard-stop prevents state mutation (blocked commands never commit)
- [ ] Override audit trail created for each referee decision
- [ ] Rules can be reloaded without restarting service
- [ ] 90%+ accuracy on legality (human referee validation)
- [ ] Latency: legality check < 50ms P95

### Deliverables
```
rules-engine/
├── src/
│   ├── rules-loader.ts
│   ├── condition-evaluator.ts
│   ├── legality-checker.ts
│   ├── override-handler.ts
│   └── rules/ (20 movement rule definitions)
├── tests/
│   └── rules.test.ts (50+ rule tests)
└── data/
    └── movement-rules.json

web-console/
├── src/
│   ├── pages/RefereePage.tsx (override UI)
│   └── components/RuleBlockedAlert.tsx
```

### Dependencies
- M1 must be complete (state engine, command pipeline)

### Risk
- **Rule authoring burden:** Creating 100+ rules manually is error-prone
  - Mitigation: rule template generator, validation checklist, human review

---

## M3: Shooting Phase & Web Console (Weeks 8–10)

**Goal:** Implement full shooting flow (target selection, dice rolling, damage resolution), web console dashboard.

### Sprint Breakdown

#### Week 8
- Attack declaration: legality checks (range, LoS, engagement, weapon restrictions)
- Eligible targets display: show list of valid targets in range
- Dice rolling: accept voice input ("rolled 8") or camera detection
- Attack resolution: hit rolls → wound rolls → saves → casualties
- 15 shooting rules (range, LoS, engagement, heavy, etc.)

#### Week 9
- Web console dashboard: live table map showing unit positions
- Event log viewer: searchable, filterable list of all events
- Unit status panel: wounds, morale, status flags per unit
- Objective tracker: real-time scoring, point totals
- Referee tools: manual position correction, manual roll entry, dispute UI

#### Week 10
- Integration test: full shooting flow (declare → roll → resolve → update state)
- Web console load test: 50 concurrent users viewing 10 matches
- Line of sight (LoS) mock: placeholder for terrain-based LoS checks
- Coaching mode UI: highlight eligible targets, suggest valid actions
- Unit tests for shooting rules (30+ tests)

### Acceptance Criteria
- [ ] Attack flow end-to-end (target → roll → resolve → casualties) works
- [ ] Web console displays match state with <500ms latency
- [ ] Referee can manually correct position + roll without breaking event chain
- [ ] All shooting rules blocked correctly (illegal targets, out of range, etc.)
- [ ] Event log searchable by unit, rule, phase, player
- [ ] Coaching mode explains why action is illegal
- [ ] Web console performance: <200ms for state updates, <500ms for page load
- [ ] 50 concurrent match viewers, no slowdown

### Deliverables
```
rules-engine/
├── src/
│   └── rules/ (15 shooting rule definitions)

web-console/
├── src/
│   ├── pages/
│   │   ├── MatchDashboard.tsx
│   │   ├── RefereePage.tsx
│   │   └── CoachingMode.tsx
│   ├── components/
│   │   ├── TableMap.tsx
│   │   ├── EventLog.tsx
│   │   ├── ObjectiveTracker.tsx
│   │   └── UnitPanel.tsx
│   └── hooks/useWebSocket.ts

mobile/
├── src/
│   └── pages/ShootingPhase.tsx (stub for M4+)
```

### Dependencies
- M1, M2 must be complete

### Risk
- **Line of sight complexity:** Terrain-based LoS checks deferred to M5; using simple distance checks now
  - Mitigation: placeholder LoS check (distance-only), flag for future improvement

---

## M4: Vision Pipeline v1 (Weeks 11–14)

**Goal:** Implement on-device unit detection, fingerprint scanning, real-time tracking, confidence scoring.

### Sprint Breakdown

#### Week 11
- MobileNet-v3 TensorFlow Lite model: convert, quantize, embed in app
- Base detection: Hough circles + YOLO to find unit bases in frame
- Unit crop + preprocessing: 224×224 normalization for MobileNet
- On-device embedding: extract 128-D vector per unit, L2 normalize
- iPhone camera permission + frame capture (30 fps)

#### Week 12
- Fingerprint scanning flow: capture 4 angles in ≤5s, upload embeddings
- Cloud matching: cosine similarity to fingerprints, top-K candidates
- Confidence scoring: ≥85% auto-confirm, 70–85% prompt, <70% manual select
- Duplicate detection: identify A/B/C units, auto-label
- Unit tests for embedding matching (20 tests), confidence logic

#### Week 13
- Real-time tracking: ByteTrack or DeepSORT for temporal coherence
- Position mapping: homography from calibration images (pixel → table coords)
- AR overlay: show detected units + confidence, update position in real-time
- Tracking loss recovery: if unit disappears, prompt manual confirm on re-detection
- Integration test: scan units → track through match → verify positions accurate

#### Week 14
- Calibration flow: user provides ruler images + crosshairs
- Homography compute: auto-calibrate table coordinates
- Accuracy validation: RMSE < 0.5 inches, confidence > 90%
- Performance optimization: process N keyframes/sec to save battery
- Load test: continuous tracking of 20 units at 30 fps, latency <200ms

### Acceptance Criteria
- [ ] Unit fingerprints scanned in ≤5 seconds, with ≥95% confidence
- [ ] Real-time tracking maintains unit identity across 30 fps video (dropout <1 frame)
- [ ] Position accuracy ±0.5 inches (table homography calibration)
- [ ] A/B/C labeling correct for duplicate units (manual validation)
- [ ] AR overlay updates position in real-time (<200ms latency)
- [ ] Confidence scoring: <5% false positives (wrong unit ID)
- [ ] Phone battery usage <2% per minute (TF Lite optimized)
- [ ] Cold start (fingerprint scan) <30s per unit

### Deliverables
```
mobile/
├── src/
│   ├── vision/
│   │   ├── EmbeddingModel.swift
│   │   ├── BaseDetector.swift
│   │   ├── FingerprintScanner.swift
│   │   ├── Tracker.swift
│   │   └── HomographyCalibration.swift
│   ├── views/
│   │   ├── VisionPreview.swift
│   │   ├── FingerprintScanView.swift
│   │   └── AROverlay.swift
│   └── hooks/useVision.ts (web console vision control)

models/
└── mobilenet_v3_40k_v1.0.tflite (4 MB)

api-server/
├── src/
│   ├── vision-service/
│   │   ├── matcher.ts
│   │   ├── tracker.ts
│   │   └── calibration.ts
```

### Dependencies
- M0, M1, M2 must be complete
- ML team: pre-trained MobileNet-v3 model + PCA projection ready

### Risk
- **Model accuracy:** Off-the-shelf MobileNet may not perform well on 40K minis
  - Mitigation: fine-tune on 40K unit images (10k+ crowdsourced photos), validate P&P
- **Lighting variability:** Table lighting changes affect embedding
  - Mitigation: augment training data (brightness, shadows); use confidence thresholds

---

## M5: Voice Integration & Terrain Scanning (Weeks 15–18)

**Goal:** Implement voice-first command interface, Whisper speech-to-text, intent parsing; integrate LiDAR/edge-detection for terrain.

### Sprint Breakdown

#### Week 15
- Whisper API integration: on-device or cloud speech-to-text
- Voice permission + microphone capture (PTT button)
- Intent parser: grammar-based rule matching ("Move Intercessors to objective 2")
- Command generation: intent → Command object (MoveUnit, AttackDeclared, etc.)
- Fallback: if speech-to-text fails 3×, prompt tap UI

#### Week 16
- Confidence scoring: only parse intents with >60% confidence
- Disambiguation: if ambiguous ("Move Intercessors" + 2 Intercessor squads), ask "A or B?"
- Timeout handling: <3s to respond, then retry or fallback
- Phone feedback: haptic + audio confirm ("Move registered") or deny ("Didn't understand, try again")
- Voice grammar tests: 50+ test cases (move, attack, charge, etc.)

#### Week 17
- LiDAR scanning (iPhone 12+): 3D point cloud → terrain footprints
- Edge detection (fallback): CV2 contours on video frame
- Terrain classification: user labels (ruin, hill, woods, etc.)
- Footprint storage: polygon vertices in table coordinates
- Line of sight (LoS) integration: rules-engine checks terrain when evaluating attacks

#### Week 18
- Voice + vision integration: user says command → AR shows execution
- Confirmation flow: voice command → AR preview → voice confirm ("yes/no")
- Coaching mode voice: explain why action is illegal (TTS feedback)
- Terrain voice queries: "Can Guardsmen see Intercessors?" → Helm checks LoS + responds
- Integration test: full match with voice commands, terrain LoS checks, no manual input

### Acceptance Criteria
- [ ] Speech-to-text latency <2s (on-device or cloud)
- [ ] Intent parsing accuracy >90% on standard 40K commands
- [ ] Voice command success rate >80% (lower if background noise; fallback to tap)
- [ ] Disambiguation prompts <1s response time
- [ ] Terrain mapping accuracy >90% (manual validation vs. photo reference)
- [ ] LoS checks correct for 95% of test cases
- [ ] Voice feedback (TTS) natural, no robotic sounding
- [ ] Full match playable with voice commands + AR, no tap UI needed (optional)

### Deliverables
```
mobile/
├── src/
│   ├── voice/
│   │   ├── SpeechRecognition.swift
│   │   ├── IntentParser.ts
│   │   ├── CommandGenerator.ts
│   │   └── VoiceConfirmation.swift
│   ├── terrain/
│   │   ├── LiDARScanner.swift
│   │   ├── EdgeDetector.swift
│   │   └── TerrainMapper.swift
│   └── pages/VoiceCommandPage.tsx

voice-service/
├── src/
│   ├── whisper-client.ts
│   ├── intent-parser.ts
│   └── grammar/
│       └── 40k-commands.pegjs (grammar definition)

rules-engine/
├── src/
│   └── los-checker.ts (terrain-aware LoS evaluation)
```

### Dependencies
- M4 must be complete (vision pipeline for AR feedback)
- Whisper API key (OpenAI) configured

### Risk
- **Voice in noisy environments:** 40K tournaments can be loud
  - Mitigation: noise cancellation (Whisper handles this); fallback to tap UI prominent
- **Terrain classification:** Automatic terrain type detection hard
  - Mitigation: user manually labels terrain during setup (quick, <1min per feature)

---

## M6: Full Integration & Launch Prep (Weeks 19–22)

**Goal:** Vertical slice integration, army import from BattleScribe/WH+, polish, launch readiness.

### Sprint Breakdown

#### Week 19
- BattleScribe JSON import: parse roster, convert to internal Army schema
- WH+ app JSON import: similar parser (verify format with external sources)
- Manual army entry: fallback UI for users without tools
- Army validation: check points total, detachment rules, model counts
- Import test: 50 sample armies (various factions, points levels)

#### Week 20
- Full match vertical slice: create → load armies → scan units → play 3 turns → score
- Coaching mode complete: explains every block, highlights abilities, suggests actions
- Competitive mode strict: minimal help, hard-stop enforcement, no undo
- Match export: JSON event log + CSV summary + PDF match report
- Polish: UI consistency (colors, fonts, spacing), error messages, animations

#### Week 21
- Performance optimization: app launch time <3s, match state update <200ms
- Battery optimization: reduce TF Lite frequency, offload to cloud when possible
- Network resilience: offline mode queues commands, syncs on reconnect
- Regression testing: re-run all M1–M5 acceptance tests
- Security audit: check auth, encryption, data handling, rate limiting

#### Week 22
- Launch checklist: app signing, TestFlight beta, privacy policy, terms of service
- Documentation: user guides (iPhone, web console, voice commands), API docs, deployment
- Roadmap for post-MVP: future phases (campaign mode, community rules library, tournaments)
- Post-launch support: setup support channel, monitoring, bug triage
- Demo video: 2-min showing full match workflow

### Acceptance Criteria
- [ ] End-to-end match (create → army import → scan → 3 turns → score) takes <15 min
- [ ] Army import accurate: all units, points, strategems present
- [ ] Coaching mode helpful: >80% of players don't ask "why blocked?" questions
- [ ] Competitive mode strict: no false positives (blocks when shouldn't), <5% false negatives
- [ ] Export match data: event log complete, point summary correct, replay accurate
- [ ] App performance: <3s launch, <200ms state update, <50ms legality check
- [ ] Network resilience: offline mode buffers 50+ commands, syncs correctly
- [ ] TestFlight beta: ≥100 testers, ≥4.5 star rating, <5 critical bugs
- [ ] Privacy policy reviewed by compliance officer, terms signed off by legal
- [ ] Deployment: app in TestFlight, ready for App Store submission

### Deliverables
```
LAUNCH PACKAGE:
├── mobile/
│   ├── Helm.ipa (TestFlight build)
│   ├── privacy-policy.md
│   └── user-guide.md
├── web/
│   └── helm-console.tar.gz (docker image)
├── docs/
│   ├── API.md (REST + WebSocket)
│   ├── DEPLOYMENT.md
│   ├── ARCHITECTURE.md
│   └── SUPPORT.md
├── demo-video.mp4 (2 min)
└── roadmap-next.md (Phase 2 ideas)
```

### Dependencies
- M1–M5 must be complete
- External: Legal review (privacy policy), TestFlight setup (Apple)

### Risk
- **Post-launch bugs:** New platforms, edge cases, unforeseen issues
  - Mitigation: 2-week hotfix window, monitoring alerts, support team on-call

---

## Testing Strategy

### Unit Tests (Continuous)
- Rules evaluation: 100+ test cases per rule category
- State reduction: 50+ state mutations
- Vision matching: embedding similarity scores
- Voice parsing: intent recognition on 100+ utterances
- Target: ≥80% code coverage per service

### Integration Tests (Per Sprint)
- End-to-end command flow: command → legality → event → state broadcast
- Multi-device sync: 2 iPhones + web console, verify state consistency
- Vision + tracking: scan units → track for 1 minute, accuracy ±0.5"
- Voice + action: speak command → AR preview → confirm → state updated
- Network resilience: disconnect WebSocket, buffer commands, reconnect

### Performance Tests (M4+)
- Latency benchmarks: legality check <50ms, state broadcast <200ms, vision track <100ms
- Load tests: 50 concurrent matches, 1000+ events, no degradation
- Battery: <2% per minute on iPhone
- Memory: app footprint <500 MB, TF Lite model <10 MB

### User Acceptance Tests (M5–M6)
- Coaching mode: novice player completes 3-turn match without rules lookups
- Competitive mode: strict referee can enforce all rules without disputes
- Army import: BattleScribe armies import with 100% accuracy
- Voice commands: 80% success rate in tournament environment
- Match replay: event log replay reconstructs state at any turn

### Beta Testing (M6)
- 100+ external testers on TestFlight
- 2-week feedback cycle
- Bug priority: critical (game-breaking) → high (wrong result) → medium (cosmetic)
- Target: zero critical/high bugs before public launch

---

## Risk Matrix

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|-----------|
| Vision model accuracy (minis too small) | High | Medium | Fine-tune on 40K data, confidence thresholds, manual fallback |
| Voice parsing in loud environments | High | High | Noise cancellation, tap fallback UI, offline queue |
| Rules library coverage (incomplete) | High | Medium | Start with 10th edition core, community upload pipeline |
| WebSocket stability (frequent drops) | Medium | Medium | Heartbeat/keepalive, exponential backoff, polling fallback |
| Terrain LoS checks (complex) | Medium | Low | Placeholder distance-based LoS, improve in Phase 2 |
| Performance (50+ units, real-time) | Medium | Low | Optimize TF Lite, reduce frame rate if needed |
| User adoption (marketing, reviews) | High | Unknown | Beta testing, demo video, community engagement |
| Regulatory (copyright, data privacy) | Medium | Low | Legal review, user-provided rules (no embedded text), GDPR compliance |

---

## Acceptance Tests by Milestone

### M0
```
✓ All engineers can dev locally
✓ CI passes on every commit
✓ Shared types package works
```

### M1
```
✓ 100+ events stored, no loss
✓ State updates broadcast <200ms
✓ Event replay reconstructs state
✓ WebSocket latency <100ms P95
```

### M2
```
✓ All movement rules block correctly
✓ Overrides audit-logged
✓ Hard-stop prevents illegal mutations
✓ Legality check <50ms P95
```

### M3
```
✓ Full shooting flow (declare → roll → resolve)
✓ Web console shows live state
✓ Referee UI works (override, manual entry)
✓ 50 concurrent viewers, no slowdown
```

### M4
```
✓ Units scanned in ≤5s, ≥95% confidence
✓ A/B/C labeling correct
✓ Tracking maintains identity <1 frame dropout
✓ Position accuracy ±0.5"
```

### M5
```
✓ Intent parsing >90% accuracy
✓ Voice success rate >80%
✓ Terrain mapping >90% accurate
✓ LoS checks correct 95% of cases
```

### M6
```
✓ End-to-end match <15 min (create → play → score)
✓ Army import 100% accurate
✓ Coaching mode >80% clear
✓ TestFlight rating ≥4.5 stars
```

---

## Post-MVP Roadmap (Phase 2+)

**Not in scope for MVP, but noted for planning:**

### Phase 2 (Months 4–6)
- Campaign mode: multi-match tracking, narrative progression
- Enhanced LoS: 3D terrain elevation, occlusion from models
- Stratagem library: all 10th ed strategems with timing enforcement
- Community rules: user-submitted rules, voting, versioning

### Phase 3 (Months 7–9)
- Tournament mode: round-robin, Swiss, scoring, tiebreakers
- Match analytics: heatmaps of units, most frequent blocks, player stats
- Mobile desktop app: standalone macOS/Windows version
- API for third parties: allow battle report websites to fetch Helm data

### Phase 4 (Months 10+)
- Multiplayer AI coach: advanced advice ("use this stratagem now")
- 3D terrain: full 3D LiDAR map with elevation
- Neural net rules: train ML model on 10K+ tournament matches to predict optimal moves
- Helm tournaments: centralized platform for organizing 40K tournaments

---

## References

- [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) — Feature list, personas, success metrics
- [ARCHITECTURE.md](ARCHITECTURE.md) — Technical design, service split
- [DATA_MODEL.md](DATA_MODEL.md) — Schema definitions, event types
- [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md) — Compliance requirements per milestone

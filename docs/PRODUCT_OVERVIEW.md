# Helm: Product Overview

## Vision Statement

Helm is the voice-first, AI-powered referee for Warhammer 40K tabletop play. It reduces rules overhead, enforces hard-stop legality, and lets players focus on narrative and strategy. By combining markerless computer vision, natural language voice commands, and real-time state tracking, Helm transforms the 40K experience from a rules-lookup bottleneck into fluid, coaching-enriched gameplay.

## North Star

Players spend **less than 5% of match time** on rules lookups, legality disputes, or bookkeeping. The referee (AI or human) has perfect information about unit positions, status, and rules compliance, delivered via intuitive voice and AR. New players can learn as they play; veterans can compete with confidence that no illegal action sneaks through.

---

## User Personas

### Persona 1: Alex (New Player, 1-5 games)
- **Pain points:** Doesn't know all unit abilities, forgets coherency rules, uncertain if actions are legal
- **Helm value:** Coaching mode explains every ability, blocks illegal moves with suggestions, voice commands feel more natural than card-shuffling
- **Key features:** Simplified voice grammar, "why is this illegal?" explanations, ability highlights in AR overlay

### Persona 2: Maya (Veteran Competitive Player, 50+ games)
- **Pain points:** Fast-paced game slows down when both players dispute engagement status; wants perfect state record for post-match analysis
- **Helm value:** Event log captures every action, rules engine has zero tolerance for gray areas, AR overlay confirms positions instantly
- **Key features:** Competitive-mode rules strictness, detailed match export/analytics, override audit trail for tournament scrutiny

### Persona 3: Jordan (Tournament Organizer / Referee)
- **Pain points:** Adjudicates disputes across 8+ tables simultaneously, hard to catch sloppy moves on distant tables, lacks authority when players disagree
- **Helm value:** Centralized web console shows all tables in real-time, hard-stop legality enforcement is objective (not subjective judgment), audit trail proves every decision
- **Key features:** Multi-table dashboard, override audit, explainable rule blocking, export match logs for appeals

---

## Core Gameplay Loops

### Loop 1: Pre-Match Briefing (~2 min)
1. Create or load match (Matched Play, Narrative, Campaign)
2. Each player loads their army roster (BattleScribe JSON, WH+ app JSON, or manual entry)
3. Each unit is scanned via phone camera in **≤5s per unit**:
   - Place unit on table
   - Helm's vision service captures unit embedding (markerless recognition)
   - Auto-labeled A/B/C if duplicates exist
   - Stores fingerprint for real-time tracking
4. Both players confirm positions on AR map overlay
5. Players choose voice (phone's speaker), tap fallback (for noisy environments), or text mode
6. Match state syncs to all devices; Helm awaits first phase command

**Helm involvement:** Vision coaching ("tilt unit 20°—I can see more bases now"), roster validation against match rules, pre-match legality sweep

---

### Loop 2: Matched Play Round (turns 1–5, ~30 min per round)
Exemplar: Ork player's turn (Command, Movement, Psychic, Shooting, Charge, Fight phases)

#### Command Phase
- **Voice:** "Next phase" → Helm advances to Movement
- Helm checks strategems available and displays via AR overlay
- Veteran voice-commands strategem: "Use stratagem…" (auto-completes from voice-grammar dictionary)
- New player taps "Strategems" on console, sees cards with voice explanations

#### Movement Phase
- **Voice:** "Move Intercessors to objective 2"
- Helm vision tracks Intercessors A/B on table in real-time
- Rules engine checks: distance ≤6", not in engagement, coherency (units within 2" maintain cohesion)
- **Hard-stop block example:** Player tries moving unit 7"
  - Helm prevents move, voice response: "Intercessors can move 6". You've entered engagement range with Guardsmen. Move denied."
  - Debug info: Which rule? Why engagement range matters? Suggested fix?
- **AR overlay:** Shows legal movement ranges as blue circles; red zone = engagement restriction
- Player confirms move with voice ("confirm") or tap
- Event: `UnitMoved { unitId, fromPos, toPos, distance, morale, phase }`

#### Psychic Phase
- Skipped if no psykers
- "Cast smite on Guardsmen" → Helm checks range (24"), line of sight (terrain scan validates), not in engagement, manifesting threshold
- Block: "Smite range is 24". They're 28" away. Cast denied."

#### Shooting Phase
- **Voice:** "Attack with Hellblasters" (if A/B ambiguity, Helm clarifies: "Hellblasters A or B?")
- Helm displays eligible targets (within 24", no engagement restriction on this unit per rules, LoS check)
- "Shoot Hellblasters into Guardsmen A" → Helm shows attack stat (BS 3+, 2 shots each model)
- **Dice:** "Roll to hit" → Helm listens, player rolls physical dice
- Voice-driven: "That's 8 hits" or manual entry via console
- Event: `DiceRolled { unitId, attackType: "hit", count, phase }`
- Legality: 2 models × 2 shots = 4 attacks max; Helm blocks "8 hits" unless 4 models visible
- Resolve into damage (Armor saves, Invulnerable saves) → Event: `AttackResolved { defenderUnitId, wounds }`

#### Charge Phase
- "Declare charge: Boyz into Guardsmen" → Helm checks distance (≤12"), eligibility (not pinned, etc.)
- Roll for charge: "Rolled 6 and 4" → Helm validates both dice visible, auto-detects via dice-service
- **Hard-stop:** Charge roll is 3" each, max 10" total. This charge succeeds.
- Update unit position; set `isBattleShocked: true` if unit has taken wounds (morale check)

#### Fight Phase
- Melee resolution, pile-in, consolidate moves
- "Boyz attack Guardsmen" → Helm shows weapon profiles, number of attacks
- Wounds → `UnitDestroyed` event if HP ≤ 0

#### All Phases
- Terrain scanning is live: LiDAR (iPhone 12+) maps 2D footprint of terrain features
- LoS checks reference terrain: "Can Hellblasters see Guardsmen? Checking terrain…"
- Confidence <80%? Helm prompts: "I'm unsure of LoS. Tap 'confirm' or 'deny'."

---

### Loop 3: End of Battle (~5 min)
- "Tally objectives" (voice or tap) → Helm auto-counts point holders per objective
- "Score 100 points" (player claims) → Helm displays official count via rules engine
- Generate match export: JSON event log, point totals, turn summaries, illegal-action overrides
- Players review AR replay: playback unit positions frame-by-frame

---

## Key Differentiators

| Feature | Helm | Pen & Paper | Competing Apps |
|---------|------|-------------|-----------------|
| **Markerless vision** | ✓ Computer vision + roster learning | ✗ Manual tracking | Some use markers |
| **Voice-first** | ✓ PTT default, coherent grammar | ✗ | Text/UI-only |
| **Hard-stop enforcement** | ✓ Blocks illegal moves immediately | ✗ (trust-based) | Some warn only |
| **Explainable blocks** | ✓ Tells you why + how to fix | ✗ | Minimal explanations |
| **Real-time AR overlay** | ✓ Legal ranges, terrain, position certainty | ✗ | Static maps only |
| **Event-sourced state** | ✓ Full audit trail, replay, undo | ✗ | Game-state logs only |
| **Terrain scanning** | ✓ LiDAR + vision, auto-mapped | ✗ | Manual selection |
| **Mobile + desktop sync** | ✓ iPhone for on-table, web for ref/analysis | ✗ | Mobile-only or PC-only |
| **Rules library swappable** | ✓ User can upload reference data | Baked-in | Baked-in |
| **No DRM on rules** | ✓ User data, provenance tracked | — | Copyrighted data embedded |

---

## Match Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ PRE-MATCH: Load armies, scan units (≤5s each), confirm positions│
│ Helm: Vision + Roster validation + AR calibration               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ ROUND LOOP (Turns 1-5)                                          │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ P1 TURN: [Command] → [Movement] → [Psychic] → [Shooting]    ││
│ │          → [Charge] → [Fight]                                ││
│ │ Voice commands: "Move unit", "Attack target", "Roll N dice"  ││
│ │ Hard-stops: Legality check before each action                ││
│ │ AR overlay: Legal ranges, engagement zones, terrain, LoS     ││
│ └──────────────────────────────────────────────────────────────┘│
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ P2 TURN: (same flow)                                         ││
│ └──────────────────────────────────────────────────────────────┘│
│ Helm: Event log, state mutation, rules enforcement per phase   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ POST-MATCH: Score objectives, export events, review AR replay   │
│ Helm: Final audit, analytics export, dispute resolution data    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Coaching & Referee Modes

### Coaching Mode (New Player)
- **Helm personality:** Helpful, explanatory
- Every legality block includes: rule ID, rule text summary (non-copyrighted), suggested fix, related rules
- **Voice:** "You can't move Intercessors 7". They're in engagement with Guardsmen. Engagement units stay put or Fall Back (move 6", can't shoot). Want to Fall Back?"
- Highlights unit abilities that apply to current phase
- Shows eligible targets with color-coded ranges

### Referee Mode (Competitive / Tournament)
- **Helm personality:** Objective, strict
- Legality blocks are **non-negotiable** (override requires explicit audit entry with reason)
- All decisions logged: `OverrideApplied { ruleId, playerRequest, permission, audit }`
- Multi-table dashboard for TO: heatmap of blocks per table, override frequency, dispute triggers
- Export includes full event chain for appeals

### Coaching Queries (Voice + Web Console)
- "What is coherency?" → Helm reads rule definition (user-supplied, provenance tracked, not copyrighted)
- "Can this unit shoot?" → Helm evaluates unit state (engaged? hasn't moved? has ammo?) and answers yes/no + reason
- "Show Intercessors abilities" → AR overlay highlights unit, lists abilities with voice summaries
- "Explain last attack" → Helm narrates: "Guardsmen rolled 4 dice, 3 hits, Intercessors saved 1. 2 casualties."

---

## iPhone Scanning Flow

### Unit Fingerprinting (~5s per unit, pre-match)
1. **Setup:** Place unit on 12"×12" white mat (reference)
2. **Capture:** Player holds iPhone 6" away, shows 3–4 angles (front, side, back) within 5s
3. **Processing:**
   - On-device: MobileNet-v3 backbone extracts embedding (128-D vector)
   - Server: Compare to roster (BattleScribe JSON): which datasheet unit type? (Intercessors, Guardsmen, etc.)
   - **Duplication:** If Army has 2× Intercessor squads → auto-label A/B
4. **Confirmation:** AR preview shows detected unit overlaid on live feed; player taps "✓ Confirmed"
5. **Store:** Embedding + roster ID + label → Helm database
6. **Live tracking:** During match, Helm performs real-time frame→embedding comparison; low latency (on-device MobileNet inference ~50ms per frame)

### Confidence & Fallback
- Confidence ≥ 80%? Auto-confirm unit
- Confidence 50–80%? Show "I'm 60% sure this is Intercessors A. Tap ✓ to confirm or ✗ to re-scan."
- Confidence < 50%? Force manual selection from roster list

---

## AR Overlay UX (iPhone)

During active play, iPhone screen shows:
- **Live video feed** of tabletop
- **Unit overlays:** Each detected unit has a label (Intercessors A), color-coded by player
- **Movement zones:** Blue circles (legal move range), red arcs (engagement range, no-move zones)
- **LoS checker:** Tap unit A, tap unit B → Helm highlights LoS path, marks terrain blocking
- **Terrain map:** 2D footprint of ruins, hills, etc. (LiDAR-sourced if available)
- **Confidence meter:** Small icon shows vision confidence (green ✓, yellow ?, red ✗)
- **Status bar:** Current phase, active player, dice roll prompts

---

## Desktop/Web Console (Tournament Operator & Analysis)

- **Match overview:** Table layout, unit positions, casualty counts
- **Event log:** Every action: timestamp, player, action, legality result
- **Rules log:** Every block/override with explanation
- **Objectives:** Real-time point counter per player
- **Stratagem tracker:** Available, used, cooldowns
- **Referee tools:**
  - Manual position correction (override vision)
  - Manual roll entry (if voice/dice not detected)
  - Dispute resolution UI (record agreed-upon state change + reasoning)
- **Export:** JSON event log, CSV summary, PDF match report

---

## Core Technical Constraints

- **Vision latency:** < 200ms per frame (markerless detection + tracking)
- **Voice latency:** < 3s (voice capture → intent → action)
- **Network:** Real-time WebSocket sync to all devices; offline mode queues commands
- **Privacy:** Video frames not stored unless debug enabled (1-hour TTL); match state encrypted at rest
- **Rules library:** User-provided (no copyrighted text server-side); provenance tracked (source, version, timestamp)
- **Terrain:** LiDAR for iPhone 12+ (optional); falls back to 2D edge detection for older models

---

## Success Metrics

1. **Time-to-action:** Average phase duration decreases 20% vs. pen-and-paper baseline
2. **Rules disputes:** 95% of potential disputes caught by hard-stop enforcement before escalation
3. **New player satisfaction:** Coaching mode leads to 40% fewer "how do I...?" interruptions
4. **Competitive integrity:** Event log allows 100% of post-match disputes to be resolved objectively
5. **Vision accuracy:** Unit identification ≥ 95% (A/B/C labeled correctly)
6. **Voice success rate:** Intent parsing ≥ 90% (reduced by accent, background noise; fallback to tap)

---

## Roadmap Summary

See [MVP_PLAN.md](MVP_PLAN.md) for detailed milestones.

**Short-term (M0–M3):** State engine, rules engine, basic UI
**Mid-term (M4–M5):** Vision pipeline, voice integration, terrain scanning
**Long-term (M6+):** Full integration, army import ecosystem, competitive certifications

---

## References

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design, services, data flow
- [DATA_MODEL.md](DATA_MODEL.md) — Entity schemas, event types
- [API_CONTRACTS.md](API_CONTRACTS.md) — WebSocket, REST endpoints
- [VOICE_GRAMMAR.md](VOICE_GRAMMAR.md) — Voice command library
- [VISION_PIPELINE.md](VISION_PIPELINE.md) — Unit detection, tracking, terrain scanning
- [RULES_ENGINE.md](RULES_ENGINE.md) — Legality enforcement, reference library
- [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md) — Data protection, audit trails
- [MVP_PLAN.md](MVP_PLAN.md) — Roadmap, milestones, acceptance tests

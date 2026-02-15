# Helm: Voice Grammar & Natural Language Commands

## Overview

Helm uses a structured voice-command grammar with fallback to tap/text UI. The system supports both strict command patterns (for competitive play) and fuzzy natural language (for casual play). All voice commands are processed by the Voice Service on the cloud backend, with on-device speech-to-text via Whisper (or local Vosk for offline).

**Design Principles:**
- Natural language first: "Move Intercessors to objective 2" beats "move_unit_to_objective(u456, obj1)"
- Fallback always available: If voice fails 3 times, auto-prompt tap alternative
- Disambiguation on demand: If ambiguous (2× Intercessor squads), ask clarification question
- Context awareness: Available commands change per phase
- Error recovery: Misheard command? Offer correction suggestions

---

## Command Structure

All voice commands follow this pattern:

```
[ACTION] [UNIT/TARGET] [DIRECTION/MODIFIER] [CONFIRMATION]

Examples:
- "Move Intercessors to objective 2"
- "Attack with Hellblasters into Guardsmen A"
- "Roll to hit"
- "Next phase"
- "Undo last move"
```

---

## Phase-Specific Commands

### Command Phase

**Intent:** Use strategems, declare enhancements, plan turn

#### Stratagem Usage
```
Voice: "Use [stratagem name]"
Example: "Use Smoke Screen"
Parser output: UseStratagemCommand { stratagemId: "smoke_screen" }
Response: "Smoke Screen used (1 CP). Which unit?"
```

**Fallback (no target specified):**
```
User says: "Use Smoke Screen"
Helm: "Smoke Screen doesn't target units. Effect applied: +1 to saving throws this turn."
```

**Disambiguation (stratagem applies to unit):**
```
User says: "Use Cadian Strategem"
Helm: "Cadian Strategem affects Infantry. Which Infantry unit — Guardsmen A or Guardsmen B?"
User voice: "Guardsmen A"
Result: StratagemUsed { unitId: "guardsmen_a", stratagemId: "cadian_strategem" }
```

#### Enhancement Usage
```
Voice: "[Unit] gains [enhancement name]"
Example: "Intercessors gain Reinforced Armor"
Result: EnhancementApplied { unitId: "intercessors_a", enhancementId: "reinforced_armor" }
```

#### Score Objectives
```
Voice: "Tally objectives" or "Score objectives"
Helm: "Objective 1 held by Player 1 (3 pts). Objective 2 unclaimed. Objective 3 held by Player 2 (3 pts)."
Result: ObjectiveScoredEvent for each holder
```

---

### Movement Phase

**Intent:** Move units, advance, fall back, maintain coherency

#### Standard Movement
```
Voice: "Move [unit] to [location/objective]"
Examples:
  - "Move Intercessors to objective 2"
  - "Move Guardsmen forward 4 inches"
  - "Move Hellblasters behind that ruin"

Parser output: MoveUnitCommand { unitId, targetPosition, moveType: 'normal' }
Legality check:
  - ✓ Is unit in movement phase?
  - ✓ Has unit moved this turn already? (max 1× per turn)
  - ✓ Is destination ≤ 6 inches away?
  - ✓ Do all models remain in coherency (within 2 inches)?
  - ✓ Is unit engaged with enemy? (can't move normally if engaged)

Response (if legal): "Moved Intercessors 4.5 inches. Do they remain in coherency? [awaiting confirm]"
Response (if illegal): "Intercessors are engaged with Guardsmen. Can't move in normal movement. Try Fall Back instead."
```

#### Advance Move
```
Voice: "Advance [unit]" or "[unit] advances"
Example: "Boyz advance"
Parser output: MoveUnitCommand { unitId, moveType: 'advance' }
Legality check:
  - ✓ Is unit eligible to advance this turn? (can't advance and charge in same turn, normally)
  - ✓ Distance moved ≤ max distance for datasheet
  - ✓ Is unit engaged? (can't advance if engaged)
  - Effect: Unit marked as hasAdvanced = true; loses ranged attacks this turn

Response: "Boyz advanced. They cannot shoot or use ranged weapons this turn."
```

#### Fall Back
```
Voice: "Fall back [unit]" or "[unit] falls back"
Example: "Guardsmen fall back"
Parser output: MoveUnitCommand { unitId, moveType: 'fallback' }
Legality check:
  - ✓ Is unit engaged? (usually required for fall back)
  - ✓ Distance moved ≤ 6 inches
  - ✓ Unit can't shoot after falling back

Response: "Guardsmen fell back 4 inches. They can't shoot this turn."
```

#### Confirmation Mechanic
```
User says: "Move Intercessors to objective 2"
Helm (showing AR): "Moving Intercessors 5.2 inches to objective 2. Confirm? [await voice confirmation]"
User says: "Confirm" or "Yes"
Result: Event committed, broadcast to all clients

User says: "Undo" or "No"
Result: Command rejected, AR reverts, prompt for new command
```

---

### Psychic Phase

**Intent:** Cast psychic powers (witchcraft/sorcery), manifest abilities

#### Manifest Psychic Power
```
Voice: "Cast [power] on [target]"
Examples:
  - "Cast Smite on Guardsmen"
  - "Manifest Prescience on Intercessors"
  - "Cast Deny the Witch" (defensive, no target)

Parser output: CastPowerCommand { unitId, powerId, targetUnitId }
Legality check:
  - ✓ Is psyker present in shooting unit?
  - ✓ Is power in current datasheet?
  - ✓ Is target within range?
  - ✓ Line of sight (terrain scan validates)
  - ✓ Is this power already cast this turn? (can cast up to 2 typically)

Response (legal): "Smite cast on Guardsmen. Roll to manifest (8+). Ready to roll? [voice prompt for dice]"
Response (illegal): "Smite range is 24 inches. Guardsmen are 28 inches away. Can't cast."
```

#### Casting Check
```
Voice: "Roll to manifest"
Helm: "Roll 2 dice for Smite (target 8+)."
User: "Rolled 6 and 5" (or camera detects dice)
Result: DiceRolledEvent { unitId, rollType: 'psychic', results: [6, 5], total: 11 }
Helm: "Smite manifests! 1 mortal wound on Guardsmen."
```

---

### Shooting Phase

**Intent:** Select targets, roll to hit, roll to wound, apply saves

#### Attack Declaration
```
Voice: "Attack with [unit]" or "[unit] shoots [target]"
Examples:
  - "Attack with Hellblasters"
  - "Hellblasters shoot Guardsmen A"

Parser output: AttackDeclaredCommand { unitId, targetUnitId, weaponId }
Legality checks:
  - ✓ Can this unit shoot? (not in melee engagement, not advanced this turn)
  - ✓ Is target in range and line of sight?
  - ✓ Is target visible to this unit?
  - ✓ Can this unit target this enemy? (e.g., no "Infantry only" on Flyers)

Response (legal): "Hellblasters (2 models, 2 shots each = 4 attacks) fire at Guardsmen A. Ready to roll to hit? (BS 3+, need 3+)"
Response (ambiguous unit): "You have Hellblasters A and Hellblasters B. Which squad attacks?"
Response (illegal): "Hellblasters are in engagement with Guardsmen B. Can't shoot other targets while engaged."
```

#### Eligibility Check (Before Dice)
```
Voice: "Show eligible targets"
Helm displays (AR + voice):
  - Guardsmen A: 16 inches away (in range)
  - Guardsmen B: 24 inches away (in range)
  - Guardsmen C: 28 inches away (out of range for this weapon)
  - Skitarii: Behind ruin (no LoS)

User voice: "Shoot Guardsmen A"
```

#### Dice Rolling (To Hit)
```
Voice: "Roll to hit"
Helm: "Rolling for Hellblasters. 4 attacks, BS 3+ (need 3+). Go ahead and roll."
User rolls 4 physical dice visible to iPhone camera, or says: "Rolled 3, 5, 2, 4"
Helm (camera detection): "I see 4 dice: 3, 5, 2, 4. That's 3 hits. Confirm?"
User voice: "Confirm"
Result: DiceRolledEvent { diceCount: 4, results: [3,5,2,4], total: 3 (hits) }
```

**Voice Alternative (no camera):**
```
User voice: "That's 3 hits" (or "I hit 3 times")
Helm: "Confirmed: 3 hits. Continuing to wound rolls."
```

**Fallback (Helm uncertain):**
```
User rolls 4 dice
Helm (camera uncertain): "I see 4 dice but I'm unsure of the values. Can you tell me the results?"
User voice: "3, 5, 2, 4"
Helm: "Got it: 3, 5, 2, 4. That's 3 hits (3+). Confirm?"
```

#### Dice Rolling (To Wound)
```
Helm: "3 hits on Guardsmen A (2+ wounds). Roll 3 dice."
User: "Rolled 2, 6, 1"
Helm: "2 wounds (2+). Now saves for Guardsmen."
```

#### Saves
```
Helm: "Guardsmen save (4+ armor). Roll 2 dice."
User: "Rolled 3, 2"
Helm: "1 save made. 1 casualty. Guardsmen reduced to X models."
Result: AttackResolvedEvent { wounds: 2, saves: 1, casualties: 1 }
```

#### Attack Workflow Summary
```
1. "Attack with [unit] [into/at] [target]"
2. Legality check (in range? LoS? not engaged? not advanced?)
3. "Roll to hit" → User rolls → Confirm hits
4. "Roll to wound" → User rolls → Confirm wounds
5. "Apply saves" → User rolls → Confirm casualties
6. Unit updated: wounds reduced, possibly marked as "has_attacked"
```

---

### Charge Phase

**Intent:** Declare charges, roll, move into melee

#### Charge Declaration
```
Voice: "Declare charge: [unit] into [target]"
Examples:
  - "Declare charge: Boyz into Guardsmen A"
  - "Charge Terminators into Space Marines"

Parser output: ChargeCommand { unitId, targetUnitId }
Legality checks:
  - ✓ Can this unit charge? (not pinned, not in engagement already, within 12" of target)
  - ✓ Is target within 12 inches?
  - ✓ Can this unit reach target after charge roll?

Response: "Boyz declare charge on Guardsmen A (distance 8 inches, need 8+ on 2d6). Ready to roll?"
```

#### Charge Roll
```
Voice: "Roll charge"
Helm: "Roll 2 dice for charge distance."
User: "Rolled 6 and 4" (or camera detects dice)
Result: DiceRolledEvent { rollType: 'charge', results: [6,4], total: 10 }
Helm: "10 inches rolled. Charge succeeds! Boyz move into engagement with Guardsmen A."
Update: isInEngagement = true, position moved
```

**Charge Failure:**
```
User: "Rolled 3 and 2" (total 5, need 8+)
Helm: "5 inches rolled. Charge fails (needed 8+). Boyz stay in place."
```

---

### Fight Phase

**Intent:** Melee combat, pile-in, consolidation

#### Attack in Melee
```
Voice: "[unit] attacks [target]"
Examples:
  - "Boyz attack Guardsmen"
  - "Terminators fight Intercessors"

Parser output: MeleeAttackCommand { unitId, targetUnitId, weaponId }
Legality checks:
  - ✓ Is unit in engagement? (must be to attack in melee)
  - ✓ Is target in engagement with this unit?
  - ✓ Weapon is melee-capable?

Response: "Boyz (5 models, 2 attacks each = 10 attacks) fight Guardsmen A. Roll to hit (WS 4+)."
(Same dice flow as Shooting: hit → wound → save → casualties)
```

#### Pile-In and Consolidation
```
Voice: "End fight phase" (auto-triggers after all melee resolved)
Helm: "Units in melee can pile-in 3 inches towards enemy. Boyz pile-in towards…? [pause for direction]"
User: "Forward" or "Left"
Helm: "Boyz moved 3 inches forward. Consolidate towards objective? [auto-consolidate best position]"
Result: Unit repositioned, event logged
```

---

## Phase Navigation

### Advance Phase
```
Voice: "Next phase" or "End [current phase]"
Examples:
  - "Next phase" (from Movement → Psychic)
  - "End shooting phase"
  - "Go to fight phase"

Parser output: AdvancePhaseCommand { fromPhase, toPhase }
Helm validates:
  - ✓ Are we in the correct current phase?
  - ✓ Did both players confirm ready?

Response: "Advancing to [phase]. [Summary of phase changes]. Player [X] turn."
```

### Turn Skip
```
Voice: "End turn" or "Pass"
Helm: "Ending Player 1 turn. Player 2's turn begins. [Summary of phase reset]."
Update: currentPlayer switched, units reset flags, round counter if needed
```

### Undo Last Action
```
Voice: "Undo" or "Undo last move" or "Undo last attack"
Helm: "Undoing [action]. Unit [X] returned to [state]."
Behavior:
  - Only undo last 3 actions per turn (if enabled by player preference)
  - Competitive mode: NO undo (all actions final)
  - Casual mode: undo allowed until next player turn
Result: Event removed from event store (replacement event: ActionUndone)
```

---

## General Commands (Any Phase)

### Rules Queries
```
Voice: "What is [rule]?" or "Explain [rule]"
Examples:
  - "What is coherency?"
  - "Explain engagement"
  - "How far can Intercessors move?"

Parser output: QueryRuleCommand { query: "coherency" }
Result: QueryRuleResponse { results: [ { ruleId, description, source } ] }
Helm responds: "Coherency means models in a unit must be within 2 inches of at least one other model in the unit."
```

### Unit Abilities
```
Voice: "What are [unit]'s abilities?" or "[Unit] abilities"
Examples:
  - "Intercessors abilities"
  - "What can Guardsmen do?"

Parser output: QueryUnitCommand { unitId }
Result: Lists all abilities, weapons, traits, auras
Helm responds: "Intercessors have <list of abilities>, <weapon profiles>, <traits>."
```

### Tactical Advice (Coaching Mode)
```
Voice: "Can [unit] [action]?" or "Is [action] legal?"
Examples:
  - "Can Intercessors move 7 inches?"
  - "Can Guardsmen shoot after advancing?"
  - "Is this charge legal?"

Parser output: QueryLegalityCommand { unitId, actionType }
Helm calls rules-engine legality check, responds with yes/no + reason
```

### Status Checks
```
Voice: "What's the score?" or "Current objectives"
Helm: "Player 1: 6 points. Player 2: 3 points. [Breakdown by objective]."

Voice: "How many wounds does [unit] have?"
Helm: "Guardsmen A has 4 wounds remaining out of 10."

Voice: "Is [unit] in engagement?"
Helm: "Yes, Guardsmen A is in engagement with Intercessors B."
```

### Manual Corrections (Referee Mode)
```
Voice: "Override [unit] position to [location]"
Example: "Override Guardsmen position to 26 comma 24"
Parser output: ManualOverrideCommand { unitId, newPosition }
Helm: "Logging override for Guardsmen position. Reason?"
Referee voice: "Photo evidence confirms different position"
Result: OverrideAppliedEvent logged with audit trail
```

---

## Voice Grammar Reference

### Unit Reference Patterns
```
Direct: "Intercessors", "Guardsmen", "Hellblasters"
With label: "Intercessors A", "Intercessors B", "Guardsmen A"
With role: "my Intercessors", "enemy Guardsmen"
With datasheet: "five Intercessors", "two Guardsmen"
```

### Direction Patterns
```
Objective: "to objective 2", "to objective A"
Compass: "forward", "backward", "left", "right", "north", "south"
Landmark: "toward the ruin", "behind the hill", "into the woods"
Coordinate: "to 26 comma 24" (for map coordinate input)
Distance: "move 4 inches", "charge 8 inches"
```

### Confirmation Patterns
```
Affirmative: "yes", "confirm", "okay", "agreed", "do it"
Negative: "no", "cancel", "undo", "reject", "wait"
Correction: "actually…", "hold on", "let me correct"
```

---

## Ambiguity Resolution

### Duplicate Units
```
User voice: "Move Intercessors"
Parser detects 2× Intercessor squads
Helm: "You have Intercessors A and Intercessors B. Which one?"
User voice: "A"
Action proceeds with Intercessors A
```

### Overlapping Targets
```
User voice: "Attack Guardsmen"
Parser detects Guardsmen A, B, C all in range
Helm: "Which Guardsmen unit — A, B, or C?"
User voice: "The one closest to me"
Vision service identifies closest unit (AR confirms)
```

### Command Misparse
```
User voice: "Morv Intercessors…" (unclear, might be "Move")
Helm: "Did you say 'Move Intercessors'?"
User voice: "Yes"
Action proceeds

User voice: "Morvintirceptors…" (very garbled)
Helm: "I didn't catch that. Say again?"
User repeats
```

---

## Error Recovery & Fallbacks

### Fallback 1: Repeat Request
```
Voice → No parse (confidence < 40%)
Helm: "I didn't understand. Can you repeat?"
User repeats
```

### Fallback 2: Suggest Alternatives
```
Voice → Partial parse (confidence 40–70%, matches 2+ intents)
Helm: "Did you mean 'Move Intercessors' or 'Attack with Intercessors'?"
User voice: "Move"
Proceeds with Move command
```

### Fallback 3: Offer Tap UI
```
Voice → Failed 3 times in a row
Helm: "Voice isn't working well. Switch to tap? [Button: Tap Mode]"
User taps button, iPhone switches to visual UI (dropdown menus, buttons)
```

### Fallback 4: Text Input
```
iPhone app offers text input box for complex commands:
"Type command: [input field]"
User types: "Move Intercessors A to 24,24"
Text parser converts to MoveUnitCommand
```

---

## Coaching Mode Enhancements

### Suggestion System
```
User voice: "Move Intercessors 7 inches"
Helm: "That's 1 inch beyond the 6-inch limit. Did you mean 6 inches?"
User voice: "Yes"
Helm: "Or would you like to Fall Back instead (6 inches, can't shoot)?"
```

### Ability Highlighting
```
Voice: "What can Intercessors do?"
Helm: "Intercessors can move 6 inches, shoot in shooting phase, have <list of traits>.
       Your Intercessors are not in engagement, so they can move, shoot, and charge."
```

### Opportunity Notifications
```
Helm: "Boyz are in melee with Guardsmen. You can consolidate and potentially charge another unit next. Interested?"
```

---

## Competitive Mode Differences

**Coaching Mode:** Helpful prompts, suggestions, ability highlights, undo allowed
**Competitive Mode:** Strict parsing, no suggestions, no undo, hard-stop enforcement

```
Competitive voice command: "Move Intercessors A to 24 comma 24"
Required precision, no fuzzy matching

Voice: "Move Intercessors"
Result: Blocked — ambiguous unit (A/B/C present)
Helm: "Specify unit: A, B, or C?"
```

---

## References

- [ARCHITECTURE.md](ARCHITECTURE.md) — Voice Service, intent parsing
- [VOICE_PIPELINE.md](VISION_PIPELINE.md) — Speech recognition, confidence scoring
- [RULES_ENGINE.md](RULES_ENGINE.md) — Legality checks referenced in commands

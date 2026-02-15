export enum Phase {
  Command = 'Command',
  Movement = 'Movement',
  Shooting = 'Shooting',
  Charge = 'Charge',
  Fight = 'Fight',
}

export enum GameSize {
  Incursion = 'Incursion',
  Onslaught = 'Onslaught',
  Apocalypse = 'Apocalypse',
}

export interface Position {
  x: number
  y: number
}

export enum UnitStatus {
  Healthy = 'Healthy',
  Damaged = 'Damaged',
  Battleshocked = 'Battleshocked',
  InEngagement = 'InEngagement',
  HasMoved = 'HasMoved',
  HasAdvanced = 'HasAdvanced',
  HasFallenBack = 'HasFallenBack',
  InOverwatch = 'InOverwatch',
}

export interface Weapon {
  id: string
  name: string
  range: number
  attacks: string
  ballisticSkill: number
  strength: number
  armorPenetration: number
  damage: string
  abilities: string[]
}

export interface Unit {
  id: string
  name: string
  letter: string
  faction: 'imperium' | 'chaos' | 'xenos' | 'neutral'
  position: Position
  models: number
  maxModels: number
  wounds: number
  maxWounds: number
  moved: boolean
  advanced: boolean
  fallenBack: boolean
  inEngagement: boolean
  battleshocked: boolean
  baseSize: 'infantry' | 'bikers' | 'vehicle' | 'monster'
  movement: number
  toughness: number
  save: number
  leadership: number
  objectiveControl: number
  abilities: string[]
  weapons: Weapon[]
  enhancements: string[]
  isWarlord: boolean
  playerId: string
}

export interface Player {
  id: string
  name: string
  faction: 'imperium' | 'chaos' | 'xenos'
  commandPoints: number
  victoryPoints: number
  units: Unit[]
}

export interface TerrainPiece {
  id: string
  name: string
  position: Position
  shape: 'circle' | 'rectangle' | 'polygon'
  width?: number
  height?: number
  radius?: number
  points?: Position[]
}

export interface Objective {
  id: string
  name: string
  position: Position
  radius: number
  controlledBy: string | null
}

export interface MatchState {
  id: string
  round: number
  phase: Phase
  currentPlayerIndex: number
  players: Player[]
  terrain: TerrainPiece[]
  objectives: Objective[]
  missionRules: string[]
  startTime: number
  isPaused: boolean
}

export enum MatchEventType {
  UnitMoved = 'UnitMoved',
  UnitAdvanced = 'UnitAdvanced',
  UnitFallenBack = 'UnitFallenBack',
  UnitDestroyed = 'UnitDestroyed',
  UnitBattleshocked = 'UnitBattleshocked',
  ObjectiveClaimed = 'ObjectiveClaimed',
  DamageRolled = 'DamageRolled',
  SavingThrowRolled = 'SavingThrowRolled',
  VictoryPointsGained = 'VictoryPointsGained',
  IllegalActionBlocked = 'IllegalActionBlocked',
  CommandUsed = 'CommandUsed',
  PhaseAdvanced = 'PhaseAdvanced',
  RoundStarted = 'RoundStarted',
  MatchEnded = 'MatchEnded',
}

export interface MatchEvent {
  id: string
  type: MatchEventType
  timestamp: number
  playerId: string
  unitId?: string
  data: {
    [key: string]: unknown
  }
}

export enum CommandType {
  AdvancePhase = 'AdvancePhase',
  MoveUnit = 'MoveUnit',
  AdvanceUnit = 'AdvanceUnit',
  FallBackUnit = 'FallBackUnit',
  DeclareAttack = 'DeclareAttack',
  DeclareCharge = 'DeclareCharge',
  FightEnemy = 'FightEnemy',
  ApplyOverride = 'ApplyOverride',
  RollDamage = 'RollDamage',
  RollSave = 'RollSave',
  UseStratagem = 'UseStratagem',
}

export interface GameCommand {
  id: string
  type: CommandType
  matchId: string
  playerId: string
  timestamp: number
  data: {
    [key: string]: unknown
  }
}

export type WebSocketMessage =
  | {
      type: 'subscribe'
      matchId: string
    }
  | {
      type: 'state_update'
      state: MatchState
    }
  | {
      type: 'event'
      event: MatchEvent
    }
  | {
      type: 'command_result'
      commandId: string
      success: boolean
      error?: string
    }

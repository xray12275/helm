import { MatchState, Unit, TerrainPiece, Objective, Phase, Position } from '../types'

export interface RenderOptions {
  showGrid: boolean
  scale: number
  offsetX: number
  offsetY: number
}

const BATTLEFIELD_WIDTH = 60
const BATTLEFIELD_HEIGHT = 44

export function renderBattlefield(
  ctx: CanvasRenderingContext2D,
  state: MatchState | null,
  selectedUnitId: string | null,
  options: RenderOptions
): void {
  const { showGrid, scale, offsetX, offsetY } = options

  // Clear canvas
  ctx.fillStyle = '#0F172A'
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  if (!state) return

  // Draw grid
  if (showGrid) {
    renderGrid(ctx, scale, offsetX, offsetY)
  }

  // Draw deployment zones
  renderDeploymentZones(ctx, scale, offsetX, offsetY)

  // Draw terrain
  if (state.terrain && state.terrain.length > 0) {
    renderTerrain(ctx, state.terrain, scale, offsetX, offsetY)
  }

  // Draw objectives
  if (state.objectives && state.objectives.length > 0) {
    renderObjectives(ctx, state.objectives, scale, offsetX, offsetY)
  }

  // Draw all units
  for (const player of state.players) {
    if (player.units && player.units.length > 0) {
      renderUnits(ctx, player.units, selectedUnitId, state.phase, scale, offsetX, offsetY)
    }
  }

  // Draw selected unit's ranges
  if (selectedUnitId && state) {
    const unit = findUnitById(state, selectedUnitId)
    if (unit) {
      renderMovementRange(ctx, unit, scale, offsetX, offsetY)
      renderWeaponRanges(ctx, unit, scale, offsetX, offsetY)
    }
  }
}

function renderGrid(
  ctx: CanvasRenderingContext2D,
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  ctx.strokeStyle = 'rgba(107, 114, 128, 0.2)'
  ctx.lineWidth = 0.5

  // Vertical lines
  for (let x = 0; x <= BATTLEFIELD_WIDTH; x += 6) {
    const screenX = offsetX + x * scale
    ctx.beginPath()
    ctx.moveTo(screenX, offsetY)
    ctx.lineTo(screenX, offsetY + BATTLEFIELD_HEIGHT * scale)
    ctx.stroke()
  }

  // Horizontal lines
  for (let y = 0; y <= BATTLEFIELD_HEIGHT; y += 6) {
    const screenY = offsetY + y * scale
    ctx.beginPath()
    ctx.moveTo(offsetX, screenY)
    ctx.lineTo(offsetX + BATTLEFIELD_WIDTH * scale, screenY)
    ctx.stroke()
  }

  // Draw grid numbers
  ctx.fillStyle = 'rgba(107, 114, 128, 0.4)'
  ctx.font = '10px monospace'
  ctx.textAlign = 'center'

  for (let x = 0; x <= BATTLEFIELD_WIDTH; x += 6) {
    const screenX = offsetX + x * scale
    ctx.fillText(String(x), screenX, offsetY - 5)
  }

  ctx.textAlign = 'left'
  for (let y = 0; y <= BATTLEFIELD_HEIGHT; y += 6) {
    const screenY = offsetY + y * scale
    ctx.fillText(String(y), offsetX - 15, screenY)
  }
}

function renderDeploymentZones(
  ctx: CanvasRenderingContext2D,
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  // Player 1 deployment (top 12")
  ctx.fillStyle = 'rgba(59, 130, 246, 0.05)'
  ctx.fillRect(offsetX, offsetY, BATTLEFIELD_WIDTH * scale, 12 * scale)

  // Player 2 deployment (bottom 12")
  ctx.fillRect(
    offsetX,
    offsetY + (BATTLEFIELD_HEIGHT - 12) * scale,
    BATTLEFIELD_WIDTH * scale,
    12 * scale
  )

  // Draw deployment zone borders
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)'
  ctx.lineWidth = 2
  ctx.setLineDash([5, 5])

  ctx.beginPath()
  ctx.moveTo(offsetX, offsetY + 12 * scale)
  ctx.lineTo(offsetX + BATTLEFIELD_WIDTH * scale, offsetY + 12 * scale)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(offsetX, offsetY + (BATTLEFIELD_HEIGHT - 12) * scale)
  ctx.lineTo(offsetX + BATTLEFIELD_WIDTH * scale, offsetY + (BATTLEFIELD_HEIGHT - 12) * scale)
  ctx.stroke()

  ctx.setLineDash([])
}

export function renderTerrain(
  ctx: CanvasRenderingContext2D,
  terrain: TerrainPiece[],
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  for (const piece of terrain) {
    const screenPos = tableToScreen(piece.position, scale, offsetX, offsetY)

    ctx.fillStyle = 'rgba(120, 113, 108, 0.3)'
    ctx.strokeStyle = 'rgb(120, 113, 108)'
    ctx.lineWidth = 1.5

    if (piece.shape === 'circle' && piece.radius) {
      ctx.beginPath()
      ctx.arc(
        screenPos.x,
        screenPos.y,
        piece.radius * scale,
        0,
        Math.PI * 2
      )
      ctx.fill()
      ctx.stroke()

      // Label
      ctx.fillStyle = 'rgb(120, 113, 108)'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(piece.name, screenPos.x, screenPos.y)
    } else if (piece.shape === 'rectangle' && piece.width && piece.height) {
      const w = piece.width * scale
      const h = piece.height * scale
      ctx.fillRect(screenPos.x - w / 2, screenPos.y - h / 2, w, h)
      ctx.strokeRect(screenPos.x - w / 2, screenPos.y - h / 2, w, h)

      // Label
      ctx.fillStyle = 'rgb(120, 113, 108)'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(piece.name, screenPos.x, screenPos.y)
    } else if (piece.shape === 'polygon' && piece.points && piece.points.length > 0) {
      ctx.beginPath()
      const first = tableToScreen(piece.points[0], scale, offsetX, offsetY)
      ctx.moveTo(first.x, first.y)

      for (let i = 1; i < piece.points.length; i++) {
        const p = tableToScreen(piece.points[i], scale, offsetX, offsetY)
        ctx.lineTo(p.x, p.y)
      }

      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Label at centroid
      let cx = 0,
        cy = 0
      for (const p of piece.points) {
        cx += p.x
        cy += p.y
      }
      cx /= piece.points.length
      cy /= piece.points.length
      const screenLabel = tableToScreen({ x: cx, y: cy }, scale, offsetX, offsetY)

      ctx.fillStyle = 'rgb(120, 113, 108)'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(piece.name, screenLabel.x, screenLabel.y)
    }
  }
}

export function renderObjectives(
  ctx: CanvasRenderingContext2D,
  objectives: Objective[],
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  for (const obj of objectives) {
    const screenPos = tableToScreen(obj.position, scale, offsetX, offsetY)
    const screenRadius = obj.radius * scale

    // Control indicator
    if (obj.controlledBy) {
      ctx.fillStyle = 'rgba(212, 175, 55, 0.3)'
      ctx.beginPath()
      ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2)
      ctx.fill()
    }

    // Objective circle
    ctx.strokeStyle = 'rgb(212, 175, 55)'
    ctx.lineWidth = 2.5
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    // Center dot
    ctx.fillStyle = 'rgb(212, 175, 55)'
    ctx.beginPath()
    ctx.arc(screenPos.x, screenPos.y, 4, 0, Math.PI * 2)
    ctx.fill()

    // Label
    ctx.fillStyle = 'rgb(212, 175, 55)'
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(obj.name, screenPos.x, screenPos.y - screenRadius - 12)
  }
}

export function renderUnits(
  ctx: CanvasRenderingContext2D,
  units: Unit[],
  selectedUnitId: string | null,
  phase: Phase,
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  for (const unit of units) {
    const screenPos = tableToScreen(unit.position, scale, offsetX, offsetY)

    // Base size determines rendering
    let baseRadius = 8
    if (unit.baseSize === 'infantry') baseRadius = 6
    if (unit.baseSize === 'bikers') baseRadius = 8
    if (unit.baseSize === 'vehicle') baseRadius = 12
    if (unit.baseSize === 'monster') baseRadius = 14

    // Faction color
    let factionColor = '#8B5CF6' // xenos-purple
    if (unit.faction === 'imperium') factionColor = '#3B82F6' // blue
    if (unit.faction === 'chaos') factionColor = '#DC2626' // red

    // Draw base circle
    ctx.fillStyle = factionColor
    ctx.beginPath()
    ctx.arc(screenPos.x, screenPos.y, baseRadius * scale, 0, Math.PI * 2)
    ctx.fill()

    // Status border
    let borderColor = factionColor
    let borderWidth = 1.5

    if (unit.battleshocked) {
      borderColor = '#EF4444'
      borderWidth = 3
    } else if (unit.inEngagement) {
      borderColor = '#F97316'
      borderWidth = 2.5
    } else if (unit.moved) {
      borderColor = '#06B6D4'
      borderWidth = 2
    }

    ctx.strokeStyle = borderColor
    ctx.lineWidth = borderWidth
    ctx.beginPath()
    ctx.arc(screenPos.x, screenPos.y, baseRadius * scale, 0, Math.PI * 2)
    ctx.stroke()

    // Selection highlight
    if (unit.id === selectedUnitId) {
      ctx.strokeStyle = '#FCD34D'
      ctx.lineWidth = 3
      ctx.setLineDash([3, 2])
      ctx.beginPath()
      ctx.arc(
        screenPos.x,
        screenPos.y,
        (baseRadius + 4) * scale,
        0,
        Math.PI * 2
      )
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Unit label
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${unit.name} ${unit.letter}`, screenPos.x, screenPos.y)

    // Wounds indicator (small text below)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.font = '9px sans-serif'
    ctx.fillText(
      `${unit.wounds}/${unit.maxWounds}`,
      screenPos.x,
      screenPos.y + baseRadius * scale + 12
    )
  }
}

export function renderMovementRange(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  const screenPos = tableToScreen(unit.position, scale, offsetX, offsetY)
  const rangeInches = unit.movement

  ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.arc(
    screenPos.x,
    screenPos.y,
    rangeInches * scale,
    0,
    Math.PI * 2
  )
  ctx.stroke()
  ctx.setLineDash([])

  // Label
  ctx.fillStyle = 'rgba(59, 130, 246, 0.6)'
  ctx.font = '10px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${rangeInches}"`, screenPos.x, screenPos.y - rangeInches * scale - 5)
}

export function renderWeaponRanges(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  const screenPos = tableToScreen(unit.position, scale, offsetX, offsetY)

  // Get unique ranges from weapons
  const ranges = new Set(unit.weapons.map((w) => w.range))

  let colorIndex = 0
  const colors = [
    'rgba(34, 197, 94, 0.3)',
    'rgba(236, 72, 153, 0.3)',
    'rgba(249, 115, 22, 0.3)',
  ]

  for (const range of ranges) {
    ctx.strokeStyle = colors[colorIndex % colors.length]
    ctx.lineWidth = 1
    ctx.setLineDash([2, 2])
    ctx.beginPath()
    ctx.arc(screenPos.x, screenPos.y, range * scale, 0, Math.PI * 2)
    ctx.stroke()

    colorIndex++
  }

  ctx.setLineDash([])
}

export function tableToScreen(
  pos: Position,
  scale: number,
  offsetX: number,
  offsetY: number
): Position {
  return {
    x: offsetX + pos.x * scale,
    y: offsetY + pos.y * scale,
  }
}

export function screenToTable(
  screenPos: Position,
  scale: number,
  offsetX: number,
  offsetY: number
): Position {
  return {
    x: (screenPos.x - offsetX) / scale,
    y: (screenPos.y - offsetY) / scale,
  }
}

function findUnitById(state: MatchState, unitId: string): Unit | undefined {
  for (const player of state.players) {
    const unit = player.units.find((u) => u.id === unitId)
    if (unit) return unit
  }
  return undefined
}

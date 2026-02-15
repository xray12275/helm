import React, { useRef, useEffect, useState } from 'react'
import { useMatchStore } from '../store/match-store'
import {
  renderBattlefield,
  screenToTable,
  RenderOptions,
} from '../lib/canvas-renderer'

export const BattlefieldMap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { state, selectedUnitId, selectUnit } = useMatchStore()

  const [scale, setScale] = useState(8) // pixels per inch
  const [offsetX, setOffsetX] = useState(20)
  const [offsetY, setOffsetY] = useState(20)
  const [showGrid, setShowGrid] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Render the battlefield
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const options: RenderOptions = {
      showGrid,
      scale,
      offsetX,
      offsetY,
    }

    renderBattlefield(ctx, state, selectedUnitId || null, options)
  }, [state, selectedUnitId, scale, offsetX, offsetY, showGrid])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !state) return

    const rect = canvasRef.current.getBoundingClientRect()
    const screenPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }

    const tablePos = screenToTable(screenPos, scale, offsetX, offsetY)

    // Find unit at this position
    let clickedUnit = null
    for (const player of state.players) {
      for (const unit of player.units) {
        const dx = unit.position.x - tablePos.x
        const dy = unit.position.y - tablePos.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        // Allow 0.5 inches of click tolerance
        if (distance < 0.5) {
          clickedUnit = unit
          break
        }
      }
      if (clickedUnit) break
    }

    if (clickedUnit) {
      selectUnit(selectedUnitId === clickedUnit.id ? null : clickedUnit.id)
    } else {
      selectUnit(null)
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2) {
      // Right click to drag
      setIsDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY })
      e.preventDefault()
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      const dx = e.clientX - dragStart.x
      const dy = e.clientY - dragStart.y

      setOffsetX((prev) => prev + dx)
      setOffsetY((prev) => prev + dy)
      setDragStart({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const newScale = Math.max(2, Math.min(20, scale + (e.deltaY > 0 ? -1 : 1)))
    setScale(newScale)
  }

  const handleResetView = () => {
    setScale(8)
    setOffsetX(20)
    setOffsetY(20)
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900 relative overflow-hidden">
      <canvas
        ref={canvasRef}
        width={1200}
        height={700}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        className="flex-1 cursor-pointer"
      />

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-chaos-black/90 p-3 rounded border border-imperial-gold">
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
            showGrid
              ? 'bg-imperial-gold text-chaos-black'
              : 'bg-gray-700 text-gray-300'
          }`}
        >
          {showGrid ? 'Hide Grid' : 'Show Grid'}
        </button>

        <div className="text-xs text-gray-400 border-t border-gray-700 pt-2">
          <div>Zoom: {Math.round(scale * 100) / 100}x</div>
          <div className="text-xs text-gray-500 mt-1">
            Scroll to zoom | Right-click to pan
          </div>
        </div>

        <button
          onClick={handleResetView}
          className="px-3 py-1 text-xs font-bold bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
        >
          Reset View
        </button>
      </div>

      {/* Info Panel */}
      {selectedUnitId && (
        <div className="absolute top-4 left-4 bg-chaos-black/95 border border-imperial-gold p-3 rounded max-w-xs">
          <div className="text-sm">
            <div className="text-imperial-gold font-bold">Unit Selected</div>
            <div className="text-xs text-gray-400 mt-1">
              Use the right panel for full details. Click on the battlefield to deselect.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

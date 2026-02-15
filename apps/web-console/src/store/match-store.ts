import { create } from 'zustand'
import { MatchState, MatchEvent } from '../types'

export interface MatchStore {
  matchId: string | null
  state: MatchState | null
  events: MatchEvent[]
  connected: boolean
  selectedUnitId: string | null
  showEventLog: boolean
  showPhaseGuide: boolean
  showDiceRoller: boolean
  overrideModal: {
    visible: boolean
    event: MatchEvent | null
  }

  // Actions
  setMatchId(id: string): void
  updateState(state: MatchState): void
  addEvent(event: MatchEvent): void
  setConnected(connected: boolean): void
  selectUnit(unitId: string | null): void
  toggleEventLog(): void
  togglePhaseGuide(): void
  toggleDiceRoller(): void
  showOverride(event: MatchEvent): void
  hideOverride(): void
  reset(): void
}

export const useMatchStore = create<MatchStore>((set) => ({
  matchId: null,
  state: null,
  events: [],
  connected: false,
  selectedUnitId: null,
  showEventLog: true,
  showPhaseGuide: true,
  showDiceRoller: false,
  overrideModal: {
    visible: false,
    event: null,
  },

  setMatchId: (id: string) => set({ matchId: id }),

  updateState: (state: MatchState) => set({ state }),

  addEvent: (event: MatchEvent) =>
    set((prev) => ({
      events: [...prev.events, event],
    })),

  setConnected: (connected: boolean) => set({ connected }),

  selectUnit: (unitId: string | null) => set({ selectedUnitId: unitId }),

  toggleEventLog: () =>
    set((prev) => ({ showEventLog: !prev.showEventLog })),

  togglePhaseGuide: () =>
    set((prev) => ({ showPhaseGuide: !prev.showPhaseGuide })),

  toggleDiceRoller: () =>
    set((prev) => ({ showDiceRoller: !prev.showDiceRoller })),

  showOverride: (event: MatchEvent) =>
    set({
      overrideModal: {
        visible: true,
        event,
      },
    }),

  hideOverride: () =>
    set({
      overrideModal: {
        visible: false,
        event: null,
      },
    }),

  reset: () =>
    set({
      matchId: null,
      state: null,
      events: [],
      connected: false,
      selectedUnitId: null,
    }),
}))

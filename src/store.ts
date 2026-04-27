import { create } from 'zustand';
import { KILLS_TO_WIN, MIN_MATCH_PLAYERS, type ImpactSnapshot, type LobbyRoomSnapshot, type MatchResult, type MatchStateSnapshot, type PlayerSnapshot, type ProjectileSnapshot } from './gameTypes';

export interface Can extends ProjectileSnapshot {}
export interface Impact extends ImpactSnapshot {}

interface GameState {
  status: 'LOBBY' | 'PLAYING' | 'RESULT';
  wager: string;
  cans: Can[];
  impacts: Impact[];
  throwCharge: number;
  playersInfo: Record<string, PlayerSnapshot>;
  lobbyRooms: LobbyRoomSnapshot[];
  matchResult: MatchResult | null;
  matchState: MatchStateSnapshot;
  setWager: (wager: string) => void;
  startGame: () => void;
  registerCan: (projectile: Can) => void;
  removeCan: (id: string) => void;
  addImpact: (impact: Impact) => void;
  removeImpact: (id: string) => void;
  setThrowCharge: (charge: number) => void;
  setPlayersInfo: (info: Record<string, PlayerSnapshot>) => void;
  setLobbyRooms: (rooms: LobbyRoomSnapshot[]) => void;
  setMatchResult: (result: MatchResult) => void;
  setMatchState: (state: MatchStateSnapshot) => void;
  endGame: (result?: MatchResult) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  status: 'LOBBY',
  wager: 'FREE',
  cans: [],
  impacts: [],
  throwCharge: 0,
  playersInfo: {},
  lobbyRooms: [],
  matchResult: null,
  matchState: {
    phase: 'warmup',
    playerCount: 0,
    minPlayers: MIN_MATCH_PLAYERS,
    killsToWin: KILLS_TO_WIN,
    countdownEndsAt: null,
    message: `Warmup: waiting for ${MIN_MATCH_PLAYERS} players.`,
  },
  setWager: (wager) => set({ wager }),
  
  startGame: () => set({
    status: 'PLAYING',
    cans: [],
    impacts: [],
    throwCharge: 0,
    playersInfo: {},
    matchResult: null,
  }),
  registerCan: (projectile) => set((state) => ({
    cans: [...state.cans.filter((can) => can.id !== projectile.id), projectile],
  })),
  removeCan: (id) => set((state) => ({
    cans: state.cans.filter((can) => can.id !== id),
  })),
  addImpact: (impact) => set((state) => ({
    impacts: [...state.impacts.filter((entry) => entry.id !== impact.id), impact],
  })),
  removeImpact: (id) => set((state) => ({
    impacts: state.impacts.filter(i => i.id !== id)
  })),
  setThrowCharge: (charge) => set({ throwCharge: Math.max(0, Math.min(1, charge)) }),
  setPlayersInfo: (info) => set({ playersInfo: info }),
  setLobbyRooms: (rooms) => set({ lobbyRooms: rooms }),
  setMatchResult: (result) => set({ matchResult: result, status: 'RESULT' }),
  setMatchState: (matchState) => set({ matchState }),
  endGame: (result) => set({
    status: 'RESULT',
    matchResult: result ?? null,
    cans: [],
    throwCharge: 0,
  }),
  reset: () => set({
    status: 'LOBBY',
    cans: [],
    impacts: [],
    throwCharge: 0,
    playersInfo: {},
    matchResult: null,
    matchState: {
      phase: 'warmup',
      playerCount: 0,
      minPlayers: MIN_MATCH_PLAYERS,
      killsToWin: KILLS_TO_WIN,
      countdownEndsAt: null,
      message: `Warmup: waiting for ${MIN_MATCH_PLAYERS} players.`,
    },
  }),
}));

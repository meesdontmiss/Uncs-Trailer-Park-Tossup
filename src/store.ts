import { create } from 'zustand';

export interface Can {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  isLocal?: boolean;
}

export interface Impact {
  id: string;
  position: [number, number, number];
  timestamp: number;
}

interface GameState {
  status: 'LOBBY' | 'PLAYING' | 'RESULT';
  health: number;
  score: number;
  cansThrown: number;
  wager: string;
  cans: Can[];
  impacts: Impact[];
  playersInfo: Record<string, any>;
  startGame: () => void;
  takeDamage: (amount: number) => void;
  addScore: () => void;
  throwCan: (position: [number, number, number], velocity: [number, number, number], isLocal?: boolean) => void;
  addImpact: (position: [number, number, number]) => void;
  removeImpact: (id: string) => void;
  setPlayersInfo: (info: Record<string, any>) => void;
  endGame: () => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  status: 'LOBBY',
  health: 100,
  score: 0,
  cansThrown: 0,
  wager: '0.1 SOL',
  cans: [],
  impacts: [],
  playersInfo: {},
  
  startGame: () => set({ status: 'PLAYING', health: 100, score: 0, cansThrown: 0, cans: [], impacts: [] }),
  takeDamage: (amount) => set((state) => {
    const newHealth = Math.max(0, state.health - amount);
    if (newHealth === 0) return { health: 0, status: 'RESULT' };
    return { health: newHealth };
  }),
  throwCan: (position, velocity, isLocal = true) => set((state) => ({ 
    cansThrown: isLocal ? state.cansThrown + 1 : state.cansThrown,
    cans: [...state.cans, { id: Math.random().toString(), position, velocity, isLocal }] 
  })),
  addImpact: (position) => set((state) => ({
    impacts: [...state.impacts, { id: Math.random().toString(), position, timestamp: Date.now() }]
  })),
  removeImpact: (id) => set((state) => ({
    impacts: state.impacts.filter(i => i.id !== id)
  })),
  setPlayersInfo: (info) => set({ playersInfo: info }),
  addScore: () => set((state) => ({ score: state.score + 1 })),
  endGame: () => set({ status: 'RESULT' }),
  reset: () => set({ status: 'LOBBY' })
}));

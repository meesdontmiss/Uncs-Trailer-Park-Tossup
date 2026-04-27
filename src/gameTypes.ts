export const MAX_HEALTH = 100;
export const CAN_DAMAGE = 34;
export const MIN_CAN_DAMAGE = 26;
export const MAX_CAN_DAMAGE = 44;
export const KILLS_TO_WIN = 5;
export const MIN_MATCH_PLAYERS = 2;
export const MATCH_START_COUNTDOWN_MS = 5000;
export const RESPAWN_DELAY_MS = 2500;
export const HOUSE_FEE_RATE = 0.02;
export const GRAVITY_Y = -20;
export const PROJECTILE_TTL_MS = 1800;
export const SHOOT_COOLDOWN_MS = 250;
export const PLAYER_HIT_RADIUS = 1.45;
export const IMPACT_TOLERANCE = 6;
export const MIN_THROW_POWER = 26;
export const MAX_THROW_POWER = 58;
export const FULL_CHARGE_MS = 950;
export const PLAYER_MOVE_SPEED = 15;
export const PLAYER_JUMP_FORCE = 8;

export type Vec3 = [number, number, number];

export interface PlayerSnapshot {
  id: string;
  position: Vec3;
  yaw: number;
  pitch: number;
  kills: number;
  deaths: number;
  health: number;
  alive: boolean;
  respawnAt: number | null;
  invulnerableUntil: number | null;
}

export interface LobbyPlayerSnapshot {
  id: string;
  joinedAt: number;
  walletAddress: string | null;
  username: string;
  pfp: string;
  entryPaid: boolean;
  ready: boolean;
}

export interface LobbyRoomSnapshot {
  wager: string;
  players: LobbyPlayerSnapshot[];
  readyCount: number;
  countdownEndsAt: number | null;
}

export interface ProjectileSnapshot {
  id: string;
  ownerId: string;
  spawnPos: Vec3;
  velocity: Vec3;
  chargePower: number;
  spawnedAt: number;
}

export type MatchEndReason = 'lastStanding' | 'forfeit' | 'disconnect' | 'escape';
export type MatchPhase = 'warmup' | 'live' | 'finished';

export interface MatchStateSnapshot {
  phase: MatchPhase;
  playerCount: number;
  minPlayers: number;
  killsToWin: number;
  countdownEndsAt: number | null;
  message: string;
}

export interface MatchResult {
  winnerId: string | null;
  secondPlaceBonusId: string | null;
  wager: string;
  playerCount: number;
  buyInUnc: number;
  grossPotUnc: number;
  houseFeeUnc: number;
  payoutPoolUnc: number;
  reason: MatchEndReason;
  endedAt: number;
}

export interface ImpactSnapshot {
  id: string;
  position: Vec3;
  timestamp: number;
  ownerId: string;
  targetId: string | null;
}

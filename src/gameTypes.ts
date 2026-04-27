export const MAX_HEALTH = 100;
export const CAN_DAMAGE = 34;
export const MIN_CAN_DAMAGE = 26;
export const MAX_CAN_DAMAGE = 44;
export const KILLS_TO_WIN = 5;
export const HOUSE_FEE_RATE = 0.02;
export const GRAVITY_Y = -20;
export const PROJECTILE_TTL_MS = 1800;
export const SHOOT_COOLDOWN_MS = 250;
export const PLAYER_HIT_RADIUS = 2.4;
export const IMPACT_TOLERANCE = 6;

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
}

export interface LobbyPlayerSnapshot {
  id: string;
  joinedAt: number;
  walletAddress: string | null;
  username: string;
  pfp: string;
  entryPaid: boolean;
}

export interface LobbyRoomSnapshot {
  wager: string;
  players: LobbyPlayerSnapshot[];
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

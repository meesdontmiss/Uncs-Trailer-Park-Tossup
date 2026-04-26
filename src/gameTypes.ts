export const MAX_HEALTH = 100;
export const CAN_DAMAGE = 34;
export const KILLS_TO_WIN = 5;
export const GRAVITY_Y = -20;
export const PROJECTILE_TTL_MS = 1800;
export const SHOOT_COOLDOWN_MS = 250;
export const RESPAWN_DELAY_MS = 2500;
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

export interface ProjectileSnapshot {
  id: string;
  ownerId: string;
  spawnPos: Vec3;
  velocity: Vec3;
  spawnedAt: number;
}

export type MatchEndReason = 'kills' | 'forfeit' | 'disconnect' | 'escape';

export interface MatchResult {
  winnerId: string | null;
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

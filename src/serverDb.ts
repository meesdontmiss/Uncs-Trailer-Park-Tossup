import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import pg from 'pg';
import type { MatchResult, PlayerSnapshot, ProjectileSnapshot, Vec3 } from './gameTypes';

const { Pool } = pg;

dotenv.config({ path: '.env.local' });
dotenv.config();

export interface PersistedProfile {
  id: string | null;
  walletAddress: string | null;
  username: string;
  pfp: string;
}

interface MatchPlayerInput {
  socketId: string;
  profile: PersistedProfile;
  player: PlayerSnapshot;
}

interface FinishMatchInput {
  result: MatchResult;
  players: PlayerSnapshot[];
  getProfile: (socketId: string) => PersistedProfile | undefined;
}

const databaseUrl = process.env.DATABASE_URL;
const autoMigrate = process.env.DB_AUTO_MIGRATE !== 'false';

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('sslmode=disable') ? undefined : { rejectUnauthorized: false },
      max: Number(process.env.DB_POOL_SIZE ?? 5),
    })
  : null;

let initPromise: Promise<void> | null = null;

function toDate(ms: number) {
  return new Date(ms);
}

function logDbError(operation: string, error: unknown) {
  console.error(`[db] ${operation} failed`, error);
}

export function isDatabaseEnabled() {
  return Boolean(pool);
}

export async function initDatabase() {
  if (!pool) {
    console.log('[db] DATABASE_URL not set; persistence disabled.');
    return;
  }

  if (!autoMigrate) {
    console.log('[db] DB_AUTO_MIGRATE=false; skipping schema bootstrap.');
    return;
  }

  initPromise ??= (async () => {
    const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schemaSql);
    console.log('[db] Neon schema ready.');
  })();

  await initPromise;
}

async function withDb<T>(operation: string, callback: () => Promise<T>): Promise<T | null> {
  if (!pool) {
    return null;
  }

  try {
    await initDatabase();
    return await callback();
  } catch (error) {
    logDbError(operation, error);
    return null;
  }
}

export async function saveProfile(socketId: string, profile: Omit<PersistedProfile, 'id'>) {
  const persisted = await withDb('saveProfile', async () => {
    if (profile.walletAddress) {
      const { rows } = await pool!.query<{ id: string }>(
        `insert into player_profiles (wallet_address, username, pfp, last_socket_id, updated_at)
         values ($1, $2, $3, $4, now())
         on conflict (wallet_address) do update
         set username = excluded.username,
             pfp = excluded.pfp,
             last_socket_id = excluded.last_socket_id,
             updated_at = now()
         returning id`,
        [profile.walletAddress, profile.username, profile.pfp, socketId],
      );
      return rows[0]?.id ?? null;
    }

    const { rows } = await pool!.query<{ id: string }>(
      `insert into player_profiles (username, pfp, last_socket_id)
       values ($1, $2, $3)
       returning id`,
      [profile.username, profile.pfp, socketId],
    );
    return rows[0]?.id ?? null;
  });

  return {
    ...profile,
    id: persisted,
  };
}

export async function createMatch(wager: string, buyInUnc: number) {
  return withDb('createMatch', async () => {
    const { rows } = await pool!.query<{ id: string }>(
      `insert into matches (wager, buy_in_unc)
       values ($1, $2)
       returning id`,
      [wager, buyInUnc],
    );
    return rows[0]?.id ?? null;
  });
}

export async function upsertMatchPlayer(matchId: string | null, input: MatchPlayerInput) {
  if (!matchId) {
    return;
  }

  await withDb('upsertMatchPlayer', async () => {
    await pool!.query(
      `insert into match_players (
         match_id, socket_id, profile_id, wallet_address, username, pfp, kills, deaths, health, alive
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (match_id, socket_id) do update
       set profile_id = excluded.profile_id,
           wallet_address = excluded.wallet_address,
           username = excluded.username,
           pfp = excluded.pfp,
           kills = excluded.kills,
           deaths = excluded.deaths,
           health = excluded.health,
           alive = excluded.alive`,
      [
        matchId,
        input.socketId,
        input.profile.id,
        input.profile.walletAddress,
        input.profile.username,
        input.profile.pfp,
        input.player.kills,
        input.player.deaths,
        input.player.health,
        input.player.alive,
      ],
    );
  });
}

export async function markPlayerLeft(matchId: string | null, socketId: string) {
  if (!matchId) {
    return;
  }

  await withDb('markPlayerLeft', async () => {
    await pool!.query(
      `update match_players
       set left_at = now()
       where match_id = $1 and socket_id = $2 and left_at is null`,
      [matchId, socketId],
    );
  });
}

export async function recordEvent(
  matchId: string | null,
  eventType: string,
  payload: unknown = {},
  actor?: PersistedProfile & { socketId?: string },
  target?: PersistedProfile & { socketId?: string },
  projectileId?: string,
) {
  if (!matchId) {
    return;
  }

  await withDb('recordEvent', async () => {
    await pool!.query(
      `insert into match_events (
         match_id, event_type, actor_socket_id, actor_profile_id,
         target_socket_id, target_profile_id, projectile_id, payload
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        matchId,
        eventType,
        actor?.socketId ?? null,
        actor?.id ?? null,
        target?.socketId ?? null,
        target?.id ?? null,
        projectileId ?? null,
        JSON.stringify(payload),
      ],
    );
  });
}

export async function recordProjectile(
  matchId: string | null,
  projectile: ProjectileSnapshot,
  ownerProfile: PersistedProfile | undefined,
) {
  if (!matchId) {
    return;
  }

  await withDb('recordProjectile', async () => {
    await pool!.query(
      `insert into match_projectiles (
         id, match_id, owner_socket_id, owner_profile_id, spawn_pos, velocity, charge_power, spawned_at
       )
       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
       on conflict (id) do nothing`,
      [
        projectile.id,
        matchId,
        projectile.ownerId,
        ownerProfile?.id ?? null,
        JSON.stringify(projectile.spawnPos),
        JSON.stringify(projectile.velocity),
        projectile.chargePower,
        toDate(projectile.spawnedAt),
      ],
    );
  });
}

export async function resolveProjectileRecord(
  matchId: string | null,
  projectileId: string,
  impactPosition?: Vec3,
  target?: PersistedProfile & { socketId?: string },
) {
  if (!matchId) {
    return;
  }

  await withDb('resolveProjectileRecord', async () => {
    await pool!.query(
      `update match_projectiles
       set resolved_at = now(),
           impact_pos = coalesce($3::jsonb, impact_pos),
           target_socket_id = coalesce($4, target_socket_id),
           target_profile_id = coalesce($5, target_profile_id)
       where match_id = $1 and id = $2`,
      [
        matchId,
        projectileId,
        impactPosition ? JSON.stringify(impactPosition) : null,
        target?.socketId ?? null,
        target?.id ?? null,
      ],
    );
  });
}

export async function updatePlayerStats(matchId: string | null, player: PlayerSnapshot) {
  if (!matchId) {
    return;
  }

  await withDb('updatePlayerStats', async () => {
    await pool!.query(
      `update match_players
       set kills = $3,
           deaths = $4,
           health = $5,
           alive = $6
       where match_id = $1 and socket_id = $2`,
      [matchId, player.id, player.kills, player.deaths, player.health, player.alive],
    );
  });
}

export async function finishMatchRecord(matchId: string | null, input: FinishMatchInput) {
  if (!matchId) {
    return;
  }

  await withDb('finishMatchRecord', async () => {
    const winnerProfile = input.result.winnerId ? input.getProfile(input.result.winnerId) : undefined;
    const secondProfile = input.result.secondPlaceBonusId ? input.getProfile(input.result.secondPlaceBonusId) : undefined;
    const sortedPlayers = [...input.players].sort((left, right) => {
      if (left.id === input.result.winnerId) return -1;
      if (right.id === input.result.winnerId) return 1;
      return (right.kills - left.kills) || (left.deaths - right.deaths) || left.id.localeCompare(right.id);
    });

    await pool!.query(
      `update matches
       set status = 'finished',
           player_count = $2,
           gross_pot_unc = $3,
           house_fee_unc = $4,
           payout_pool_unc = $5,
           winner_socket_id = $6,
           winner_profile_id = $7,
           second_place_bonus_socket_id = $8,
           second_place_bonus_profile_id = $9,
           end_reason = $10,
           ended_at = $11,
           updated_at = now()
       where id = $1`,
      [
        matchId,
        input.result.playerCount,
        input.result.grossPotUnc,
        input.result.houseFeeUnc,
        input.result.payoutPoolUnc,
        input.result.winnerId,
        winnerProfile?.id ?? null,
        input.result.secondPlaceBonusId,
        secondProfile?.id ?? null,
        input.result.reason,
        toDate(input.result.endedAt),
      ],
    );

    for (let index = 0; index < sortedPlayers.length; index += 1) {
      const player = sortedPlayers[index];
      const profile = input.getProfile(player.id);
      await pool!.query(
        `update match_players
         set kills = $3,
             deaths = $4,
             health = $5,
             alive = $6,
             final_rank = $7
         where match_id = $1 and socket_id = $2`,
        [matchId, player.id, player.kills, player.deaths, player.health, player.alive, index + 1],
      );

      if (profile?.id) {
        await pool!.query(
          `update player_profiles
           set matches_played = matches_played + 1,
               wins = wins + $2,
               kills = kills + $3,
               deaths = deaths + $4,
               updated_at = now()
           where id = $1`,
          [profile.id, player.id === input.result.winnerId ? 1 : 0, player.kills, player.deaths],
        );
      }
    }
  });
}

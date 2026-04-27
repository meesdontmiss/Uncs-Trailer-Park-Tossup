import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import pg from 'pg';
import type { MatchResult, PlayerSnapshot, ProjectileSnapshot, Vec3 } from './gameTypes';
import type { EntryPaymentReceipt } from './paymentTypes';

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

interface PayoutSettlementInput {
  ok: boolean;
  message: string;
  signatures: string[];
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

export async function abandonMatchRecord(matchId: string | null, reason = 'abandoned') {
  if (!matchId) {
    return;
  }

  await withDb('abandonMatchRecord', async () => {
    await pool!.query(
      `update matches
       set status = $2,
           end_reason = $2,
           ended_at = coalesce(ended_at, now()),
           updated_at = now()
       where id = $1 and status = 'active'`,
      [matchId, reason],
    );

    await pool!.query(
      `update match_players
       set left_at = coalesce(left_at, now()),
           result = coalesce(result, $2)
       where match_id = $1 and left_at is null`,
      [matchId, reason],
    );
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

export async function recordEntryPayment(
  matchId: string | null,
  socketId: string,
  profile: PersistedProfile,
  receipt: EntryPaymentReceipt,
) {
  await withDb('recordEntryPayment', async () => {
    await pool!.query(
      `insert into entry_payments (
         match_id, socket_id, profile_id, wallet_address, wager, amount_unc, signature, status, verified_at
       )
       values ($1, $2, $3, $4, $5, $6, $7, 'verified', $8)
       on conflict (signature) do update
       set match_id = coalesce(entry_payments.match_id, excluded.match_id),
           socket_id = excluded.socket_id,
           profile_id = excluded.profile_id,
           wallet_address = excluded.wallet_address,
           wager = excluded.wager,
           amount_unc = excluded.amount_unc,
           status = 'verified',
           verified_at = excluded.verified_at`,
      [
        matchId,
        socketId,
        profile.id,
        receipt.walletAddress,
        receipt.wager,
        receipt.amountUnc,
        receipt.signature,
        toDate(receipt.verifiedAt),
      ],
    );

    if (matchId) {
      await pool!.query(
        `update match_players
         set unc_paid = greatest(unc_paid, $3)
         where match_id = $1 and socket_id = $2`,
        [matchId, socketId, receipt.amountUnc],
      );
    }
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
    const profileBySocket = new Map<string, PersistedProfile | undefined>(
      input.players.map((player) => [player.id, input.getProfile(player.id)]),
    );
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
      const profile = profileBySocket.get(player.id);
      const result = player.id === input.result.winnerId ? 'win' : 'loss';
      const uncWon = player.id === input.result.winnerId ? input.result.payoutPoolUnc : 0;
      const houseFeeShare = input.result.playerCount > 0
        ? Number((input.result.houseFeeUnc / input.result.playerCount).toFixed(2))
        : 0;
      await pool!.query(
        `insert into match_players (
           match_id, socket_id, profile_id, wallet_address, username, pfp,
           kills, deaths, health, alive, final_rank, result, unc_paid, unc_won, house_fee_unc
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         on conflict (match_id, socket_id) do update
         set profile_id = excluded.profile_id,
             wallet_address = excluded.wallet_address,
             username = excluded.username,
             pfp = excluded.pfp,
             kills = excluded.kills,
             deaths = excluded.deaths,
             health = excluded.health,
             alive = excluded.alive,
             final_rank = excluded.final_rank,
             result = excluded.result,
             unc_paid = greatest(match_players.unc_paid, excluded.unc_paid),
             unc_won = excluded.unc_won,
             house_fee_unc = excluded.house_fee_unc`,
        [
          matchId,
          player.id,
          profile?.id ?? null,
          profile?.walletAddress ?? null,
          profile?.username ?? `Player_${player.id.slice(0, 4)}`,
          profile?.pfp ?? '🥫',
          player.kills,
          player.deaths,
          player.health,
          player.alive,
          index + 1,
          result,
          input.result.buyInUnc,
          uncWon,
          houseFeeShare,
        ],
      );

      if (profile?.id) {
        await pool!.query(
          `update player_profiles
           set matches_played = matches_played + 1,
               wins = wins + $2,
               losses = losses + $3,
               kills = kills + $4,
               deaths = deaths + $5,
               unc_won = unc_won + $6,
               unc_spent = unc_spent + $7,
               unc_house_fees_paid = unc_house_fees_paid + $8,
               updated_at = now()
           where id = $1`,
          [
            profile.id,
            player.id === input.result.winnerId ? 1 : 0,
            player.id === input.result.winnerId ? 0 : 1,
            player.kills,
            player.deaths,
            uncWon,
            input.result.buyInUnc,
            houseFeeShare,
          ],
        );
      }
    }

    await pool!.query(
      `update match_players
       set left_at = coalesce(left_at, now()),
           final_rank = coalesce(final_rank, ranked.rank),
           result = coalesce(result, 'loss'),
           unc_paid = greatest(unc_paid, $2)
       from (
         select id, row_number() over (order by joined_at) + $3 as rank
         from match_players
         where match_id = $1 and final_rank is null
       ) ranked
       where match_players.id = ranked.id`,
      [matchId, input.result.buyInUnc, sortedPlayers.length],
    );

    await pool!.query(
      `with affected_profiles as (
         select distinct profile_id
         from match_players
         where match_id = $1 and profile_id is not null
       ),
       rollup as (
         select
           mp.profile_id,
           count(*) filter (where mp.result in ('win', 'loss'))::int as matches_played,
           count(*) filter (where mp.result = 'win')::int as wins,
           count(*) filter (where mp.result = 'loss')::int as losses,
           coalesce(sum(mp.kills), 0)::int as kills,
           coalesce(sum(mp.deaths), 0)::int as deaths,
           coalesce(sum(mp.unc_won), 0)::numeric(18, 2) as unc_won,
           coalesce(sum(mp.unc_paid), 0)::numeric(18, 2) as unc_spent,
           coalesce(sum(mp.house_fee_unc), 0)::numeric(18, 2) as unc_house_fees_paid
         from match_players mp
         join affected_profiles ap on ap.profile_id = mp.profile_id
         group by mp.profile_id
       )
       update player_profiles
       set matches_played = rollup.matches_played,
           wins = rollup.wins,
           losses = rollup.losses,
           kills = rollup.kills,
           deaths = rollup.deaths,
           unc_won = rollup.unc_won,
           unc_spent = rollup.unc_spent,
           unc_house_fees_paid = rollup.unc_house_fees_paid,
           updated_at = now()
       from rollup
       where player_profiles.id = rollup.profile_id`,
      [matchId],
    );
  });
}

export async function recordPayoutSettlement(
  matchId: string | null,
  result: MatchResult,
  winnerProfile: PersistedProfile | undefined,
  settlement: PayoutSettlementInput,
) {
  if (!matchId) {
    return settlement;
  }

  await withDb('recordPayoutSettlement', async () => {
    const signature = settlement.signatures[0] ?? null;
    const status = settlement.ok
      ? (settlement.signatures.length > 0 ? 'settled' : 'not_required')
      : 'skipped';

    await pool!.query(
      `insert into payouts (
         match_id, winner_profile_id, winner_wallet_address, gross_pot_unc,
         house_fee_unc, payout_pool_unc, status, message, signatures
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [
        matchId,
        winnerProfile?.id ?? null,
        winnerProfile?.walletAddress ?? null,
        result.grossPotUnc,
        result.houseFeeUnc,
        result.payoutPoolUnc,
        status,
        settlement.message,
        JSON.stringify(settlement.signatures),
      ],
    );

    await pool!.query(
      `update matches
       set payout_status = $2,
           payout_signature = $3,
           payout_error = $4,
           updated_at = now()
       where id = $1`,
      [matchId, status, signature, settlement.ok ? null : settlement.message],
    );
  });

  return settlement;
}

export async function repairHistoricalRollups() {
  await withDb('repairHistoricalRollups', async () => {
    await pool!.query(
      `update matches
       set status = 'abandoned',
           end_reason = coalesce(end_reason, 'abandoned'),
           ended_at = coalesce(ended_at, updated_at, created_at),
           updated_at = now()
       where status = 'active'
         and not exists (
           select 1 from match_players
           where match_players.match_id = matches.id
             and match_players.left_at is null
         )`,
    );

    await pool!.query(
      `update match_players
       set result = case
           when final_rank = 1 then 'win'
           when final_rank is not null then 'loss'
           when left_at is not null then 'abandoned'
           else result
         end`,
    );

    await pool!.query(
      `with rollup as (
         select
           profile_id,
           count(*) filter (where result in ('win', 'loss'))::int as matches_played,
           count(*) filter (where result = 'win')::int as wins,
           count(*) filter (where result = 'loss')::int as losses,
           coalesce(sum(kills), 0)::int as kills,
           coalesce(sum(deaths), 0)::int as deaths,
           coalesce(sum(unc_won), 0)::numeric(18, 2) as unc_won,
           coalesce(sum(unc_paid), 0)::numeric(18, 2) as unc_spent,
           coalesce(sum(house_fee_unc), 0)::numeric(18, 2) as unc_house_fees_paid
         from match_players
         where profile_id is not null
         group by profile_id
       )
       update player_profiles
       set matches_played = coalesce(rollup.matches_played, 0),
           wins = coalesce(rollup.wins, 0),
           losses = coalesce(rollup.losses, 0),
           kills = coalesce(rollup.kills, 0),
           deaths = coalesce(rollup.deaths, 0),
           unc_won = coalesce(rollup.unc_won, 0),
           unc_spent = coalesce(rollup.unc_spent, 0),
           unc_house_fees_paid = coalesce(rollup.unc_house_fees_paid, 0),
           updated_at = now()
       from rollup
       where player_profiles.id = rollup.profile_id`,
    );
  });
}

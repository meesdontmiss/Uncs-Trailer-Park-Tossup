import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { randomUUID } from 'crypto';
import { Server } from 'socket.io';
import { arenaColliders, arenaSpawnPoints } from './src/arena';
import {
  GRAVITY_Y,
  HOUSE_FEE_RATE,
  MAX_CAN_DAMAGE,
  MAX_HEALTH,
  MIN_CAN_DAMAGE,
  PLAYER_HIT_RADIUS,
  PROJECTILE_TTL_MS,
  SHOOT_COOLDOWN_MS,
  type LobbyRoomSnapshot,
  type MatchResult,
  type PlayerSnapshot,
  type ProjectileSnapshot,
  type Vec3,
} from './src/gameTypes';
import {
  abandonMatchRecord,
  createMatch,
  finishMatchRecord,
  initDatabase,
  isDatabaseEnabled,
  markPlayerLeft,
  recordEntryPayment,
  recordEvent,
  recordPayoutSettlement,
  recordProjectile,
  resolveProjectileRecord,
  saveProfile,
  updatePlayerStats,
  upsertMatchPlayer,
  type PersistedProfile,
} from './src/serverDb';
import {
  getHotWalletTokenAccount,
  getPaymentConfig,
  settleMatchPayout,
  verifyEntryPayment,
} from './src/serverPayments';
import type { EntryPaymentReceipt } from './src/paymentTypes';

interface LobbyProfile extends PersistedProfile {}

interface ServerPlayer extends PlayerSnapshot {
  lastShotAt: number;
}

interface ServerProjectile extends ProjectileSnapshot {
  resolved: boolean;
  lastSimulatedAt: number;
}

const isProductionRuntime = process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start';
const PORT = Number(process.env.PORT ?? (isProductionRuntime ? 3000 : 3001));
const PROJECTILE_SIM_STEP_MS = 25;
const players: Record<string, ServerPlayer> = {};
const projectiles = new Map<string, ServerProjectile>();
const lobbySelections = new Map<string, { wager: string; joinedAt: number }>();
const lobbyProfiles = new Map<string, LobbyProfile>();
const entryPayments = new Map<string, EntryPaymentReceipt>();
let matchResult: MatchResult | null = null;
let activeMatchId: string | null = null;
let activeMatchCreatePromise: Promise<string | null> | null = null;

function defaultProfileForSocket(socketId: string): LobbyProfile {
  return {
    id: null,
    walletAddress: null,
    username: `Player_${socketId.slice(0, 4)}`,
    pfp: '🥫',
  };
}

function getProfile(socketId: string) {
  return lobbyProfiles.get(socketId) ?? defaultProfileForSocket(socketId);
}

function eventActor(socketId: string) {
  return {
    ...getProfile(socketId),
    socketId,
  };
}

function persist(task: Promise<unknown>) {
  task.catch((error) => {
    console.error('[db] async persistence failed', error);
  });
}

async function ensureActiveMatch(wager: string, buyInUnc: number) {
  if (activeMatchId || matchResult) {
    return activeMatchId;
  }

  activeMatchCreatePromise ??= createMatch(wager, buyInUnc)
    .then((matchId) => {
      activeMatchId = matchId;
      persist(recordEvent(activeMatchId, 'matchStarted', { wager, databaseEnabled: isDatabaseEnabled() }));
      return matchId;
    })
    .finally(() => {
      activeMatchCreatePromise = null;
    });

  return activeMatchCreatePromise;
}

function parseBuyInUnc(wager: string) {
  if (wager === 'FREE') {
    return 0;
  }

  const numeric = Number(wager.replace(/[$,UNC\s]/gi, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function buildMatchResult(winnerId: string | null, reason: MatchResult['reason']): MatchResult {
  const playerList = Object.values(players);
  const wager = winnerId ? (lobbySelections.get(winnerId)?.wager ?? 'FREE') : 'FREE';
  const buyInUnc = parseBuyInUnc(wager);
  const playerCount = playerList.length;
  const grossPotUnc = buyInUnc * playerCount;
  const houseFeeUnc = Number((grossPotUnc * HOUSE_FEE_RATE).toFixed(2));

  return {
    winnerId,
    secondPlaceBonusId: chooseSecondPlaceBonusId(winnerId),
    wager,
    playerCount,
    buyInUnc,
    grossPotUnc,
    houseFeeUnc,
    payoutPoolUnc: Number((grossPotUnc - houseFeeUnc).toFixed(2)),
    reason,
    endedAt: Date.now(),
  };
}

function distanceSquared(a: Vec3, b: Vec3) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return (dx * dx) + (dy * dy) + (dz * dz);
}

function chooseSpawnPoint(excludePlayerId?: string): Vec3 {
  const alivePlayers = Object.values(players).filter((player) => player.alive && player.id !== excludePlayerId);
  const ranked = arenaSpawnPoints
    .map((spawnPoint) => ({
      spawnPoint,
      score: alivePlayers.length === 0
        ? Number.POSITIVE_INFINITY
        : Math.min(...alivePlayers.map((player) => distanceSquared(spawnPoint, player.position))),
    }))
    .sort((left, right) => right.score - left.score);

  const topChoices = ranked.slice(0, Math.min(3, ranked.length));
  const selected = topChoices[Math.floor(Math.random() * topChoices.length)] ?? ranked[0];
  return selected?.spawnPoint ?? [0, 4, 0];
}

function snapshotPlayers(): Record<string, PlayerSnapshot> {
  return Object.fromEntries(
    Object.entries(players).map(([id, player]) => [
      id,
      {
        id,
        position: player.position,
        yaw: player.yaw,
        pitch: player.pitch,
        kills: player.kills,
        deaths: player.deaths,
        health: player.health,
        alive: player.alive,
        respawnAt: player.respawnAt,
      },
    ]),
  );
}

function snapshotLobbyRooms(): LobbyRoomSnapshot[] {
  const rooms = new Map<string, LobbyRoomSnapshot>();

  for (const [id, selection] of lobbySelections.entries()) {
    const room = rooms.get(selection.wager) ?? {
      wager: selection.wager,
      players: [],
    };
    const profile = lobbyProfiles.get(id);
    room.players.push({
      id,
      joinedAt: selection.joinedAt,
      walletAddress: profile?.walletAddress ?? null,
      username: profile?.username ?? `Player_${id.slice(0, 4)}`,
      pfp: profile?.pfp ?? '🥫',
      entryPaid: selection.wager === 'FREE' || entryPayments.get(id)?.wager === selection.wager,
    });
    rooms.set(selection.wager, room);
  }

  return [...rooms.values()]
    .map((room) => ({
      ...room,
      players: room.players.sort((left, right) => left.joinedAt - right.joinedAt),
    }))
    .sort((left, right) => left.wager.localeCompare(right.wager));
}

function emitLobbyRooms(io: Server) {
  for (const id of lobbySelections.keys()) {
    if (!io.sockets.sockets.has(id)) {
      lobbySelections.delete(id);
      lobbyProfiles.delete(id);
    }
  }

  io.emit('lobbyRooms', snapshotLobbyRooms());
}

function snapshotProjectile(projectile: ServerProjectile): ProjectileSnapshot {
  return {
    id: projectile.id,
    ownerId: projectile.ownerId,
    spawnPos: projectile.spawnPos,
    velocity: projectile.velocity,
    chargePower: projectile.chargePower,
    spawnedAt: projectile.spawnedAt,
  };
}

function distance(a: Vec3, b: Vec3) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
}

function rotateY(vector: Vec3, angle: number): Vec3 {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [
    (vector[0] * cosine) - (vector[2] * sine),
    vector[1],
    (vector[0] * sine) + (vector[2] * cosine),
  ];
}

function projectilePositionAt(spawnPos: Vec3, velocity: Vec3, elapsedSeconds: number): Vec3 {
  return [
    spawnPos[0] + (velocity[0] * elapsedSeconds),
    spawnPos[1] + (velocity[1] * elapsedSeconds) + (0.5 * GRAVITY_Y * elapsedSeconds * elapsedSeconds),
    spawnPos[2] + (velocity[2] * elapsedSeconds),
  ];
}

function expectedProjectilePosition(projectile: ServerProjectile, at: number): Vec3 {
  const elapsedSeconds = Math.max(0, (at - projectile.spawnedAt) / 1000);
  return projectilePositionAt(projectile.spawnPos, projectile.velocity, elapsedSeconds);
}

function toLocalSpace(point: Vec3, center: Vec3, rotationY = 0): Vec3 {
  return rotateY(
    [
      point[0] - center[0],
      point[1] - center[1],
      point[2] - center[2],
    ],
    -rotationY,
  );
}

function segmentIntersectionWithBox(start: Vec3, end: Vec3, center: Vec3, halfSize: Vec3, rotationY = 0): number | null {
  const localStart = toLocalSpace(start, center, rotationY);
  const localEnd = toLocalSpace(end, center, rotationY);
  const direction: Vec3 = [
    localEnd[0] - localStart[0],
    localEnd[1] - localStart[1],
    localEnd[2] - localStart[2],
  ];

  let tMin = 0;
  let tMax = 1;

  for (let axis = 0; axis < 3; axis += 1) {
    if (Math.abs(direction[axis]) < 1e-6) {
      if (localStart[axis] < -halfSize[axis] || localStart[axis] > halfSize[axis]) {
        return null;
      }
      continue;
    }

    let t1 = (-halfSize[axis] - localStart[axis]) / direction[axis];
    let t2 = (halfSize[axis] - localStart[axis]) / direction[axis];

    if (t1 > t2) {
      [t1, t2] = [t2, t1];
    }

    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);

    if (tMin > tMax) {
      return null;
    }
  }

  return tMin;
}

function segmentIntersectionWithSphere(start: Vec3, end: Vec3, center: Vec3, radius: number): number | null {
  const direction: Vec3 = [
    end[0] - start[0],
    end[1] - start[1],
    end[2] - start[2],
  ];
  const offset: Vec3 = [
    start[0] - center[0],
    start[1] - center[1],
    start[2] - center[2],
  ];

  const a = distanceSquared(direction, [0, 0, 0]);
  const b = 2 * ((offset[0] * direction[0]) + (offset[1] * direction[1]) + (offset[2] * direction[2]));
  const c = distanceSquared(offset, [0, 0, 0]) - (radius * radius);

  if (c <= 0) {
    return 0;
  }

  const discriminant = (b * b) - (4 * a * c);
  if (discriminant < 0 || a === 0) {
    return null;
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const firstHit = (-b - sqrtDiscriminant) / (2 * a);
  const secondHit = (-b + sqrtDiscriminant) / (2 * a);

  if (firstHit >= 0 && firstHit <= 1) {
    return firstHit;
  }

  if (secondHit >= 0 && secondHit <= 1) {
    return secondHit;
  }

  return null;
}

function lerpVec3(start: Vec3, end: Vec3, t: number): Vec3 {
  return [
    start[0] + ((end[0] - start[0]) * t),
    start[1] + ((end[1] - start[1]) * t),
    start[2] + ((end[2] - start[2]) * t),
  ];
}

function createPlayer(id: string): ServerPlayer {
  return {
    id,
    position: chooseSpawnPoint(id),
    yaw: 0,
    pitch: 0,
    kills: 0,
    deaths: 0,
    health: MAX_HEALTH,
    alive: true,
    respawnAt: null,
    lastShotAt: 0,
  };
}

function despawnProjectile(io: Server, projectileId: string) {
  if (!projectiles.delete(projectileId)) {
    return;
  }

  io.emit('projectileDespawned', { projectileId });
}

function clearProjectiles(io: Server) {
  for (const projectileId of projectiles.keys()) {
    io.emit('projectileDespawned', { projectileId });
  }
  projectiles.clear();
}

function emitPlayers(io: Server) {
  io.emit('scoreUpdate', snapshotPlayers());
}

function resetArena(io: Server) {
  matchResult = null;
  activeMatchId = null;
  activeMatchCreatePromise = null;
  clearProjectiles(io);
}

function finishMatch(io: Server, result: MatchResult) {
  matchResult = result;
  const matchId = activeMatchId;
  const winnerProfile = result.winnerId ? getProfile(result.winnerId) : undefined;
  const winnerWalletAddress = winnerProfile?.walletAddress ?? null;
  persist(recordEvent(matchId, 'matchEnded', result));
  persist(finishMatchRecord(matchId, {
    result,
    players: Object.values(players),
    getProfile,
  }));
  persist(settleMatchPayout({
    winnerWalletAddress,
    grossPotUnc: result.grossPotUnc,
    houseFeeUnc: result.houseFeeUnc,
    payoutPoolUnc: result.payoutPoolUnc,
  }).then(async (settlement) => {
    await recordPayoutSettlement(matchId, result, winnerProfile, settlement);
    await recordEvent(matchId, 'payoutSettlement', settlement);
  }));
  clearProjectiles(io);
  io.emit('matchEnded', result);
  emitPlayers(io);
}

function chooseSecondPlaceBonusId(winnerId: string | null) {
  return Object.values(players)
    .filter((player) => player.id !== winnerId)
    .sort((left, right) => (
      (right.kills - left.kills)
      || (left.deaths - right.deaths)
      || left.id.localeCompare(right.id)
    ))[0]?.id ?? null;
}

function maybeFinishLastStanding(io: Server) {
  const alivePlayers = Object.values(players).filter((player) => player.alive);
  const totalPlayers = Object.keys(players).length;

  if (matchResult || totalPlayers < 2 || alivePlayers.length !== 1) {
    return false;
  }

  const winnerId = alivePlayers[0].id;
  finishMatch(io, buildMatchResult(winnerId, 'lastStanding'));
  return true;
}

function handleValidHit(io: Server, ownerId: string, targetId: string, impactPosition: Vec3, chargePower: number) {
  const owner = players[ownerId];
  const target = players[targetId];

  if (!owner || !target || !target.alive) {
    return;
  }

  const clampedCharge = Math.max(0, Math.min(1, chargePower));
  const damage = Math.round(MIN_CAN_DAMAGE + ((MAX_CAN_DAMAGE - MIN_CAN_DAMAGE) * clampedCharge));
  target.health = Math.max(0, target.health - damage);
  io.emit('impactCreated', {
    id: randomUUID(),
    position: impactPosition,
    timestamp: Date.now(),
    ownerId,
    targetId,
  });

  if (target.health > 0) {
    persist(updatePlayerStats(activeMatchId, target));
    persist(recordEvent(
      activeMatchId,
      'playerDamaged',
      { damage, impactPosition, chargePower },
      eventActor(ownerId),
      eventActor(targetId),
    ));
    emitPlayers(io);
    return;
  }

  owner.kills += 1;
  target.deaths += 1;
  target.alive = false;
  target.health = 0;
  target.respawnAt = null;

  io.emit('playerKilled', { targetId, killerId: ownerId });
  persist(updatePlayerStats(activeMatchId, owner));
  persist(updatePlayerStats(activeMatchId, target));
  persist(recordEvent(
    activeMatchId,
    'playerKilled',
    { damage, impactPosition, chargePower },
    eventActor(ownerId),
    eventActor(targetId),
  ));

  if (maybeFinishLastStanding(io)) {
    return;
  }

  emitPlayers(io);
}

function findProjectileImpact(projectile: ServerProjectile, start: Vec3, end: Vec3) {
  let bestHitT = Number.POSITIVE_INFINITY;
  let impactPosition: Vec3 | null = null;
  let targetId: string | null = null;

  if (start[1] > 0 && end[1] <= 0) {
    const groundHitT = start[1] / (start[1] - end[1]);
    if (groundHitT >= 0 && groundHitT <= 1) {
      bestHitT = groundHitT;
      impactPosition = lerpVec3(start, end, groundHitT);
    }
  }

  for (const collider of arenaColliders) {
    const colliderHitT = segmentIntersectionWithBox(start, end, collider.center, collider.halfSize, collider.rotationY);
    if (colliderHitT !== null && colliderHitT < bestHitT) {
      bestHitT = colliderHitT;
      impactPosition = lerpVec3(start, end, colliderHitT);
      targetId = null;
    }
  }

  for (const target of Object.values(players)) {
    if (!target.alive || target.id === projectile.ownerId) {
      continue;
    }

    const playerHitT = segmentIntersectionWithSphere(start, end, target.position, PLAYER_HIT_RADIUS);
    if (playerHitT !== null && playerHitT < bestHitT) {
      bestHitT = playerHitT;
      impactPosition = lerpVec3(start, end, playerHitT);
      targetId = target.id;
    }
  }

  if (!impactPosition) {
    return null;
  }

  return {
    position: impactPosition,
    targetId,
  };
}

function resolveProjectile(io: Server, projectile: ServerProjectile, impact: { position: Vec3; targetId: string | null }) {
  projectile.resolved = true;
  despawnProjectile(io, projectile.id);
  persist(resolveProjectileRecord(
    activeMatchId,
    projectile.id,
    impact.position,
    impact.targetId ? eventActor(impact.targetId) : undefined,
  ));

  if (impact.targetId) {
    handleValidHit(io, projectile.ownerId, impact.targetId, impact.position, projectile.chargePower);
    return;
  }

  io.emit('impactCreated', {
    id: randomUUID(),
    position: impact.position,
    timestamp: Date.now(),
    ownerId: projectile.ownerId,
    targetId: null,
  });
  persist(recordEvent(
    activeMatchId,
    'projectileImpact',
    { impactPosition: impact.position },
    eventActor(projectile.ownerId),
    undefined,
    projectile.id,
  ));
}

async function startServer() {
  await initDatabase();
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      port: PORT,
      database: isDatabaseEnabled() ? 'enabled' : 'disabled',
      activeMatchId,
      players: Object.keys(players).length,
      projectiles: projectiles.size,
    });
  });

  app.get('/api/status', (_req, res) => {
    res.json({
      ok: true,
      databaseEnabled: isDatabaseEnabled(),
      activeMatchId,
      playerCount: Object.keys(players).length,
      lobbyRooms: snapshotLobbyRooms(),
      matchResult,
    });
  });

  app.get('/api/payment-config', (_req, res) => {
    res.json({
      ...getPaymentConfig(),
      hotWalletTokenAccount: getHotWalletTokenAccount(),
    });
  });

  const cleanupInterval = setInterval(() => {
    const now = Date.now();

    for (const [projectileId, projectile] of projectiles.entries()) {
      if (projectile.resolved) {
        despawnProjectile(io, projectileId);
        continue;
      }

      const projectileExpiresAt = projectile.spawnedAt + PROJECTILE_TTL_MS;
      const simulationEnd = Math.min(now, projectileExpiresAt);

      let segmentStartAt = projectile.lastSimulatedAt;
      while (segmentStartAt < simulationEnd) {
        const segmentEndAt = Math.min(segmentStartAt + PROJECTILE_SIM_STEP_MS, simulationEnd);
        const segmentStart = expectedProjectilePosition(projectile, segmentStartAt);
        const segmentEnd = expectedProjectilePosition(projectile, segmentEndAt);
        const impact = findProjectileImpact(projectile, segmentStart, segmentEnd);

        if (impact) {
          resolveProjectile(io, projectile, impact);
          break;
        }

        segmentStartAt = segmentEndAt;
        projectile.lastSimulatedAt = segmentEndAt;
      }

      if (projectile.resolved) {
        continue;
      }

      if (simulationEnd >= projectileExpiresAt) {
        despawnProjectile(io, projectileId);
      }
    }
  }, 50);

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);
    socket.emit('lobbyRooms', snapshotLobbyRooms());
    socket.emit('paymentConfig', {
      ...getPaymentConfig(),
      hotWalletTokenAccount: getHotWalletTokenAccount(),
    });
    persist(recordEvent(activeMatchId, 'socketConnected', { socketId: socket.id }, eventActor(socket.id)));

    socket.on('getPaymentConfig', (callback?: (config: ReturnType<typeof getPaymentConfig> & { hotWalletTokenAccount: string | null }) => void) => {
      callback?.({
        ...getPaymentConfig(),
        hotWalletTokenAccount: getHotWalletTokenAccount(),
      });
    });

    socket.on('selectLobby', (wager: string) => {
      lobbySelections.set(socket.id, {
        wager,
        joinedAt: lobbySelections.get(socket.id)?.joinedAt ?? Date.now(),
      });
      persist(recordEvent(activeMatchId, 'lobbySelected', { wager }, eventActor(socket.id)));
      emitLobbyRooms(io);
    });

    socket.on('verifyEntryPayment', async (
      payload: { signature: string; wager: string; walletAddress: string; amountUnc: number },
      callback?: (result: Awaited<ReturnType<typeof verifyEntryPayment>>) => void,
    ) => {
      const profile = getProfile(socket.id);
      if (!profile.walletAddress || profile.walletAddress !== payload.walletAddress) {
        const result = { ok: false, message: 'Connected wallet does not match this payment.' };
        callback?.(result);
        return;
      }

      const selection = lobbySelections.get(socket.id);
      if (!selection || selection.wager !== payload.wager) {
        const result = { ok: false, message: 'Select the wager room before paying its entry fee.' };
        callback?.(result);
        return;
      }

      const expectedAmount = parseBuyInUnc(payload.wager);
      if (expectedAmount <= 0 || payload.amountUnc < expectedAmount) {
        const result = { ok: false, message: 'Payment amount does not match this wager room.' };
        callback?.(result);
        return;
      }

      const result = await verifyEntryPayment({
        signature: payload.signature,
        wager: payload.wager,
        walletAddress: payload.walletAddress,
        amountUnc: expectedAmount,
      });

      if (result.ok && result.receipt) {
        entryPayments.set(socket.id, result.receipt);
        persist(recordEntryPayment(activeMatchId, socket.id, profile, result.receipt));
        persist(recordEvent(activeMatchId, 'entryPaymentVerified', result.receipt, eventActor(socket.id)));
        emitLobbyRooms(io);
      }

      callback?.(result);
    });

    socket.on('saveProfile', async (profile: Partial<LobbyProfile>) => {
      const username = typeof profile.username === 'string'
        ? profile.username.trim().slice(0, 18)
        : '';
      const pfp = typeof profile.pfp === 'string'
        ? profile.pfp.trim().slice(0, 80)
        : '🥫';
      const walletAddress = typeof profile.walletAddress === 'string' && profile.walletAddress
        ? profile.walletAddress
        : null;

      const persistedProfile = await saveProfile(socket.id, {
        walletAddress,
        username: username || `Player_${socket.id.slice(0, 4)}`,
        pfp: pfp || '🥫',
      });
      lobbyProfiles.set(socket.id, persistedProfile);
      if (players[socket.id]) {
        persist(upsertMatchPlayer(activeMatchId, {
          socketId: socket.id,
          profile: persistedProfile,
          player: players[socket.id],
        }));
      }
      emitLobbyRooms(io);
    });

    socket.on('joinMatch', async () => {
      if (!lobbySelections.has(socket.id)) {
        lobbySelections.set(socket.id, { wager: 'FREE', joinedAt: Date.now() });
        emitLobbyRooms(io);
      }

      if (matchResult && Object.keys(players).length === 0) {
        resetArena(io);
      }

      const selection = lobbySelections.get(socket.id);
      const wager = selection?.wager ?? 'FREE';
      const buyInUnc = parseBuyInUnc(wager);
      if (buyInUnc > 0 && !getProfile(socket.id).walletAddress) {
        socket.emit('joinMatchRejected', {
          reason: 'walletRequired',
          message: 'Connect a wallet and confirm the entry fee before joining this wager room.',
          wager,
        });
        return;
      }
      if (buyInUnc > 0 && entryPayments.get(socket.id)?.wager !== wager) {
        socket.emit('joinMatchRejected', {
          reason: 'paymentRequired',
          message: 'Pay and verify the entry fee before joining this wager room.',
          wager,
        });
        return;
      }

      if (!players[socket.id]) {
        players[socket.id] = createPlayer(socket.id);
      }

      const player = players[socket.id];
      await ensureActiveMatch(wager, buyInUnc);
      persist(upsertMatchPlayer(activeMatchId, {
        socketId: socket.id,
        profile: getProfile(socket.id),
        player,
      }));
      persist(recordEvent(activeMatchId, 'playerJoined', { position: player.position, wager }, eventActor(socket.id)));

      socket.emit('currentPlayers', snapshotPlayers());
      socket.emit('scoreUpdate', snapshotPlayers());
      socket.emit('spawnAssigned', { id: player.id, position: player.position });
      if (matchResult) {
        socket.emit('matchEnded', matchResult);
      }

      socket.broadcast.emit('playerJoined', snapshotPlayers()[socket.id]);
      emitPlayers(io);
    });

    socket.on('updateState', (state: Partial<Pick<PlayerSnapshot, 'position' | 'yaw' | 'pitch'>>) => {
      const player = players[socket.id];
      if (!player || !player.alive || matchResult) {
        return;
      }

      if (state.position) {
        player.position = state.position;
      }

      if (typeof state.yaw === 'number') {
        player.yaw = state.yaw;
      }

      if (typeof state.pitch === 'number') {
        player.pitch = state.pitch;
      }
      persist(updatePlayerStats(activeMatchId, player));

      socket.broadcast.emit('playerMoved', {
        id: player.id,
        position: player.position,
        yaw: player.yaw,
        pitch: player.pitch,
      });
    });

    socket.on('shoot', (data: Omit<ProjectileSnapshot, 'id' | 'ownerId' | 'spawnedAt'>) => {
      const player = players[socket.id];
      if (!player || !player.alive || matchResult) {
        return;
      }

      const now = Date.now();
      if ((now - player.lastShotAt) < SHOOT_COOLDOWN_MS) {
        return;
      }

      player.lastShotAt = now;

      const projectile: ServerProjectile = {
        id: randomUUID(),
        ownerId: socket.id,
        spawnPos: data.spawnPos,
        velocity: data.velocity,
        chargePower: Math.max(0, Math.min(1, data.chargePower ?? 0)),
        spawnedAt: now,
        resolved: false,
        lastSimulatedAt: now,
      };

      projectiles.set(projectile.id, projectile);
      persist(recordProjectile(activeMatchId, snapshotProjectile(projectile), getProfile(socket.id)));
      persist(recordEvent(
        activeMatchId,
        'projectileSpawned',
        { spawnPos: projectile.spawnPos, velocity: projectile.velocity, chargePower: projectile.chargePower },
        eventActor(socket.id),
        undefined,
        projectile.id,
      ));
      io.emit('projectileSpawn', snapshotProjectile(projectile));
    });

    socket.on('disconnect', async () => {
      console.log('Socket disconnected:', socket.id);
      const leavingActor = eventActor(socket.id);

      if (!players[socket.id]) {
        return;
      }

      const projectedRemainingPlayers = Object.values(players).filter((player) => player.id !== socket.id);
      const shouldFinishForfeit = !matchResult && projectedRemainingPlayers.length === 1 && Object.keys(players).length >= 2;
      await markPlayerLeft(activeMatchId, socket.id);
      await recordEvent(activeMatchId, 'playerDisconnected', { socketId: socket.id }, leavingActor);

      if (shouldFinishForfeit) {
        finishMatch(io, buildMatchResult(projectedRemainingPlayers[0].id, 'forfeit'));
      }

      delete players[socket.id];
      lobbySelections.delete(socket.id);
      lobbyProfiles.delete(socket.id);
      entryPayments.delete(socket.id);

      for (const [projectileId, projectile] of projectiles.entries()) {
        if (projectile.ownerId === socket.id) {
          persist(resolveProjectileRecord(activeMatchId, projectileId));
          despawnProjectile(io, projectileId);
        }
      }

      io.emit('playerLeft', socket.id);
      emitLobbyRooms(io);

      const remainingPlayers = Object.values(players);
      if (remainingPlayers.length === 0) {
        if (!matchResult) {
          await abandonMatchRecord(activeMatchId);
        }
        resetArena(io);
      } else {
        emitPlayers(io);
      }
    });
  });

  if (isProductionRuntime) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    clearInterval(cleanupInterval);
    httpServer.close();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer();

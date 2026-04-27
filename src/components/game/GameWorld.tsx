import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { KeyboardControls, Sky } from '@react-three/drei';
import { Level } from './Level';
import { Player } from './Player';
import { CanProjectile } from './CanProjectile';
import { ImpactEffect } from './ImpactEffect';
import { NetworkPlayer } from './NetworkPlayer';
import { useGameStore } from '../../store';
import {
  type ImpactSnapshot,
  type MatchStateSnapshot,
  type MatchResult,
  type PlayerSnapshot,
  type ProjectileSnapshot,
} from '../../gameTypes';
import {
  playCanImpactSound,
  playDeathBassSound,
  playKillSound,
  startGameAmbience,
  startGameMusic,
  stopGameAmbience,
  stopGameMusic,
  stopLobbyMusic,
} from '../../lib/audio';
import { ensureSocketConnected, socket } from '../../lib/socket';

interface NetworkPlayerState extends PlayerSnapshot {
  lastShotAt: number | null;
}

export const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'throw', keys: ['Click'] },
];

export function GameWorld() {
  const cans = useGameStore((state) => state.cans);
  const impacts = useGameStore((state) => state.impacts);
  const registerCan = useGameStore((state) => state.registerCan);
  const removeCan = useGameStore((state) => state.removeCan);
  const addImpact = useGameStore((state) => state.addImpact);
  const setPlayersInfo = useGameStore((state) => state.setPlayersInfo);
  const setMatchResult = useGameStore((state) => state.setMatchResult);
  const setMatchState = useGameStore((state) => state.setMatchState);
  const [networkPlayers, setNetworkPlayers] = useState<Record<string, NetworkPlayerState>>({});

  useEffect(() => {
    stopLobbyMusic();
    startGameMusic();
    startGameAmbience();
    return () => {
      stopGameMusic();
      stopGameAmbience();
    };
  }, []);

  useEffect(() => {
    const applySnapshot = (players: Record<string, PlayerSnapshot>) => {
      setPlayersInfo(players);
      setNetworkPlayers((prev) => {
        const next: Record<string, NetworkPlayerState> = {};

        for (const player of Object.values(players)) {
          next[player.id] = {
            ...player,
            lastShotAt: prev[player.id]?.lastShotAt ?? null,
          };
        }

        return next;
      });
    };

    const onCurrentPlayers = (players: Record<string, PlayerSnapshot>) => {
      applySnapshot(players);
    };

    const onPlayerJoined = (player: PlayerSnapshot) => {
      setNetworkPlayers((prev) => ({
        ...prev,
        [player.id]: {
          ...player,
          lastShotAt: null,
        },
      }));
    };

    const onPlayerLeft = (id: string) => {
      setNetworkPlayers((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    };

    const onProjectileSpawn = (projectile: ProjectileSnapshot) => {
      registerCan(projectile);

      setNetworkPlayers((prev) => {
        const owner = prev[projectile.ownerId];
        if (!owner) {
          return prev;
        }

        return {
          ...prev,
          [projectile.ownerId]: {
            ...owner,
            lastShotAt: projectile.spawnedAt,
          },
        };
      });
    };

    const onProjectileDespawned = ({ projectileId }: { projectileId: string }) => {
      removeCan(projectileId);
    };

    const onImpactCreated = (impact: ImpactSnapshot) => {
      addImpact(impact);
      playCanImpactSound();
    };

    const onPlayerKilled = ({ killerId }: { targetId: string; killerId: string }) => {
      playDeathBassSound();
      if (killerId === socket.id) {
        playKillSound();
      }
    };

    const onPlayerRespawned = ({ id, position }: { id: string; position: [number, number, number] }) => {
      setNetworkPlayers((prev) => {
        const existing = prev[id];
        if (!existing) {
          return prev;
        }

        return {
          ...prev,
          [id]: {
            ...existing,
            position,
          },
        };
      });
    };

    const onMatchEnded = (result: MatchResult) => {
      setMatchResult(result);
    };

    const onMatchState = (state: MatchStateSnapshot) => {
      setMatchState(state);
    };

    socket.on('currentPlayers', onCurrentPlayers);
    socket.on('playerJoined', onPlayerJoined);
    socket.on('playerLeft', onPlayerLeft);
    socket.on('projectileSpawn', onProjectileSpawn);
    socket.on('projectileDespawned', onProjectileDespawned);
    socket.on('impactCreated', onImpactCreated);
    socket.on('playerKilled', onPlayerKilled);
    socket.on('playerRespawned', onPlayerRespawned);
    socket.on('scoreUpdate', applySnapshot);
    socket.on('matchEnded', onMatchEnded);
    socket.on('matchState', onMatchState);

    const joinMatch = () => {
      socket.emit('joinMatch');
    };

    socket.on('connect', joinMatch);
    ensureSocketConnected();
    if (socket.connected) {
      joinMatch();
    }

    return () => {
      socket.off('connect', joinMatch);
      socket.off('currentPlayers', onCurrentPlayers);
      socket.off('playerJoined', onPlayerJoined);
      socket.off('playerLeft', onPlayerLeft);
      socket.off('projectileSpawn', onProjectileSpawn);
      socket.off('projectileDespawned', onProjectileDespawned);
      socket.off('impactCreated', onImpactCreated);
      socket.off('playerKilled', onPlayerKilled);
      socket.off('playerRespawned', onPlayerRespawned);
      socket.off('scoreUpdate', applySnapshot);
      socket.off('matchEnded', onMatchEnded);
      socket.off('matchState', onMatchState);
    };
  }, [addImpact, registerCan, removeCan, setMatchResult, setMatchState, setPlayersInfo]);

  return (
    <KeyboardControls map={keyboardMap}>
      <Canvas
        dpr={1}
        camera={{ fov: 75, near: 0.1, far: 185 }}
        gl={{ alpha: false, antialias: false, depth: true, stencil: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor('#9dc8e6', 1);
        }}
      >
        <color attach="background" args={['#9dc8e6']} />
        <fog attach="fog" args={['#b8d0dd', 72, 170]} />
        <Sky
          distance={450000}
          sunPosition={[-55, 35, -80]}
          turbidity={4.5}
          rayleigh={1.8}
          mieCoefficient={0.006}
          mieDirectionalG={0.72}
        />
        <hemisphereLight args={['#d9ecff', '#52694a', 0.82]} />
        <ambientLight intensity={0.38} />
        <directionalLight
          position={[-32, 42, -28]}
          color="#fff4d4"
          intensity={1.48}
        />

        <Suspense fallback={null}>
          <Physics gravity={[0, -20, 0]}>
            <Level />
            <Player />

            {Object.values(networkPlayers).map((player) => {
              if (player.id === socket.id) {
                return null;
              }

              return (
                <NetworkPlayer
                  key={player.id}
                  id={player.id}
                  initialData={player}
                />
              );
            })}

            {cans.map((can) => (
              <CanProjectile
                key={can.id}
                id={can.id}
                ownerId={can.ownerId}
                position={can.spawnPos}
                spawnedAt={can.spawnedAt}
                velocity={can.velocity}
                chargePower={can.chargePower}
              />
            ))}

            {impacts.map((impact) => (
              <ImpactEffect key={impact.id} id={impact.id} position={impact.position} />
            ))}
          </Physics>
        </Suspense>
      </Canvas>
    </KeyboardControls>
  );
}

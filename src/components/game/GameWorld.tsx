import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Cloud, Clouds, Environment, KeyboardControls, Sky } from '@react-three/drei';
import { Level } from './Level';
import { Player } from './Player';
import { CanProjectile } from './CanProjectile';
import { ImpactEffect } from './ImpactEffect';
import { NetworkPlayer } from './NetworkPlayer';
import { useGameStore } from '../../store';
import {
  type ImpactSnapshot,
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

interface MovementUpdate {
  id: string;
  position: [number, number, number];
  yaw: number;
  pitch: number;
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

    const onPlayerMoved = (movement: MovementUpdate) => {
      setNetworkPlayers((prev) => {
        const existing = prev[movement.id];
        if (!existing) {
          return prev;
        }

        return {
          ...prev,
          [movement.id]: {
            ...existing,
            position: movement.position,
            yaw: movement.yaw,
            pitch: movement.pitch,
          },
        };
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

    socket.on('currentPlayers', onCurrentPlayers);
    socket.on('playerJoined', onPlayerJoined);
    socket.on('playerLeft', onPlayerLeft);
    socket.on('playerMoved', onPlayerMoved);
    socket.on('projectileSpawn', onProjectileSpawn);
    socket.on('projectileDespawned', onProjectileDespawned);
    socket.on('impactCreated', onImpactCreated);
    socket.on('playerKilled', onPlayerKilled);
    socket.on('playerRespawned', onPlayerRespawned);
    socket.on('scoreUpdate', applySnapshot);
    socket.on('matchEnded', onMatchEnded);

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
      socket.off('playerMoved', onPlayerMoved);
      socket.off('projectileSpawn', onProjectileSpawn);
      socket.off('projectileDespawned', onProjectileDespawned);
      socket.off('impactCreated', onImpactCreated);
      socket.off('playerKilled', onPlayerKilled);
      socket.off('playerRespawned', onPlayerRespawned);
      socket.off('scoreUpdate', applySnapshot);
      socket.off('matchEnded', onMatchEnded);
    };
  }, [addImpact, registerCan, removeCan, setMatchResult, setPlayersInfo]);

  return (
    <KeyboardControls map={keyboardMap}>
      <Canvas
        shadows
        camera={{ fov: 75 }}
        gl={{ alpha: false, antialias: true }}
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
        <Suspense fallback={null}>
          <Environment preset="park" environmentIntensity={0.72} />
          <Clouds limit={60} range={220}>
            <Cloud
              seed={14}
              position={[-90, 92, -170]}
              bounds={[36, 7, 12]}
              scale={[2.6, 0.8, 1.1]}
              volume={8}
              opacity={0.18}
              color="#f7fbff"
            />
            <Cloud
              seed={27}
              position={[88, 104, -140]}
              bounds={[40, 8, 14]}
              scale={[2.9, 0.85, 1.15]}
              volume={10}
              opacity={0.16}
              color="#edf6ff"
            />
            <Cloud
              seed={41}
              position={[12, 112, 150]}
              bounds={[50, 7, 16]}
              scale={[3.2, 0.75, 1.25]}
              volume={10}
              opacity={0.14}
              color="#f4f8fa"
            />
          </Clouds>
        </Suspense>
        <hemisphereLight args={['#d9ecff', '#52694a', 0.82]} />
        <ambientLight intensity={0.24} />
        <directionalLight
          castShadow
          position={[-32, 42, -28]}
          color="#fff4d4"
          intensity={1.65}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
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

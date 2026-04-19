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
import { socket } from '../../lib/socket';
import { playDeathBassSound } from '../../lib/audio';

export const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'throw', keys: ['Click'] } 
];

export function GameWorld() {
  const cans = useGameStore(s => s.cans);
  const impacts = useGameStore(s => s.impacts);
  const [networkPlayers, setNetworkPlayers] = useState<Record<string, any>>({});

  useEffect(() => {
    socket.on('currentPlayers', setNetworkPlayers);
    socket.on('playerJoined', (p) => setNetworkPlayers(prev => ({...prev, [p.id]: p})));
    socket.on('playerLeft', (id) => setNetworkPlayers(prev => { 
      const n = {...prev}; delete n[id]; return n; 
    }));

    socket.on('playerShot', (data) => {
      useGameStore.getState().throwCan(data.spawnPos, data.velocity, false);
    });

    socket.on('playerKilled', (data) => {
      // Play sub bass kick globally whenever anyone gets dropped
      playDeathBassSound();
    });

    socket.on('scoreUpdate', (players) => {
      useGameStore.getState().setPlayersInfo(players);
    });

    return () => {
      socket.off('currentPlayers');
      socket.off('playerJoined');
      socket.off('playerLeft');
      socket.off('playerShot');
      socket.off('playerKilled');
      socket.off('scoreUpdate');
    };
  }, []);

  return (
    <KeyboardControls map={keyboardMap}>
      <Canvas shadows camera={{ fov: 75 }}>
        <Sky sunPosition={[100, 20, 100]} turbidity={0.1} rayleigh={0.5} />
        <ambientLight intensity={0.5} />
        <directionalLight
          castShadow
          position={[10, 20, 10]}
          intensity={1.5}
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
            
            {Object.values(networkPlayers).map(p => {
              if (p.id === socket.id) return null; // Don't render self here
              return <NetworkPlayer key={p.id} id={p.id} initialData={p} />
            })}

            {cans.map(can => (
              <CanProjectile key={can.id} id={can.id} position={can.position} velocity={can.velocity} isLocal={can.isLocal} />
            ))}

            {impacts.map(impact => (
              <ImpactEffect key={impact.id} id={impact.id} position={impact.position} />
            ))}
          </Physics>
        </Suspense>
      </Canvas>
    </KeyboardControls>
  );
}

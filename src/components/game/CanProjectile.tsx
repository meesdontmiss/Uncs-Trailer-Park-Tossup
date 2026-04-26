import { useMemo, useRef } from 'react';
import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { assets } from './assets';
import { GRAVITY_Y } from '../../gameTypes';

interface CanProjectileProps {
  id: string;
  ownerId: string;
  position: [number, number, number];
  spawnedAt: number;
  velocity: [number, number, number];
}

export function CanProjectile({ id, ownerId, position, spawnedAt, velocity }: CanProjectileProps) {
  const projectileRef = useRef<THREE.Group>(null);
  const texture = useMemo(() => {
    const loaded = new THREE.TextureLoader().load(assets.sprites.CAN);
    loaded.colorSpace = THREE.SRGBColorSpace;
    loaded.magFilter = THREE.NearestFilter;
    return loaded;
  }, []);

  useFrame((_, delta) => {
    if (!projectileRef.current) {
      return;
    }

    const elapsedSeconds = Math.max(0, (Date.now() - spawnedAt) / 1000);
    projectileRef.current.position.set(
      position[0] + (velocity[0] * elapsedSeconds),
      position[1] + (velocity[1] * elapsedSeconds) + (0.5 * GRAVITY_Y * elapsedSeconds * elapsedSeconds),
      position[2] + (velocity[2] * elapsedSeconds),
    );
    projectileRef.current.rotation.x += delta * 12;
    projectileRef.current.rotation.y += delta * 18;
    projectileRef.current.rotation.z += delta * 14;
  });

  return (
    <group ref={projectileRef} position={position} name={`can-${id}-${ownerId}`}>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <mesh>
          <planeGeometry args={[0.5, 1]} />
          <meshStandardMaterial map={texture} transparent alphaTest={0.08} side={THREE.DoubleSide} roughness={0.45} metalness={0.25} />
        </mesh>
      </Billboard>
    </group>
  );
}

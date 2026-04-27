import { useRef } from 'react';
import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GRAVITY_Y } from '../../gameTypes';
import { useCanTexture } from './useGameTextures';

interface CanProjectileProps {
  id: string;
  ownerId: string;
  position: [number, number, number];
  spawnedAt: number;
  velocity: [number, number, number];
  chargePower: number;
}

export function CanProjectile({ id, ownerId, position, spawnedAt, velocity, chargePower }: CanProjectileProps) {
  const projectileRef = useRef<THREE.Group>(null);
  const spriteRef = useRef<THREE.Mesh>(null);
  const texture = useCanTexture();
  const scale = 1.15 + (chargePower * 0.28);

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

    if (spriteRef.current) {
      spriteRef.current.rotation.z += delta * (12 + (chargePower * 10));
    }
  });

  return (
    <group ref={projectileRef} position={position} name={`can-${id}-${ownerId}`} scale={scale}>
      <mesh position={[0, 0, 0.32]} rotation={[0, 0, Math.PI / 2]}>
        <planeGeometry args={[0.22, 1.35 + (chargePower * 0.55)]} />
        <meshBasicMaterial
          color="#82ff00"
          transparent
          opacity={0.26 + (chargePower * 0.18)}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <Billboard follow={true}>
        <mesh ref={spriteRef} frustumCulled={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={texture}
            transparent={true}
            alphaTest={0.08}
            side={THREE.DoubleSide}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

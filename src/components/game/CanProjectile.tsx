import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GRAVITY_Y } from '../../gameTypes';

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
  const materials = useMemo(() => ({
    can: new THREE.MeshStandardMaterial({
      color: '#050706',
      roughness: 0.32,
      metalness: 0.82,
    }),
    rim: new THREE.MeshStandardMaterial({
      color: '#d7ded4',
      roughness: 0.18,
      metalness: 0.92,
    }),
    neon: new THREE.MeshStandardMaterial({
      color: '#82ff00',
      emissive: '#4dde00',
      emissiveIntensity: 0.7,
      roughness: 0.24,
    }),
  }), []);
  const scale = 0.9 + (chargePower * 0.22);

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
    projectileRef.current.rotation.y += delta * (18 + (chargePower * 12));
    projectileRef.current.rotation.z += delta * 14;
  });

  return (
    <group ref={projectileRef} position={position} name={`can-${id}-${ownerId}`} scale={scale}>
      <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.19, 0.19, 0.64, 36]} />
          <primitive object={materials.can} attach="material" />
        </mesh>
        <mesh position={[0, 0.33, 0]} castShadow>
          <cylinderGeometry args={[0.192, 0.192, 0.035, 36]} />
          <primitive object={materials.rim} attach="material" />
        </mesh>
        <mesh position={[0, -0.33, 0]} castShadow>
          <cylinderGeometry args={[0.192, 0.192, 0.035, 36]} />
          <primitive object={materials.rim} attach="material" />
        </mesh>
        <mesh position={[0, 0.36, 0.055]} rotation={[Math.PI / 2, 0, 0.18]}>
          <torusGeometry args={[0.07, 0.008, 8, 18]} />
          <primitive object={materials.rim} attach="material" />
        </mesh>
        {[-0.065, 0, 0.065].map((x, index) => (
          <mesh
            key={x}
            position={[x, 0.02, 0.196]}
            rotation={[0, 0, (index - 1) * -0.18]}
          >
            <planeGeometry args={[0.04, 0.46]} />
            <primitive object={materials.neon} attach="material" />
          </mesh>
        ))}
        <mesh position={[0, -0.03, -0.196]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.16, 0.42]} />
          <meshStandardMaterial color="#1f251d" roughness={0.5} metalness={0.2} />
        </mesh>
      </group>
    </group>
  );
}

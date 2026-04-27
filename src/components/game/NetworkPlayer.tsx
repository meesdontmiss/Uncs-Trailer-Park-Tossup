import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { socket } from '../../lib/socket';
import type { PlayerSnapshot } from '../../gameTypes';
import { useShootTexture, useUncSpriteTextures } from './useGameTextures';

interface NetworkPlayerState extends PlayerSnapshot {
  lastShotAt: number | null;
}

export function NetworkPlayer({ id, initialData }: { id: string; initialData: NetworkPlayerState }) {
  const { camera } = useThree();
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const spriteMeshRef = useRef<THREE.Mesh>(null);
  const walkTime = useRef(0);
  const [isDead, setIsDead] = useState(!initialData.alive);
  const positionRef = useRef(new THREE.Vector3().fromArray(initialData.position));
  const targetPosition = useRef(new THREE.Vector3().fromArray(initialData.position));
  const yawRef = useRef(initialData.yaw);
  const isShootingRef = useRef(false);
  const shootTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const textures = useUncSpriteTextures();
  const shootTexture = useShootTexture();

  useEffect(() => {
    targetPosition.current.set(initialData.position[0], initialData.position[1], initialData.position[2]);
    yawRef.current = initialData.yaw;
    setIsDead(!initialData.alive);
  }, [initialData.alive, initialData.position, initialData.yaw]);

  useEffect(() => {
    const onMove = (data: { id: string; position: [number, number, number]; yaw: number }) => {
      if (data.id !== id) {
        return;
      }

      targetPosition.current.set(data.position[0], data.position[1], data.position[2]);
      yawRef.current = data.yaw;
    };

    const onProjectileSpawn = (data: { ownerId: string }) => {
      if (data.ownerId !== id) {
        return;
      }

      isShootingRef.current = true;
      if (shootTimeout.current) {
        clearTimeout(shootTimeout.current);
      }

      shootTimeout.current = setTimeout(() => {
        isShootingRef.current = false;
      }, 150);
    };

    const onPlayerKilled = (data: { targetId: string }) => {
      if (data.targetId === id) {
        setIsDead(true);
      }
    };

    const onPlayerRespawned = (data: { id: string; position: [number, number, number] }) => {
      if (data.id !== id) {
        return;
      }

      targetPosition.current.set(data.position[0], data.position[1], data.position[2]);
      positionRef.current.set(data.position[0], data.position[1], data.position[2]);
      setIsDead(false);
    };

    socket.on('playerMoved', onMove);
    socket.on('projectileSpawn', onProjectileSpawn);
    socket.on('playerKilled', onPlayerKilled);
    socket.on('playerRespawned', onPlayerRespawned);

    return () => {
      if (shootTimeout.current) {
        clearTimeout(shootTimeout.current);
      }
      socket.off('playerMoved', onMove);
      socket.off('projectileSpawn', onProjectileSpawn);
      socket.off('playerKilled', onPlayerKilled);
      socket.off('playerRespawned', onPlayerRespawned);
    };
  }, [id]);

  useFrame((_, delta) => {
    positionRef.current.lerp(targetPosition.current, 0.2);
    rigidBodyRef.current?.setNextKinematicTranslation(positionRef.current);

    const deltaX = camera.position.x - positionRef.current.x;
    const deltaZ = camera.position.z - positionRef.current.z;
    const angleToCamera = Math.atan2(deltaX, deltaZ);

    let relativeAngle = yawRef.current - angleToCamera;
    relativeAngle = (relativeAngle + (Math.PI * 4)) % (Math.PI * 2);

    let octant = Math.round(relativeAngle / (Math.PI / 4)) % 8;
    if (octant < 0) {
      octant += 8;
    }

    const activeTexture = isShootingRef.current ? shootTexture : textures[octant];
    if (materialRef.current && materialRef.current.map !== activeTexture) {
      materialRef.current.map = activeTexture;
      materialRef.current.needsUpdate = true;
    }
    if (materialRef.current) {
      const invulnerable = (initialData.invulnerableUntil ?? 0) > Date.now();
      materialRef.current.opacity = invulnerable ? 0.55 + (Math.sin(Date.now() * 0.02) * 0.25) : 1;
    }

    if (isDead) {
      if (spriteMeshRef.current) {
        spriteMeshRef.current.rotation.x = THREE.MathUtils.lerp(spriteMeshRef.current.rotation.x, -Math.PI / 2, delta * 15);
        spriteMeshRef.current.position.y = THREE.MathUtils.lerp(spriteMeshRef.current.position.y, -3, delta * 15);
      }
      return;
    }

    if (spriteMeshRef.current) {
      const dist = positionRef.current.distanceTo(targetPosition.current);
      if (dist > 0.05) {
        walkTime.current += delta * 15;
        spriteMeshRef.current.rotation.x = THREE.MathUtils.lerp(spriteMeshRef.current.rotation.x, 0, delta * 15);
        spriteMeshRef.current.rotation.z = Math.sin(walkTime.current) * 0.15;
        spriteMeshRef.current.position.y = -1.25 + (Math.abs(Math.sin(walkTime.current)) * 0.2);
      } else {
        walkTime.current = 0;
        spriteMeshRef.current.rotation.x = THREE.MathUtils.lerp(spriteMeshRef.current.rotation.x, 0, delta * 15);
        spriteMeshRef.current.rotation.z = THREE.MathUtils.lerp(spriteMeshRef.current.rotation.z, 0, delta * 15);
        spriteMeshRef.current.position.y = THREE.MathUtils.lerp(spriteMeshRef.current.position.y, -1.25, delta * 15);
      }
    }
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="kinematicPosition"
      colliders="hull"
      name={`remote-${id}`}
      position={initialData.position}
    >
      <mesh visible={false} position={[0, 0, 0]}>
        <capsuleGeometry args={[1.25, 0.5]} />
      </mesh>

      <Billboard follow>
        <mesh ref={spriteMeshRef} position={[0, -1.25, 0]} frustumCulled={false}>
          <planeGeometry args={[2.5, 3.5]} />
          <meshStandardMaterial ref={materialRef} transparent alphaTest={0.5} side={THREE.DoubleSide} />
        </mesh>
      </Billboard>
    </RigidBody>
  );
}

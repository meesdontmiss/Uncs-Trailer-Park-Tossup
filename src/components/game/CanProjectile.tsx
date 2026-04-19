import { useEffect, useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { assets } from './assets';
import { useGameStore } from '../../store';
import { playCanImpactSound } from '../../lib/audio';

interface CanProjectileProps {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  isLocal?: boolean;
}

export function CanProjectile({ id, position, velocity, isLocal }: CanProjectileProps) {
  const body = useRef<RapierRigidBody>(null);
  const addImpact = useGameStore(s => s.addImpact);
  const [hasHit, setHasHit] = useState(false);
  
  // Use a simple 2D billboard sprite for the Can too! Cursed and perfect.
  const texture = useMemo(() => new THREE.TextureLoader().load(assets.sprites.CAN), []);

  useEffect(() => {
    // Apply initial velocity when spawned
    if (body.current) {
      body.current.setLinvel({ x: velocity[0], y: velocity[1], z: velocity[2] }, true);
      body.current.setAngvel({ x: Math.random() * 10, y: Math.random() * 10, z: Math.random() * 10 }, true);
    }
  }, [velocity]);
  
  // Add collision handler
  const onIntersectionEnter = (e: any) => {
    if (!hasHit) {
      setHasHit(true);
      playCanImpactSound();
      
      const pos = body.current?.translation();
      if (pos) {
        // Spawn an impact visual exactly where the can hit
        addImpact([pos.x, pos.y, pos.z]);
      }
    }
  };
  
  return (
    <RigidBody 
      ref={body} 
      name={isLocal ? "can-local" : "can-remote"}
      position={position} 
      type="dynamic" 
      colliders="hull" 
      mass={0.5} 
      restitution={0.6}
      friction={2}
      onCollisionEnter={onIntersectionEnter}
    >
      <Billboard
        follow={true}
        lockX={false}
        lockY={false}
        lockZ={false} 
      >
        <mesh>
          <planeGeometry args={[0.5, 1]} />
          <meshStandardMaterial map={texture} transparent alphaTest={0.5} side={THREE.DoubleSide} />
        </mesh>
      </Billboard>
    </RigidBody>
  );
}

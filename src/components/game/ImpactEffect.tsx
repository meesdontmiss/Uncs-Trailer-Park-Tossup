import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store';
import { useImpactTexture } from './useGameTextures';

export function ImpactEffect({ id, position }: { id: string; position: [number, number, number] }) {
  const removeImpact = useGameStore(s => s.removeImpact);
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  const texture = useImpactTexture();
  const startTime = useMemo(() => Date.now(), []);

  useFrame(() => {
    const elapsed = Date.now() - startTime;
    if (elapsed > 300) {
      removeImpact(id); // Despawn after 300ms
    } else if (materialRef.current) {
      // Fade out
      materialRef.current.opacity = 1 - (elapsed / 300);
      // Scale up slightly
      meshRef.current?.scale.setScalar(1 + (elapsed / 220));
      materialRef.current.needsUpdate = true;
    }
  });

  return (
    <Billboard position={position} follow={true}>
      <mesh ref={meshRef}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshStandardMaterial 
          ref={materialRef} 
          map={texture} 
          transparent={true} 
          alphaTest={0.05}
          side={THREE.DoubleSide} 
          emissive="#7eff00"
          emissiveIntensity={0.9}
        />
      </mesh>
    </Billboard>
  );
}

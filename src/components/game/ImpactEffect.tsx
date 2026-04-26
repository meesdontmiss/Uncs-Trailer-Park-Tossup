import { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store';
import { assets } from './assets';

export function ImpactEffect({ id, position }: { id: string; position: [number, number, number] }) {
  const removeImpact = useGameStore(s => s.removeImpact);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  const texture = useMemo(() => {
    const loaded = new THREE.TextureLoader().load(assets.sprites.IMPACT);
    loaded.colorSpace = THREE.SRGBColorSpace;
    return loaded;
  }, []);
  const startTime = useMemo(() => Date.now(), []);

  useFrame(() => {
    const elapsed = Date.now() - startTime;
    if (elapsed > 300) {
      removeImpact(id); // Despawn after 300ms
    } else if (materialRef.current) {
      // Fade out
      materialRef.current.opacity = 1 - (elapsed / 300);
      // Scale up slightly
      materialRef.current.needsUpdate = true;
    }
  });

  return (
    <Billboard position={position} follow={true}>
      <mesh>
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

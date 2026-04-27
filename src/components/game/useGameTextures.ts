import { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { assets } from './assets';

function configureSpriteTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function useUncSpriteTextures() {
  const textures = useTexture(assets.sprites.unc);
  return useMemo(() => textures.map(configureSpriteTexture), [textures]);
}

export function useShootTexture() {
  const texture = useTexture(assets.sprites.UNC_SHOOT_BACK);
  return useMemo(() => configureSpriteTexture(texture), [texture]);
}

export function useCanTexture() {
  const texture = useTexture(assets.sprites.CAN);
  return useMemo(() => configureSpriteTexture(texture), [texture]);
}

export function useImpactTexture() {
  const texture = useTexture(assets.sprites.IMPACT);
  return useMemo(() => configureSpriteTexture(texture), [texture]);
}

useTexture.preload(assets.sprites.unc);
useTexture.preload(assets.sprites.UNC_SHOOT_BACK);
useTexture.preload(assets.sprites.CAN);
useTexture.preload(assets.sprites.IMPACT);

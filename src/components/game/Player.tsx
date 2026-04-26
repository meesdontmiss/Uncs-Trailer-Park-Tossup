import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, RapierRigidBody, CapsuleCollider } from '@react-three/rapier';
import { useKeyboardControls, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store';
import { assets } from './assets';
import { socket } from '../../lib/socket';
import {
  playJumpSound,
  playThrowChargeStartSound,
  playThrowSound,
  stopThrowChargeSound,
  updateThrowChargeSound,
} from '../../lib/audio';
import { readMobileControls } from '../../lib/mobileControls';

const SPEED = 15;
const JUMP_FORCE = 8;
const MIN_THROW_POWER = 26;
const MAX_THROW_POWER = 58;
const FULL_CHARGE_MS = 1100;

export function Player() {
  const body = useRef<RapierRigidBody>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const [, getKeys] = useKeyboardControls();
  const { camera } = useThree();
  const spriteMeshRef = useRef<THREE.Mesh>(null);
  const walkTime = useRef(0);
  const [yaw, setYaw] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [isDead, setIsDead] = useState(false);
  const yawRef = useRef(yaw);
  const pitchRef = useRef(pitch);
  const chargeStartedAt = useRef<number | null>(null);
  const wasMobileThrowHeld = useRef(false);
  const lastShootTime = useRef(0);
  const lastSync = useRef(0);
  const hasSpawned = useRef(false);
  const previousAlive = useRef<boolean | null>(null);
  const baseSpriteYOffset = 0;

  const myInfo = useGameStore((state) => (socket.id ? state.playersInfo[socket.id] : undefined));
  const setThrowCharge = useGameStore((state) => state.setThrowCharge);

  const textures = useMemo(() => {
    const loader = new THREE.TextureLoader();
    return assets.sprites.unc.map((path) => {
      const texture = loader.load(path);
      texture.magFilter = THREE.NearestFilter;
      return texture;
    });
  }, []);

  const shootTexture = useMemo(() => {
    const texture = new THREE.TextureLoader().load(assets.sprites.UNC_SHOOT_BACK);
    texture.magFilter = THREE.NearestFilter;
    return texture;
  }, []);

  useEffect(() => {
    yawRef.current = yaw;
    pitchRef.current = pitch;
  }, [yaw, pitch]);

  useEffect(() => () => {
    chargeStartedAt.current = null;
    setThrowCharge(0);
    stopThrowChargeSound();
  }, [setThrowCharge]);

  useEffect(() => {
    if (!materialRef.current) {
      return;
    }

    materialRef.current.map = textures[2];
    materialRef.current.needsUpdate = true;
  }, [textures]);

  const beginThrowCharge = () => {
    if (!body.current || isDead || chargeStartedAt.current !== null) {
      return;
    }

    chargeStartedAt.current = Date.now();
    setThrowCharge(0.01);
    playThrowChargeStartSound();
  };

  const releaseThrowCharge = () => {
    if (!body.current || isDead) {
      chargeStartedAt.current = null;
      setThrowCharge(0);
      stopThrowChargeSound();
      return;
    }

    const now = Date.now();
    const chargeElapsed = chargeStartedAt.current === null ? 0 : now - chargeStartedAt.current;
    const chargePower = Math.max(0, Math.min(1, chargeElapsed / FULL_CHARGE_MS));
    const throwPower = MIN_THROW_POWER + ((MAX_THROW_POWER - MIN_THROW_POWER) * chargePower);

    chargeStartedAt.current = null;
    setThrowCharge(0);
    stopThrowChargeSound();

    playThrowSound(chargePower);
    lastShootTime.current = now;

    const playerPos = body.current.translation();
    const playerPosVec = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyAxisAngle(new THREE.Vector3(1, 0, 0), pitchRef.current);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);

    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);
    const up = new THREE.Vector3(0, 1, 0);

    const spawnPos = playerPosVec.clone()
      .add(up.clone().multiplyScalar(0.75))
      .add(right.clone().multiplyScalar(0.8))
      .add(forward.clone().multiplyScalar(1.5));

    socket.emit('shoot', {
      spawnPos: [spawnPos.x, spawnPos.y, spawnPos.z],
      velocity: [forward.x * throwPower, forward.y * throwPower, forward.z * throwPower],
      chargePower,
    });
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!document.pointerLockElement || isDead) {
        return;
      }

      setYaw((value) => value - (event.movementX * 0.002));
      setPitch((value) => Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, value - (event.movementY * 0.002))));
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (!document.pointerLockElement || event.button !== 0 || isDead) {
        return;
      }

      beginThrowCharge();
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (!document.pointerLockElement || event.button !== 0) {
        return;
      }

      releaseThrowCharge();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDead, setThrowCharge]);

  useEffect(() => {
    const handleSpawnAssigned = ({ id, position }: { id: string; position: [number, number, number] }) => {
      if (id !== socket.id || !body.current) {
        return;
      }

      body.current.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      hasSpawned.current = true;
    };

    socket.on('spawnAssigned', handleSpawnAssigned);
    return () => {
      socket.off('spawnAssigned', handleSpawnAssigned);
    };
  }, []);

  useEffect(() => {
    if (!myInfo || !body.current) {
      return;
    }

    if (!hasSpawned.current) {
      body.current.setTranslation({ x: myInfo.position[0], y: myInfo.position[1], z: myInfo.position[2] }, true);
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      hasSpawned.current = true;
    }

    if (previousAlive.current === null) {
      previousAlive.current = myInfo.alive;
      setIsDead(!myInfo.alive);
      return;
    }

    if (previousAlive.current && !myInfo.alive) {
      setIsDead(true);
    }

    if (!previousAlive.current && myInfo.alive) {
      body.current.setTranslation({ x: myInfo.position[0], y: myInfo.position[1], z: myInfo.position[2] }, true);
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      setIsDead(false);
    }

    previousAlive.current = myInfo.alive;
  }, [myInfo]);

  const lastYaw = useRef(yaw);

  useFrame((_, delta) => {
    if (!body.current) {
      return;
    }

    const mobile = readMobileControls();
    if ((mobile.lookX !== 0 || mobile.lookY !== 0) && !isDead) {
      const nextYaw = yawRef.current - (mobile.lookX * 0.003);
      const nextPitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, pitchRef.current - (mobile.lookY * 0.003)));
      yawRef.current = nextYaw;
      pitchRef.current = nextPitch;
      setYaw(nextYaw);
      setPitch(nextPitch);
    }

    if (mobile.throwHeld && !wasMobileThrowHeld.current) {
      beginThrowCharge();
    }

    if (!mobile.throwHeld && wasMobileThrowHeld.current) {
      releaseThrowCharge();
    }

    wasMobileThrowHeld.current = mobile.throwHeld;

    if (chargeStartedAt.current !== null) {
      const charge = Math.max(0, Math.min(1, (Date.now() - chargeStartedAt.current) / FULL_CHARGE_MS));
      setThrowCharge(charge);
      updateThrowChargeSound(charge);
    }

    const { forward, backward, left, right, jump } = getKeys();
    const currentVelocity = body.current.linvel();
    const playerPos = body.current.translation();

    if (isDead) {
      body.current.setLinvel({ x: 0, y: Math.min(0, currentVelocity.y), z: 0 }, true);
      if (spriteMeshRef.current) {
        spriteMeshRef.current.rotation.x = THREE.MathUtils.lerp(spriteMeshRef.current.rotation.x, -Math.PI / 2, delta * 15);
        spriteMeshRef.current.position.y = THREE.MathUtils.lerp(spriteMeshRef.current.position.y, -1.75, delta * 15);
      }
      return;
    }

    const velocity = new THREE.Vector3(0, 0, 0);
    if (forward) velocity.z -= 1;
    if (backward) velocity.z += 1;
    if (left) velocity.x -= 1;
    if (right) velocity.x += 1;
    velocity.x += mobile.moveX;
    velocity.z -= mobile.moveY;

    velocity.normalize().multiplyScalar(SPEED);
    velocity.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    body.current.setLinvel({ x: velocity.x, y: currentVelocity.y, z: velocity.z }, true);

    if ((jump || mobile.jump) && Math.abs(currentVelocity.y) < 0.1) {
      body.current.setLinvel({ x: currentVelocity.x, y: JUMP_FORCE, z: currentVelocity.z }, true);
      playJumpSound();
    }

    if (playerPos.y < -15) {
      body.current.setTranslation({ x: 0, y: 10, z: 0 }, true);
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    const playerPosVec = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
    const cameraDistance = 4;
    const cameraHeight = 1.4;
    const shoulderOffset = 1.2;

    const camForward = new THREE.Vector3(0, 0, -1);
    camForward.applyAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
    camForward.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

    const camRight = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const camUp = new THREE.Vector3(0, 1, 0);

    const camPos = playerPosVec.clone()
      .add(camUp.clone().multiplyScalar(cameraHeight))
      .add(camRight.clone().multiplyScalar(shoulderOffset))
      .add(camForward.clone().multiplyScalar(-cameraDistance));

    camera.position.copy(camPos);
    camera.lookAt(camPos.clone().add(camForward.clone().multiplyScalar(100)));

    const yawVelocity = (yaw - lastYaw.current) / (delta || 0.016);
    lastYaw.current = yaw;

    let visualHeading = yaw;
    if (left && !backward) visualHeading += Math.PI / 8;
    if (right && !backward) visualHeading -= Math.PI / 8;

    const angleDiff = visualHeading - yaw + Math.PI;
    const normalizedAngle = (angleDiff + (Math.PI * 4)) % (Math.PI * 2);
    let octant = Math.round(normalizedAngle / (Math.PI / 4)) % 8;

    if (octant === 0 || octant === 1 || octant === 7) {
      octant = (left || (!left && !right && velocity.x < 0) || yawVelocity > 0) ? 6 : 2;
    }

    const isShooting = (Date.now() - lastShootTime.current) < 150;
    const activeTexture = isShooting ? shootTexture : textures[octant];
    if (materialRef.current && materialRef.current.map !== activeTexture) {
      materialRef.current.map = activeTexture;
      materialRef.current.needsUpdate = true;
    }

    if (Date.now() - lastSync.current > 50) {
      socket.emit('updateState', {
        position: [playerPos.x, playerPos.y, playerPos.z],
        yaw,
        pitch,
      });
      lastSync.current = Date.now();
    }

    if (spriteMeshRef.current) {
      const isMoving = forward || backward || left || right || Math.abs(mobile.moveX) > 0.05 || Math.abs(mobile.moveY) > 0.05;
      if (isMoving && Math.abs(currentVelocity.y) < 0.1) {
        walkTime.current += delta * 15;
        spriteMeshRef.current.rotation.z = Math.sin(walkTime.current) * 0.15;
        spriteMeshRef.current.position.y = baseSpriteYOffset + (Math.abs(Math.sin(walkTime.current)) * 0.2);
      } else {
        walkTime.current = 0;
        spriteMeshRef.current.rotation.x = THREE.MathUtils.lerp(spriteMeshRef.current.rotation.x, 0, delta * 15);
        spriteMeshRef.current.rotation.z = THREE.MathUtils.lerp(spriteMeshRef.current.rotation.z, 0, delta * 15);
        spriteMeshRef.current.position.y = THREE.MathUtils.lerp(spriteMeshRef.current.position.y, baseSpriteYOffset, delta * 15);
      }
    }
  });

  return (
    <RigidBody
      ref={body}
      name="player-local"
      colliders={false}
      mass={1}
      type="dynamic"
      position={[0, 5, 0]}
      lockRotations
      ccd
    >
      <CapsuleCollider args={[1.25, 0.5]} />

      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <mesh ref={spriteMeshRef} position={[0, baseSpriteYOffset, 0]} frustumCulled={false}>
          <planeGeometry args={[2.5, 3.5]} />
          <meshStandardMaterial ref={materialRef} transparent alphaTest={0.5} side={THREE.DoubleSide} />
        </mesh>
      </Billboard>
    </RigidBody>
  );
}

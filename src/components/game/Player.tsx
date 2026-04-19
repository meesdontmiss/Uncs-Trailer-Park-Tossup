import { useEffect, useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, RapierRigidBody, CapsuleCollider } from '@react-three/rapier';
import { useKeyboardControls, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store';
import { assets } from './assets';
import { socket } from '../../lib/socket';
import { playThrowSound, playKillSound, playDeathBassSound } from '../../lib/audio';

const SPEED = 15;
const JUMP_FORCE = 8;
const THROW_POWER = 40;

export function Player() {
  const body = useRef<RapierRigidBody>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const [subscribeKeys, getKeys] = useKeyboardControls();
  const { camera } = useThree();
  const spriteMeshRef = useRef<THREE.Mesh>(null);
  const walkTime = useRef(0);
  
  // Custom camera tracking (Third Person Yaw/Pitch)
  const [yaw, setYaw] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [isDead, setIsDead] = useState(false);
  const yawRef = useRef(yaw);
  const pitchRef = useRef(pitch);
  const lastShootTime = useRef(0);
  const lastSync = useRef(0);

  useEffect(() => {
    const onKill = ({ targetId, killerId }: any) => {
      if (killerId === socket.id) {
         playKillSound();
      }
      if (targetId === socket.id && body.current) {
         // I died!
         setIsDead(true);
         
         // Wait a moment so we can see ourselves fall flat, then respawn
         setTimeout(() => {
            body.current?.setTranslation({ x: (Math.random() - 0.5) * 40, y: 10, z: (Math.random() - 0.5) * 40 }, true);
            body.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
            setIsDead(false);
         }, 3000);
      }
    };
    socket.on('playerKilled', onKill);
    return () => { socket.off('playerKilled', onKill); };
  }, []);

  const textures = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const map = assets.sprites.unc.map(path => {
      const tex = loader.load(path);
      tex.magFilter = THREE.NearestFilter; // Give it that crunchy PS1 vibe
      return tex;
    });
    return map;
  }, []);

  const shootTexture = useMemo(() => {
    const tex = new THREE.TextureLoader().load(assets.sprites.UNC_SHOOT_BACK);
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }, []);
  
  const throwCan = useGameStore(s => s.throwCan);

  useEffect(() => {
    yawRef.current = yaw;
    pitchRef.current = pitch;
  }, [yaw, pitch]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement) {
        setYaw(y => y - e.movementX * 0.002);
        setPitch(p => Math.max(-Math.PI/2.5, Math.min(Math.PI/2.5, p - e.movementY * 0.002)));
      }
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      if (document.pointerLockElement && e.button === 0 && body.current) {
        playThrowSound(); // Pew!
        lastShootTime.current = Date.now(); // Trigger the visual flash
        
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
        
        const velocityArray: [number, number, number] = [forward.x * THROW_POWER, forward.y * THROW_POWER, forward.z * THROW_POWER];
        const spawnArray: [number, number, number] = [spawnPos.x, spawnPos.y, spawnPos.z];

        throwCan(spawnArray, velocityArray, true);
        socket.emit('shoot', { spawnPos: spawnArray, velocity: velocityArray });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [throwCan]);

  const lastYaw = useRef(yaw);

  useFrame((_, delta) => {
    if (!body.current) return;
    
    const { forward, backward, left, right, jump } = getKeys();
    const currentVelocity = body.current.linvel();
    const playerPos = body.current.translation();

    // If dead, lock movement and drop sprite flat to the floor
    if (isDead) {
       body.current.setLinvel({ x: 0, y: Math.min(0, currentVelocity.y), z: 0 }, true);
       if (spriteMeshRef.current) {
          spriteMeshRef.current.rotation.x = THREE.MathUtils.lerp(spriteMeshRef.current.rotation.x, -Math.PI / 2, delta * 15);
          spriteMeshRef.current.position.y = THREE.MathUtils.lerp(spriteMeshRef.current.position.y, -1.5, delta * 15);
       }
       return; // Skip camera update and normal math so we stay looking where we died
    }

    const velocity = new THREE.Vector3(0, 0, 0);

    if (forward) velocity.z -= 1;
    if (backward) velocity.z += 1;
    if (left) velocity.x -= 1;
    if (right) velocity.x += 1;

    velocity.normalize().multiplyScalar(SPEED);
    velocity.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw); 

    body.current.setLinvel({ x: velocity.x, y: currentVelocity.y, z: velocity.z }, true);

    if (jump && Math.abs(currentVelocity.y) < 0.1) {
      body.current.setLinvel({ x: currentVelocity.x, y: JUMP_FORCE, z: currentVelocity.z }, true);
    }
    
    // Safety Net: If somehow clipping out of map, teleport back up
    if (playerPos.y < -15) {
      body.current.setTranslation({ x: 0, y: 10, z: 0 }, true);
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return; 
    }

    const playerPosVec = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
    
    const cameraDistance = 4.0; 
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
    
    const aimTarget = camPos.clone().add(camForward.clone().multiplyScalar(100));
    camera.lookAt(aimTarget);

    // Dynamic rotation math
    const yawVelocity = (yaw - lastYaw.current) / (delta || 0.016);
    lastYaw.current = yaw;

    let visualHeading = yaw;
    
    // Twist shoulders slightly based on input...
    if (left && !backward) visualHeading += Math.PI / 8;
    if (right && !backward) visualHeading -= Math.PI / 8;

    const angleDiff = visualHeading - yaw + Math.PI;
    const normalizedAngle = (angleDiff + Math.PI * 4) % (Math.PI * 2);
    
    let octant = Math.round(normalizedAngle / (Math.PI / 4)) % 8;

    // CLAMP: Do not allow the local player to ever see the Front of their own character (0, 1, 7)
    // To prevent rapid jitter, just lock to the single side profile based on velocity directly
    if (octant === 0 || octant === 1 || octant === 7) {
        octant = (left || (!left && !right && velocity.x < 0) || yawVelocity > 0) ? 6 : 2; 
    }

    // Determine the active texture based on octant and shooting state
    const isShooting = (Date.now() - lastShootTime.current) < 150; // 150ms flash duration
    let activeTexture = textures[octant];
    if (isShooting) {
        activeTexture = shootTexture; // Override with the shoot flash graphic
    }

    if (materialRef.current && materialRef.current.map !== activeTexture) {
      materialRef.current.map = activeTexture;
      materialRef.current.needsUpdate = true;
    }

    // Sync state to 20fps for network performance 
    if (Date.now() - lastSync.current > 50) {
      socket.emit('updateState', {
        position: [playerPos.x, playerPos.y, playerPos.z],
        yaw,
        pitch
      });
      lastSync.current = Date.now();
    }

    // Apply the "South Park" style waddle animation
    if (spriteMeshRef.current) {
      const isMoving = forward || backward || left || right;
      if (isMoving && Math.abs(currentVelocity.y) < 0.1) {
        walkTime.current += delta * 15;
        // Waddle side to side (tilt)
        spriteMeshRef.current.rotation.z = Math.sin(walkTime.current) * 0.15;
        // Bob up and down (bounce)
        spriteMeshRef.current.position.y = Math.abs(Math.sin(walkTime.current)) * 0.2;
      } else {
        walkTime.current = 0;
        spriteMeshRef.current.rotation.x = THREE.MathUtils.lerp(spriteMeshRef.current.rotation.x, 0, delta * 15);
        spriteMeshRef.current.rotation.z = THREE.MathUtils.lerp(spriteMeshRef.current.rotation.z, 0, delta * 15);
        spriteMeshRef.current.position.y = THREE.MathUtils.lerp(spriteMeshRef.current.position.y, 0, delta * 15);
      }
    }
  });

  return (
    <RigidBody 
      ref={body} 
      colliders={false} 
      mass={1} 
      type="dynamic" 
      position={[0, 5, 0]} 
      lockRotations={true} 
      ccd={true}
    >
      <CapsuleCollider args={[1.25, 0.5]} /> 
      
      <Billboard
        follow={true}
        lockX={false}
        lockY={false}
        lockZ={false} 
      >
        <mesh ref={spriteMeshRef} position={[0, 0, 0]}>
          <planeGeometry args={[2.5, 3.5]} />
          <meshStandardMaterial ref={materialRef} transparent alphaTest={0.5} side={THREE.DoubleSide} />
        </mesh>
      </Billboard>
    </RigidBody>
  );
}

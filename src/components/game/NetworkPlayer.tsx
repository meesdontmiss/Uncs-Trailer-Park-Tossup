import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { assets } from './assets';
import { socket } from '../../lib/socket';

export function NetworkPlayer({ id, initialData }: any) {
  const { camera } = useThree();
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const spriteMeshRef = useRef<THREE.Mesh>(null);
  const walkTime = useRef(0);
  const [isDead, setIsDead] = useState(false);
  
  const positionRef = useRef(new THREE.Vector3().fromArray(initialData.position || [0, 5, 0]));
  const targetPosition = useRef(new THREE.Vector3().fromArray(initialData.position || [0, 5, 0]));
  const yawRef = useRef(initialData.yaw || 0);
  
  const isShootingRef = useRef(false);
  const shootTimeout = useRef<any>(null);

  const textures = useMemo(() => {
    const loader = new THREE.TextureLoader();
    return assets.sprites.unc.map(path => {
      const tex = loader.load(path);
      tex.magFilter = THREE.NearestFilter;
      return tex;
    });
  }, []);

  const shootTexture = useMemo(() => {
    const tex = new THREE.TextureLoader().load(assets.sprites.UNC_SHOOT_BACK);
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }, []);

  useEffect(() => {
    const onMove = (data: any) => {
      if (data.id === id) {
        targetPosition.current.set(...data.position);
        yawRef.current = data.yaw;
      }
    };
    
    const onShoot = (data: any) => {
      if (data.id === id) {
        isShootingRef.current = true;
        if (shootTimeout.current) clearTimeout(shootTimeout.current);
        shootTimeout.current = setTimeout(() => { isShootingRef.current = false; }, 150);
      }
    };

    const onKill = (data: any) => {
      if (data.targetId === id) {
        setIsDead(true);
        setTimeout(() => setIsDead(false), 3000); // 3 seconds matching local code
      }
    };

    socket.on('playerMoved', onMove);
    socket.on('playerShot', onShoot);
    socket.on('playerKilled', onKill);
    return () => {
      socket.off('playerMoved', onMove);
      socket.off('playerShot', onShoot);
      socket.off('playerKilled', onKill);
    };
  }, [id]);

  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Smoothly interpolate position
    positionRef.current.lerp(targetPosition.current, 0.2);
    groupRef.current.position.copy(positionRef.current);

    // Sprite math: compare remote player yaw with angle to local camera
    const deltaX = camera.position.x - positionRef.current.x;
    const deltaZ = camera.position.z - positionRef.current.z;
    const angleToCamera = Math.atan2(deltaX, deltaZ); 

    let relativeAngle = yawRef.current - angleToCamera;
    relativeAngle = (relativeAngle + Math.PI * 4) % (Math.PI * 2);

    let octant = Math.round(relativeAngle / (Math.PI / 4)) % 8;
    if (octant < 0) octant += 8;

    let activeTexture = textures[octant];
    if (isShootingRef.current) {
      activeTexture = shootTexture;
    }

    if (materialRef.current && materialRef.current.map !== activeTexture) {
      materialRef.current.map = activeTexture;
      materialRef.current.needsUpdate = true;
    }

    if (isDead) {
       if (spriteMeshRef.current) {
          spriteMeshRef.current.rotation.x = THREE.MathUtils.lerp(spriteMeshRef.current.rotation.x, -Math.PI / 2, delta * 15);
          spriteMeshRef.current.position.y = THREE.MathUtils.lerp(spriteMeshRef.current.position.y, -3, delta * 15);
       }
       return;
    }

    // Apply the "South Park" style waddle animation for remote players
    if (spriteMeshRef.current) {
      const dist = positionRef.current.distanceTo(targetPosition.current);
      if (dist > 0.05) {
        walkTime.current += delta * 15;
        spriteMeshRef.current.rotation.x = THREE.MathUtils.lerp(spriteMeshRef.current.rotation.x, 0, delta * 15);
        spriteMeshRef.current.rotation.z = Math.sin(walkTime.current) * 0.15;
        // Base position offset in NetworkPlayer is -1.25, so we add the hop to that
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
    <group ref={groupRef}>
      {/* Kinematic body acts as a solid target for local physics simulations without getting bumped around */}
      <RigidBody
         type="kinematicPosition"
         colliders="hull" 
         name={`remote-${id}`}
         onCollisionEnter={(payload) => {
           // If the local player's can hits this remote player, claim the kill!
           if (payload.other.rigidBodyObject?.name === 'can-local') {
             socket.emit('hit', id); 
           }
         }}
      >
        <mesh visible={false} position={[0,0,0]}>
          <capsuleGeometry args={[1.25, 0.5]} />
        </mesh>
        
        <Billboard follow={true}>
          <mesh ref={spriteMeshRef} position={[0, -1.25, 0]}>
            <planeGeometry args={[2.5, 3.5]} />
            <meshStandardMaterial ref={materialRef} transparent alphaTest={0.5} side={THREE.DoubleSide} />
          </mesh>
        </Billboard>
      </RigidBody>
    </group>
  );
}

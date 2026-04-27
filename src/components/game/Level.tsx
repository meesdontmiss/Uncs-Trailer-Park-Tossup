import { useMemo, useRef } from 'react';
import { RigidBody } from '@react-three/rapier';
import { Billboard, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { assets } from './assets';
import { carPlacements, clutterPlacements, couchPlacements, coverPlacements, trailerPlacements } from '../../arena';

// --------------------------------------------------------
// Custom Map Props (Composed 3D Shapes)
// --------------------------------------------------------

const clutterCanOffsets: [number, number, number][] = [
  [-1.6, 0.05, -0.9],
  [0.4, 0.05, -1.1],
  [1.1, 0.05, 0.2],
  [-0.7, 0.05, 1.1],
  [1.5, 0.05, 1.3],
];

const clutterButtOffsets: [number, number, number][] = [
  [-1.4, 0.02, 0.8],
  [-0.5, 0.02, -1.3],
  [0.2, 0.02, 0.3],
  [0.9, 0.02, -0.7],
  [1.3, 0.02, 1.1],
  [-1, 0.02, -0.1],
  [0.6, 0.02, 1.5],
  [1.7, 0.02, -1.4],
];

const groundDecalPlacements: Array<{
  position: [number, number, number];
  scale: [number, number];
  rotationY: number;
}> = [
  { position: [-6, 0.08, -48], scale: [9, 9], rotationY: 0.2 },
  { position: [6, 0.08, -20], scale: [8, 8], rotationY: -0.7 },
  { position: [-7, 0.08, 8], scale: [7, 7], rotationY: 1.1 },
  { position: [5, 0.08, 34], scale: [8.5, 8.5], rotationY: -1.4 },
  { position: [0, 0.08, 59], scale: [7, 7], rotationY: 0.8 },
];

const treePlacements: Array<{ position: [number, number, number]; scale: number }> = [
  { position: [-62, 0, -58], scale: 1.25 },
  { position: [-58, 0, -24], scale: 1.05 },
  { position: [-61, 0, 22], scale: 1.18 },
  { position: [-53, 0, 58], scale: 0.95 },
  { position: [58, 0, -54], scale: 1.12 },
  { position: [63, 0, -18], scale: 0.9 },
  { position: [57, 0, 26], scale: 1.22 },
  { position: [62, 0, 60], scale: 1.05 },
  { position: [-30, 0, 68], scale: 0.9 },
  { position: [35, 0, -68], scale: 1.0 },
  { position: [-42, 0, -6], scale: 0.82 },
  { position: [42, 0, 8], scale: 0.88 },
  { position: [-36, 0, 33], scale: 0.78 },
  { position: [36, 0, -33], scale: 0.82 },
];

const chairPlacements: Array<{ position: [number, number, number]; rotationY: number; color: string }> = [
  { position: [-11, 0.08, -14], rotationY: 0.35, color: '#f0d25b' },
  { position: [-18, 0.08, 18], rotationY: -0.65, color: '#9fb6c7' },
  { position: [14, 0.08, -24], rotationY: 0.9, color: '#d87952' },
  { position: [18, 0.08, 12], rotationY: -1.1, color: '#87a35d' },
  { position: [7, 0.08, 48], rotationY: 0.25, color: '#d8c7a2' },
  { position: [-6, 0.08, -48], rotationY: -0.2, color: '#c9dc75' },
  { position: [6, 0.08, -52], rotationY: 0.3, color: '#70a6b8' },
];

const chickenPlacements: Array<{ origin: [number, number, number]; radius: number; speed: number; phase: number }> = [
  { origin: [-8, 0.18, -36], radius: 3.2, speed: 0.8, phase: 0 },
  { origin: [4, 0.18, -34], radius: 2.1, speed: 1.1, phase: 0.8 },
  { origin: [10, 0.18, -8], radius: 2.6, speed: 1.05, phase: 1.7 },
  { origin: [-6, 0.18, 28], radius: 3.8, speed: 0.65, phase: 3.2 },
  { origin: [16, 0.18, 42], radius: 2.4, speed: 0.95, phase: 4.1 },
];

function makeBillboardTexture(kind: 'tree' | 'chicken') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  ctx.clearRect(0, 0, 256, 256);
  if (kind === 'tree') {
    ctx.fillStyle = '#5a3e24';
    ctx.fillRect(113, 112, 30, 104);
    ctx.fillStyle = '#3f2a19';
    ctx.fillRect(128, 118, 9, 98);
    ctx.fillStyle = '#314f29';
    ctx.beginPath();
    ctx.ellipse(124, 94, 70, 55, -0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#496f37';
    ctx.beginPath();
    ctx.ellipse(91, 112, 45, 35, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5f8846';
    ctx.beginPath();
    ctx.ellipse(153, 108, 53, 40, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(25,32,18,0.55)';
    ctx.lineWidth = 5;
    ctx.stroke();
  } else {
    ctx.fillStyle = '#ead7aa';
    ctx.beginPath();
    ctx.ellipse(122, 146, 52, 34, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(164, 118, 25, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c73523';
    ctx.beginPath();
    ctx.arc(166, 94, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e89925';
    ctx.beginPath();
    ctx.moveTo(188, 119);
    ctx.lineTo(217, 128);
    ctx.lineTo(188, 137);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5f3e1f';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(102, 173);
    ctx.lineTo(94, 210);
    ctx.moveTo(140, 172);
    ctx.lineTo(148, 210);
    ctx.stroke();
    ctx.fillStyle = '#1b1510';
    ctx.beginPath();
    ctx.arc(172, 114, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(61,40,25,0.65)';
    ctx.lineWidth = 4;
    ctx.strokeRect(78, 91, 111, 91);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function ParkSign3D({ texture }: { texture: THREE.Texture }) {
  return (
    <Billboard position={[0, 5.25, -70]} follow lockX lockZ>
      <mesh>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial
          map={texture}
          transparent
          alphaTest={0.08}
          side={THREE.DoubleSide}
          roughness={0.9}
        />
      </mesh>
    </Billboard>
  );
}

function Clutter3D({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Scattered beer cans */}
      {clutterCanOffsets.map((offset, i) => (
        <mesh 
          key={`can-${i}`} 
          position={offset}
          rotation={[0.35 * (i + 1), 0.6 * (i + 1), 0.2 * (i + 1)]}
        >
          <cylinderGeometry args={[0.08, 0.08, 0.25, 8]} />
          <meshStandardMaterial color="#b0b0b0" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      
      {/* Scattered cigarette butts */}
      {clutterButtOffsets.map((offset, i) => (
        <mesh 
          key={`butt-${i}`} 
          position={offset}
          rotation={[Math.PI / 2, 0.45 * (i + 1), 0]}
        >
          <cylinderGeometry args={[0.02, 0.02, 0.1, 4]} />
          <meshStandardMaterial color="#e6a46a" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Trailer3D({
  position,
  rotation = [0, 0, 0],
  color = '#bfbaad',
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
}) {
  return (
    <RigidBody type="fixed" colliders="cuboid" position={position} rotation={rotation}>
      {/* Main Body */}
      <mesh castShadow receiveShadow position={[0, 2, 0]}>
        <boxGeometry args={[10, 4, 24]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {/* Roof */}
      <mesh castShadow receiveShadow position={[0, 4.25, 0]}>
        <boxGeometry args={[10.5, 0.5, 24.5]} />
        <meshStandardMaterial color="#8c8c8c" roughness={0.9} />
      </mesh>
      {/* Deck/Porch */}
      <mesh castShadow receiveShadow position={[7, 0.5, 0]}>
        <boxGeometry args={[4, 1, 8]} />
        <meshStandardMaterial color="#6b5035" roughness={0.9} />
      </mesh>
      {/* Stairs */}
      <mesh castShadow receiveShadow position={[9.5, 0.25, 0]}>
        <boxGeometry args={[1, 0.5, 4]} />
        <meshStandardMaterial color="#6b5035" roughness={0.9} />
      </mesh>
      {/* Door */}
      <mesh castShadow position={[5.05, 2, 0]}>
        <boxGeometry args={[0.1, 3, 2]} />
        <meshStandardMaterial color="#4a4a4a" />
      </mesh>
    </RigidBody>
  );
}

function Car3D({
  position,
  rotation = [0, 0, 0],
  color = '#8a3f33',
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
}) {
  return (
    <RigidBody type="fixed" colliders="cuboid" position={position} rotation={rotation}>
      {/* Base */}
      <mesh castShadow receiveShadow position={[0, 0.75, 0]}>
        <boxGeometry args={[4, 1.5, 10]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.6} />
      </mesh>
      {/* Cabin */}
      <mesh castShadow receiveShadow position={[0, 2, -1]}>
        <boxGeometry args={[3.8, 1.5, 5]} />
        <meshStandardMaterial color="#222" roughness={0.1} metalness={0.8} />
      </mesh>
    </RigidBody>
  );
}

function Couch3D({
  position,
  rotation = [0, 0, 0],
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <RigidBody type="fixed" colliders="cuboid" position={position} rotation={rotation}>
      <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[4, 1, 2]} />
        <meshStandardMaterial color="#6c7a4b" roughness={0.9} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 1.5, -0.75]}>
        <boxGeometry args={[4, 1.5, 0.5]} />
        <meshStandardMaterial color="#58633c" roughness={0.9} />
      </mesh>
    </RigidBody>
  );
}

function CoverStack3D({
  position,
  rotation = [0, 0, 0],
  color = '#5f6b46',
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
}) {
  return (
    <RigidBody type="fixed" colliders="cuboid" position={position} rotation={rotation}>
      <mesh castShadow receiveShadow position={[0, 0.65, 0]}>
        <boxGeometry args={[5, 1.3, 2.4]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      <mesh castShadow receiveShadow position={[-1.15, 1.65, 0.18]} rotation={[Math.PI / 2, 0.25, 0]}>
        <cylinderGeometry args={[0.62, 0.62, 1.1, 16]} />
        <meshStandardMaterial color="#1d1d1b" roughness={0.78} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.1, 1.64, -0.12]} rotation={[Math.PI / 2, -0.18, 0]}>
        <cylinderGeometry args={[0.62, 0.62, 1.1, 16]} />
        <meshStandardMaterial color="#24241f" roughness={0.78} />
      </mesh>
      <mesh castShadow receiveShadow position={[1.35, 1.65, 0.15]} rotation={[Math.PI / 2, 0.35, 0]}>
        <cylinderGeometry args={[0.62, 0.62, 1.1, 16]} />
        <meshStandardMaterial color="#191917" roughness={0.78} />
      </mesh>
    </RigidBody>
  );
}

function TreeBillboard({ texture, position, scale }: { texture: THREE.Texture; position: [number, number, number]; scale: number }) {
  return (
    <Billboard position={[position[0], position[1] + (5.2 * scale), position[2]]} follow lockX lockZ>
      <mesh castShadow>
        <planeGeometry args={[8 * scale, 11 * scale]} />
        <meshStandardMaterial
          map={texture}
          transparent
          alphaTest={0.08}
          side={THREE.DoubleSide}
          roughness={1}
        />
      </mesh>
    </Billboard>
  );
}

function LawnChair3D({ position, rotationY, color }: { position: [number, number, number]; rotationY: number; color: string }) {
  const frameColor = '#d8d0bd';
  const shadowColor = new THREE.Color(color).offsetHSL(0, -0.1, -0.16).getStyle();

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.44, 0.16]} rotation={[-0.18, 0, 0]}>
        <boxGeometry args={[1.9, 0.08, 1.25]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 1.14, -0.55]} rotation={[0.48, 0, 0]}>
        <boxGeometry args={[1.9, 0.08, 1.5]} />
        <meshStandardMaterial color={color} roughness={0.88} />
      </mesh>
      {[-0.52, 0, 0.52].map((x) => (
        <mesh key={`strap-seat-${x}`} castShadow receiveShadow position={[x, 0.5, 0.17]} rotation={[-0.18, 0, 0]}>
          <boxGeometry args={[0.08, 0.1, 1.32]} />
          <meshStandardMaterial color={shadowColor} roughness={0.95} />
        </mesh>
      ))}
      {[-0.48, 0.48].map((x) => (
        <mesh key={`strap-back-${x}`} castShadow receiveShadow position={[x, 1.18, -0.56]} rotation={[0.48, 0, 0]}>
          <boxGeometry args={[0.1, 0.1, 1.55]} />
          <meshStandardMaterial color={shadowColor} roughness={0.95} />
        </mesh>
      ))}
      {[
        [-0.86, 0.54, 0.65, -0.22],
        [0.86, 0.54, 0.65, 0.22],
        [-0.86, 0.86, -0.74, 0.16],
        [0.86, 0.86, -0.74, -0.16],
      ].map(([x, y, z, tilt], index) => (
        <mesh key={`leg-${index}`} castShadow receiveShadow position={[x, y, z]} rotation={[tilt, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 1.25, 10]} />
          <meshStandardMaterial color={frameColor} roughness={0.55} metalness={0.35} />
        </mesh>
      ))}
      {[
        [0, 0.86, 0.78, Math.PI / 2],
        [0, 1.56, -1.02, Math.PI / 2],
        [-0.96, 1, -0.08, 0],
        [0.96, 1, -0.08, 0],
      ].map(([x, y, z, rz], index) => (
        <mesh key={`rail-${index}`} castShadow receiveShadow position={[x, y, z]} rotation={[0, 0, rz]}>
          <cylinderGeometry args={[0.04, 0.04, 1.95, 10]} />
          <meshStandardMaterial color={frameColor} roughness={0.55} metalness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function Chicken3D({
  origin,
  radius,
  speed,
  phase,
}: {
  origin: [number, number, number];
  radius: number;
  speed: number;
  phase: number;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!group.current) {
      return;
    }

    const t = (clock.elapsedTime * speed) + phase;
    const x = origin[0] + Math.cos(t) * radius;
    const z = origin[2] + Math.sin(t * 0.7) * radius;
    const nextX = origin[0] + Math.cos(t + 0.02) * radius;
    const nextZ = origin[2] + Math.sin((t + 0.02) * 0.7) * radius;

    group.current.position.set(
      x,
      origin[1] + Math.abs(Math.sin(t * 7)) * 0.08,
      z,
    );
    group.current.rotation.y = Math.atan2(nextX - x, nextZ - z);
  });

  return (
    <group ref={group} position={origin}>
      <mesh castShadow position={[0, 0.34, 0]} scale={[0.62, 0.42, 0.45]}>
        <sphereGeometry args={[1, 18, 12]} />
        <meshStandardMaterial color="#ead7aa" roughness={0.86} />
      </mesh>
      <mesh castShadow position={[0, 0.62, 0.45]} scale={[0.34, 0.32, 0.32]}>
        <sphereGeometry args={[1, 16, 10]} />
        <meshStandardMaterial color="#f0dfbd" roughness={0.86} />
      </mesh>
      <mesh castShadow position={[0, 0.95, 0.42]} rotation={[0.2, 0, 0]} scale={[0.17, 0.1, 0.14]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color="#c73523" roughness={0.72} />
      </mesh>
      <mesh castShadow position={[0, 0.61, 0.82]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.12, 0.28, 4]} />
        <meshStandardMaterial color="#e89925" roughness={0.68} />
      </mesh>
      <mesh position={[-0.1, 0.67, 0.75]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial color="#11100d" roughness={0.4} />
      </mesh>
      <mesh position={[0.1, 0.67, 0.75]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial color="#11100d" roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0, 0.34, -0.48]} rotation={[-0.45, 0, 0]} scale={[0.38, 0.18, 0.26]}>
        <sphereGeometry args={[1, 14, 8]} />
        <meshStandardMaterial color="#d6be8d" roughness={0.9} />
      </mesh>
      {[-0.16, 0.16].map((x) => (
        <group key={`leg-${x}`} position={[x, 0.09, 0.08]}>
          <mesh castShadow rotation={[0.12, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.32, 6]} />
            <meshStandardMaterial color="#de8d20" roughness={0.75} />
          </mesh>
          <mesh castShadow position={[0, -0.17, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.2, 6]} />
            <meshStandardMaterial color="#de8d20" roughness={0.75} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// --------------------------------------------------------
// The Level
// --------------------------------------------------------

export function Level() {
  const treeTexture = useMemo(() => makeBillboardTexture('tree'), []);
  const props = useTexture({
    grass: assets.terrain.grass,
    dirt: assets.terrain.dirt,
    groundClutter: assets.terrain.groundClutter,
    parkSign: assets.terrain.parkSign,
  });

  props.grass.wrapS = props.grass.wrapT = THREE.RepeatWrapping;
  props.grass.repeat.set(40, 40);
  
  props.dirt.wrapS = props.dirt.wrapT = THREE.RepeatWrapping;
  props.dirt.repeat.set(10, 30);
  props.groundClutter.anisotropy = 8;
  props.parkSign.anisotropy = 8;

  return (
    <group>
      {/* Main Ground */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.5, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[150, 1, 150]} />
          <meshStandardMaterial map={props.grass} color="#9fc47b" roughness={0.92} />
        </mesh>
      </RigidBody>

      {/* Dirt Road cutting through the park */}
      <mesh receiveShadow position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 150]} />
        <meshStandardMaterial map={props.dirt} color="#6b6045" roughness={1} />
      </mesh>

      {groundDecalPlacements.map((decal, index) => (
        <mesh
          key={`ground-decal-${index}`}
          position={decal.position}
          rotation={[-Math.PI / 2, 0, decal.rotationY]}
          renderOrder={2}
        >
          <planeGeometry args={decal.scale} />
          <meshStandardMaterial
            map={props.groundClutter}
            transparent
            alphaTest={0.08}
            depthWrite={false}
            roughness={1}
          />
        </mesh>
      ))}

      <ParkSign3D texture={props.parkSign} />

      {treePlacements.map((tree, index) => (
        <TreeBillboard
          key={`tree-${index}`}
          texture={treeTexture}
          position={tree.position}
          scale={tree.scale}
        />
      ))}

      {chairPlacements.map((chair, index) => (
        <LawnChair3D
          key={`chair-${index}`}
          position={chair.position}
          rotationY={chair.rotationY}
          color={chair.color}
        />
      ))}

      {chickenPlacements.map((chicken, index) => (
        <Chicken3D
          key={`chicken-${index}`}
          origin={chicken.origin}
          radius={chicken.radius}
          speed={chicken.speed}
          phase={chicken.phase}
        />
      ))}

      {/* Invisible boundaries to keep the player inside the map */}
      {/* Expanding the map outward to give more roaming room */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, 5, -75]}>
        <mesh visible={false}><boxGeometry args={[150, 20, 1]} /></mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" position={[0, 5, 75]}>
        <mesh visible={false}><boxGeometry args={[150, 20, 1]} /></mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" position={[-75, 5, 0]}>
        <mesh visible={false}><boxGeometry args={[1, 20, 150]} /></mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" position={[75, 5, 0]}>
        <mesh visible={false}><boxGeometry args={[1, 20, 150]} /></mesh>
      </RigidBody>

      {/* Wooden Fences around the outer edge */}
      {[-75, 75].map((z) => (
        <RigidBody type="fixed" colliders="cuboid" key={`fence-z-${z}`}>
          <mesh castShadow receiveShadow position={[0, 1.5, z]}>
            <boxGeometry args={[150, 3, 0.5]} />
            <meshStandardMaterial color="#4a3e35" roughness={1} />
          </mesh>
        </RigidBody>
      ))}
      {[-75, 75].map((x) => (
        <RigidBody type="fixed" colliders="cuboid" key={`fence-x-${x}`}>
          <mesh castShadow receiveShadow position={[x, 1.5, 0]}>
            <boxGeometry args={[0.5, 3, 150]} />
            <meshStandardMaterial color="#4a3e35" roughness={1} />
          </mesh>
        </RigidBody>
      ))}

      {/* ------------- Layout ------------- */}
      {/* Main row 1 (Left Side) */}
      {trailerPlacements.slice(0, 4).map((placement, index) => (
        <Trailer3D
          key={`trailer-left-${index}`}
          position={placement.position}
          rotation={[0, placement.rotationY ?? 0, 0]}
          color={placement.color}
        />
      ))}
      
      <Couch3D position={couchPlacements[0].position} rotation={[0, couchPlacements[0].rotationY ?? 0, 0]} />
      <Clutter3D position={clutterPlacements[0].position} />

      {/* Row 2 (Right Side, facing road) */}
      {trailerPlacements.slice(4).map((placement, index) => (
        <Trailer3D
          key={`trailer-right-${index}`}
          position={placement.position}
          rotation={[0, placement.rotationY ?? 0, 0]}
          color={placement.color}
        />
      ))}
      
      <Couch3D position={couchPlacements[1].position} rotation={[0, couchPlacements[1].rotationY ?? 0, 0]} />
      <Clutter3D position={clutterPlacements[1].position} />
      
      {/* Cars parked scattered */}
      {carPlacements.map((placement, index) => (
        <Car3D
          key={`car-${index}`}
          position={placement.position}
          rotation={[0, placement.rotationY ?? 0, 0]}
          color={placement.color}
        />
      ))}

      {coverPlacements.map((placement, index) => (
        <CoverStack3D
          key={`cover-${index}`}
          position={placement.position}
          rotation={[0, placement.rotationY ?? 0, 0]}
          color={placement.color}
        />
      ))}

      {/* Some random clutter spots */}
      {clutterPlacements.slice(2).map((placement, index) => (
        <Clutter3D key={`clutter-${index}`} position={placement.position} />
      ))}
      
    </group>
  );
}

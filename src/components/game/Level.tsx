import { RigidBody } from '@react-three/rapier';
import { Billboard, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { assets } from './assets';
import { carPlacements, clutterPlacements, couchPlacements, trailerPlacements } from '../../arena';

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

// --------------------------------------------------------
// The Level
// --------------------------------------------------------

export function Level() {
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
          <meshStandardMaterial map={props.grass} color="#8ab56e" />
        </mesh>
      </RigidBody>

      {/* Dirt Road cutting through the park */}
      <mesh receiveShadow position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 150]} />
        <meshStandardMaterial map={props.dirt} color="#5e4933" roughness={1} />
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

      {/* Some random clutter spots */}
      {clutterPlacements.slice(2).map((placement, index) => (
        <Clutter3D key={`clutter-${index}`} position={placement.position} />
      ))}
      
    </group>
  );
}

import { RigidBody } from '@react-three/rapier';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

// --------------------------------------------------------
// Custom Map Props (Composed 3D Shapes)
// --------------------------------------------------------

function Clutter3D({ position }: any) {
  return (
    <group position={position}>
      {/* Scattered beer cans */}
      {[...Array(5)].map((_, i) => (
        <mesh 
          key={`can-${i}`} 
          position={[(Math.random() - 0.5) * 4, 0.05, (Math.random() - 0.5) * 4]} 
          rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]}
        >
          <cylinderGeometry args={[0.08, 0.08, 0.25, 8]} />
          <meshStandardMaterial color="#b0b0b0" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      
      {/* Scattered cigarette butts */}
      {[...Array(8)].map((_, i) => (
        <mesh 
          key={`butt-${i}`} 
          position={[(Math.random() - 0.5) * 4, 0.02, (Math.random() - 0.5) * 4]} 
          rotation={[Math.PI / 2, Math.random() * Math.PI, 0]}
        >
          <cylinderGeometry args={[0.02, 0.02, 0.1, 4]} />
          <meshStandardMaterial color="#e6a46a" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Trailer3D({ position, rotation = [0, 0, 0], color = "#bfbaad" }: any) {
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

function Car3D({ position, rotation = [0, 0, 0], color = "#8a3f33" }: any) {
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

function Couch3D({ position, rotation = [0, 0, 0] }: any) {
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
  // Use raw GitHub CDN URLs to ensure we get some nice basic HD textures without needing massive public/ uploads
  const props = useTexture({
    grass: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r149/examples/textures/terrain/grasslight-big.jpg',
    dirt: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r149/examples/textures/terrain/grasslight-big.jpg' // Re-using grass texture but we will color-tint it for dirt!
  });

  props.grass.wrapS = props.grass.wrapT = THREE.RepeatWrapping;
  props.grass.repeat.set(40, 40);
  
  props.dirt.wrapS = props.dirt.wrapT = THREE.RepeatWrapping;
  props.dirt.repeat.set(10, 30);

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
      <Trailer3D position={[-25, 0, -50]} color="#b8c2a3" />
      <Trailer3D position={[-25, 0, -20]} color="#d3d3d3" />
      <Trailer3D position={[-25, 0, 10]} color="#a3b8c2" />
      <Trailer3D position={[-25, 0, 40]} color="#c2bda3" />
      
      <Couch3D position={[-16, 0.5, -10]} rotation={[0, 0.4, 0]} />
      <Clutter3D position={[-16, 0, -9]} />

      {/* Row 2 (Right Side, facing road) */}
      <Trailer3D position={[25, 0, -40]} rotation={[0, Math.PI, 0]} color="#b2c2a3" />
      <Trailer3D position={[25, 0, -10]} rotation={[0, Math.PI, 0]} color="#d3d3d3" />
      <Trailer3D position={[25, 0, 20]} rotation={[0, Math.PI, 0]} color="#a3a8c2" />
      <Trailer3D position={[25, 0, 50]} rotation={[0, Math.PI, 0]} color="#c2a3a3" />
      
      <Couch3D position={[15, 0.5, 30]} rotation={[0, -0.2, 0]} />
      <Clutter3D position={[15, 0, 28]} />
      
      {/* Cars parked scattered */}
      <Car3D position={[-12, 0, -35]} rotation={[0, 0.5, 0]} color="#8a3f33" />
      <Car3D position={[12, 0, 0]} rotation={[0, -0.3, 0]} color="#334d8a" />
      <Car3D position={[-12, 0, 25]} rotation={[0, 1.2, 0]} color="#8a7933" />
      <Car3D position={[10, 0, 40]} rotation={[0, -1.5, 0]} color="#4a4a4a" />

      {/* Some random clutter spots */}
      <Clutter3D position={[0, 0, 10]} />
      <Clutter3D position={[-5, 0, -25]} />
      <Clutter3D position={[8, 0, -40]} />
      
    </group>
  );
}

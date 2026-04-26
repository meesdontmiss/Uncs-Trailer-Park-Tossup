import type { Vec3 } from './gameTypes';

export interface ArenaPlacement {
  position: Vec3;
  rotationY?: number;
  color?: string;
}

export interface ArenaCollider {
  id: string;
  center: Vec3;
  halfSize: Vec3;
  rotationY?: number;
}

export const ARENA_HALF_EXTENT = 75;

export const arenaSpawnPoints: Vec3[] = [
  [-52, 4, -60],
  [52, 4, -60],
  [-52, 4, 60],
  [52, 4, 60],
  [-8, 4, -62],
  [8, 4, -62],
  [-8, 4, 62],
  [8, 4, 62],
];

export const trailerPlacements: ArenaPlacement[] = [
  { position: [-25, 0, -50], color: '#b8c2a3' },
  { position: [-25, 0, -20], color: '#d3d3d3' },
  { position: [-25, 0, 10], color: '#a3b8c2' },
  { position: [-25, 0, 40], color: '#c2bda3' },
  { position: [25, 0, -40], rotationY: Math.PI, color: '#b2c2a3' },
  { position: [25, 0, -10], rotationY: Math.PI, color: '#d3d3d3' },
  { position: [25, 0, 20], rotationY: Math.PI, color: '#a3a8c2' },
  { position: [25, 0, 50], rotationY: Math.PI, color: '#c2a3a3' },
];

export const couchPlacements: ArenaPlacement[] = [
  { position: [-16, 0.5, -10], rotationY: 0.4 },
  { position: [15, 0.5, 30], rotationY: -0.2 },
];

export const carPlacements: ArenaPlacement[] = [
  { position: [-12, 0, -35], rotationY: 0.5, color: '#8a3f33' },
  { position: [12, 0, 0], rotationY: -0.3, color: '#334d8a' },
  { position: [-12, 0, 25], rotationY: 1.2, color: '#8a7933' },
  { position: [10, 0, 40], rotationY: -1.5, color: '#4a4a4a' },
];

export const clutterPlacements: ArenaPlacement[] = [
  { position: [-16, 0, -9] },
  { position: [15, 0, 28] },
  { position: [0, 0, 10] },
  { position: [-5, 0, -25] },
  { position: [8, 0, -40] },
];

export const arenaColliders: ArenaCollider[] = [
  ...trailerPlacements.map((placement, index) => ({
    id: `trailer-${index}`,
    center: [placement.position[0], 2.25, placement.position[2]] as Vec3,
    halfSize: [5.25, 2.25, 12.25] as Vec3,
    rotationY: placement.rotationY ?? 0,
  })),
  ...carPlacements.map((placement, index) => ({
    id: `car-${index}`,
    center: [placement.position[0], 1.5, placement.position[2]] as Vec3,
    halfSize: [2, 1.5, 5] as Vec3,
    rotationY: placement.rotationY ?? 0,
  })),
  ...couchPlacements.map((placement, index) => ({
    id: `couch-${index}`,
    center: [placement.position[0], 1.25, placement.position[2]] as Vec3,
    halfSize: [2, 1.25, 1] as Vec3,
    rotationY: placement.rotationY ?? 0,
  })),
  {
    id: 'north-boundary',
    center: [0, 5, -75] as Vec3,
    halfSize: [75, 10, 0.5],
  },
  {
    id: 'south-boundary',
    center: [0, 5, 75] as Vec3,
    halfSize: [75, 10, 0.5],
  },
  {
    id: 'west-boundary',
    center: [-75, 5, 0] as Vec3,
    halfSize: [0.5, 10, 75],
  },
  {
    id: 'east-boundary',
    center: [75, 5, 0] as Vec3,
    halfSize: [0.5, 10, 75],
  },
];

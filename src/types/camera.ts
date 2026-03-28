export type CameraType = 'perspective' | 'orthographic';

export type CameraCategory = 
  | 'Editor Orbit'
  | 'Indoor Walkthrough'
  | 'Outdoor Explore'
  | 'Gameplay Follow'
  | 'Broadcast Side View'
  | 'Broadcast Overhead'
  | 'Race Start View'
  | 'Finish View'
  | 'Entrance Camera'
  | 'Replay Camera'
  | 'Cinematic Showcase'
  | 'Swimming: Poolside'
  | 'Swimming: Top-down Lane'
  | 'Swimming: Race Start'
  | 'Swimming: Underwater'
  | 'Swimming: Finish Line'
  | 'Swimming: Podium'
  | 'Swimming: Training'
  | 'Swimming: Entrance'
  | 'Custom';

export interface CameraPreset {
  id: string;
  name: string;
  category: CameraCategory;
  type: CameraType;
  position: [number, number, number];
  rotation: [number, number, number];
  target: [number, number, number];
  fov: number;
  zoom?: number;
  near: number;
  far: number;
  sensitivity: number;
  orbitLimits?: {
    minAzimuth: number;
    maxAzimuth: number;
    minPolar: number;
    maxPolar: number;
    minDistance: number;
    maxDistance: number;
  };
  panLimits?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  indoorRestrictions?: boolean;
}

export interface CameraPathPoint {
  id: string;
  position: [number, number, number];
  target: [number, number, number];
  duration: number; // Duration to reach this point from previous
  pause?: number; // Optional pause at this point
  fov?: number;
}

export interface CameraPath {
  id: string;
  name: string;
  category: CameraCategory;
  points: CameraPathPoint[];
  loop?: boolean;
  interpolation: 'linear' | 'smooth';
}

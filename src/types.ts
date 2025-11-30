import * as THREE from 'three';

export type SnapType = 'vertex' | 'edge' | 'midpoint' | 'centroid' | 'face' | 'none';

export interface SnapResult {
  point: THREE.Vector3;
  type: SnapType;
  distance: number;
  object: THREE.Object3D;
  edgeVertices?: [THREE.Vector3, THREE.Vector3];
}

export type DimensionType = 'linear' | 'aligned' | 'angle' | 'leader';

export interface DimensionStyle {
  color: string; 
  fontSize: number;
  scale: number;
  depthTest: boolean;
  offset: number; 
  units: 'm' | 'mm' | 'ft';
  textBgColor: string | null; // null for transparent
  textMode: 'horizontal' | 'aligned';
}

export interface DimensionData {
  id: number;
  type: DimensionType;
  start: THREE.Vector3;
  end: THREE.Vector3; // For Angle: P1. For Leader: Elbow.
  offsetPoint: THREE.Vector3; // For Angle: P2. For Leader: End/Text Pos.
  angleP2?: THREE.Vector3;
  text?: string; // Custom text for leader
}

export interface CPlane {
  origin: THREE.Vector3;
  normal: THREE.Vector3;
}

export interface DimensionOptions {
  color?: string;
  fontSize?: number;
  units?: 'm' | 'mm' | 'ft';
}

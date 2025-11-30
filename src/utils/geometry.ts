import * as THREE from 'three';

export function getClosestPointOnLineSegment(point: THREE.Vector3, start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3 {
  const line = new THREE.Line3(start, end);
  const target = new THREE.Vector3();
  line.closestPointToPoint(point, true, target);
  return target;
}

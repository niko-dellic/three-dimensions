import * as THREE from 'three';
import { SnapResult } from './types';
import { getClosestPointOnLineSegment } from './utils/geometry';

export class SnappingManager {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private raycaster: THREE.Raycaster;
  private snapMarker: THREE.Mesh;
  private edgeHighlighter: THREE.Line;
  private enabled: boolean = true;
  private snapThreshold: number = 0.2; // World units

  // Config Toggles
  public snapVertices: boolean = true;
  public snapEdges: boolean = true;
  public snapMidpoints: boolean = true;
  public snapCentroids: boolean = true;
  // Explicitly disable generic face snapping as per requirement, 
  // or make it a toggle if needed later. For now, we only snap to features.

  public getSnapMarker(): THREE.Mesh {
    return this.snapMarker;
  }

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    // Optimize raycaster
    this.raycaster.params.Points!.threshold = 0.1;
    this.raycaster.params.Line!.threshold = 0.1;

    // Visual helper (Point)
    const geometry = new THREE.SphereGeometry(0.05, 16, 16);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00, // Green for snap
      depthTest: false, 
      transparent: true, 
      opacity: 0.8 
    });
    this.snapMarker = new THREE.Mesh(geometry, material);
    this.snapMarker.renderOrder = 999;
    this.snapMarker.visible = false;
    this.scene.add(this.snapMarker);

    // Visual helper (Edge)
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      depthTest: false,
      transparent: true,
      opacity: 0.8
    });
    this.edgeHighlighter = new THREE.Line(lineGeo, lineMat);
    this.edgeHighlighter.renderOrder = 999;
    this.edgeHighlighter.visible = false;
    this.scene.add(this.edgeHighlighter);
  }

  public enable() {
    this.enabled = true;
    this.snapMarker.visible = false; 
    this.edgeHighlighter.visible = false;
  }

  public disable() {
    this.enabled = false;
    this.snapMarker.visible = false;
    this.edgeHighlighter.visible = false;
  }

  public getSnapPoint(mouse: THREE.Vector2, objects: THREE.Object3D[]): SnapResult | null {
    if (!this.enabled) {
      this.snapMarker.visible = false;
      this.edgeHighlighter.visible = false;
      return null;
    }

    this.raycaster.setFromCamera(mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(objects, true);

    if (intersects.length === 0) {
      this.snapMarker.visible = false;
      this.edgeHighlighter.visible = false;
      return null;
    }

    const hit = intersects[0];
    const point = hit.point;

    // We'll collect candidates and pick the best one.
    let bestSnap: SnapResult | null = null;
    let minSnapDist = this.snapThreshold; // Only snap if within threshold

    if (hit.object instanceof THREE.Mesh && hit.face) {
      const mesh = hit.object;
      const geometry = mesh.geometry;
      
      if (geometry.isBufferGeometry) {
        const positionAttribute = geometry.attributes.position;
        const indices = [hit.face.a, hit.face.b, hit.face.c];
        
        // Get vertices in world space
        const vertices = indices.map(idx => 
          new THREE.Vector3().fromBufferAttribute(positionAttribute, idx).applyMatrix4(mesh.matrixWorld)
        );

        // 1. Vertex Snap
        if (this.snapVertices) {
          for (const v of vertices) {
            const dist = v.distanceTo(point);
            if (dist < minSnapDist) {
              minSnapDist = dist;
              bestSnap = {
                point: v,
                type: 'vertex',
                distance: dist,
                object: mesh
              };
            }
          }
        }

        // 2. Midpoint Snap (Center of edges)
        if (this.snapMidpoints) {
           const edges = [
            [vertices[0], vertices[1]],
            [vertices[1], vertices[2]],
            [vertices[2], vertices[0]]
          ];
          for (const edge of edges) {
            const mid = new THREE.Vector3().addVectors(edge[0], edge[1]).multiplyScalar(0.5);
            const dist = mid.distanceTo(point);
            if (dist < minSnapDist) {
              minSnapDist = dist;
              bestSnap = {
                point: mid,
                type: 'midpoint',
                distance: dist,
                object: mesh,
                edgeVertices: [edge[0], edge[1]] // Optional: highlight edge for midpoint too?
              };
            }
          }
        }

        // 3. Centroid Snap (Center of face)
        if (this.snapCentroids) {
          const centroid = new THREE.Vector3().addVectors(vertices[0], vertices[1]).add(vertices[2]).divideScalar(3);
          const dist = centroid.distanceTo(point);
          if (dist < minSnapDist) {
            minSnapDist = dist;
            bestSnap = {
              point: centroid,
              type: 'centroid',
              distance: dist,
              object: mesh
            };
          }
        }

        // 4. Edge Snap (Anywhere on edge)
        // We check this LAST or check distance carefully. 
        // If we have a vertex/midpoint already, that takes precedence usually if it's closer.
        // But if we are right on the edge far from corners, this kicks in.
        if (this.snapEdges) {
          const edges = [
            [vertices[0], vertices[1]],
            [vertices[1], vertices[2]],
            [vertices[2], vertices[0]]
          ];
          
          for (const edge of edges) {
            const closest = getClosestPointOnLineSegment(point, edge[0], edge[1]);
            const dist = closest.distanceTo(point);
            if (dist < minSnapDist) {
              minSnapDist = dist;
              bestSnap = {
                point: closest,
                type: 'edge',
                distance: dist,
                object: mesh,
                edgeVertices: [edge[0], edge[1]]
              };
            }
          }
        }
      }
    }

    // If no feature snap found, and we don't allow face snapping, we return null.
    if (!bestSnap) {
      this.snapMarker.visible = false;
      this.edgeHighlighter.visible = false;
      return null;
    }

    // Update Visual Helper
    this.snapMarker.position.copy(bestSnap.point);
    this.snapMarker.visible = true;
    
    // Color coding (Optional, or just keep green)
    // Let's use Green for everything as requested, maybe slight variation later?
    (this.snapMarker.material as THREE.MeshBasicMaterial).color.setHex(0x00ff00);

    // Handle Edge Highlighting
    // Show line for 'edge' and maybe 'midpoint'
    if ((bestSnap.type === 'edge' || bestSnap.type === 'midpoint') && bestSnap.edgeVertices) {
      const positions = this.edgeHighlighter.geometry.attributes.position;
      positions.setXYZ(0, bestSnap.edgeVertices[0].x, bestSnap.edgeVertices[0].y, bestSnap.edgeVertices[0].z);
      positions.setXYZ(1, bestSnap.edgeVertices[1].x, bestSnap.edgeVertices[1].y, bestSnap.edgeVertices[1].z);
      positions.needsUpdate = true;
      this.edgeHighlighter.visible = true;
    } else {
      this.edgeHighlighter.visible = false;
    }

    return bestSnap;
  }
}

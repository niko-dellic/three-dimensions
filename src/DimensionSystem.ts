import * as THREE from 'three';
import { SnappingManager } from './SnappingManager';
import { DimensionRenderer } from './DimensionRenderer';
import { DimensionType, CPlane } from './types';

type InteractionState = 'idle' | 'drawing' | 'drawing_angle_p2' | 'offsetting' | 'defining_cplane_p1' | 'defining_cplane_p2' | 'defining_cplane_p3' | 'defining_cplane_face' | 'translating_cplane';

export class DimensionSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  public snappingManager: SnappingManager;
  public dimensionRenderer: DimensionRenderer;
  
  public mode: DimensionType = 'linear';

  public cplane: CPlane = {
    origin: new THREE.Vector3(0, 0, 0),
    normal: new THREE.Vector3(0, 1, 0) // Default World XZ (Y-up)
  };

  // State
  private state: InteractionState = 'idle';
  private startPoint: THREE.Vector3 | null = null; // Center / Leader Origin / CPlane P1
  private endPoint: THREE.Vector3 | null = null;   // Arm 1 / Leader Elbow / CPlane P2
  private angleP2: THREE.Vector3 | null = null;    // Arm 2 / CPlane P3

  constructor(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.camera = camera;
    this.snappingManager = new SnappingManager(this.scene, this.camera);
    this.dimensionRenderer = new DimensionRenderer(this.scene);
    
    // Keep reference if needed later, or just ignore for now.
    renderer.getSize(new THREE.Vector2());
  }

  public setCPlane(origin: THREE.Vector3, normal: THREE.Vector3) {
    this.cplane.origin.copy(origin);
    this.cplane.normal.copy(normal).normalize();
  }
  
  public setCPlaneToWorld() {
    this.setCPlane(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
  }
  
  public setCPlaneToView() {
    // Origin at target? Or just some distance in front.
    const normal = new THREE.Vector3();
    this.camera.getWorldDirection(normal);
    normal.negate(); // Plane faces camera
    
    // Place origin 10 units in front of camera
    const origin = this.camera.position.clone().add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(10));
    
    this.setCPlane(origin, normal);
  }
  
  public startDefineCPlane() {
    this.reset();
    this.state = 'defining_cplane_p1';
    console.log('Define CPlane: Click Origin');
  }

  public startDefineCPlaneFromFace() {
    this.reset();
    this.state = 'defining_cplane_face';
    console.log('Define CPlane: Click a Mesh Face');
  }

  public startTranslateCPlane() {
    this.reset();
    this.state = 'translating_cplane';
    console.log('Translate CPlane: Click new origin point');
  }

  // Call this from main app on mouse move
  public onMouseMove(mouse: THREE.Vector2, objects: THREE.Object3D[], cplaneHelper: { update: (c: CPlane) => void }) {
    const snap = this.snappingManager.getSnapPoint(mouse, objects);
    // Use startPoint as reference for subsequent steps to keep drawing coplanar/parallel
    const currentPoint = snap ? snap.point : this.getRayPoint(mouse, this.startPoint || undefined);
    
    // Preview logic
    if (!currentPoint) return;
    
    // CPlane Definition Preview
    if (this.state === 'translating_cplane') {
      const tempCPlane: CPlane = { origin: currentPoint, normal: this.cplane.normal };
      cplaneHelper.update(tempCPlane);
      return;
    }
    if (this.state.startsWith('defining_cplane')) {
       // Future: Show a preview of the CPlane as it's being defined
       return;
    }

    if (this.mode === 'leader') {
      if (this.state === 'drawing' && this.startPoint) {
        // Start -> Elbow preview
        this.dimensionRenderer.updatePreview('leader', this.startPoint, currentPoint, currentPoint);
      } else if (this.state === 'offsetting' && this.startPoint && this.endPoint) {
        // Start -> Elbow -> Extension
        this.dimensionRenderer.updatePreview('leader', this.startPoint, this.endPoint, currentPoint);
      }
    } else if (this.mode === 'angle') {
      if (this.state === 'drawing' && this.startPoint) {
         this.dimensionRenderer.updatePreview('linear', this.startPoint, currentPoint, currentPoint);
      } else if (this.state === 'drawing_angle_p2' && this.startPoint && this.endPoint) {
         this.dimensionRenderer.updatePreview('angle', this.startPoint, this.endPoint, currentPoint, currentPoint);
      } else if (this.state === 'offsetting' && this.startPoint && this.endPoint && this.angleP2) {
         this.dimensionRenderer.updatePreview('angle', this.startPoint, this.endPoint, currentPoint, this.angleP2);
      }
    } else {
      // Linear / Aligned
      if (this.state === 'drawing' && this.startPoint) {
        this.dimensionRenderer.updatePreview('linear', this.startPoint, currentPoint, currentPoint);
      } 
      else if (this.state === 'offsetting' && this.startPoint && this.endPoint) {
         this.dimensionRenderer.updatePreview('linear', this.startPoint, this.endPoint, currentPoint);
      }
    }
  }

  // Call this from main app on click
  public onClick(mouse: THREE.Vector2, objects: THREE.Object3D[]) {
    const snap = this.snappingManager.getSnapPoint(mouse, objects);
    
    // CPlane Definition Logic
    if (this.state === 'translating_cplane') {
      const point = snap ? snap.point : this.getRayPoint(mouse);
      if (!point) return; 
      this.setCPlane(point, this.cplane.normal);
      console.log('CPlane Translated');
      this.reset();
      return;
    }

    if (this.state === 'defining_cplane_face') {
       // Use raw raycaster to find face
       const raycaster = new THREE.Raycaster();
       raycaster.setFromCamera(mouse, this.camera);
       const intersects = raycaster.intersectObjects(objects, true);
       
       if (intersects.length > 0) {
         const hit = intersects[0];
         if (hit.face) {
           const normal = hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld));
           // We use hit point as origin
           this.setCPlane(hit.point, normal);
           console.log('CPlane Set to Face');
           this.reset();
           return;
         }
       }
       return;
    }

    if (this.state === 'defining_cplane_p1') {
      if (!snap) return;
      this.startPoint = snap.point.clone();
      this.state = 'defining_cplane_p2';
      console.log('CPlane Origin Set. Click X-Axis Direction.');
      return;
    }
    if (this.state === 'defining_cplane_p2') {
      if (!snap) return;
      this.endPoint = snap.point.clone();
      if (this.startPoint!.distanceTo(this.endPoint) < 0.001) return;
      this.state = 'defining_cplane_p3';
      console.log('CPlane X-Axis Set. Click Y-Axis Direction (Plane).');
      return;
    }
    if (this.state === 'defining_cplane_p3') {
      if (!snap) return;
      const p3 = snap.point.clone();
      
      // Calculate Normal from P1, P2, P3
      const v1 = new THREE.Vector3().subVectors(this.endPoint!, this.startPoint!).normalize(); // X Axis
      const v2 = new THREE.Vector3().subVectors(p3, this.startPoint!).normalize();
      const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
      
      if (normal.lengthSq() < 0.001) {
        console.warn('Points are collinear, cannot define plane');
        this.reset();
        return;
      }
      
      this.setCPlane(this.startPoint!, normal);
      console.log('CPlane Defined');
      this.reset();
      return;
    }

    if (this.state === 'idle') {
      // 1. Start Dimension - MUST Snap
      if (!snap) return;
      
      this.startPoint = snap.point.clone();
      this.state = 'drawing';
      console.log('Dimension Started. Click next point.');
    } 
    else if (this.state === 'drawing') {
      // 2. Set Second Point 
      // Linear/Angle: Must Snap.
      // Leader: Can be free (Elbow).
      
      if (this.mode === 'leader') {
         const point = snap ? snap.point : this.getRayPoint(mouse, this.startPoint || undefined);
         if (!point) return;
         this.endPoint = point.clone(); // Elbow
         this.state = 'offsetting';
         console.log('Elbow set. Click extension end.');
      } else {
        // Must Snap
        if (!snap) return;
        this.endPoint = snap.point.clone();
        // Check degenerate
        if (this.startPoint!.distanceTo(this.endPoint) < 0.001) return;

        if (this.mode === 'angle') {
          this.state = 'drawing_angle_p2';
          console.log('Arm 1 set. Click Arm 2.');
        } else {
          this.state = 'offsetting';
          console.log('End point set. Click to place dimension line.');
        }
      }
    }
    else if (this.state === 'drawing_angle_p2') {
      // Angle Mode: Set Arm 2 - Can be free space
      const point = snap ? snap.point : this.getRayPoint(mouse, this.startPoint || undefined);
      if (!point) return;
      
      this.angleP2 = point.clone();
       // Check degenerate
      if (this.startPoint!.distanceTo(this.angleP2) < 0.001) return;
      
      this.state = 'offsetting';
      console.log('Arm 2 set. Click to place angle arc.');
    }
    else if (this.state === 'offsetting') {
      // Finalize - Can be free space
      const point = snap ? snap.point : this.getRayPoint(mouse, this.startPoint || undefined);
      if (!point) return;

      if (this.mode === 'leader') {
         // Prompt for text
         const text = window.prompt("Enter leader text:", "Note");
         if (text !== null) {
           this.dimensionRenderer.createDimension('leader', this.startPoint!, this.endPoint!, point, undefined, text);
         }
      } else {
         this.dimensionRenderer.createDimension(this.mode, this.startPoint!, this.endPoint!, point, this.angleP2 || undefined);
      }
      
      this.dimensionRenderer.clearPreview();
      this.reset();
      console.log('Dimension created.');
    }
  }
  
  public cancel() {
    this.reset();
    this.dimensionRenderer.clearPreview();
  }

  private reset() {
    this.state = 'idle';
    this.startPoint = null;
    this.endPoint = null;
    this.angleP2 = null;
  }

  private getRayPoint(mouse: THREE.Vector2, referencePoint?: THREE.Vector3): THREE.Vector3 {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    
    // Project onto CPlane
    const plane = new THREE.Plane();
    const origin = referencePoint ? referencePoint : this.cplane.origin;
    plane.setFromNormalAndCoplanarPoint(this.cplane.normal, origin);
    
    const target = new THREE.Vector3();
    const result = raycaster.ray.intersectPlane(plane, target);
    
    if (result) {
      return result;
    }
    
    // Fallback if parallel
    raycaster.ray.at(10, target);
    return target;
  }
}
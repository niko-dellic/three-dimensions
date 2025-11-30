import * as THREE from 'three';
import { CPlane } from '../types';

export class CPlaneHelper extends THREE.Group {
  private grid: THREE.GridHelper;
  private axis: THREE.AxesHelper;

  constructor(size: number = 20, divisions: number = 20) {
    super();

    // Grid
    this.grid = new THREE.GridHelper(size, divisions, 0x888888, 0xcccccc);
    // Rotate grid to be XY plane by default if we want? 
    // THREE.GridHelper is XZ.
    // Let's keep it XZ local, and we rotate the whole group.
    this.add(this.grid);

    // Axis
    this.axis = new THREE.AxesHelper(size / 2);
    this.add(this.axis);
  }

  public update(cplane: CPlane) {
    this.position.copy(cplane.origin);

    // Orient the group so that its local UP (Y) matches the CPlane normal.
    // By default, the group's Up is (0,1,0).
    
    // However, GridHelper is in XZ plane, so its normal is Y.
    // So aligning the Group Y to CPlane normal works perfectly.
    
    // We also need to consider the "Right" vector to be stable if possible,
    // but for a simple CPlane, Normal + Origin is enough definition. 
    // We'll use lookAt approach or Quaternion from unit vectors.
    
    const defaultUp = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(defaultUp, cplane.normal.clone().normalize());
    this.setRotationFromQuaternion(quaternion);
  }
}

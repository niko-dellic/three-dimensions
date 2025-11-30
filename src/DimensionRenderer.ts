import * as THREE from 'three';
import { createTextSprite } from './utils/text';
import { DimensionStyle, DimensionData, DimensionType } from './types';

export class DimensionRenderer {
  private scene: THREE.Scene;
  private dimensionsGroup: THREE.Group;
  private previewGroup: THREE.Group;
  private dimensionData: DimensionData[] = [];
  private nextId = 0;
  
  public style: DimensionStyle = {
    color: '#000000',
    fontSize: 1,
    scale: 1,
    depthTest: false,
    offset: 0.5,
    units: 'm',
    textBgColor: '#ffffff', // Default white bg
    textMode: 'horizontal'
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.dimensionsGroup = new THREE.Group();
    this.previewGroup = new THREE.Group();
    this.scene.add(this.dimensionsGroup);
    this.scene.add(this.previewGroup);
  }

  public getDimensionsGroup() {
    return this.dimensionsGroup;
  }

  public getPreviewGroup() {
    return this.previewGroup;
  }

  public setStyle(style: Partial<DimensionStyle>) {
    this.style = { ...this.style, ...style };
    this.rebuildAll();
  }

  public createDimension(type: DimensionType, start: THREE.Vector3, end: THREE.Vector3, offsetPoint: THREE.Vector3, angleP2?: THREE.Vector3, text?: string) {
    const data: DimensionData = {
      id: this.nextId++,
      type,
      start: start.clone(),
      end: end.clone(),
      offsetPoint: offsetPoint.clone(),
      angleP2: angleP2 ? angleP2.clone() : undefined,
      text
    };
    this.dimensionData.push(data);
    this.rebuildAll();
  }

  public updatePreview(type: DimensionType, start: THREE.Vector3, end: THREE.Vector3, offsetPoint: THREE.Vector3, angleP2?: THREE.Vector3, text?: string) {
    this.previewGroup.clear();
    // Mock data for preview
    const data: DimensionData = {
      id: -1,
      type,
      start,
      end,
      offsetPoint,
      angleP2,
      text
    };
    const group = this.buildGeometry(data, true);
    if (group) {
      this.previewGroup.add(group);
    }
  }

  public clearPreview() {
    this.previewGroup.clear();
  }

  public clear() {
    this.dimensionData = [];
    this.dimensionsGroup.clear();
    this.previewGroup.clear();
  }

  private rebuildAll() {
    this.dimensionsGroup.clear();
    for (const data of this.dimensionData) {
      const group = this.buildGeometry(data, false);
      if (group) this.dimensionsGroup.add(group);
    }
  }

  private buildGeometry(data: DimensionData, isPreview: boolean): THREE.Group | null {
    if (data.type === 'angle') {
      return this.buildAngleGeometry(data, isPreview);
    } else if (data.type === 'leader') {
      return this.buildLeaderGeometry(data, isPreview);
    } else {
      return this.buildLinearGeometry(data, isPreview);
    }
  }

  private buildLeaderGeometry(data: DimensionData, isPreview: boolean): THREE.Group | null {
    // Start = Origin (Arrow)
    // End = Elbow
    // OffsetPoint = End of extension (Text)
    
    const { start, end, offsetPoint } = data;
    const group = new THREE.Group();
    const color = new THREE.Color(this.style.color);
    if (isPreview) color.lerp(new THREE.Color(0x888888), 0.5);

    const lineMat = new THREE.LineBasicMaterial({ 
      color: color, 
      depthTest: this.style.depthTest,
      transparent: true,
      opacity: isPreview ? 0.6 : 1.0 
    });

    // 1. Line 1: Origin -> Elbow
    const pts1 = [start, end];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts1), lineMat));

    // 2. Line 2: Elbow -> Extension
    const pts2 = [end, offsetPoint];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), lineMat));

    // 3. Arrow at Start
    // Direction from End to Start?
    // Usually arrows point AT the origin.
    // Vector end -> start
    const arrowDir = new THREE.Vector3().subVectors(start, end).normalize();
    // If zero length (start==end), fallback
    if (arrowDir.lengthSq() < 0.0001) arrowDir.set(0, 1, 0);

    // Cone geometry for arrow
    const arrowLen = 0.2 * this.style.scale;
    const arrowWidth = 0.05 * this.style.scale;
    
    const coneGeo = new THREE.ConeGeometry(arrowWidth, arrowLen, 8);
    const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: color, depthTest: this.style.depthTest }));
    
    // Align cone
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), arrowDir);
    cone.setRotationFromQuaternion(quaternion);
    
    const conePos = start.clone().sub(arrowDir.clone().multiplyScalar(arrowLen / 2));
    cone.position.copy(conePos);
    
    group.add(cone);

    // 4. Text
    const label = data.text || "Note";
    const extDir = new THREE.Vector3().subVectors(offsetPoint, end).normalize();
    if (extDir.lengthSq() < 0.0001) extDir.set(1, 0, 0);

    const textPos = offsetPoint.clone().add(extDir.multiplyScalar(0.2 * this.style.scale));
    const sprite = createTextSprite(label, this.style.color, this.style.scale, this.style.textBgColor);
    sprite.position.copy(textPos);

    if (!this.style.depthTest) {
      sprite.material.depthTest = false;
      sprite.renderOrder = 999;
    }
    group.add(sprite);

    return group;
  }

  private buildLinearGeometry(data: DimensionData, isPreview: boolean): THREE.Group | null {
    const { start, end, offsetPoint } = data;
    const distance = start.distanceTo(end);
    if (distance < 0.001) return null;

    const group = new THREE.Group();
    const color = new THREE.Color(this.style.color);
    if (isPreview) color.lerp(new THREE.Color(0x888888), 0.5);

    // 1. Calculate Offset Vector
    // The dimension line is parallel to AB.
    // It passes through the projection of offsetPoint onto the plane defined by normal = AB? 
    // No, usually we want the dimension line to pass through offsetPoint directly if possible, 
    // OR be projected onto the plane defined by (A, B, OffsetPoint).
    
    const ab = new THREE.Vector3().subVectors(end, start);
    const dir = ab.clone().normalize();
    
    // Vector from Start to OffsetPoint
    const vStartOffset = new THREE.Vector3().subVectors(offsetPoint, start);
    
    // Project vStartOffset onto 'dir' to find the component along the line
    const projectionLength = vStartOffset.dot(dir);
    const projectionVec = dir.clone().multiplyScalar(projectionLength);
    
    // The vector from the line AB to the OffsetPoint is the perpendicular component
    const perpVec = new THREE.Vector3().subVectors(vStartOffset, projectionVec);
    
    // So the dimension line endpoints are:
    const p1 = start.clone().add(perpVec);
    const p2 = end.clone().add(perpVec);

    // 2. Main Dimension Line
    const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const lineMat = new THREE.LineBasicMaterial({ 
      color: color, 
      depthTest: this.style.depthTest,
      transparent: true,
      opacity: isPreview ? 0.6 : 1.0
    });
    group.add(new THREE.Line(lineGeo, lineMat));

    // 3. Leader Lines (Witness lines)
    // From object (start/end) to dimension line (p1/p2)
    // Often we want a small gap from the object and a small extension past the dim line.
    const gap = 0.0; // Gap from object
    const extension = 0.1 * this.style.scale; // Extension past dim line
    
    // Direction of leader is perpVec normalized (if length > 0)
    let leaderDir = perpVec.clone().normalize();
    if (perpVec.lengthSq() < 0.0001) {
      // If offset is zero, we don't strictly have a leader dir. 
      // Fallback to Up or something? Or just don't draw leaders if on top.
      // Let's assume Y up if coincident.
      leaderDir = new THREE.Vector3(0, 1, 0);
    }

    const l1Start = start.clone().add(leaderDir.clone().multiplyScalar(gap));
    const l1End = p1.clone().add(leaderDir.clone().multiplyScalar(extension));
    
    const l2Start = end.clone().add(leaderDir.clone().multiplyScalar(gap));
    const l2End = p2.clone().add(leaderDir.clone().multiplyScalar(extension));

    const leaderMat = new THREE.LineBasicMaterial({ 
      color: color, 
      depthTest: this.style.depthTest, 
      transparent: true, 
      opacity: 0.5 
    });
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([l1Start, l1End]), leaderMat));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([l2Start, l2End]), leaderMat));

    // 4. Ticks (Architecture Ticks - 45 degrees)
    // We need a vector perpendicular to the dimension line and the leader line.
    // Cross product of dir (dim line) and leaderDir.
    // const cross = new THREE.Vector3().crossVectors(dir, leaderDir).normalize();
    
    const tickSize = 0.1 * this.style.scale;
    // 45 degrees in the plane defined by (dir, leaderDir)?
    // Actually, standard architectural ticks are usually just 45 deg in view, but in 3D...
    // Let's just do a slash: (dir + leaderDir).normalize()? 
    // A common style is a slash at 45deg relative to the line.
    
    // Let's try constructing a small vector that is 45deg.
    // tickVec = (dir + leaderDir) * size? 
    // No, usually it cuts across. 
    // Let's use the cross product as the 'depth' and just rotate the leaderDir?
    // Simplest "Slash": Rotate leaderDir 45 deg around cross? 
    // Or just (dir + leaderDir) * size.
    
    const tickVec = new THREE.Vector3().addVectors(dir, leaderDir).normalize().multiplyScalar(tickSize);
    
    const t1a = p1.clone().sub(tickVec);
    const t1b = p1.clone().add(tickVec);
    const t2a = p2.clone().sub(tickVec);
    const t2b = p2.clone().add(tickVec);

    const ticksGeo = new THREE.BufferGeometry().setFromPoints([t1a, t1b, t2a, t2b]);
    const ticks = new THREE.LineSegments(ticksGeo, lineMat);
    group.add(ticks);

    // 5. Text
    // Format units
    let label = distance.toFixed(2);
    if (this.style.units === 'mm') label = (distance * 1000).toFixed(0);
    else if (this.style.units === 'ft') label = (distance * 3.28084).toFixed(2) + "'";
    else label += 'm';

    const sprite = createTextSprite(label, this.style.color, this.style.scale, this.style.textBgColor);
    const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    // Offset text slightly "above" (along leader dir)
    sprite.position.copy(midPoint).add(leaderDir.clone().multiplyScalar(0.2 * this.style.scale));
    
    // Optional: Disable depth test for text to make it always readable?
    if (!this.style.depthTest) {
      sprite.material.depthTest = false;
      sprite.renderOrder = 999;
    }

    group.add(sprite);

    return group;
  }

  private buildAngleGeometry(data: DimensionData, isPreview: boolean): THREE.Group | null {
    // Center = start
    // Arm 1 = end
    // Arm 2 = angleP2
    // Radius Point = offsetPoint
    if (!data.angleP2) return null;

    const center = data.start;
    const p1 = data.end;
    const p2 = data.angleP2;
    const radiusPoint = data.offsetPoint;

    const group = new THREE.Group();
    const color = new THREE.Color(this.style.color);
    if (isPreview) color.lerp(new THREE.Color(0x888888), 0.5);
    
    const lineMat = new THREE.LineBasicMaterial({ 
      color: color, 
      depthTest: this.style.depthTest,
      transparent: true,
      opacity: isPreview ? 0.6 : 1.0 
    });

    // 1. Calculate Vectors
    const v1 = new THREE.Vector3().subVectors(p1, center);
    const v2 = new THREE.Vector3().subVectors(p2, center);
    
    // Radius is distance from center to offsetPoint
    const radius = center.distanceTo(radiusPoint);
    if (radius < 0.001) return null;

    // 2. Draw Arms (from center to radius distance? or full length?)
    // Usually dim lines don't go all the way to center, but let's draw them for clarity.
    // Or just draw the Arc?
    // Let's draw leader lines from object to arc.
    // Direction v1 and v2.
    const dir1 = v1.clone().normalize();
    const dir2 = v2.clone().normalize();

    const arcStart1 = center.clone().add(dir1.clone().multiplyScalar(radius));
    const arcStart2 = center.clone().add(dir2.clone().multiplyScalar(radius));

    // Draw leaders from center (or object) to arc?
    // For angle, usually we see the arc and maybe lines from center.
    const leader1 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([center, arcStart1]), lineMat);
    const leader2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([center, arcStart2]), lineMat);
    group.add(leader1);
    group.add(leader2);

    // 3. Draw Arc
    // We need an arc between dir1 and dir2 on the plane defined by them.
    // Calculate angle
    let angle = v1.angleTo(v2); // Radians
    const degrees = THREE.MathUtils.radToDeg(angle);
    
    // We need to draw the arc points.
    // Plane normal
    const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
    if (normal.lengthSq() < 0.0001) {
      // Parallel lines, no plane. Default UP?
      normal.set(0, 1, 0);
    }

    const curve = new THREE.EllipseCurve(
      0, 0, // ax, aY
      radius, radius, // xRadius, yRadius
      0, angle, // startAngle, endAngle
      false, // clockwise
      0 // rotation
    );

    // The EllipseCurve is 2D. We need to orient it in 3D.
    // Build points
    const points2D = curve.getPoints(24);
    const points3D: THREE.Vector3[] = [];
    
    // Create a basis for the plane
    // X axis = dir1
    // Z axis = normal
    // Y axis = cross(normal, dir1)
    const xAxis = dir1.clone();
    const zAxis = normal.clone();
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
    
    for (const p of points2D) {
      // Map 2D (x, y) to 3D: Center + x*xAxis + y*yAxis
      // EllipseCurve starts at angle 0 on positive X. which matches our dir1.
      const vec = center.clone()
        .add(xAxis.clone().multiplyScalar(p.x))
        .add(yAxis.clone().multiplyScalar(p.y));
      points3D.push(vec);
    }

    const arcGeo = new THREE.BufferGeometry().setFromPoints(points3D);
    group.add(new THREE.Line(arcGeo, lineMat));

    // 4. Text
    const label = degrees.toFixed(1) + '°';
    const midAngle = angle / 2;
    const midDir = dir1.clone().applyAxisAngle(normal, midAngle);
    const textPos = center.clone().add(midDir.multiplyScalar(radius + 0.2 * this.style.scale));
    
    const sprite = createTextSprite(label, this.style.color, this.style.scale, this.style.textBgColor);
    sprite.position.copy(textPos);
    
    if (!this.style.depthTest) {
      sprite.material.depthTest = false;
      sprite.renderOrder = 999;
    }
    group.add(sprite);

    return group;
  }
}
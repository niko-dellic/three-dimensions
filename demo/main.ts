import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { DimensionSystem } from "../src/DimensionSystem";
import { CPlaneHelper } from "../src/utils/CPlaneHelper";
import GUI from "lil-gui";

const app = document.getElementById("app")!;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(5, 5, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// Light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// House Geometry
const houseGroup = new THREE.Group();

// Base
const boxGeo = new THREE.BoxGeometry(2, 2, 2);
const boxMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
const box = new THREE.Mesh(boxGeo, boxMat);
box.position.y = 1;
houseGroup.add(box);

// Roof
const roofGeo = new THREE.ConeGeometry(1.5, 1, 4);
const roofMat = new THREE.MeshStandardMaterial({ color: 0x885544 });
const roof = new THREE.Mesh(roofGeo, roofMat);
roof.position.y = 2.5;
roof.rotation.y = Math.PI / 4;
houseGroup.add(roof);

scene.add(houseGroup);

// Initialize System
const dimSystem = new DimensionSystem(scene, camera, renderer);

// CPlane Helper
const cplaneHelper = new CPlaneHelper(20, 20);
scene.add(cplaneHelper);
cplaneHelper.update(dimSystem.cplane);

// GUI Setup
const gui = new GUI();

const snapFolder = gui.addFolder("Snapping");
const snapConfig = {
  enabled: true,
  vertices: true,
  edges: true,
  midpoints: true,
  centroids: true,
};

snapFolder
  .add(snapConfig, "enabled")
  .onChange((v: boolean) =>
    v ? dimSystem.snappingManager.enable() : dimSystem.snappingManager.disable()
  );
snapFolder
  .add(snapConfig, "vertices")
  .onChange((v: boolean) => (dimSystem.snappingManager.snapVertices = v));
snapFolder
  .add(snapConfig, "edges")
  .onChange((v: boolean) => (dimSystem.snappingManager.snapEdges = v));
snapFolder
  .add(snapConfig, "midpoints")
  .onChange((v: boolean) => (dimSystem.snappingManager.snapMidpoints = v));
snapFolder
  .add(snapConfig, "centroids")
  .onChange((v: boolean) => (dimSystem.snappingManager.snapCentroids = v));

const styleFolder = gui.addFolder("Dimension Style");
const styleConfig = dimSystem.dimensionRenderer.style;
styleFolder
  .addColor(styleConfig, "color")
  .onChange(() =>
    dimSystem.dimensionRenderer.setStyle({ color: styleConfig.color })
  );
styleFolder
  .add(styleConfig, "scale", 0.1, 5)
  .onChange(() =>
    dimSystem.dimensionRenderer.setStyle({ scale: styleConfig.scale })
  );
styleFolder
  .add(styleConfig, "depthTest")
  .onChange(() =>
    dimSystem.dimensionRenderer.setStyle({ depthTest: styleConfig.depthTest })
  );
styleFolder
  .add(styleConfig, "units", ["m", "mm", "ft"])
  .onChange(() =>
    dimSystem.dimensionRenderer.setStyle({ units: styleConfig.units as any })
  );
styleFolder
  .addColor(styleConfig, "textBgColor")
  .name("Text BG")
  .onChange(() =>
    dimSystem.dimensionRenderer.setStyle({
      textBgColor: styleConfig.textBgColor,
    })
  );
// styleFolder.add(styleConfig, 'textMode', ['horizontal', 'aligned']).onChange(() => dimSystem.dimensionRenderer.setStyle({ textMode: styleConfig.textMode as any }));

const modeFolder = gui.addFolder("Mode");
const modeConfig = { mode: "linear" };
modeFolder
  .add(modeConfig, "mode", ["linear", "angle", "leader"])
  .onChange((v: string) => {
    dimSystem.mode = v as any;
    dimSystem.cancel(); // Reset state on mode change
  });

const cplaneFolder = gui.addFolder("CPlane");
const cplaneActions = {
  setWorld: () => {
    dimSystem.setCPlaneToWorld();
    cplaneHelper.update(dimSystem.cplane);
  },
  setView: () => {
    dimSystem.setCPlaneToView();
    cplaneHelper.update(dimSystem.cplane);
  },
  define3Pt: () => {
    dimSystem.startDefineCPlane();
  },
  defineFace: () => {
    dimSystem.startDefineCPlaneFromFace();
  },
  translate: () => {
    dimSystem.startTranslateCPlane();
  },
};
cplaneFolder.add(cplaneActions, "setWorld").name("Set to World");
cplaneFolder.add(cplaneActions, "setView").name("Set to View");
cplaneFolder.add(cplaneActions, "define3Pt").name("Define 3-Point");
cplaneFolder.add(cplaneActions, "defineFace").name("Set to Face");
cplaneFolder.add(cplaneActions, "translate").name("Translate");

const actionFolder = gui.addFolder("Actions");
const actions = {
  clear: () => dimSystem.dimensionRenderer.clear(),
  cancel: () => dimSystem.cancel(),
};
actionFolder.add(actions, "clear");
actionFolder.add(actions, "cancel");

// Raycast / Mouse Move
const mouse = new THREE.Vector2();

// Helper to get snappable objects, excluding dimensions
function getSnappableObjects() {
  const dimensionsGroup = dimSystem.dimensionRenderer.getDimensionsGroup();
  const previewGroup = dimSystem.dimensionRenderer.getPreviewGroup();

  const objects: THREE.Object3D[] = [];
  scene.traverse((child) => {
    // Filter out dimensions and preview, and visual helpers
    if (
      child === dimensionsGroup ||
      child === previewGroup ||
      child === cplaneHelper
    )
      return;
    if (
      child.parent === dimensionsGroup ||
      child.parent === previewGroup ||
      child.parent === cplaneHelper
    )
      return;

    // Add Meshes
    if ((child as THREE.Mesh).isMesh) {
      // Ignore the snap marker itself if it gets into the tree
      const marker = dimSystem.snappingManager.getSnapMarker();
      if (marker && child === marker) return;

      objects.push(child);
    }
  });
  return objects;
}

window.addEventListener("mousemove", (event) => {
  // Calculate mouse position in normalized device coordinates
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  dimSystem.onMouseMove(mouse, getSnappableObjects(), cplaneHelper);
});

window.addEventListener("click", (event) => {
  if (event.target !== renderer.domElement) return; // Ignore clicks on UI

  dimSystem.onClick(mouse, getSnappableObjects());
  // Lazy update in case state changed
  cplaneHelper.update(dimSystem.cplane);
});

// Escape to cancel
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    dimSystem.cancel();
  }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();

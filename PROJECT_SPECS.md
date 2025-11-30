# Project Specifications: three-arch-dims

## 1. Project Overview
**Goal**: Create a production-ready, open-source NPM package (`three-arch-dims`) that adds architectural dimensioning capabilities to Three.js applications.
**Description**: A vanilla Three.js plugin (no React/Vue dependencies) written in TypeScript. It provides tools for measuring distances and annotating 3D models with professional architectural styles (leaders, ticks, aligned text).
**Target Audience**: Developers building CAD, BIM, or 3D visualization tools.

## 2. Technical Stack
- **Language**: TypeScript (Strict mode enabled).
- **Build Tool**: Vite (configured in **Library Mode**).
- **Core Dependency**: `three` (defined as a `peerDependency` to avoid version conflicts).
- **Dev Dependencies**: `vite`, `typescript`, `vite-plugin-dts` (for generating `.d.ts` type definitions).

## 3. Architecture & Modules

The project should follow a modular class-based structure.

### A. File Structure
```
three-arch-dims/
├── src/
│   ├── index.ts                # Public API export
│   ├── DimensionSystem.ts      # Main orchestrator
│   ├── SnappingManager.ts      # Handles raycasting & geometry snapping
│   ├── DimensionRenderer.ts    # Manages THREE.Objects (Lines, Sprites)
│   ├── types.ts                # Shared interfaces
│   └── utils/
│       ├── geometry.ts         # Math helpers
│       └── text.ts             # Canvas-based text generation
├── demo/                       # Interactive playground for testing
│   ├── index.html
│   ├── main.ts
│   └── style.css
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### B. Core Classes

#### 1. `DimensionSystem`
- **Responsibility**: The main entry point. Manages the scene reference, camera, and user interaction states (idle, drawing, modifying).
- **API**:
  - `constructor(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer)`
  - `enable()` / `disable()`
  - `setMode(mode: 'linear' | 'aligned' | 'leader')`
  - `createDimension(start: Vector3, end: Vector3)`

#### 2. `SnappingManager`
- **Responsibility**: Detecting vertices and edges on arbitrary meshes under the mouse.
- **Logic**:
  - Use `THREE.Raycaster`.
  - Snapping Priority: Vertices > Edges > Faces.
  - Visual feedback: Show a small marker (sphere/crosshair) at the snapped point.

#### 3. `DimensionRenderer`
- **Responsibility**: Creating and updating the 3D objects representing dimensions.
- **Implementation Details**:
  - **Lines**: Use `THREE.LineSegments` for crisp rendering. Support "tick marks" at endpoints.
  - **Text**: Use `THREE.Sprite` with a dynamic canvas texture for text labels. This ensures text always faces the camera and is readable.
  - **Styling**: Configurable colors, font sizes, and units (m, mm, ft).

## 4. Feature Requirements

### A. Snapping Tool
1.  **Vertex Snapping**: Snap to the exact position of mesh vertices.
2.  **Edge Snapping**: Snap to the nearest point on a mesh edge.
3.  **Visual Feedback**: Highlight the snapped point in real-time before clicking.

### B. Dimension Types
1.  **Linear Dimension**:
    -   Measures distance projected onto X, Y, or Z axis (like CAD "Linear").
2.  **Aligned Dimension**:
    -   Measures the absolute distance between two points, parallel to the line connecting them.
3.  **Leader Line**:
    -   An arrow pointing to a specific location with a text annotation (e.g., "Material: Steel").

### C. Interactive Demo
-   A clean `index.html` scene containing:
    -   A basic "House" shape (Box geometry with a roof).
    -   OrbitControls.
    -   UI Buttons to switch modes: [Linear] [Aligned] [Leader].
    -   A toggle for [Snapping On/Off].

## 5. Build & Distribution Configuration
-   **NPM Package**:
    -   Must expose CommonJS (`main`) and ES Modules (`module`) formats.
    -   Must include TypeScript definitions (`types`).
-   **Vite Config**:
    -   Use `build.lib` options.
    -   Externalize `three` to prevent bundling it.
    -   Use `vite-plugin-dts` to output type files to `dist/`.

## 6. Implementation Steps for the AI
1.  Initialize the project structure (`package.json`, `tsconfig.json`, `vite.config.ts`).
2.  Implement `SnappingManager` first to get the interaction foundation.
3.  Implement `DimensionRenderer` to handle visual output.
4.  Implement `DimensionSystem` to tie inputs to rendering.
5.  Build the `demo/` folder to test features as they are added.


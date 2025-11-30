import * as THREE from 'three';

export function createTextSprite(message: string, color: string = '#000000', scale: number = 1, bgColor: string | null = null): THREE.Sprite {
  const fontFace = 'Arial';
  const fontSize = 64; 
  const borderThickness = 4;
  const padding = 8;
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  
  // Dynamic size
  context.font = `Bold ${fontSize}px ${fontFace}`;
  const metrics = context.measureText(message);
  const textWidth = metrics.width;
  
  canvas.width = textWidth + (borderThickness + padding) * 2;
  canvas.height = fontSize * 1.4 + (borderThickness + padding) * 2;
  
  // Background
  if (bgColor) {
    context.fillStyle = bgColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  // Text
  context.font = `Bold ${fontSize}px ${fontFace}`;
  context.fillStyle = color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  
  context.fillText(message, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
  
  const sprite = new THREE.Sprite(spriteMaterial);
  
  const baseScale = 0.5 * scale; 
  sprite.scale.set(baseScale * (canvas.width / canvas.height), baseScale, 1);
  
  return sprite;
}

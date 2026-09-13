import type { BufferGeometry, Material, Object3D } from 'three/webgpu';

/** Free the GPU memory (geometry buffers, materials) held by an object and all of its children. */
export function disposeObject(root: Object3D): void {
  root.traverse((object) => {
    const drawable = object as Object3D & { geometry?: BufferGeometry; material?: Material | Material[] };
    drawable.geometry?.dispose();
    const { material } = drawable;
    if (Array.isArray(material)) {
      for (const item of material) item.dispose();
    } else {
      material?.dispose();
    }
  });
}

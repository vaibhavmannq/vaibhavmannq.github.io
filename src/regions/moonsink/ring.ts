import {
  Color,
  EdgesGeometry,
  Group,
  LineBasicNodeMaterial,
  LineSegments,
  Mesh,
  MeshBasicNodeMaterial,
  OctahedronGeometry,
  TorusGeometry,
} from 'three/webgpu';
import { mulberry32 } from '../../shared/random';

/**
 * Centre of the ring in prototype space (see cameraPath.ts). Chosen so the moon (direction 0.148, 0.069, 0.987)
 * sits inside the ring when seen from the start of the camera path.
 */
const RING_CENTER = { x: 14, y: 16, z: 205 };
const RING_RADIUS = 42;

interface Shard {
  mesh: Mesh;
  spin: number;
  phase: number;
  baseY: number;
}

export function createRing() {
  const group = new Group();
  // Prototype space → Three.js: mirror x (same conversion as the camera)
  group.position.set(-RING_CENTER.x, RING_CENTER.y, RING_CENTER.z);
  group.rotation.set(0.05, Math.PI + 0.25, 0.1);

  // Unlit, near-black stone: a silhouette against the night horizon
  const stone = new MeshBasicNodeMaterial({ color: new Color(0x05090b) });
  const random = mulberry32(7);

  // Broken arcs: random lengths with random gaps, always the same thanks to the seed
  let angle = 0.2;
  while (angle < Math.PI * 2 - 0.3) {
    const arc = 0.6 + random() * 0.9;
    const piece = new Mesh(new TorusGeometry(RING_RADIUS, 1.8, 10, 48, arc), stone);
    piece.rotation.z = angle;
    group.add(piece);
    angle += arc + 0.12 + random() * 0.3;
  }

  // Values above 1 are "brighter than white": bloom (tier 2+) turns them into a glow
  const glow = new MeshBasicNodeMaterial({ color: new Color(0.5, 2.2, 2.6) });
  group.add(new Mesh(new TorusGeometry(RING_RADIUS - 3, 0.18, 6, 256), glow));

  const edgeGlow = new LineBasicNodeMaterial({ color: new Color(0.45, 1.6, 1.9) });
  const shards: Shard[] = [];
  for (let i = 0; i < 10; i++) {
    const geometry = new OctahedronGeometry(1.5 + random() * 3.5, 0);
    const mesh = new Mesh(geometry, stone);
    mesh.add(new LineSegments(new EdgesGeometry(geometry), edgeGlow));
    const around = random() * Math.PI * 2;
    const distance = RING_RADIUS + 8 + random() * 22;
    mesh.position.set(Math.cos(around) * distance, Math.sin(around) * distance * 0.7 + 4, (random() - 0.5) * 20);
    group.add(mesh);
    shards.push({ mesh, spin: 0.15 + random() * 0.35, phase: random() * Math.PI * 2, baseY: mesh.position.y });
  }

  return {
    group,
    update(timeSeconds: number, reducedMotion: boolean) {
      if (reducedMotion) return;
      for (const shard of shards) {
        shard.mesh.rotation.set(timeSeconds * shard.spin * 0.5, timeSeconds * shard.spin, 0);
        shard.mesh.position.y = shard.baseY + Math.sin(timeSeconds * shard.spin + shard.phase) * 1.5;
      }
      // A slow breathing pulse, never a flash (spec §10.1)
      glow.color.setRGB(0.5, 2.2, 2.6).multiplyScalar(0.85 + 0.15 * Math.sin(timeSeconds * 1.3));
    },
  };
}

import type { Manifest } from './manifest';

/** World files live under /world/ (public/world). Stage A first, then stage B (spec §12); boot.ts orders the calls. */
export async function loadManifest(base = '/world/'): Promise<Manifest> {
  const response = await fetch(`${base}manifest.json`);
  if (!response.ok) throw new Error(`manifest: ${response.status}`);
  return (await response.json()) as Manifest;
}

export async function fetchBinary(path: string, base = '/world/'): Promise<ArrayBuffer> {
  const response = await fetch(base + path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.arrayBuffer();
}

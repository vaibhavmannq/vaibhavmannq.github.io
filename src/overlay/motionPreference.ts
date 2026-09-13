export const MOTION_STORAGE_KEY = 'moonlit:motion';

export type StoredMotion = 'reduced' | 'full';

export function parseStoredMotion(raw: string | null): StoredMotion | null {
  return raw === 'reduced' || raw === 'full' ? raw : null;
}

/** The visitor's explicit choice wins; otherwise follow the operating-system setting. */
export function resolveReducedMotion(osPrefersReduced: boolean, stored: StoredMotion | null): boolean {
  return stored === null ? osPrefersReduced : stored === 'reduced';
}

export interface MoonlitDebug {
  backend: 'webgpu' | 'webgl2' | 'stills';
  tier(): number;
  frames(): number;
  progress(): number;
  section(): string;
  reducedMotion(): boolean;
  /** The moon's phase in the 3D scene; absent in stills mode, which has no moon to move. */
  moonPhase?(): number;
}

declare global {
  interface Window {
    __moonlit?: MoonlitDebug;
  }
}

/** Read-only facts about the running site, used by Playwright tests. Nothing here can change the site. */
export function exposeDebug(debug: MoonlitDebug): void {
  window.__moonlit = debug;
}

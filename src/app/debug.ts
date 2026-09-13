export interface MoonlitDebug {
  backend: 'webgpu' | 'webgl2' | 'stills';
  tier(): number;
  frames(): number;
  progress(): number;
  section(): string;
  reducedMotion(): boolean;
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

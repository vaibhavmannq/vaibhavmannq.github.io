/**
 * Look-around (Amendment 1 §6 step 1; D25, D27): at a stop, a drag turns the head; it settles back to the path
 * when the journey moves on. Drags "grab the world": dragging right looks left. Pure: the caller feeds drags and
 * frame times and adds the result to the pose's yaw and pitch (before pointer parallax).
 */
export const LOOK = {
  maxYawDeg: 40,
  maxPitchDeg: 15,
  /** a drag across the whole screen width turns this far */
  fullWidthDeg: 80,
  /** how fast the head follows: the share of the gap closed per second is 1 - e^(-rate) */
  rate: 8,
} as const;

const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

export interface Look {
  /** A drag of (dx, dy) screen pixels on a screen `widthPx` wide (dy positive down). */
  drag(dxPx: number, dyPx: number, widthPx: number): void;
  /** Advance by `dtS`; `resting` is true while the journey rests at a stop. Returns the head's turn in degrees. */
  update(resting: boolean, dtS: number): { yaw: number; pitch: number };
}

export function createLook(): Look {
  const target = { yaw: 0, pitch: 0 };
  const head = { yaw: 0, pitch: 0 };
  return {
    drag(dxPx, dyPx, widthPx) {
      const k = LOOK.fullWidthDeg / Math.max(1, widthPx);
      target.yaw = clamp(target.yaw - dxPx * k, LOOK.maxYawDeg);
      target.pitch = clamp(target.pitch + dyPx * k, LOOK.maxPitchDeg);
    },
    update(resting, dtS) {
      if (!resting) {
        target.yaw = 0;
        target.pitch = 0;
      }
      const k = 1 - Math.exp(-LOOK.rate * dtS);
      head.yaw += (target.yaw - head.yaw) * k;
      head.pitch += (target.pitch - head.pitch) * k;
      return { yaw: head.yaw, pitch: head.pitch };
    },
  };
}

/** How far a touch must move before it is read (px). */
export const TOUCH_SLOP_PX = 12;

/**
 * What a touch drag is for, from its movement so far: under 12 px, not yet known; more up or down than sideways, the
 * page's scroll; sideways, a head turn, but only while the journey rests at a stop. In a flight the head cannot turn,
 * so the touch is dropped and the touch snap still carries the visitor on to the next place (final review I2).
 */
export function touchIntent(dxPx: number, dyPx: number, resting: boolean): 'wait' | 'scroll' | 'turn' | 'drop' {
  if (Math.hypot(dxPx, dyPx) < TOUCH_SLOP_PX) return 'wait';
  if (Math.abs(dxPx) <= Math.abs(dyPx)) return 'scroll';
  return resting ? 'turn' : 'drop';
}

/** A mouse drag whose button is no longer held has ended, even if its pointerup was lost (alt-tab mid-drag). */
export const dragEnded = (pointerType: string, buttons: number): boolean => pointerType === 'mouse' && buttons === 0;

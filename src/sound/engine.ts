import { HOURS } from '../journey/hours';
import { SHOTS } from '../journey/shots';
import { STOP_IDS, type StopId, toThree, type Vec3 } from '../journey/types';
import { fallsPan, type Levels, LOOPS, type LoopId, mix } from './mixer';

/**
 * The sound engine (plan M8 Task 9; design 2026-11-20-sound-design.md). Silent and empty until the visitor turns it
 * on: the AudioContext is made inside that tap (browsers allow sound only after one), and the loops are fetched then,
 * the ones the current place plays first. Every loop runs all the time at its mixer level; levels glide (no clicks), the
 * whole fades in over 1.5 s and out over 0.4 s, and the context pauses while the tab is hidden.
 */

/** Overall level (design §3: a backdrop, about −20 dBFS on average with every loop normalised alike). */
export const MASTER = 0.55;
/**
 * Each file holds its 36 s loop plus the loop's own first LOOP_START seconds again at the end (make_loops, s22): AAC
 * starts with a few ms of encoder padding, so the player loops LOOP_START..end and that padding never reaches a join.
 */
export const LOOP_START = 0.1;
/** Each loop's trim against the others once normalised (the falls and wind are broadband: a little lower). */
export const TRIM: Levels = {
  'cove-lap': 1,
  'cove-evening': 0.8,
  'open-sea': 1,
  falls: 0.85,
  'night-air': 0.8,
  'ridge-wind': 0.8,
  cave: 1,
  'dawn-chorus': 0.9,
};

export interface FrameIn {
  a: number;
  b: number;
  hourWeight: number;
}

export interface Sound {
  readonly on: boolean;
  /** Turns sound on or off; must be called from the click itself the first time. */
  toggle(): Promise<boolean>;
  /** The places and the hour's turn, every frame (with or without a GPU). */
  frame(f: FrameIn): void;
  /** The eye's real position (three.js axes) and coast yaw, when the world is drawn. */
  eye(position: Vec3, yawDeg: number): void;
  /** Sunset's gust now, 0..1, weighted by Sunset's share of the frame (Task 16k); 0 when the world is not drawn. */
  gust(amp: number): void;
}

const stopEye = (id: StopId): Vec3 => toThree([SHOTS[id].cam[0], SHOTS[id].cam[1], SHOTS[id].eyeZ]);

export function createSound(base = '/world/sound/'): Sound {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let pan: StereoPannerNode | null = null;
  const gains = new Map<LoopId, GainNode>();
  let on = false;
  let eyeAt: { position: Vec3; yaw: number } | null = null;
  let gustNow = 0;
  let last = 0;

  const start = async (first: Levels) => {
    const c = new AudioContext();
    ctx = c;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    master = c.createGain();
    master.gain.value = 0;
    master.connect(comp).connect(c.destination);
    pan = c.createStereoPanner();
    pan.connect(master);
    for (const id of LOOPS) {
      const g = c.createGain();
      g.gain.value = 0;
      g.connect(id === 'falls' ? pan : master);
      gains.set(id, g);
    }
    document.addEventListener('visibilitychange', () => {
      if (!ctx || !on) return;
      if (document.hidden) void ctx.suspend();
      else void ctx.resume();
    });
    // the loops the visitor hears now come first, then the rest, one at a time (no burst on a slow line)
    const order = [...LOOPS].sort((x, y) => first[y] - first[x]);
    for (const id of order) {
      try {
        const res = await fetch(`${base}${id}.m4a`);
        if (!res.ok) continue;
        const buffer = await c.decodeAudioData(await res.arrayBuffer());
        const src = c.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        src.loopStart = LOOP_START;
        src.loopEnd = buffer.duration;
        src.connect(gains.get(id) as GainNode);
        src.start(0, LOOP_START + Math.random() * (buffer.duration - LOOP_START));
      } catch {
        // a loop that fails to load stays silent; the others play
      }
    }
  };

  let current: FrameIn = { a: 0, b: 0, hourWeight: 0 };
  const levels = (): Levels => {
    const a = STOP_IDS[current.a] ?? 'golden';
    const b = STOP_IDS[current.b] ?? a;
    const w = current.hourWeight;
    const beaufort = HOURS[a].world.beaufort * (1 - w) + HOURS[b].world.beaufort * w;
    const eye = eyeAt?.position ?? (w < 0.5 ? stopEye(a) : stopEye(b));
    return mix({ a, b, w, beaufort, eye, gust: gustNow });
  };

  return {
    get on() {
      return on;
    },
    async toggle() {
      on = !on;
      if (on && !ctx) {
        void start(levels());
      }
      const c = ctx as AudioContext | null;
      if (!c || !master) return on;
      const now = c.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      if (on) {
        await c.resume();
        master.gain.linearRampToValueAtTime(MASTER, now + 1.5);
      } else {
        master.gain.linearRampToValueAtTime(0, now + 0.4);
        setTimeout(() => {
          if (!on) void c.suspend();
        }, 450);
      }
      return on;
    },
    frame(f) {
      current = f;
      if (!ctx || !on) return;
      // ten times a second is plenty for levels that glide over ~0.4 s
      const t = performance.now();
      if (t - last < 100) return;
      last = t;
      const l = levels();
      const now = ctx.currentTime;
      for (const id of LOOPS) gains.get(id)?.gain.setTargetAtTime(l[id] * TRIM[id], now, 0.4);
      if (pan && eyeAt) pan.pan.setTargetAtTime(fallsPan(eyeAt.position, eyeAt.yaw), now, 0.3);
    },
    eye(position, yaw) {
      eyeAt = { position, yaw };
    },
    gust(amp) {
      gustNow = amp;
    },
  };
}

import { beforeAll, describe, expect, it } from 'vitest';
import { journey } from '../../src/journey/journey.config';
import type { RegionSegment } from '../../src/journey/types';
import { SHOWN_OFFSET } from '../../src/overlay/sections';
import { MOONSINK_PATH, poseAt, toThreeCamera } from '../../src/regions/moonsink/cameraPath';

const anchors = (journey[0] as RegionSegment).sections;

beforeAll(() => {
  // createMoonsink reads the window's aspect for its camera; nothing else of the DOM.
  Object.assign(globalThis, { window: { innerWidth: 1600, innerHeight: 900 } });
});

// Final review I3: a page opened or reloaded partway down (a deep link to a project, a reload on Contact) showed its
// text at once while the camera drifted in from the open sea behind it.
describe('the journey camera', () => {
  it('starts where the scroll is, not at the open sea', async () => {
    const { createMoonsink } = await import('../../src/regions/moonsink');
    const region = createMoonsink({ reducedMotion: false }, anchors);
    region.setEntered(true);
    const contact = anchors[3];
    if (contact === undefined) throw new Error('no contact anchor');
    const local = contact.from + SHOWN_OFFSET;
    region.update(local, 0, 1 / 60);
    const [x, y, z] = toThreeCamera(poseAt(MOONSINK_PATH, local)).position;
    expect(region.camera.position.x).toBeCloseTo(x, 5);
    expect(region.camera.position.y).toBeCloseTo(y, 5);
    expect(region.camera.position.z).toBeCloseTo(z, 5);
  });

  it('then follows the scroll smoothly', async () => {
    const { createMoonsink } = await import('../../src/regions/moonsink');
    const region = createMoonsink({ reducedMotion: false }, anchors);
    region.setEntered(true);
    region.update(0, 0, 1 / 60);
    const before = region.camera.position.z;
    region.update(0.5, 0, 1 / 60);
    const target = toThreeCamera(poseAt(MOONSINK_PATH, 0.5)).position[2];
    expect(Math.abs(region.camera.position.z - target)).toBeGreaterThan(Math.abs(before - target) * 0.5);
  });
});

import { describe, expect, it } from 'vitest';
import { parseRoute, projectHash } from '../../src/overlay/router';

describe('parseRoute', () => {
  it('reads a project deep link', () => {
    expect(parseRoute('#/projects/moonlit')).toEqual({ kind: 'project', slug: 'moonlit' });
    expect(parseRoute('#/projects/lantern-city/')).toEqual({ kind: 'project', slug: 'lantern-city' });
  });

  it('treats everything else as the journey itself', () => {
    for (const hash of ['', '#', '#about', '#/projects/', '#/projects/Moonlit', '#/projects/a b', '#/projects/x/y']) {
      expect(parseRoute(hash), hash).toEqual({ kind: 'home' });
    }
  });
});

describe('projectHash', () => {
  it('round-trips through parseRoute', () => {
    expect(parseRoute(projectHash('moonlit'))).toEqual({ kind: 'project', slug: 'moonlit' });
  });
});

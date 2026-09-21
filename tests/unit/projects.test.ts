import { describe, expect, it } from 'vitest';
import { projects } from '../../src/content/projects';
import { parseRoute, projectHash } from '../../src/overlay/router';

describe('projects content (spec §5.7)', () => {
  it('has unique slugs that make valid deep links', () => {
    const slugs = projects.map((project) => project.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(parseRoute(projectHash(slug))).toEqual({ kind: 'project', slug });
  });

  it('fills every required field', () => {
    for (const project of projects) {
      expect(project.title.trim(), project.slug).not.toBe('');
      expect(project.role.trim(), project.slug).not.toBe('');
      expect(project.summary.trim(), project.slug).not.toBe('');
      expect(project.details.length, project.slug).toBeGreaterThan(0);
      expect(project.tools.length, project.slug).toBeGreaterThan(0);
      expect(Number.isInteger(project.year) && project.year >= 2020, project.slug).toBe(true);
    }
  });

  it('gives every cover alt text and every link https', () => {
    for (const project of projects) {
      if (project.cover) expect(project.cover.alt.trim(), project.slug).not.toBe('');
      for (const href of [project.links?.live, project.links?.repo]) {
        if (href !== undefined) expect(href, project.slug).toMatch(/^https:\/\//);
      }
    }
  });
});

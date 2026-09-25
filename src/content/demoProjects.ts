import type { Project } from './projects';

/**
 * Three placeholders, shown only with `?demo`, so the owner can judge how the Projects page holds several projects
 * before there are real ones (2026-09-26). Their pictures are the site's own stills. Delete this file once real
 * projects are in content/projects.ts.
 */
const placeholder = (n: number, still: string): Project => ({
  slug: `placeholder-${n}`,
  title: `Placeholder ${n}`,
  aside: 'a project to come',
  year: 2026,
  role: 'Design and code',
  tools: ['TypeScript'],
  summary: 'Your next project goes here: one line on what it is.',
  details: ['A placeholder for a project that is not built yet. Its real words go in content/projects.ts.'],
  hardPart: 'The one hard problem the project solved, in a sentence or two.',
  cover: {
    src: `/stills/${still}-landscape.jpg`,
    alt: 'A still of the moonlit sea, standing in for a project picture',
  },
});

export const demoProjects: readonly Project[] = [
  placeholder(2, 'about'),
  placeholder(3, 'contact'),
  placeholder(4, 'intro'),
];

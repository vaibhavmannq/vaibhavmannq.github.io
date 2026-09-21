/**
 * Projects, as data (spec §5.7). Adding a project is one new entry here: the list on the Projects
 * page, its dialog and its deep link (#/projects/<slug>) all come from this file.
 */
export interface Project {
  /** Unique and kebab-case; the deep link is #/projects/<slug>. */
  slug: string;
  title: string;
  /** A few words set in italics beside the title. */
  aside?: string;
  year: number;
  role: string;
  tools: readonly string[];
  /** One line, shown in the list. */
  summary: string;
  /** The dialog's paragraphs. */
  details: readonly string[];
  cover?: { src: string; alt: string };
  links?: { live?: string; repo?: string };
}

export const projects: readonly Project[] = [
  {
    slug: 'moonlit',
    title: 'Moonlit',
    aside: 'you’re standing in it',
    year: 2026,
    role: 'Design and code',
    tools: ['TypeScript', 'Three.js', 'WebGPU and WebGL2', 'Lenis', 'Vite'],
    summary: 'The journey you are on: a moonlit sea under tonight’s real moon.',
    details: [
      'My first project, built from scratch. The sea is drawn by a shader that follows every pixel’s ray down to the water, each frame, and the moon’s shape is tonight’s real phase, so darker nights show more stars.',
      'It adapts to the device it runs on: a quality governor watches the frame rate and trades sharpness for smoothness, so a budget phone stays fluid.',
    ],
    links: { repo: 'https://github.com/vaibhavmannq/vaibhavmannq.github.io' },
  },
];

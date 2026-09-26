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
  /** The dialog's paragraphs: what it is. */
  details: readonly string[];
  /** One real difficulty, in a sentence or two (storyboard F). */
  hardPart: string;
  /** One measured number, never an estimate. */
  metric?: { value: string; label: string };
  /** The case study's picture; the caption says what it shows (storyboard F). */
  cover: { src: string; alt: string; caption?: string };
  /**
   * The two tiles under the picture on a laptop (storyboard F): a clip of the thing itself, and a before and after
   * of its hard part. Both rendered from the real scene (scripts/capture.mjs).
   */
  extras?: {
    clip?: { src: string; poster: string; label: string };
    compare?: { src: string; alt: string; before: string; after: string };
  };
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
    summary: 'The journey you are on: a moonlit sea whose moon fills as you travel.',
    details: [
      'My first project, built from scratch. The sea is drawn by a shader that follows every pixel’s ray down to the water, each frame, and the moon waxes from crescent to full as you travel.',
    ],
    hardPart:
      'Keeping it smooth on an ordinary laptop. Almost all of the sea’s cost turned out to be rays creeping through empty air above the waves, so each ray now starts at the highest surface it could meet; and the frame rate follows the screen, so 90 and 144 Hz displays no longer read as slow.',
    // Measured 2026-09-26, plan 1 Task 7 (docs/superpowers/specs/2026-09-13-moonlit-portfolio-design.md S39).
    metric: { value: '31.6 → 58 fps', label: 'the sea at 80% sharpness on an Intel UHD laptop' },
    cover: {
      src: '/projects/moonlit-cover.jpg',
      alt: 'The full moon on wet black sand, rendered by the site',
      caption: 'Frame from the live shader · full moon',
    },
    extras: {
      clip: {
        src: '/projects/moonlit-voyage.mp4',
        poster: '/projects/moonlit-voyage-poster.jpg',
        label: 'Sea to shore · six seconds of the live scene',
      },
      compare: {
        src: '/projects/moonlit-tiers.jpg',
        alt: 'The same full-moon moment at the lowest tier and at tier 3, side by side: the left is softer, with no glow',
        before: 'Tier 0 · 40% sharpness, no glow',
        after: 'Tier 3 · 80% sharpness, with glow',
      },
    },
    links: { repo: 'https://github.com/vaibhavmannq/vaibhavmannq.github.io' },
  },
];

/**
 * Projects on the way: cards in the same row, with a picture from the scene and no case study yet (owner,
 * 2026-09-26: "add that multiple projects card for both phone and laptop"). When a project is ready, it moves into
 * `projects` above and its card here goes.
 */
export interface Upcoming {
  /** A picture from the site's own stills, standing in until the project has one. */
  cover: string;
}

export const upcoming: readonly Upcoming[] = [
  { cover: '/stills/about-landscape.jpg' },
  { cover: '/stills/intro-landscape.jpg' },
];

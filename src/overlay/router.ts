/** Where the URL hash points (spec §3.2): the journey itself, or one project's dialog. */
export type Route = { kind: 'home' } | { kind: 'project'; slug: string };

const PROJECT_ROUTE = /^#\/projects\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/;

/** Reads `location.hash`. Anything that is not a well-formed project link is the journey. Pure. */
export function parseRoute(hash: string): Route {
  const match = PROJECT_ROUTE.exec(hash);
  return match?.[1] === undefined ? { kind: 'home' } : { kind: 'project', slug: match[1] };
}

/** The deep link for one project. Pure. */
export const projectHash = (slug: string): string => `#/projects/${slug}`;

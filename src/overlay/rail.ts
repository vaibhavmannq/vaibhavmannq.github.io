import type { Stop } from '../journey/types';

/** The nine places as a list of links; the current one is marked for screen readers and styled (spec §2.4). */
export function createRail(nav: HTMLElement, stops: readonly Stop[], go: (index: number) => void) {
  const list = document.createElement('ol');
  const links = stops.map((stop, i) => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${stop.id}`;
    const numeral = document.createElement('span');
    numeral.className = 'rail__numeral';
    numeral.textContent = stop.numeral;
    const hour = document.createElement('span');
    hour.className = 'rail__hour';
    hour.textContent = stop.hour;
    link.append(hour, numeral);
    link.addEventListener('click', (event) => {
      event.preventDefault();
      history.replaceState(null, '', `#${stop.id}`);
      go(i);
    });
    item.append(link);
    list.append(item);
    return link;
  });
  nav.append(list);
  let current = -1;
  return {
    setCurrent(index: number) {
      if (index === current) return;
      links[current]?.removeAttribute('aria-current');
      links[index]?.setAttribute('aria-current', 'location');
      current = index;
    },
  };
}

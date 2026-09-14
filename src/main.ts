import 'lenis/dist/lenis.css';
import './styles/base.css';
import './styles/overlay.css';
import { boot } from './app/boot';

boot().catch((error: unknown) => {
  // Something unexpected: keep the text readable rather than leaving the black opening up
  console.error('Moonlit failed to start.', error);
  document.documentElement.classList.remove('is-gated');
  document.documentElement.classList.add('is-stills');
  document.getElementById('opening')?.setAttribute('hidden', '');
  // Boot may have stopped after locking scroll, with no frame loop left to show the sections. Fall back
  // to the no-JavaScript layout: every section static and visible, and the page scrollable.
  document.documentElement.classList.add('is-broken');
  document.documentElement.classList.remove('lenis-stopped');
  for (const section of document.querySelectorAll<HTMLElement>('.section')) {
    section.style.opacity = '1';
    section.style.transform = 'none';
  }
});

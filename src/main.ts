import 'lenis/dist/lenis.css';
import './styles/base.css';
import './styles/overlay.css';
import { boot } from './app/boot';

boot().catch((error: unknown) => {
  // Something unexpected: keep the text readable rather than leaving a locked title screen
  console.error('Moonlit failed to start.', error);
  document.documentElement.classList.remove('is-gated');
  document.documentElement.classList.add('is-stills');
});

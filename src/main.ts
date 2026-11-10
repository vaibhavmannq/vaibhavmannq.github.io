import './styles/world.css';
import { boot } from './app/boot';

boot().catch((error: unknown) => {
  // Something unexpected: the name and text stay readable on the poster.
  console.error('The world failed to start.', error);
  document.documentElement.classList.add('is-stills');
});

// Workspace bootstrap — mounts exactly one game from the collection.
import { createSpaceInvaders } from './Space_Invaders/index.js';

const app = document.getElementById('app');
createSpaceInvaders(app);

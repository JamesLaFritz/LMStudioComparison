/**
 * Main Entry Point - Initializes Space Invaders game
 */
import SpaceInvadersApp from './Space_Invaders/index';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Initialize the Space Invaders application
        const app = new SpaceInvadersApp('game-container');
        
        console.log('Space Invaders game initialized successfully!');
    } catch (error) {
        console.error('Failed to initialize game:', error);
    }
});

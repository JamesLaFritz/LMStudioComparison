import { Game } from './Game';

// Global game instance
let gameInstance: Game | null = null;

window.addEventListener('load', () => {
    // Initialize game after a brief delay to ensure DOM is ready
    setTimeout(() => {
        gameInstance = new Game();
        
        // Hide loading screen
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }

        // Start render loop
        requestAnimationFrame(() => gameLoop());
    }, 500);

    // Handle window resize
    window.addEventListener('resize', () => {
        if (gameInstance) {
            gameInstance.onResize();
        }
    });

    // Keyboard shortcuts for menu navigation
    document.addEventListener('keydown', (e) => {
        if (!gameInstance) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            gameInstance.showMainMenu();
        } else if (e.key === 'Enter' && gameInstance.gameState === 'menu') {
            gameInstance.start();
        } else if (e.key === 'Enter' && gameInstance.gameState === 'gameover') {
            gameInstance.restart();
        }
    });

    // Expose game functions to HTML buttons
    (window as any).startGame = () => {
        if (gameInstance) gameInstance.start();
    };

    (window as any).restartGame = () => {
        if (gameInstance) gameInstance.restart();
    };

    (window as any).showHighScore = () => {
        if (gameInstance) gameInstance.showHighScore();
    };
});

function gameLoop(): void {
    if (!gameInstance) return;

    gameInstance.update();
    gameInstance.render();

    requestAnimationFrame(() => gameLoop());
}

console.log('Space Invaders: Retro-Futurism - Loaded');

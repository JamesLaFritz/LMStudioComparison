/**
 * UIManager - Glassmorphism HTML overlay manager
 * Handles all UI panels, score displays, and interactive elements
 */

export class UIManager {
    constructor() {
        this.container = null;
        this.panels = new Map();
        this.scoreElement = null;
        this.livesElement = null;
        this.levelElement = null;
        this.multiplierElement = null;
        
        // Current state display values
        this.currentScore = 0;
        this.currentLives = 3;
        this.currentLevel = 1;
        this.currentMultiplier = 1;
    }

    init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('UIManager: Container not found:', containerId);
            return false;
        }
        
        // Create main UI structure
        this.createScorePanel();
        this.createLivesDisplay();
        this.createLevelDisplay();
        this.createMultiplierDisplay();
        this.createMenuOverlay();
        this.createGameOverOverlay();
        this.createPauseOverlay();
        
        return true;
    }

    createScorePanel() {
        const panel = document.createElement('div');
        panel.className = 'glass-panel score-panel';
        panel.id = 'score-panel';
        
        this.scoreElement = document.createElement('span');
        this.scoreElement.className = 'score-value neon-text';
        this.scoreElement.textContent = '0';
        
        const label = document.createElement('div');
        label.className = 'panel-label';
        label.textContent = 'SCORE';
        
        panel.appendChild(label);
        panel.appendChild(this.scoreElement);
        this.container.appendChild(panel);
        
        this.panels.set('score', panel);
    }

    createLivesDisplay() {
        const panel = document.createElement('div');
        panel.className = 'glass-panel lives-panel';
        panel.id = 'lives-panel';
        
        this.livesElement = document.createElement('span');
        this.livesElement.className = 'lives-value neon-text cyan-glow';
        this.livesElement.textContent = '❤️❤️❤️';
        
        const label = document.createElement('div');
        label.className = 'panel-label';
        label.textContent = 'LIVES';
        
        panel.appendChild(label);
        panel.appendChild(this.livesElement);
        this.container.appendChild(panel);
        
        this.panels.set('lives', panel);
    }

    createLevelDisplay() {
        const panel = document.createElement('div');
        panel.className = 'glass-panel level-panel';
        panel.id = 'level-panel';
        
        this.levelElement = document.createElement('span');
        this.levelElement.className = 'level-value neon-text magenta-glow';
        this.levelElement.textContent = '1';
        
        const label = document.createElement('div');
        label.className = 'panel-label';
        label.textContent = 'WAVE';
        
        panel.appendChild(label);
        panel.appendChild(this.levelElement);
        this.container.appendChild(panel);
        
        this.panels.set('level', panel);
    }

    createMultiplierDisplay() {
        const panel = document.createElement('div');
        panel.className = 'glass-panel multiplier-panel hidden';
        panel.id = 'multiplier-panel';
        
        this.multiplierElement = document.createElement('span');
        this.multiplierElement.className = 'multiplier-value neon-text gold-glow';
        this.multiplierElement.textContent = '1x';
        
        const label = document.createElement('div');
        label.className = 'panel-label';
        label.textContent = 'COMBO';
        
        panel.appendChild(label);
        panel.appendChild(this.multiplierElement);
        this.container.appendChild(panel);
        
        this.panels.set('multiplier', panel);
    }

    createMenuOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'glass-overlay menu-overlay';
        overlay.id = 'menu-overlay';
        
        // Title with neon glow effect
        const title = document.createElement('h1');
        title.className = 'game-title neon-text cyan-glow large';
        title.innerHTML = `
            <span style="display: block; font-size: 0.5em; letter-spacing: 0.3em;">SPACE</span>
            INVADERS
        `;
        
        // Start button
        const startButton = document.createElement('button');
        startButton.className = 'neon-button cyan-glow';
        startButton.textContent = 'START MISSION';
        startButton.id = 'start-button';
        
        // Instructions
        const instructions = document.createElement('div');
        instructions.className = 'instructions glass-panel';
        instructions.innerHTML = `
            <p><strong>CONTROLS</strong></p>
            <p>⌨️ WASD / Arrow Keys - Move Left/Right</p>
            <p>⎵ Space - Fire Laser</p>
            <p>🎮 Gamepad - Left Stick / D-Pad to move, A Button to fire</p>
            <p>⏸️ P Key - Pause Game</p>
        `;
        
        overlay.appendChild(title);
        overlay.appendChild(startButton);
        overlay.appendChild(instructions);
        this.container.appendChild(overlay);
        
        this.panels.set('menu', overlay);
        
        // Event listener for start button
        startButton.addEventListener('click', () => {
            this.hidePanel('menu');
            if (this.onStartCallback) {
                this.onStartCallback();
            }
        });
    }

    createGameOverOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'glass-overlay game-over-overlay hidden';
        overlay.id = 'game-over-overlay';
        
        // Game over title
        const title = document.createElement('h2');
        title.className = 'game-title neon-text red-glow large';
        title.textContent = 'MISSION FAILED';
        
        // Final score display
        const finalScoreContainer = document.createElement('div');
        finalScoreContainer.className = 'final-score glass-panel';
        
        const scoreLabel = document.createElement('p');
        scoreLabel.className = 'panel-label';
        scoreLabel.textContent = 'FINAL SCORE';
        
        this.finalScoreElement = document.createElement('span');
        this.finalScoreElement.className = 'score-value neon-text gold-glow large';
        this.finalScoreElement.textContent = '0';
        
        finalScoreContainer.appendChild(scoreLabel);
        finalScoreContainer.appendChild(this.finalScoreElement);
        
        // Retry button
        const retryButton = document.createElement('button');
        retryButton.className = 'neon-button red-glow';
        retryButton.textContent = 'RETRY MISSION';
        retryButton.id = 'retry-button';
        
        overlay.appendChild(title);
        overlay.appendChild(finalScoreContainer);
        overlay.appendChild(retryButton);
        this.container.appendChild(overlay);
        
        this.panels.set('gameOver', overlay);
        
        // Event listener for retry button
        retryButton.addEventListener('click', () => {
            this.hidePanel('gameOver');
            if (this.onRetryCallback) {
                this.onRetryCallback();
            }
        });
    }

    createPauseOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'glass-overlay pause-overlay hidden';
        overlay.id = 'pause-overlay';
        
        // Pause title
        const title = document.createElement('h2');
        title.className = 'game-title neon-text cyan-glow large';
        title.textContent = 'PAUSED';
        
        // Resume button
        const resumeButton = document.createElement('button');
        resumeButton.className = 'neon-button cyan-glow';
        resumeButton.textContent = 'RESUME';
        resumeButton.id = 'resume-button';
        
        overlay.appendChild(title);
        overlay.appendChild(resumeButton);
        this.container.appendChild(overlay);
        
        this.panels.set('pause', overlay);
        
        // Event listener for resume button
        resumeButton.addEventListener('click', () => {
            this.hidePanel('pause');
            if (this.onResumeCallback) {
                this.onResumeCallback();
            }
        });
    }

    updateScore(score) {
        this.currentScore = score;
        if (this.scoreElement) {
            // Animate score change with flash effect
            this.scoreElement.textContent = score.toLocaleString();
            this.scoreElement.classList.add('score-flash');
            setTimeout(() => {
                this.scoreElement.classList.remove('score-flash');
            }, 100);
        }
    }

    updateLives(lives) {
        this.currentLives = lives;
        if (this.livesElement) {
            // Display as hearts
            const heartString = '❤️'.repeat(Math.max(0, lives));
            this.livesElement.textContent = heartString || '💀';
            
            // Flash red when losing a life
            if (lives < 3) {
                this.livesElement.classList.add('life-lost-flash');
                setTimeout(() => {
                    this.livesElement.classList.remove('life-lost-flash');
                }, 200);
            }
        }
    }

    updateLevel(level) {
        this.currentLevel = level;
        if (this.levelElement) {
            this.levelElement.textContent = level.toString();
            
            // Pulse animation on level up
            this.levelElement.classList.add('level-up-pulse');
            setTimeout(() => {
                this.levelElement.classList.remove('level-up-pulse');
            }, 500);
        }
    }

    updateMultiplier(multiplier) {
        this.currentMultiplier = multiplier;
        if (this.multiplierElement && this.panels.get('multiplier')) {
            this.multiplierElement.textContent = `${multiplier}x`;
            
            // Show panel when multiplier > 1
            const panel = this.panels.get('multiplier');
            if (multiplier > 1) {
                panel.classList.remove('hidden');
                this.multiplierElement.classList.add('combo-active');
            } else {
                panel.classList.add('hidden');
                this.multiplierElement.classList.remove('combo-active');
            }
        }
    }

    showGameOver(finalScore) {
        if (this.finalScoreElement) {
            this.finalScoreElement.textContent = finalScore.toLocaleString();
        }
        this.showPanel('gameOver');
    }

    showPause() {
        this.showPanel('pause');
    }

    hidePause() {
        this.hidePanel('pause');
    }

    showPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (panel) {
            panel.classList.remove('hidden');
            panel.style.opacity = '1';
        }
    }

    hidePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (panel) {
            panel.style.opacity = '0';
            setTimeout(() => {
                panel.classList.add('hidden');
            }, 200);
        }
    }

    setOnStartCallback(callback) {
        this.onStartCallback = callback;
    }

    setOnRetryCallback(callback) {
        this.onRetryCallback = callback;
    }

    setOnResumeCallback(callback) {
        this.onResumeCallback = callback;
    }

    reset() {
        this.updateScore(0);
        this.updateLives(3);
        this.updateLevel(1);
        this.updateMultiplier(1);
        
        // Hide all overlays except menu
        this.hidePanel('gameOver');
        this.hidePanel('pause');
        this.showPanel('menu');
    }

    hideAllOverlays() {
        this.hidePanel('menu');
        this.hidePanel('gameOver');
        this.hidePanel('pause');
    }
}

export default UIManager;

/**
 * Score Display UI - Glassmorphism styled score display with neon accents
 */
class ScoreDisplay {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error('Container element not found');
        }
        
        // Initialize UI elements
        this._initializeUI();
    }

    _initializeUI() {
        // Create score display container with glassmorphism styling
        const scoreDisplay = document.createElement('div');
        scoreDisplay.className = 'score-display';
        scoreDisplay.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(10px);
            border: 2px solid #00ff88;
            border-radius: 10px;
            padding: 15px 30px;
            color: #00ff88;
            font-family: 'Courier New', monospace;
            font-size: 24px;
            text-shadow: 0 0 10px #00ff88, 0 0 20px #00ff88;
            animation: pulse 2s infinite;
        `;

        // Add score label and value elements
        const scoreLabel = document.createElement('span');
        scoreLabel.textContent = 'SCORE:';
        scoreLabel.style.cssText = 'color: #ffffff;';
        
        this.scoreValue = document.createElement('span');
        this.scoreValue.textContent = '0';
        this.scoreValue.className = 'score-value';

        // Add lives display
        const livesDisplay = document.createElement('div');
        livesDisplay.className = 'lives-display';
        livesDisplay.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(10px);
            border: 2px solid #ff4444;
            border-radius: 10px;
            padding: 15px 30px;
            color: #ff4444;
            font-family: 'Courier New', monospace;
            font-size: 24px;
            text-shadow: 0 0 10px #ff4444, 0 0 20px #ff4444;
        `;

        // Add lives label and value elements
        const livesLabel = document.createElement('span');
        livesLabel.textContent = 'LIVES:';
        livesLabel.style.cssText = 'color: #ffffff;';
        
        this.livesValue = document.createElement('span');
        this.livesValue.textContent = '3';
        this.livesValue.className = 'lives-value';

        // Add level display
        const levelDisplay = document.createElement('div');
        levelDisplay.className = 'level-display';
        levelDisplay.style.cssText = `
            position: absolute;
            top: 20px;
            left: 20px;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(10px);
            border: 2px solid #44ff44;
            border-radius: 10px;
            padding: 15px 30px;
            color: #44ff44;
            font-family: 'Courier New', monospace;
            font-size: 24px;
            text-shadow: 0 0 10px #44ff44, 0 0 20px #44ff44;
        `;

        // Add level label and value elements
        const levelLabel = document.createElement('span');
        levelLabel.textContent = 'LEVEL:';
        levelLabel.style.cssText = 'color: #ffffff;';
        
        this.levelValue = document.createElement('span');
        this.levelValue.textContent = '1';
        this.levelValue.className = 'level-value';

        // Add all UI elements to container
        scoreDisplay.appendChild(scoreLabel);
        scoreDisplay.appendChild(this.scoreValue);
        livesDisplay.appendChild(livesLabel);
        livesDisplay.appendChild(this.livesValue);
        levelDisplay.appendChild(levelLabel);
        levelDisplay.appendChild(this.levelValue);

        this.container.appendChild(scoreDisplay);
        this.container.appendChild(livesDisplay);
        this.container.appendChild(levelDisplay);
    }

    updateScore(newScore) {
        // Animate score change with floating text effect
        const oldScore = parseInt(this.scoreValue.textContent);
        
        if (newScore > oldScore) {
            this._createFloatingText(`+${newScore - oldScore}`, '#00ff88');
        } else {
            this._createFloatingText(`${newScore - oldScore}`, '#ff4444');
        }

        // Update score value with animation
        this.scoreValue.textContent = newScore;
    }

    updateLives(newLives) {
        // Animate lives change with floating text effect
        const oldLives = parseInt(this.livesValue.textContent);
        
        if (newLives < oldLives) {
            this._createFloatingText(`-${Math.abs(newLives - oldLives)}`, '#ff4444');
        }

        // Update lives value with animation
        this.livesValue.textContent = newLives;
    }

    updateLevel(newLevel) {
        // Animate level change with floating text effect
        const oldLevel = parseInt(this.levelValue.textContent);
        
        if (newLevel > oldLevel) {
            this._createFloatingText(`LEVEL ${newLevel}`, '#44ff44');
        }

        // Update level value with animation
        this.levelValue.textContent = newLevel;
    }

    _createFloatingText(text, color) {
        const floatingText = document.createElement('div');
        floatingText.className = 'floating-text';
        floatingText.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: ${color};
            font-family: 'Courier New', monospace;
            font-size: 32px;
            text-shadow: 0 0 10px ${color}, 0 0 20px ${color};
            animation: floatUp 2s ease-out forwards;
        `;

        // Add floating text to container
        this.container.appendChild(floatingText);

        // Remove after animation completes
        setTimeout(() => {
            floatingText.remove();
        }, 2000);
    }

    destroy() {
        // Clear references and dispose resources
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        this.container = null;
    }
}

export default ScoreDisplay;

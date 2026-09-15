/**
 * SceneManager — Handles scene transitions, loading states, and cleanup between scenes
 */

export class SceneManager {
  constructor() {
    this.currentScene = null;
    this.transitioning = false;
    this.onTransitionComplete = null;
  }

  setScene(sceneName) {
    if (this.transitioning) return;
    
    // Cleanup previous scene
    if (this.currentScene && typeof this.currentScene.cleanup === 'function') {
      this.currentScene.cleanup();
    }
    
    this.currentScene = sceneName;
  }

  startTransition(callback, onComplete) {
    this.transitioning = true;
    this.onTransitionComplete = onComplete || (() => {});
    
    if (typeof callback === 'function') {
      setTimeout(() => {
        callback();
        setTimeout(() => {
          this.transitioning = false;
          this.onTransitionComplete();
        }, 500); // Transition duration
      }, 100);
    } else {
      this.transitioning = false;
      this.onTransitionComplete();
    }
  }

  getCurrentScene() {
    return this.currentScene;
  }

  isTransitioning() {
    return this.transitioning;
  }
}

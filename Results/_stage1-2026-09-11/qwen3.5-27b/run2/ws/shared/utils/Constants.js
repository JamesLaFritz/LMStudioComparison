// Shared Constants for Space Invaders and other games
export const CONSTANTS = {
    // Game dimensions
    VIEWPORT_WIDTH: 80,
    VIEWPORT_HEIGHT: 60,
    PLAYER_Y_POSITION: -25,
    
    // Player settings
    PLAYER_SPEED: 12,
    PLAYER_SIZE: { width: 3, height: 2 },
    BULLET_SPEED: 80,
    FIRE_COOLDOWN: 400, // ms
    
    // Invader settings
    INVADER_ROWS: 5,
    INVADER_COLS: 10,
    INVADER_WIDTH: 2.5,
    INVADER_HEIGHT: 1.8,
    INVADER_SPACING_X: 3,
    INVADER_SPACING_Y: 2.2,
    BASE_INVADER_SPEED: 1.5,
    INVADER_DROP_DISTANCE: 1.5,
    
    // Scoring
    POINTS_SQUID: 30,
    POINTS_CRAB: 20,
    POINTS_OCTOPUS: 10,
    UFO_POINTS_MIN: 100,
    UFO_POINTS_MAX: 300,
    
    // Particle system
    MAX_PARTICLES: 500,
    PARTICLE_LIFETIME_MIN: 0.3,
    PARTICLE_LIFETIME_MAX: 1.2,
    
    // Camera shake
    SHAKE_DECAY: 0.92,
    SHAKE_MAX_INTENSITY: 3,
    
    // Hit-stop
    HITSTOP_FRAMES_NORMAL: 6,
    HITSTOP_FRAMES_BOSS: 12,
    
    // Colors (RGB normalized for Three.js)
    COLOR_PLAYER: new Proxy({}, {
        get: () => [0.0, 1.0, 1.0] // Cyan
    }),
    COLOR_INVADER_SQUID: [1.0, 0.42, 0.62],
    COLOR_INVADER_CRAB: [0.3, 0.8, 0.77],
    COLOR_INVADER_OCTOPUS: [1.0, 0.9, 0.43],
    COLOR_BULLET_PLAYER: [0.0, 1.0, 1.0],
    COLOR_BOMB_ENEMY: [1.0, 0.2, 0.2],
    
    // Bloom settings
    BLOOM_STRENGTH_BASE: 1.5,
    BLOOM_RADIUS: 0.45,
    BLOOM_THRESHOLD: 0.85,
    
    // Audio
    AUDIO_MASTER_VOLUME: 0.7,
    AUDIO_MUSIC_VOLUME: 0.5,
    AUDIO_SFX_VOLUME: 0.8
};

export default CONSTANTS;

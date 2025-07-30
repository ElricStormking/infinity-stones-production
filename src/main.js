// Phaser is loaded globally from the script tag
// All classes are loaded globally

// Safe sound system - handles missing audio gracefully
window.SafeSound = {
    play: function(scene, key, config = {}) {
        try {
            if (scene.sound && scene.sound.get(key)) {
                return scene.sound.play(key, config);
            } else {
                console.log(`Audio '${key}' not found - playing silently`);
                return null;
            }
        } catch (error) {
            console.log(`Audio error for '${key}':`, error.message);
            return null;
        }
    },
    
    add: function(scene, key, config = {}) {
        try {
            if (scene.sound) {
                return scene.sound.add(key, config);
            }
        } catch (error) {
            console.log(`Audio add error for '${key}':`, error.message);
            return { play: () => {}, stop: () => {}, pause: () => {}, resume: () => {} };
        }
    }
};

// Phaser game configuration
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 1920,
    height: 1080,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1920,
        height: 1080,
        min: {
            width: 960,
            height: 540
        },
        max: {
            width: 1920,
            height: 1080
        }
    },
    scene: [window.LoadingScene, window.MenuScene, window.GameScene],
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    render: {
        antialias: true,
        pixelArt: false,
        roundPixels: false
    },
    audio: {
        disableWebAudio: false
    },
    input: {
        activePointers: 3,
        touch: {
            target: null,
            capture: true
        }
    },
    dom: {
        createContainer: true
    },
    fps: {
        target: 60,
        forceSetTimeOut: false
    }
};

// Initialize the game
window.addEventListener('load', () => {
    try {
        console.log('Initializing Infinity Storm game...');
        const game = new Phaser.Game(config);
        
        // Make game instance globally available for debugging
        window.game = game;
        console.log('Game initialized successfully!');
    } catch (error) {
        console.error('Failed to initialize game:', error);
        document.body.innerHTML = '<h1>Game Failed to Load</h1><p>Error: ' + error.message + '</p>';
    }
    
    // Handle resize events
    window.addEventListener('resize', () => {
        game.scale.refresh();
    });
    
    // Handle orientation change
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            game.scale.refresh();
        }, 100);
    });
    
    // Prevent context menu on right click
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
    
    // Handle visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            game.sound.pauseAll();
        } else {
            game.sound.resumeAll();
        }
    });
}); 
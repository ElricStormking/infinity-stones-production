// Phaser is loaded globally from the script tag
// All classes are loaded globally

// Audio initialization flag
window.AudioInitialized = false;

// Safe sound system - handles missing audio gracefully
window.SafeSound = {
    initAudio: function(scene) {
        if (!window.AudioInitialized && scene.sound && scene.sound.context) {
            console.log('🔊 Initializing audio context after user interaction');
            try {
                if (scene.sound.context.state === 'suspended') {
                    scene.sound.context.resume().then(() => {
                        console.log('🔊 Audio context resumed successfully');
                        window.AudioInitialized = true;
                    });
                } else {
                    window.AudioInitialized = true;
                    console.log('🔊 Audio context already active');
                }
            } catch (error) {
                console.log('🔊 Audio context resume error:', error);
            }
        }
    },
    
    play: function(scene, key, config = {}) {
        // Try to initialize audio if not done yet
        this.initAudio(scene);
        
        try {
            console.log(`🔊 Attempting to play '${key}'`);
            console.log(`🔊 Scene sound manager exists:`, !!scene.sound);
            
            if (scene.sound) {
                // Check cache directly first (more reliable than Sound.get())
                const audioCache = scene.cache.audio;
                const hasAudio = audioCache && audioCache.exists(key);
                console.log(`🔊 Audio '${key}' in cache:`, hasAudio);
                
                if (hasAudio) {
                    try {
                        console.log(`🔊 Playing '${key}' from cache`);
                        return scene.sound.play(key, config);
                    } catch (playError) {
                        console.log(`🔊 Play failed for '${key}':`, playError.message);
                        return null;
                    }
                } else {
                    console.log(`🔊 Audio '${key}' not found in cache - playing silently`);
                    const availableKeys = audioCache ? audioCache.getKeys() : [];
                    console.log(`🔊 Available audio keys: [${availableKeys.join(', ')}]`);
                    return null;
                }
            } else {
                console.log(`🔊 No sound manager available - playing silently`);
                return null;
            }
        } catch (error) {
            console.log(`🔊 Audio error for '${key}':`, error.message);
            return null;
        }
    },
    
    // BGM Management Functions
    currentBGM: null,
    bgmInitialized: false,
    
    switchBGM: function(scene, newBGMKey) {
        console.log(`🎵 === SWITCHING BGM TO '${newBGMKey}' ===`);
        console.log(`🎵 Current BGM:`, this.currentBGM ? this.currentBGM.key : 'None');
        console.log(`🎵 BGM Initialized:`, this.bgmInitialized);
        
        this.bgmInitialized = true;
        
        // Stop ALL audio first to prevent conflicts
        if (scene.sound) {
            console.log(`🎵 Stopping all background music...`);
            scene.sound.stopAll();
        }
        
        // Reset current BGM reference
        this.currentBGM = null;
        
        // Debug scene and sound system
        console.log(`🎵 Scene exists:`, !!scene);
        console.log(`🎵 Scene.sound exists:`, !!(scene && scene.sound));
        console.log(`🎵 Looking for audio key:`, newBGMKey);
        
        if (scene && scene.sound) {
            // Check cache directly first
            let cacheExists = false;
            let audioKeys = [];
            if (scene.cache && scene.cache.audio) {
                cacheExists = scene.cache.audio.exists(newBGMKey);
                audioKeys = scene.cache.audio.getKeys();
                console.log(`🎵 Cache.audio.exists('${newBGMKey}'):`, cacheExists);
                console.log(`🎵 All available audio keys:`, audioKeys);
            }
            
            // Use cache existence as the primary check since Sound.get() seems unreliable
            if (cacheExists) {
                console.log(`🎵 Found '${newBGMKey}' in audio cache - creating new instance directly`);
                try {
                    // Create BGM directly from cache since it exists there
                    this.currentBGM = scene.sound.add(newBGMKey, { 
                        loop: true, 
                        volume: 0.5 
                    });
                    console.log(`🎵 BGM object created:`, this.currentBGM);
                    
                    // Add event listeners for debugging
                    this.currentBGM.on('play', () => {
                        console.log(`🎵 ✅ BGM '${newBGMKey}' PLAYING`);
                    });
                    this.currentBGM.on('stop', () => {
                        console.log(`🎵 ⏹️ BGM '${newBGMKey}' STOPPED`);
                    });
                    this.currentBGM.on('pause', () => {
                        console.log(`🎵 ⏸️ BGM '${newBGMKey}' PAUSED`);
                    });
                    this.currentBGM.on('looped', () => {
                        console.log(`🎵 🔄 BGM '${newBGMKey}' LOOPED`);
                    });
                    
                    console.log(`🎵 Attempting to play BGM...`);
                    this.currentBGM.play();
                    console.log(`🎵 ✅ BGM '${newBGMKey}' PLAY COMMAND EXECUTED`);
                } catch (error) {
                    console.log(`🎵 ❌ Error creating/playing BGM:`, error);
                }
            } else {
                console.log(`🎵 ❌ BGM '${newBGMKey}' NOT FOUND in audio cache`);
                console.log(`🎵 Available keys: [${audioKeys.join(', ')}]`);
            }
        } else {
            console.log(`🎵 ❌ Scene or scene.sound not available`);
            console.log(`🎵 Scene:`, scene);
            console.log(`🎵 Scene.sound:`, scene ? scene.sound : 'N/A');
        }
    },
    
    startMainBGM: function(scene) {
        this.switchBGM(scene, 'bgm_infinity_storm');
    },
    
    startFreeSpinsBGM: function(scene) {
        this.switchBGM(scene, 'bgm_free_spins');
    },
    
    stopBGM: function() {
        if (this.currentBGM) {
            console.log(`🎵 Stopping BGM: '${this.currentBGM.key}'`);
            this.currentBGM.stop();
            this.currentBGM = null;
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
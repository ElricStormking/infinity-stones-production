// Phaser is loaded globally
// GameStateManager is loaded globally

window.LoadingScene = class LoadingScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LoadingScene' });
        console.log('LoadingScene constructor called');
    }
    
    preload() {
        console.log('LoadingScene preload started');
        // Initialize game state manager
        this.game.stateManager = new window.GameStateManager();
        console.log('GameStateManager initialized');
        
        // Create loading bar
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Background
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000);
        
        // Title
        const title = this.add.text(width / 2, height / 2 - 100, 'INFINITY STORM', {
            fontSize: '48px',
            fontFamily: 'Arial Black',
            color: '#ffffff',
            stroke: '#6B46C1',
            strokeThickness: 6
        });
        title.setOrigin(0.5);
        
        // Progress bar background
        const progressBox = this.add.graphics();
        const progressBar = this.add.graphics();
        
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 320, height / 2 - 25, 640, 50);
        
        // Loading text
        const loadingText = this.make.text({
            x: width / 2,
            y: height / 2 + 50,
            text: 'Loading...',
            style: {
                font: '20px Arial',
                color: '#ffffff'
            }
        });
        loadingText.setOrigin(0.5);
        
        // Asset text
        const assetText = this.make.text({
            x: width / 2,
            y: height / 2 + 100,
            text: '',
            style: {
                font: '18px Arial',
                color: '#ffffff'
            }
        });
        assetText.setOrigin(0.5);
        
        // Update progress bar
        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0x9B59B6, 1);
            progressBar.fillRect(width / 2 - 315, height / 2 - 20, 630 * value, 40);
            loadingText.setText(`Loading... ${Math.round(value * 100)}%`);
        });
        
        this.load.on('fileprogress', (file) => {
            assetText.setText('Loading: ' + file.key);
        });
        
        this.load.on('complete', () => {
            console.log('Load complete event fired');
            console.log(`Loaded: ${this.load.totalComplete}/${this.load.totalToLoad} files`);
            
            // Ensure all textures exist even after loading
            this.createAllFallbackTextures();
            
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            assetText.destroy();
            
            // Proceed to menu
            this.time.delayedCall(100, () => {
                this.scene.start('MenuScene');
            });
        });
        
        this.load.on('loaderror', (file) => {
            console.error('Failed to load:', file.key, file.src);
            assetText.setText('Error loading: ' + file.key);
        });
        
        // Load game assets - actual gem images and placeholder textures
        this.loadGameAssets();
        
        // Add a timeout to force loading to complete if it hangs
        this.time.delayedCall(3000, () => {
            if (!this.load.isLoading() && this.load.totalComplete === this.load.totalToLoad) {
                return; // Already finished successfully
            }
            
            console.warn('Loading timeout or errors detected - creating fallback textures');
            assetText.setText('Creating fallback textures...');
            
            // Stop the loader to prevent further errors
            this.load.reset();
            this.load.removeAllListeners();
            
            // Ensure all essential textures exist before continuing
            this.createAllFallbackTextures();
            
            this.time.delayedCall(500, () => {
                console.log('Proceeding to MenuScene with fallback textures');
                this.scene.start('MenuScene');
            });
        });
    }
    
    loadGameAssets() {
        // First, create all essential textures immediately to ensure they exist
        this.createEssentialTextures();
        
        // Load gem images that exist
        this.loadImageWithFallback('space_gem', 'assets/images/space_gem.png', 0x0099FF);
        this.loadImageWithFallback('mind_gem', 'assets/images/mind_gem.png', 0x00FFFF);
        this.loadImageWithFallback('reality_gem', 'assets/images/reality_gem.png', 0xFF0000);
        this.loadImageWithFallback('power_gem', 'assets/images/power_gem.png', 0x9932CC);
        this.loadImageWithFallback('time_gem', 'assets/images/time_gem.png', 0x00FF00);
        this.loadImageWithFallback('soul_gem', 'assets/images/soul_gem.png', 0xFF8C00);
        this.loadImageWithFallback('infinity_glove', 'assets/images/infinity_glove.png', 0xFFD700);
        
        // Load character images that exist
        this.loadImageWithFallback('portrait_thanos', 'assets/images/portrait_thanos.png', 0x4B0082);
        // Load Scarlet Witch animation frames - new idle2 and attack animations
        try {
            // Load redwitch-attack animation frames (0-31)
            for (let i = 0; i <= 31; i++) {
                const frameNum = i.toString().padStart(2, '0');
                this.load.image(`redwitch-attack_${frameNum}`, `assets/images/sprites/portrait_scarlet_witch/redwitch-attack_${frameNum}.png`);
            }
            
            // Load redwitch-idle2 animation frames (32-63)
            for (let i = 32; i <= 63; i++) {
                const frameNum = i.toString().padStart(2, '0');
                this.load.image(`redwitch-idle2_${frameNum}`, `assets/images/sprites/portrait_scarlet_witch/redwitch-idle2_${frameNum}.png`);
            }
            
            // Load the new JSON animation file
            this.load.json('scarlet_witch_animations', 'assets/images/sprites/portrait_scarlet_witch/redwitchnew_an.json');
            
            // Set up error handler for Scarlet Witch animations
            this.load.once('fileerror-json-scarlet_witch_animations', () => {
                console.warn('Failed to load Scarlet Witch animations JSON, creating fallback');
                this.createFallbackScarletWitchAnimation();
            });
        } catch (error) {
            console.warn('Failed to load Scarlet Witch animation assets:', error);
            this.createFallbackScarletWitchAnimation();
        }
        
        // Load Thanos idle animation frames (0-31)
        try {
            for (let i = 0; i <= 31; i++) {
                const frameNum = i.toString().padStart(2, '0');
                this.load.image(`thanos-idle_${frameNum}`, `assets/images/sprites/portrait_thanos/thanos-idle_${frameNum}.png`);
            }
            
            // Load Thanos attack animation frames (0-27)
            for (let i = 0; i <= 27; i++) {
                const frameNum = i.toString().padStart(2, '0');
                this.load.image(`thanos-attack_${frameNum}`, `assets/images/sprites/portrait_thanos/thanos-attack_${frameNum}.png`);
            }
            
            // Load the JSON animation file
            this.load.json('thanos_new_animations', 'assets/images/sprites/portrait_thanos/thanosnew_an.json');
            
            // Set up error handler for Thanos animations
            this.load.once('fileerror-json-thanos_new_animations', () => {
                console.warn('Failed to load Thanos animations JSON, creating fallback');
                this.createFallbackThanosAnimation();
            });
        } catch (error) {
            console.warn('Failed to load Thanos animation assets:', error);
            this.createFallbackThanosAnimation();
        }
        
        // Also load static portraits as fallback
        this.loadImageWithFallback('portrait_scarlet_witch', 'assets/images/portrait_scarlet_witch.png', 0xDC143C);
        this.loadImageWithFallback('portrait_thanos', 'assets/images/portrait_thanos.png', 0x4B0082);
        this.loadImageWithFallback('thanos', 'assets/images/thanos.png', 0x4B0082);
        this.loadImageWithFallback('scarlet_witch', 'assets/images/scarlet_witch.png', 0xDC143C);
        this.loadImageWithFallback('thanos_weapon', 'assets/images/thanos_weapon.png', 0xFF1493);
        
        // Load background and grid
        this.loadImageWithFallback('bg_infinity_storm', 'assets/images/BG_infinity_storm.png', 0x1a1a2e);
        this.loadImageWithFallback('ui_box', 'assets/images/ui_box.png', 0x4a4a4a);
        
        // Load UI elements that actually exist
        this.loadImageWithFallback('ui_bottom_panel', 'assets/images/ui_bottom_panel.png', 0x333333);
        this.loadImageWithFallback('ui_freegame', 'assets/images/ui_freegame.png', 0x666666);
        this.loadImageWithFallback('ui_number_bet', 'assets/images/ui_number_bet.png', 0x444444);
        this.loadImageWithFallback('ui_number_bet-', 'assets/images/ui_number_bet-.png', 0x444444);
        this.loadImageWithFallback('ui_number_bet+', 'assets/images/ui_number_bet+.png', 0x444444);
        this.loadImageWithFallback('ui_number_score', 'assets/images/ui_number_score.png', 0x444444);
        this.loadImageWithFallback('ui_number_win', 'assets/images/ui_number_win.png', 0x444444);
        this.loadImageWithFallback('ui_accumulated_multiplier', 'assets/images/ui_accumulated_multiplier.png', 0x555555);
        this.loadImageWithFallback('ui_small_burst', 'assets/images/ui_small_burst.png', 0x666666);
        this.loadImageWithFallback('ui_small_menu', 'assets/images/ui_small_menu.png', 0x666666);
        this.loadImageWithFallback('ui_small_stop', 'assets/images/ui_small_stop.png', 0x666666);
        this.loadImageWithFallback('ui_spin', 'assets/images/ui_spin.png', 0x777777);
        this.loadImageWithFallback('ui_title', 'assets/images/ui_title.png', 0x888888);
        this.loadImageWithFallback('ui_top', 'assets/images/ui_top.png', 0x999999);
        
        // Load spritesheets
        try {
            // Money animation spritesheet
        this.load.spritesheet('money_sprite', 'assets/images/sprites/money/money_sprite.png', {
                frameWidth: 185,
                frameHeight: 185
            });
            
            // Win animation spritesheet
            this.load.spritesheet('win_sprite', 'assets/images/sprites/Winanimation/win_01_sprite.png', {
                frameWidth: 512,
                frameHeight: 512
            });
            
            // Button light animation spritesheet
            this.load.spritesheet('button_light_sprite', 'assets/images/sprites/button_light/button_light_sprite.png', {
                frameWidth: 256,
                frameHeight: 256
            });
        } catch (error) {
            console.warn('Failed to load sprite sheets:', error);
        }
        
        // Load burst mode assets individually
        try {
            console.log('Loading burst mode assets...');
            
            // Load burst mode backgrounds and UI elements
            this.loadImageWithFallback('ui_bn_bg', 'assets/images/burstmode/ui_bn_bg.png', 0x1a1a1a);
            this.loadImageWithFallback('ui_bn_under', 'assets/images/burstmode/ui_bn_under.png', 0x2a2a2a);
            this.loadImageWithFallback('ui_bn_box', 'assets/images/burstmode/ui_bn_box.png', 0x3a3a3a);
            
            // Load burst mode number displays
            this.loadImageWithFallback('ui_bn_number_score', 'assets/images/burstmode/ui_bn_number_score.png', 0x4a4a4a);
            this.loadImageWithFallback('ui_bn_number_win', 'assets/images/burstmode/ui_bn_number_win.png', 0x4a4a4a);
            this.loadImageWithFallback('ui_bn_number_bet', 'assets/images/burstmode/ui_bn_number_bet.png', 0x4a4a4a);
            this.loadImageWithFallback('ui_bn_number_bet-', 'assets/images/burstmode/ui_bn_number_bet-.png', 0x4a4a4a);
            this.loadImageWithFallback('ui_bn_number_bet+', 'assets/images/burstmode/ui_bn_number_bet+.png', 0x4a4a4a);
            
            // Load burst mode buttons
            this.loadImageWithFallback('ui_bn_small_burst', 'assets/images/burstmode/ui_bn_small_burst.png', 0x5a5a5a);
            this.loadImageWithFallback('ui_bn_small_menu', 'assets/images/burstmode/ui_bn_small_menu.png', 0x5a5a5a);
            this.loadImageWithFallback('ui_bn_small_stop', 'assets/images/burstmode/ui_bn_small_stop.png', 0x5a5a5a);
            this.loadImageWithFallback('ui_burst_spin1', 'assets/images/burstmode/ui_burst_spin1.png', 0x5a5a5a);
            
            // Load burst mode spin button sprite sheet
            this.load.spritesheet('ui_bn_spin', 'assets/images/burstmode/ui_bn_spin.png', {
                frameWidth: 244,
                frameHeight: 244
            });
            
            // Set up error handler for spin sprite sheet
            this.load.once('fileerror-spritesheet-ui_bn_spin', () => {
                console.warn('Failed to load ui_bn_spin sprite sheet, creating fallback');
                const fallbackTexture = this.generateColoredTexture(0x777777, 'SPIN');
                this.textures.addBase64('ui_bn_spin', fallbackTexture);
            });
            
            // Load all magic animation frames
            console.log('Loading burst magic animation frames...');
            for (let i = 0; i < 48; i++) {
                const frameNum = String(i).padStart(2, '0');
                this.loadImageWithFallback(
                    `ui_bn_magic-an_${frameNum}`, 
                    `assets/images/burstmode/ui_burst_magic/ui_bn_magic-an_${frameNum}.png`, 
                    0x6a6a6a
                );
            }
            
            // Load burst mode animation JSONs
            this.load.json('burst_spin_animation_data', 'assets/images/burstmode/ui_bn_spin.json');
            this.load.json('burst_magic_animation_data', 'assets/images/burstmode/ui_burst_magic/ui_bn_magic.json');
            
            // Set up error handlers for JSON files
            this.load.once('fileerror-json-burst_spin_animation_data', () => {
                console.warn('Failed to load burst spin animation data');
            });
            
            this.load.once('fileerror-json-burst_magic_animation_data', () => {
                console.warn('Failed to load burst magic animation data');
            });
            
        } catch (error) {
            console.warn('Failed to load burst mode assets:', error);
        }
        
        // Load gem destruction animations - updated to use individual animation files
        try {
            // Load gem destruction sprite sheets with updated frame size (240x240)
            this.load.spritesheet('timegem_destruction', 'assets/images/sprites/gem_destruction/timegem_des.png', {
                frameWidth: 240,
                frameHeight: 240
            });
            
            this.load.spritesheet('realitygem_destruction', 'assets/images/sprites/gem_destruction/realitygem_des.png', {
                frameWidth: 240,
                frameHeight: 240
            });
            
            this.load.spritesheet('powergem_destruction', 'assets/images/sprites/gem_destruction/powergem_des.png', {
                frameWidth: 240,
                frameHeight: 240
            });
            
            this.load.spritesheet('spacegem_destruction', 'assets/images/sprites/gem_destruction/spacegem_des.png', {
                frameWidth: 240,
                frameHeight: 240
            });
            
            this.load.spritesheet('soulgem_destruction', 'assets/images/sprites/gem_destruction/soulgem_des.png', {
                frameWidth: 240,
                frameHeight: 240
            });
            
            this.load.spritesheet('mindgem_destruction', 'assets/images/sprites/gem_destruction/mindgem_des.png', {
                frameWidth: 240,
                frameHeight: 240
            });
            
            // Load individual gem destruction animation JSON files
            this.load.json('timegem_animations', 'assets/images/sprites/gem_destruction/timegem_animation.json');
            this.load.json('realitygem_animations', 'assets/images/sprites/gem_destruction/realitygem_animation.json');
            this.load.json('powergem_animations', 'assets/images/sprites/gem_destruction/powergem_animation.json');
            this.load.json('spacegem_animations', 'assets/images/sprites/gem_destruction/spacegem_animation.json');
            this.load.json('soulgem_animations', 'assets/images/sprites/gem_destruction/soulgem_animation.json');
            this.load.json('mindgem_animations', 'assets/images/sprites/gem_destruction/mindgem_animation.json');
        } catch (error) {
            console.warn('Failed to load gem destruction assets:', error);
        }
        
        // Load spin button animation assets - updated to use spinbuttonloop
        try {
            this.load.spritesheet('ui_buttonloop_sprite', 'assets/images/sprites/spinbuttonloop/ui_buttonloop_sprite.png', {
                frameWidth: 244,
                frameHeight: 244
            });
            this.load.json('spin_button_animations', 'assets/images/sprites/spinbuttonloop/buttonloop_animation.json');
            
            // Set up error handlers for spin button assets
            this.load.once('fileerror-spritesheet-ui_buttonloop_sprite', () => {
                console.warn('Failed to load ui_buttonloop_sprite, creating fallback');
                const fallbackTexture = this.generateColoredTexture(0x777777, 'SPIN');
                this.textures.addBase64('ui_buttonloop_sprite', fallbackTexture);
            });
            
            this.load.once('fileerror-json-spin_button_animations', () => {
                console.warn('Failed to load spin button animations JSON, creating fallback');
                // Create a simple fallback animation configuration
                this.cache.json.add('spin_button_animations', {
                    anims: [{
                        key: 'animation',
                        frames: [{ key: 'ui_buttonloop_sprite', frame: 0 }],
                        frameRate: 24,
                        repeat: -1
                    }]
                });
            });
            
        } catch (error) {
            console.warn('Failed to load spin button assets:', error);
            // Create fallback textures immediately
            const fallbackTexture = this.generateColoredTexture(0x777777, 'SPIN');
            this.textures.addBase64('ui_buttonloop_sprite', fallbackTexture);
        }
        
        // Load win presentation animations
        try {
            // Win animations for different categories
            this.load.spritesheet('win_01_sprite', 'assets/images/sprites/Winanimation/win_01_sprite.png', {
                frameWidth: 529,
                frameHeight: 222
            });
            this.load.spritesheet('win_02big_sprite', 'assets/images/sprites/Winanimation/win_02big_sprite.png', {
                frameWidth: 529,
                frameHeight: 395
            });
            this.load.spritesheet('win_03mega_sprite', 'assets/images/sprites/Winanimation/win_03mega_sprite.png', {
                frameWidth: 625,
                frameHeight: 398
            });
            this.load.spritesheet('win_04ultra', 'assets/images/sprites/Winanimation/win_04ultra.png', {
                frameWidth: 666,
                frameHeight: 395
            });
            this.load.spritesheet('win_05leg_sprite', 'assets/images/sprites/Winanimation/win_05leg_sprite.png', {
                frameWidth: 1018,
                frameHeight: 379
            });
            this.load.json('win_animations', 'assets/images/sprites/Winanimation/win_animation.json');
            
            // Load win particle frames
            for (let i = 0; i <= 31; i++) {
                const num = i.toString().padStart(2, '0');
                this.load.image(`skeleton-animation_${num}`, `assets/images/sprites/winparticle/skeleton-animation_${num}.png`);
            }
        } catch (error) {
            console.warn('Failed to load win presentation assets:', error);
        }
        
        // Load shader script
        this.load.script('redLightningShader', 'src/shaders/RedLightningShader.js');
        
        // Set up error handler for shader script
        this.load.once('fileerror-script-redLightningShader', () => {
            console.warn('Failed to load Red Lightning shader script');
        });
        
        // Try to load audio files with comprehensive error handling
        const isFileProtocol = window.location.protocol === 'file:';
        console.log('🔊 Loading audio files. Protocol:', window.location.protocol);
        console.log('🔊 Audio context state:', this.sound ? this.sound.context ? this.sound.context.state : 'no context' : 'no sound manager');
        
        try {
            // Load multiple format fallbacks for better browser compatibility
            this.load.audio('bgm_infinity_storm', 'assets/audio/BGM_infinity_storm.mp3');
            this.load.audio('bgm_free_spins', 'assets/audio/BGM_free_spins.mp3');
            this.load.audio('lightning_struck', 'assets/audio/lightning_struck.mp3');
            this.load.audio('symbol_shattering', 'assets/audio/symbol_shattering.mp3');
            
            console.log('🔊 Audio files queued for loading: bgm_infinity_storm, bgm_free_spins, lightning_struck, symbol_shattering');
            
            // Set up comprehensive error handlers
            this.load.once('fileerror-audio-bgm_infinity_storm', (error) => {
                console.log('❌ Background music failed to load:', error);
            });
            this.load.once('fileerror-audio-bgm_free_spins', (error) => {
                console.log('❌ Free spins BGM failed to load:', error);
            });
            this.load.once('fileerror-audio-lightning_struck', (error) => {
                console.log('❌ Lightning sound effect failed to load:', error);
            });
            this.load.once('fileerror-audio-symbol_shattering', (error) => {
                console.log('❌ Symbol shattering sound effect failed to load:', error);
            });
            
            // Success handlers to confirm loading
            this.load.once('filecomplete-audio-bgm_free_spins', () => {
                console.log('✅ Free spins BGM loaded successfully!');
            });
            this.load.once('filecomplete-audio-lightning_struck', () => {
                console.log('✅ Lightning sound effect loaded successfully!');
            });
            this.load.once('filecomplete-audio-symbol_shattering', () => {
                console.log('✅ Symbol shattering sound effect loaded successfully!');
            });
            
            // General audio loading complete handler
            this.load.once('complete', () => {
                console.log('🔊 All loading complete. Checking audio availability:');
                setTimeout(() => {
                    const hasMainBGM = this.sound && this.sound.get('bgm_infinity_storm');
                    const hasFreeSpinsBGM = this.sound && this.sound.get('bgm_free_spins');
                    const hasLightning = this.sound && this.sound.get('lightning_struck');
                    const hasShattering = this.sound && this.sound.get('symbol_shattering');
                    console.log('🔊 Main BGM available:', !!hasMainBGM);
                    console.log('🔊 Free Spins BGM available:', !!hasFreeSpinsBGM);
                    console.log('🔊 Lightning available:', !!hasLightning);
                    console.log('🔊 Shattering available:', !!hasShattering);
                }, 100);
            });
            
        } catch (error) {
            console.log('❌ Audio loading error - continuing without audio:', error);
        }
        
        console.log('Loading game assets...');
    }
    
    createEssentialTextures() {
        console.log('Creating essential textures...');
        
        // Create all required textures immediately
        const textures = {
            'button': null,
            'background': null,
            'particle': null
        };
        
        // Generate symbol textures
        Object.keys(textures).forEach(key => {
            try {
                let textureData;
                if (textures[key] === null) {
                    // Special textures
                    switch(key) {
                        case 'button':
                            textureData = this.generateButtonTexture();
                            break;
                        case 'background':
                            textureData = this.generateBackgroundTexture();
                            break;
                        case 'particle':
                            textureData = this.generateParticleTexture();
                            break;
                    }
                } else {
                    // Symbol textures
                    textureData = this.generateColoredTexture(textures[key].color, textures[key].text);
                }
                
                // Add texture to loader
                this.textures.addBase64(key, textureData);
                console.log(`Created essential texture: ${key}`);
            } catch (error) {
                console.error(`Failed to create texture ${key}:`, error);
                // Create minimal fallback
                this.textures.addBase64(key, this.generateMinimalTexture());
            }
        });
    }
    
    loadImageWithFallback(key, path, fallbackColor) {
        // Try to load the image
        try {
            this.load.image(key, path);
            
            // Set up error handler for this specific image
            this.load.once(`fileerror-image-${key}`, () => {
                console.warn(`Failed to load ${key} from ${path}, creating fallback`);
                // Create fallback texture immediately
                const fallbackTexture = this.generateColoredTexture(fallbackColor, key.replace(/_/g, ' ').toUpperCase());
                this.textures.addBase64(key, fallbackTexture);
            });
            
            // Also set up a success handler to confirm loading
            this.load.once(`filecomplete-image-${key}`, () => {
                console.log(`Successfully loaded: ${key}`);
            });
        } catch (error) {
            console.warn(`Error setting up load for ${key}:`, error);
            // Create fallback texture immediately
            const fallbackTexture = this.generateColoredTexture(fallbackColor, key.replace(/_/g, ' ').toUpperCase());
            this.textures.addBase64(key, fallbackTexture);
        }
    }
    
    generateMinimalTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        
        // Simple gray square
        ctx.fillStyle = '#666666';
        ctx.fillRect(0, 0, 100, 100);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, 98, 98);
        
        return canvas.toDataURL();
    }
    
    generateColoredTexture(color, text) {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        
        // Draw colored square
        ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        ctx.fillRect(0, 0, 100, 100);
        
        // Add border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, 96, 96);
        
        // Add text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const displayText = text.replace(/_/g, ' ').toUpperCase();
        const words = displayText.split(' ');
        
        // Handle different numbers of words
        if (words.length === 1) {
            ctx.fillText(words[0], 50, 50);
        } else if (words.length === 2) {
            ctx.fillText(words[0], 50, 40);
            ctx.fillText(words[1], 50, 60);
        } else if (words.length === 3) {
            ctx.fillText(words[0], 50, 30);
            ctx.fillText(words[1], 50, 50);
            ctx.fillText(words[2], 50, 70);
        } else {
            // Too many words, just show first two
            ctx.fillText(words[0], 50, 40);
            ctx.fillText(words.slice(1).join(' '), 50, 60);
        }
        
        return canvas.toDataURL();
    }
    
    generateButtonTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 60;
        const ctx = canvas.getContext('2d');
        
        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, 60);
        gradient.addColorStop(0, '#9B59B6');
        gradient.addColorStop(1, '#6B46C1');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 200, 60);
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, 198, 58);
        
        return canvas.toDataURL();
    }
    
    generateBackgroundTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        
        // Create a simple pattern
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, 32, 32);
        
        ctx.fillStyle = '#16213e';
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillRect(16, 16, 16, 16);
        
        return canvas.toDataURL();
    }
    
    generateParticleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        
        // Create a radial gradient circle for particle
        const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(8, 8, 8, 0, Math.PI * 2);
        ctx.fill();
        
        return canvas.toDataURL();
    }
    
    createAllFallbackTextures() {
        console.log('Creating all fallback textures...');
        
        // Define all textures with their fallback colors
        const textureDefinitions = {
            // Gems
            'space_gem': 0x0099FF,
            'mind_gem': 0x00FFFF,
            'reality_gem': 0xFF0000,
            'power_gem': 0x9932CC,
            'time_gem': 0x00FF00,
            'soul_gem': 0xFF8C00,
            'infinity_glove': 0xFFD700,
            
            // Characters
            'portrait_thanos': 0x4B0082,
            'portrait_scarlet_witch': 0xDC143C,
            'thanos': 0x4B0082,
            'scarlet_witch': 0xDC143C,
            
            // Backgrounds
            'bg_infinity_storm': 0x1a1a2e,
            'ui_box': 0x4a4a4a,
            
            // UI Elements
            'ui_bottom_panel': 0x333333,
            'ui_freegame': 0x666666,
            'ui_number_bet': 0x444444,
            'ui_number_bet-': 0x444444,
            'ui_number_bet+': 0x444444,
            'ui_number_score': 0x444444,
            'ui_number_win': 0x444444,
            'ui_accumulated_multiplier': 0x555555,
            'ui_small_burst': 0x666666,
            'ui_small_menu': 0x666666,
            'ui_small_stop': 0x666666,
            'ui_spin': 0x777777,
            'ui_buttonloop_sprite': 0x777777,
            'ui_title': 0x888888,
            'ui_top': 0x999999,
            'money_sprite': 0xFFD700
        };
        
        // Create fallback for each texture if it doesn't exist
        Object.entries(textureDefinitions).forEach(([key, color]) => {
            if (!this.textures.exists(key)) {
                console.log(`Creating fallback texture for: ${key}`);
                const texture = this.generateColoredTexture(color, key.replace(/_/g, ' ').toUpperCase());
                this.textures.addBase64(key, texture);
            }
        });
        
        // Also ensure essential textures exist
        this.ensureAllTexturesExist();
    }
    
    ensureAllTexturesExist() {
        console.log('Ensuring all textures exist...');
        const requiredTextures = [
            'space_gem', 'mind_gem', 'reality_gem', 'power_gem', 'time_gem', 'soul_gem',
            'infinity_glove', 'thanos', 'scarlet_witch', 'thanos_weapon',
            'portrait_thanos', 'portrait_scarlet_witch', 'bg_infinity_storm',
            'button', 'background', 'particle', 'ui_box',
            'ui_bottom_panel', 'ui_freegame', 'ui_number_bet', 'ui_number_bet-', 'ui_number_bet+',
            'ui_number_score', 'ui_number_win', 'ui_accumulated_multiplier', 'ui_small_burst', 'ui_small_menu',
            'ui_small_stop', 'ui_spin', 'ui_buttonloop_sprite', 'ui_title', 'ui_top', 'money_sprite'
        ];
        
        requiredTextures.forEach(key => {
            if (!this.textures.exists(key)) {
                console.warn(`Texture ${key} missing, creating minimal fallback`);
                this.textures.addBase64(key, this.generateMinimalTexture());
            }
        });
    }
    
    createFallbackScarletWitchAnimation() {
        console.log('Creating fallback Scarlet Witch animation');
        // Create fallback animation configuration with both idle and attack animations
        const fallbackAnimation = {
            anims: [
                {
                    key: 'idle',
                    frames: [],
                    frameRate: 20,
                    repeat: -1
                },
                {
                    key: 'attack',
                    frames: [],
                    frameRate: 24,
                    repeat: -1
                }
            ]
        };
        
        // Generate frames array for idle animation (frames 32-63)
        for (let i = 32; i <= 63; i++) {
            const frameKey = `redwitch-idle2_${i.toString().padStart(2, '0')}`;
            fallbackAnimation.anims[0].frames.push({
                key: frameKey,
                frame: 0
            });
        }
        
        // Generate frames array for attack animation (frames 0-31)
        for (let i = 0; i <= 31; i++) {
            const frameKey = `redwitch-attack_${i.toString().padStart(2, '0')}`;
            fallbackAnimation.anims[1].frames.push({
                key: frameKey,
                frame: 0
            });
        }
        
        this.cache.json.add('scarlet_witch_animations', fallbackAnimation);
        console.log('Fallback Scarlet Witch animations created');
    }
    
    createFallbackThanosAnimation() {
        console.log('Creating fallback Thanos animation');
        // Create fallback animation configuration with both idle and attack
        const fallbackAnimation = {
            anims: [
                {
                    key: 'idle',
                    frames: [],
                    frameRate: 24,
                    repeat: -1
                },
                {
                    key: 'attack',
                    frames: [],
                    frameRate: 18,
                    repeat: 0
                }
            ]
        };
        
        // Generate idle frames array (0-31)
        for (let i = 0; i <= 31; i++) {
            const frameKey = `thanos-idle_${i.toString().padStart(2, '0')}`;
            fallbackAnimation.anims[0].frames.push({
                key: frameKey,
                frame: 0
            });
        }
        
        // Generate attack frames array (0-27)
        for (let i = 0; i <= 27; i++) {
            const frameKey = `thanos-attack_${i.toString().padStart(2, '0')}`;
            fallbackAnimation.anims[1].frames.push({
                key: frameKey,
                frame: 0
            });
        }
        
        this.cache.json.add('thanos_new_animations', fallbackAnimation);
        console.log('Fallback Thanos animation created');
    }
    
    create() {
        console.log('LoadingScene create() called - transitioning to MenuScene');
        
        // Register the Red Lightning shader if it was loaded
        if (window.RedLightningShader) {
            try {
                this.cache.shader.add('RedLightning', window.RedLightningShader.fragmentShader);
                console.log('Red Lightning shader registered successfully');
            } catch (error) {
                console.warn('Failed to register Red Lightning shader:', error);
            }
        }
        
        // Add a short delay before transitioning
        this.time.delayedCall(500, () => {
            console.log('Starting MenuScene...');
            this.scene.start('MenuScene');
        });
    }
} 
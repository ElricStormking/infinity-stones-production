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
        
        // Background: show fallback first, replace with Scarlet Witch image once loaded
        const bgFallback = this.add.rectangle(width / 2, height / 2, width, height, 0x000000);
        bgFallback.setDepth(-1000);

        try {
            // Queue the loading-screen background image
            this.load.image('scarlet_witch_loading', 'assets/images/scarlet_witch_loading.png');

            // When ready, replace the fallback with the real image and scale to fill
            this.load.once('filecomplete-image-scarlet_witch_loading', () => {
                try { bgFallback.destroy(); } catch (e) {}
                const bg = this.add.image(width / 2, height / 2, 'scarlet_witch_loading');
                bg.setOrigin(0.5);
                bg.setDisplaySize(width, height);
                bg.setScrollFactor(0);
                bg.setDepth(-1000);
            });

            // If it fails, keep the fallback rectangle
            this.load.once('fileerror-image-scarlet_witch_loading', () => {
                console.warn('Failed to load scarlet_witch_loading.png; using solid background');
            });
        } catch (e) {
            console.warn('Error queueing scarlet_witch_loading.png:', e);
        }
        
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
        progressBox.setDepth(10);
        progressBar.setDepth(10);
        
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
        loadingText.setDepth(10);
        
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
        assetText.setDepth(10);
        
        // Update progress bar using loader's real totals
        const updateProgress = () => {
            const total = this.load.totalToLoad || 0;
            const done = this.load.totalComplete || 0;
            const pct = total > 0 ? (done / total) : 0;
            progressBar.clear();
            progressBar.fillStyle(0x9B59B6, 1);
            progressBar.fillRect(width / 2 - 315, height / 2 - 20, 630 * pct, 40);
            loadingText.setText(`Loading... ${Math.round(pct * 100)}% (${done}/${total})`);
        };

        // Draw initial state at 0%
        updateProgress();

        this.load.on('progress', () => updateProgress());
        this.load.on('fileprogress', () => updateProgress());
        this.load.on('filecomplete', () => updateProgress());
        this.load.on('loaderror', () => updateProgress());
        
        this.load.on('fileprogress', (file) => {
            assetText.setText('Loading: ' + file.key);
        });
        
        this.load.on('complete', () => {
            console.log('Load complete event fired');
            console.log(`Loaded: ${this.load.totalComplete}/${this.load.totalToLoad} files`);
            
            // Ensure all textures exist even after loading
            this.createAllFallbackTextures();

            // Create scatter animation if spritesheet is present
            try {
                if (this.textures && this.textures.exists('infinity_glove_scatter_sprite') && !this.anims.exists('infinity_glove_scatter')) {
                    this.anims.create({
                        key: 'infinity_glove_scatter',
                        frames: this.anims.generateFrameNumbers('infinity_glove_scatter_sprite', { start: 0, end: 23 }),
                        frameRate: 16,
                        repeat: -1
                    });
                    console.log('✅ Infinity Glove scatter animation registered');
                }
            } catch (e) {
                console.warn('Failed to create infinity_glove scatter animation:', e);
            }

            // Create random multiplier frame animation if spritesheet is present
            try {
                if (this.textures && this.textures.exists('random_multiplier_frame_bonus_sprite') && !this.anims.exists('random_multiplier_frame_bonus')) {
                    this.anims.create({
                        key: 'random_multiplier_frame_bonus',
                        frames: this.anims.generateFrameNumbers('random_multiplier_frame_bonus_sprite', { start: 0, end: 7 }),
                        frameRate: 16,
                        repeat: -1
                    });
                    console.log('✅ Random Multiplier frame animation registered');
                }
            } catch (e) {
                console.warn('Failed to create random multiplier frame animation:', e);
            }
            
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            assetText.destroy();
            
            // Proceed to menu only after the next frame to ensure texture cache is ready
            this.time.addEvent({ delay: 50, callback: () => this.scene.start('MenuScene'), loop: false });
        });
        
        this.load.on('loaderror', (file) => {
            console.error('Failed to load:', file.key, file.src);
            assetText.setText('Error loading: ' + file.key);
        });
        
        // Load game assets - actual gem images and placeholder textures
        this.loadGameAssets();
        
        // Note: we intentionally avoid forcing timeouts here to ensure
        // the progress bar reflects real loading progress and we only
        // proceed once every queued asset resolves (success or fileerror).
    }
    
    loadGameAssets() {
        // RULE: Always preload any new functions/effects/artwork/audio here to avoid runtime 404s.
        // First, create all essential textures immediately to ensure they exist
        this.createEssentialTextures();
        
        // Load new 150x150 gem images
        this.loadImageWithFallback('time_gem', 'assets/images/gems/time_gem.png', 0xFFD700);     // Orange/Yellow
        this.loadImageWithFallback('mind_gem', 'assets/images/gems/mind_gem.png', 0x9932CC);     // Purple  
        this.loadImageWithFallback('reality_gem', 'assets/images/gems/reality_gem.png', 0xFF1493); // Pink/Red
        this.loadImageWithFallback('power_gem', 'assets/images/gems/power_gem.png', 0xFF8C00);   // Orange
        this.loadImageWithFallback('space_gem', 'assets/images/gems/space_gem.png', 0x0099FF);   // Blue
        this.loadImageWithFallback('soul_gem', 'assets/images/gems/soul_gem.png', 0x00FF00);     // Green
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

            // Load Thanos snap animation frames (added in latest assets)
            for (let i = 0; i <= 34; i++) {
                const frameNum = i.toString().padStart(2, '0');
                this.load.image(`thanos-snap_${frameNum}`, `assets/images/sprites/portrait_thanos/thanos-snap_${frameNum}.png`);
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
        
        // Infinity Glove scatter animation spritesheet (24 frames, 150x150)
        try {
            this.load.spritesheet('infinity_glove_scatter_sprite', 'assets/images/sprites/infinity_glove/infinity_glove_scatter_sprite.png', {
                frameWidth: 150,
                frameHeight: 150
            });
            this.load.once('fileerror-spritesheet-infinity_glove_scatter_sprite', () => {
                console.warn('Failed to load infinity_glove_scatter_sprite, falling back to static image');
            });
        } catch (error) {
            console.warn('Error setting up infinity_glove scatter spritesheet:', error);
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
        this.loadImageWithFallback('ui_boxBG', 'assets/images/ui_boxBG.png', 0x333333);
        this.loadImageWithFallback('random_multiplier_frame', 'assets/images/random_multiplier_frame.png', 0x2f2f2f);
        // Animated random multiplier frame (bonus) spritesheet
        try {
            this.load.spritesheet('random_multiplier_frame_bonus_sprite', 'assets/images/sprites/random_multiplier_frame/random_multiplier_frame_bonus_sprite.png', {
                frameWidth: 150,
                frameHeight: 150
            });
            this.load.once('fileerror-spritesheet-random_multiplier_frame_bonus_sprite', () => {
                console.warn('Failed to load random_multiplier_frame_bonus_sprite, fallback to static PNG');
            });
        } catch (error) {
            console.warn('Error setting up random multiplier frame spritesheet:', error);
        }
        
        // Load UI elements that actually exist
        this.loadImageWithFallback('ui_bottom_panel', 'assets/images/ui_bottom_panel.png', 0x333333);
        this.loadImageWithFallback('ui_freegame', 'assets/images/ui_freegame.png', 0x666666);
        // New Free Game Purchase button
        this.loadImageWithFallback('ui_freegame_purchase', 'assets/images/ui_freegame_purchase.png', 0x2E86C1);
        // Background art for Free Spins Purchase UI (prefer sprite, fallback to static PNG)
        this.loadImageWithFallback('free_spins_purchase_check', 'assets/images/free_spins_purchase_check.png', 0xDC143C);
        try {
            // Load individual frames for the animated variant (fg-redwitch_00..39)
            for (let i = 0; i <= 39; i++) {
                const num = i.toString().padStart(2, '0');
                const key = `fg-redwitch_${num}`;
                const path = `assets/images/sprites/free_spins_purchase_check/fg-redwitch_${num}.png`;
                this.load.image(key, path);
            }
            // Load its animation JSON (references keys above)
            this.load.json('free_spins_purchase_check_animations', 'assets/images/sprites/free_spins_purchase_check/fg_redwitch_an.json');
        } catch (e) {
            // Non-fatal: keep static fallback
            console.warn('Failed to queue fg_redwitch animated assets:', e);
        }
        // Settings UI assets (moved to sidemenu_UI)
        this.loadImageWithFallback('settings_ui_bg', 'assets/images/sidemenu_UI/sidemenu_bg.png', 0x111111);
        this.loadImageWithFallback('settings_ui_panel', 'assets/images/sidemenu_UI/settings.png', 0x222222);
        this.loadImageWithFallback('settings_ui_exit', 'assets/images/sidemenu_UI/exit.png', 0xAA3333);
        this.loadImageWithFallback('settings_ui_rules', 'assets/images/sidemenu_UI/rules.png', 0x3366AA);
        this.loadImageWithFallback('settings_ui_history', 'assets/images/sidemenu_UI/history.png', 0xAAAA33);
        this.loadImageWithFallback('settings_ui_settings', 'assets/images/sidemenu_UI/settings.png', 0x888888);
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
        this.loadImageWithFallback('ui_formula_plaque', 'assets/images/ui_formula_plaque.png', 0x888888);
        // ui_top currently unused
        
        // Free Spins Purchase UI assets (buttons and decorations)
        this.loadImageWithFallback('fg_button01', 'assets/images/fg_button01.png', 0x27AE60);
        this.loadImageWithFallback('fg_button02', 'assets/images/fg_button02.png', 0xE74C3C);
        this.loadImageWithFallback('fg_confirm_deco', 'assets/images/fg_confirm_deco.png', 0xFFD700);
        this.loadImageWithFallback('fg_confirm_UI', 'assets/images/fg_confirm_UI.png', 0x2C3E50);

        // Load spritesheets
        try {
            // Money animation spritesheet (use exact frame size to avoid edge clipping)
            this.load.spritesheet('money_sprite', 'assets/images/sprites/money/money_sprite.png', {
                frameWidth: 174,
                frameHeight: 174
            });
            
            // Win animation spritesheet
            this.load.spritesheet('win_sprite', 'assets/images/sprites/Winanimation/win_01_sprite.png', {
                frameWidth: 512,
                frameHeight: 512
            });
            
            // Button light animation spritesheet (new art uses 525x502 tiles)
            this.load.spritesheet('button_light_sprite', 'assets/images/sprites/spin_button_light/button_light_sprite.png', {
                frameWidth: 525,
                frameHeight: 502
            });
            // Button light animation JSON (new naming: button_light_an.json)
            this.load.json('button_light_animations', 'assets/images/sprites/spin_button_light/button_light_an.json');
            
            // Error handlers for button light assets
            this.load.once('fileerror-spritesheet-button_light_sprite', () => {
                console.warn('Failed to load button_light_sprite, creating fallback');
                const fallbackTexture = this.generateColoredTexture(0xFFDD55, 'LIGHT');
                this.textures.addBase64('button_light_sprite', fallbackTexture);
            });
            this.load.once('fileerror-json-button_light_animations', () => {
                console.warn('Failed to load button_light_an.json, trying legacy button_light_animation.json');
                try {
                    this.load.json('button_light_animations', 'assets/images/sprites/spin_button_light/button_light_animation.json');
                    this.load.start();
                } catch (e) {
                    console.warn('Failed to queue legacy button_light_animation.json; creating fallback');
                    this.cache.json.add('button_light_animations', {
                        anims: [{
                            key: 'button_light',
                            frames: [{ key: 'button_light_sprite', frame: 0 }],
                            frameRate: 24,
                            repeat: -1
                        }]
                    });
                }
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
            
            // Scarlet Witch grid symbol (150x150) animated spritesheet
            this.load.spritesheet('scarlet_witch_symbol_sprite', 'assets/images/sprites/scarlet_witch_symbol/scarlet_witch_symbol_sprite.png', {
                frameWidth: 150,
                frameHeight: 150
            });
            this.load.once('fileerror-spritesheet-scarlet_witch_symbol_sprite', () => {
                console.warn('Failed to load scarlet_witch_symbol_sprite; grid will fallback to static scarlet_witch image');
            });
            
            // Thanos symbol spritesheet for grid symbol (150x150)
            this.load.spritesheet('thanos_sprite', 'assets/images/sprites/thanos_symbol/thanos_sprite.png', {
                frameWidth: 150,
                frameHeight: 150
            });

            // Thanos weapon symbol spritesheet for grid symbol (150x150)
            this.load.spritesheet('thanos_weap', 'assets/images/sprites/thanos_weapon_symbol/thanos_weap_sprite.png', {
                frameWidth: 150,
                frameHeight: 150
            });
            
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
            this.load.audio('thanos_power', 'assets/audio/thanos_power.mp3');
            this.load.audio('thanos_finger_snap', 'assets/audio/thanos_finger_snap.mp3');
            this.load.audio('winning_big', 'assets/audio/winning_big.mp3');
            this.load.audio('spin_drop_finish', 'assets/audio/spin_drop_finish.mp3');
            this.load.audio('kaching', 'assets/audio/kaching.mp3');
            // Burst mode winning SFX
            this.load.audio('burst_winning', 'assets/audio/burst_winning.mp3');
            
            console.log('🔊 Audio files queued for loading: bgm_infinity_storm, bgm_free_spins, lightning_struck, symbol_shattering, thanos_power, thanos_finger_snap, winning_big, spin_drop_finish, kaching');
            
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
            this.load.once('fileerror-audio-thanos_power', (error) => {
                console.log('❌ Thanos power sound effect failed to load:', error);
            });
            this.load.once('fileerror-audio-thanos_finger_snap', (error) => {
                console.log('❌ Thanos finger snap sound effect failed to load:', error);
            });
            this.load.once('fileerror-audio-winning_big', (error) => {
                console.log('❌ Winning big sound effect failed to load:', error);
            });
            this.load.once('fileerror-audio-spin_drop_finish', (error) => {
                console.log('❌ Spin drop finish sound effect failed to load:', error);
            });
            this.load.once('fileerror-audio-kaching', (error) => {
                console.log('❌ Kaching sound effect failed to load:', error);
            });
            this.load.once('fileerror-audio-burst_winning', (error) => {
                console.log('❌ Burst mode winning sound failed to load:', error);
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
            this.load.once('filecomplete-audio-thanos_power', () => {
                console.log('✅ Thanos power sound effect loaded successfully!');
            });
            this.load.once('filecomplete-audio-thanos_finger_snap', () => {
                console.log('✅ Thanos finger snap sound effect loaded successfully!');
            });
            this.load.once('filecomplete-audio-winning_big', () => {
                console.log('✅ Winning big sound effect loaded successfully!');
            });
            this.load.once('filecomplete-audio-spin_drop_finish', () => {
                console.log('✅ Spin drop finish sound effect loaded successfully!');
            });
            this.load.once('filecomplete-audio-kaching', () => {
                console.log('✅ Kaching sound effect loaded successfully!');
            });
            this.load.once('filecomplete-audio-burst_winning', () => {
                console.log('✅ Burst mode winning sound loaded successfully!');
            });
            
            // General audio loading complete handler
            this.load.once('complete', () => {
                console.log('🔊 All loading complete. Checking audio availability:');
                setTimeout(() => {
                    const hasMainBGM = this.sound && this.sound.get('bgm_infinity_storm');
                    const hasFreeSpinsBGM = this.sound && this.sound.get('bgm_free_spins');
                    const hasLightning = this.sound && this.sound.get('lightning_struck');
                    const hasShattering = this.sound && this.sound.get('symbol_shattering');
                    const hasThanosPower = this.sound && this.sound.get('thanos_power');
                    const hasThanosSnap = this.sound && this.sound.get('thanos_finger_snap');
                    const hasWinningBig = this.sound && this.sound.get('winning_big');
                    console.log('🔊 Main BGM available:', !!hasMainBGM);
                    console.log('🔊 Free Spins BGM available:', !!hasFreeSpinsBGM);
                    console.log('🔊 Lightning available:', !!hasLightning);
                    console.log('🔊 Shattering available:', !!hasShattering);
                    console.log('🔊 Thanos Power available:', !!hasThanosPower);
                    console.log('🔊 Thanos Snap available:', !!hasThanosSnap);
                    console.log('🔊 Winning Big available:', !!hasWinningBig);
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
            'ui_freegame_purchase': 0x2E86C1,
            'settings_ui_bg': 0x111111,
            'settings_ui_panel': 0x222222,
            'settings_ui_exit': 0xAA3333,
            'settings_ui_rules': 0x3366AA,
            'settings_ui_history': 0xAAAA33,
            'settings_ui_settings': 0x888888,
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
            'ui_formula_plaque': 0x888888,
            'free_spins_purchase_check': 0xDC143C,
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
            'ui_bottom_panel', 'ui_freegame', 'ui_freegame_purchase', 'settings_ui_bg', 'settings_ui_panel', 'settings_ui_exit', 'settings_ui_rules', 'settings_ui_history', 'settings_ui_settings', 'ui_number_bet', 'ui_number_bet-', 'ui_number_bet+',
            'ui_number_score', 'ui_number_win', 'ui_accumulated_multiplier', 'ui_small_burst', 'ui_small_menu',
            'ui_small_stop', 'ui_spin', 'ui_buttonloop_sprite', 'ui_formula_plaque', 'free_spins_purchase_check', 'money_sprite'
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
        
        // Create Thanos symbol animation for grid symbol (if spritesheet loaded)
        try {
            if (this.textures.exists('thanos_sprite') && !this.anims.exists('thanos_symbol_idle')) {
                this.anims.create({
                    key: 'thanos_symbol_idle',
                    frames: this.anims.generateFrameNumbers('thanos_sprite', { start: 0, end: 19 }),
                    frameRate: 20,
                    repeat: -1
                });
                console.log('✅ Thanos symbol idle animation created');
            }
            if (this.textures.exists('thanos_weap') && !this.anims.exists('thanos_weapon_symbol_idle')) {
                this.anims.create({
                    key: 'thanos_weapon_symbol_idle',
                    frames: this.anims.generateFrameNumbers('thanos_weap', { start: 0, end: 17 }),
                    frameRate: 15,
                    repeat: -1
                });
                console.log('✅ Thanos weapon symbol idle animation created');
            }
            // Scarlet Witch grid symbol idle animation (if spritesheet loaded)
            if (this.textures.exists('scarlet_witch_symbol_sprite') && !this.anims.exists('scarlet_witch_symbol_idle')) {
                this.anims.create({
                    key: 'scarlet_witch_symbol_idle',
                    frames: this.anims.generateFrameNumbers('scarlet_witch_symbol_sprite', { start: 0, end: 19 }),
                    frameRate: 20,
                    repeat: -1
                });
                console.log('✅ Scarlet Witch grid symbol idle animation created');
            }
        } catch (e) {
            console.warn('Failed to create Thanos symbol animation:', e);
        }

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
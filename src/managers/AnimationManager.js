// Animation Manager - handles all animation creation and testing for the game
window.AnimationManager = class AnimationManager {
    constructor(scene) {
        this.scene = scene;
    }
    
    createAllAnimations() {
        console.log('Creating all animations...');
        
        // Create money animation
        if (!this.scene.anims.exists('money_animation')) {
            this.scene.anims.create({
                key: 'money_animation',
                frames: this.scene.anims.generateFrameNumbers('money_sprite', { start: 0, end: 15 }),
                frameRate: 24,
                repeat: -1
            });
        }
        
        // Create burst mode animations
        try {
            const animsData = this.scene.cache.json.get('burst_animations');
            if (animsData && animsData.anims) {
                animsData.anims.forEach(animConfig => {
                    if (!this.scene.anims.exists(animConfig.key)) {
                        this.scene.anims.create({
                            key: animConfig.key,
                            frames: animConfig.frames.map(frame => ({
                                key: frame.key,
                                frame: frame.frame
                            })),
                            frameRate: animConfig.frameRate,
                            repeat: animConfig.repeat
                        });
                    }
                });
            }
        } catch (error) {
            console.warn('Failed to create burst mode animations:', error);
        }
        
        // Create gem destruction animations - updated to use individual animation files
        try {
            const gemTypes = ['timegem', 'realitygem', 'powergem', 'spacegem', 'soulgem', 'mindgem'];
            
            gemTypes.forEach(gemType => {
                const animsData = this.scene.cache.json.get(`${gemType}_animations`);
                if (animsData && animsData.anims) {
                    animsData.anims.forEach(animConfig => {
                        // Create unique animation key for each gem type
                        const animKey = `${gemType}_destruction`;
                        
                        if (!this.scene.anims.exists(animKey)) {
                            this.scene.anims.create({
                                key: animKey,
                                frames: animConfig.frames.map(frame => ({
                                    key: frame.key,
                                    frame: frame.frame
                                })),
                                frameRate: animConfig.frameRate || 24,
                                repeat: 0, // Force destruction animations to play only once
                                hideOnComplete: true
                            });
                            console.log(`✓ Created ${gemType} destruction animation (single play)`);
                        }
                    });
                } else {
                    console.warn(`${gemType} destruction animation data not found`);
                }
            });
        } catch (error) {
            console.warn('Failed to create gem destruction animations:', error);
        }
        
        // Create spin button animations
        try {
            const spinAnimsData = this.scene.cache.json.get('spin_button_animations');
            if (spinAnimsData && spinAnimsData.anims) {
                spinAnimsData.anims.forEach(animConfig => {
                    if (!this.scene.anims.exists(animConfig.key)) {
                        this.scene.anims.create({
                            key: animConfig.key,
                            frames: animConfig.frames.map(frame => ({
                                key: frame.key,
                                frame: frame.frame
                            })),
                            frameRate: animConfig.frameRate || 24,
                            repeat: animConfig.repeat || 0
                        });
                    }
                });
            }
        } catch (error) {
            console.warn('Failed to create spin button animations:', error);
        }
        
        // Create win presentation animations
        try {
            const winAnimsData = this.scene.cache.json.get('win_animations');
            if (winAnimsData && winAnimsData.anims) {
                winAnimsData.anims.forEach(animConfig => {
                    if (!this.scene.anims.exists(animConfig.key)) {
                        this.scene.anims.create({
                            key: animConfig.key,
                            frames: animConfig.frames.map(frame => ({
                                key: frame.key,
                                frame: frame.frame
                            })),
                            frameRate: animConfig.frameRate || 15,
                            repeat: animConfig.repeat || -1
                        });
                    }
                });
            }
        } catch (error) {
            console.warn('Failed to create win presentation animations:', error);
        }
        
        // Create Scarlet Witch portrait animation - MOST IMPORTANT
        try {
            const scarletWitchAnimsData = this.scene.cache.json.get('scarlet_witch_animations');
            if (scarletWitchAnimsData && scarletWitchAnimsData.anims) {
                const animConfig = scarletWitchAnimsData.anims[0]; // Get the first animation config
                const animKey = 'scarlet_witch_portrait_animation';
                
                if (!this.scene.anims.exists(animKey)) {
                    // Handle both Phaser Editor format and fallback format
                    let frames;
                    if (animConfig.frames && animConfig.frames.length > 0) {
                        // Check if it's Phaser Editor format (has duration) or fallback format (just key/frame)
                        if (animConfig.frames[0].duration !== undefined) {
                            // Phaser Editor format
                            frames = animConfig.frames.map(frame => ({
                                key: frame.key,
                                duration: frame.duration || 0
                            }));
                        } else {
                            // Fallback format - convert to Phaser animation frames
                            frames = animConfig.frames.map(frame => ({
                                key: frame.key,
                                frame: frame.frame || 0
                            }));
                        }
                        
                        // Filter out frames that don't exist
                        const validFrames = frames.filter(frame => this.scene.textures.exists(frame.key));
                        
                        if (validFrames.length > 0) {
                            this.scene.anims.create({
                                key: animKey,
                                frames: validFrames,
                                frameRate: animConfig.frameRate || 20,
                                repeat: animConfig.repeat !== undefined ? animConfig.repeat : -1,
                                skipMissedFrames: true
                            });
                            console.log(`✓ Created Scarlet Witch animation with ${validFrames.length} frames at ${animConfig.frameRate || 20} FPS`);
                        } else {
                            console.warn('No valid frames found for Scarlet Witch animation');
                            this.createFallbackPortraitAnimation('scarlet_witch_portrait_animation', 'redwitch01');
                        }
                    } else {
                        console.warn('No frames found in Scarlet Witch animation config');
                        this.createFallbackPortraitAnimation('scarlet_witch_portrait_animation', 'redwitch01');
                    }
                }
            } else {
                console.warn('Scarlet Witch animation data not found in cache');
                this.createFallbackPortraitAnimation('scarlet_witch_portrait_animation', 'redwitch01');
            }
        } catch (error) {
            console.warn('Failed to create Scarlet Witch portrait animation:', error);
            this.createFallbackPortraitAnimation('scarlet_witch_portrait_animation', 'redwitch01');
        }
        
        // Create Thanos portrait animation
        try {
            const thanosAnimsData = this.scene.cache.json.get('thanos_animations');
            if (thanosAnimsData && thanosAnimsData.anims) {
                const animConfig = thanosAnimsData.anims[0]; // Get the first animation config
                const animKey = 'thanos_portrait_animation';
                
                if (!this.scene.anims.exists(animKey)) {
                    // Handle both Phaser Editor format and fallback format
                    let frames;
                    if (animConfig.frames && animConfig.frames.length > 0) {
                        // Check if it's Phaser Editor format (has duration) or fallback format (just key/frame)
                        if (animConfig.frames[0].duration !== undefined) {
                            // Phaser Editor format
                            frames = animConfig.frames.map(frame => ({
                                key: frame.key,
                                duration: frame.duration || 0
                            }));
                        } else {
                            // Fallback format - convert to Phaser animation frames
                            frames = animConfig.frames.map(frame => ({
                                key: frame.key,
                                frame: frame.frame || 0
                            }));
                        }
                        
                        // Filter out frames that don't exist
                        const validFrames = frames.filter(frame => this.scene.textures.exists(frame.key));
                        
                        if (validFrames.length > 0) {
                            this.scene.anims.create({
                                key: animKey,
                                frames: validFrames,
                                frameRate: animConfig.frameRate || 20,
                                repeat: animConfig.repeat !== undefined ? animConfig.repeat : -1,
                                skipMissedFrames: true
                            });
                            console.log(`✓ Created Thanos animation with ${validFrames.length} frames at ${animConfig.frameRate || 20} FPS`);
                        } else {
                            console.warn('No valid frames found for Thanos animation');
                            this.createFallbackPortraitAnimation('thanos_portrait_animation', 'thanos-animation_00');
                        }
                    } else {
                        console.warn('No frames found in Thanos animation config');
                        this.createFallbackPortraitAnimation('thanos_portrait_animation', 'thanos-animation_00');
                    }
                }
            } else {
                console.warn('Thanos animation data not found in cache');
                this.createFallbackPortraitAnimation('thanos_portrait_animation', 'thanos-animation_00');
            }
        } catch (error) {
            console.warn('Failed to create Thanos portrait animation:', error);
            this.createFallbackPortraitAnimation('thanos_portrait_animation', 'thanos-animation_00');
        }
        
        console.log('All animations created.');
    }
    
    // Test method for gem destruction animations
    testGemDestructionAnimations() {
        console.log('Testing gem destruction animations...');
        
        // Updated to use new gem naming convention
        const gemTypes = [
            { sprite: 'time_gem', anim: 'timegem_destruction' },
            { sprite: 'reality_gem', anim: 'realitygem_destruction' },
            { sprite: 'power_gem', anim: 'powergem_destruction' },
            { sprite: 'space_gem', anim: 'spacegem_destruction' },
            { sprite: 'soul_gem', anim: 'soulgem_destruction' },
            { sprite: 'mind_gem', anim: 'mindgem_destruction' }
        ];
        
        const startX = this.scene.cameras.main.width / 2 - (gemTypes.length * 100) / 2;
        const y = this.scene.cameras.main.height / 2;
        
        gemTypes.forEach((gemData, index) => {
            const x = startX + (index * 100);
            
            // Create a temporary gem symbol
            const gem = this.scene.add.image(x, y - 100, gemData.sprite);
            gem.setDisplaySize(64, 64);
            
            // Play destruction animation - check if animation exists
            if (this.scene.anims.exists(gemData.anim)) {
                const destructionSprite = this.scene.add.sprite(x, y, gemData.anim);
                destructionSprite.setDisplaySize(96, 96);
                destructionSprite.play(gemData.anim);
                
                // Add label
                const label = this.scene.add.text(x, y + 60, gemData.sprite, {
                    fontSize: '12px',
                    fontFamily: 'Arial',
                    color: '#FFFFFF',
                    align: 'center'
                });
                label.setOrigin(0.5);
                
                // Clean up after animation
                destructionSprite.once('animationcomplete', () => {
                    if (gem && gem.scene) gem.destroy();
                    if (destructionSprite && destructionSprite.scene) destructionSprite.destroy();
                    if (label && label.scene) label.destroy();
                });
                
                console.log(`✓ Playing ${gemData.anim} animation`);
            } else {
                console.warn(`✗ Animation ${gemData.anim} not found`);
                
                // Add error label
                const errorLabel = this.scene.add.text(x, y + 60, `${gemData.sprite}\n(MISSING)`, {
                    fontSize: '12px',
                    fontFamily: 'Arial',
                    color: '#FF0000',
                    align: 'center'
                });
                errorLabel.setOrigin(0.5);
                
                // Clean up after delay
                this.scene.time.delayedCall(3000, () => {
                    if (gem && gem.scene) gem.destroy();
                    if (errorLabel && errorLabel.scene) errorLabel.destroy();
                });
            }
        });
        
        // Show instruction
        const instruction = this.scene.add.text(this.scene.cameras.main.width / 2, y + 120, 
            'Gem Destruction Animations Test - Press D to test', {
            fontSize: '20px',
            fontFamily: 'Arial Bold',
            color: '#FFD700',
            align: 'center'
        });
        instruction.setOrigin(0.5);
        
        const instructionCleanup = this.scene.time.delayedCall(5000, () => {
            if (instruction && instruction.scene) {
                instruction.destroy();
            }
        });
        // Store cleanup reference for potential early cleanup
        instruction.cleanupTimer = instructionCleanup;
    }
    
    // Test method for spin button animation
    testSpinButtonAnimation() {
        console.log('Testing spin button animation...');
        
        if (this.scene.ui_spin && this.scene.anims.exists('animation')) {
            // Toggle animation
            if (this.scene.ui_spin.anims.isPlaying) {
                this.scene.ui_spin.stop();
                this.scene.ui_spin.setFrame(0);
                console.log('Spin button animation stopped');
            } else {
                this.scene.ui_spin.play('animation');
                console.log('Spin button animation started');
                
                // Auto-stop after 5 seconds
                const autoStopTimer = this.scene.time.delayedCall(5000, () => {
                    if (this.scene.ui_spin && this.scene.ui_spin.anims && this.scene.ui_spin.anims.isPlaying) {
                        this.scene.ui_spin.stop();
                        this.scene.ui_spin.setFrame(0);
                        console.log('Spin button animation auto-stopped');
                    }
                });
                // Store timer reference for cleanup
                if (this.scene.ui_spin) {
                    this.scene.ui_spin.autoStopTimer = autoStopTimer;
                }
            }
        } else {
            console.warn('Spin button or animation not available');
        }
        
        // Show visual feedback
        const message = this.scene.add.text(this.scene.cameras.main.width / 2, 100, 
            'Press S to toggle spin button animation', {
            fontSize: '24px',
            fontFamily: 'Arial Bold',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        });
        message.setOrigin(0.5);
        
        const messageCleanup = this.scene.time.delayedCall(3000, () => {
            if (message && message.scene) {
                this.scene.tweens.add({
                    targets: message,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        if (message && message.scene) {
                            message.destroy();
                        }
                    }
                });
            }
        });
        message.cleanupTimer = messageCleanup;
    }
    
    // Test method for Scarlet Witch animation
    testScarletWitchAnimation() {
        console.log('=== SCARLET WITCH ANIMATION TEST ===');
        
        if (this.scene.portrait_scarlet_witch) {
            const hasAnimation = this.scene.anims.exists('scarlet_witch_portrait_animation');
            const isSprite = this.scene.portrait_scarlet_witch.anims !== undefined;
            const portraitType = this.scene.portrait_scarlet_witch.type;
            
            console.log(`Animation exists: ${hasAnimation}`);
            console.log(`Portrait is sprite: ${isSprite}`);
            console.log(`Portrait type: ${portraitType}`);
            console.log(`Portrait texture key: ${this.scene.portrait_scarlet_witch.texture.key}`);
            
            if (hasAnimation && isSprite) {
                if (this.scene.portrait_scarlet_witch.anims.isPlaying) {
                    this.scene.portrait_scarlet_witch.stop();
                    console.log('✓ Scarlet Witch animation stopped');
                } else {
                    this.scene.portrait_scarlet_witch.play('scarlet_witch_portrait_animation');
                    console.log('✓ Scarlet Witch animation started');
                }
            } else {
                console.warn('✗ Scarlet Witch animation not available or portrait is not a sprite');
                
                // Try to force create as sprite if it's not
                if (!isSprite && this.scene.textures.exists('redwitch01')) {
                    console.log('Attempting to recreate as sprite...');
                    const x = this.scene.portrait_scarlet_witch.x;
                    const y = this.scene.portrait_scarlet_witch.y;
                    const scaleX = this.scene.portrait_scarlet_witch.scaleX;
                    const scaleY = this.scene.portrait_scarlet_witch.scaleY;
                    const depth = this.scene.portrait_scarlet_witch.depth;
                    
                    this.scene.portrait_scarlet_witch.destroy();
                    this.scene.portrait_scarlet_witch = this.scene.add.sprite(x, y, 'redwitch01');
                    this.scene.portrait_scarlet_witch.setScale(scaleX, scaleY);
                    this.scene.portrait_scarlet_witch.setDepth(depth);
                    
                    if (hasAnimation) {
                        this.scene.portrait_scarlet_witch.play('scarlet_witch_portrait_animation');
                        console.log('✓ Recreated as sprite and started animation');
                    }
                }
            }
        } else {
            console.warn('✗ Scarlet Witch portrait not found');
        }
        
        // Show debug info
        const debugInfo = [];
        debugInfo.push(`Animation exists: ${this.scene.anims.exists('scarlet_witch_portrait_animation')}`);
        debugInfo.push(`Portrait exists: ${this.scene.portrait_scarlet_witch !== undefined}`);
        debugInfo.push(`Portrait is sprite: ${this.scene.portrait_scarlet_witch && this.scene.portrait_scarlet_witch.anims !== undefined}`);
        debugInfo.push(`Portrait type: ${this.scene.portrait_scarlet_witch ? this.scene.portrait_scarlet_witch.type : 'N/A'}`);
        
        // Check frame textures
        for (let i = 1; i <= 5; i++) {
            const frameKey = `redwitch${i.toString().padStart(2, '0')}`;
            debugInfo.push(`Frame ${i} exists: ${this.scene.textures.exists(frameKey)}`);
        }
        
        // Check animation details
        if (this.scene.anims.exists('scarlet_witch_portrait_animation')) {
            const anim = this.scene.anims.get('scarlet_witch_portrait_animation');
            debugInfo.push(`Animation frames: ${anim.frames.length}`);
            debugInfo.push(`Frame rate: ${anim.frameRate}`);
            debugInfo.push(`Repeat: ${anim.repeat}`);
        }
        
        const message = this.scene.add.text(this.scene.cameras.main.width / 2, 150, 
            'Scarlet Witch Animation Test\nPress W to toggle\n\n' + debugInfo.join('\n'), {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center'
        });
        message.setOrigin(0.5);
        
        this.scene.time.delayedCall(5000, () => {
            if (message && message.scene) {
                this.scene.tweens.add({
                    targets: message,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        if (message && message.scene) {
                            message.destroy();
                        }
                    }
                });
            }
        });
        
        console.log('=== END SCARLET WITCH ANIMATION TEST ===');
    }
    
    // Test method for Thanos animation
    testThanosAnimation() {
        console.log('=== THANOS ANIMATION TEST ===');
        
        if (this.scene.portrait_thanos) {
            const hasAnimation = this.scene.anims.exists('thanos_portrait_animation');
            const isSprite = this.scene.portrait_thanos.anims !== undefined;
            const portraitType = this.scene.portrait_thanos.type;
            
            console.log(`Animation exists: ${hasAnimation}`);
            console.log(`Portrait is sprite: ${isSprite}`);
            console.log(`Portrait type: ${portraitType}`);
            console.log(`Portrait texture key: ${this.scene.portrait_thanos.texture.key}`);
            
            if (hasAnimation && isSprite) {
                if (this.scene.portrait_thanos.anims.isPlaying) {
                    this.scene.portrait_thanos.stop();
                    console.log('✓ Thanos animation stopped');
                } else {
                    this.scene.portrait_thanos.play('thanos_portrait_animation');
                    console.log('✓ Thanos animation started');
                }
            } else {
                console.warn('✗ Thanos animation not available or portrait is not a sprite');
                
                // Try to force create as sprite if it's not
                if (!isSprite && this.scene.textures.exists('thanos-animation_00')) {
                    console.log('Attempting to recreate as sprite...');
                    const x = this.scene.portrait_thanos.x;
                    const y = this.scene.portrait_thanos.y;
                    const scaleX = this.scene.portrait_thanos.scaleX;
                    const scaleY = this.scene.portrait_thanos.scaleY;
                    const depth = this.scene.portrait_thanos.depth;
                    
                    this.scene.portrait_thanos.destroy();
                    this.scene.portrait_thanos = this.scene.add.sprite(x, y, 'thanos-animation_00');
                    this.scene.portrait_thanos.setScale(scaleX, scaleY);
                    this.scene.portrait_thanos.setDepth(depth);
                    
                    if (hasAnimation) {
                        this.scene.portrait_thanos.play('thanos_portrait_animation');
                        console.log('✓ Recreated as sprite and started animation');
                    }
                }
            }
        } else {
            console.warn('✗ Thanos portrait not found');
        }
        
        // Show debug info
        const debugInfo = [];
        debugInfo.push(`Animation exists: ${this.scene.anims.exists('thanos_portrait_animation')}`);
        debugInfo.push(`Portrait exists: ${this.scene.portrait_thanos !== undefined}`);
        debugInfo.push(`Portrait is sprite: ${this.scene.portrait_thanos && this.scene.portrait_thanos.anims !== undefined}`);
        debugInfo.push(`Portrait type: ${this.scene.portrait_thanos ? this.scene.portrait_thanos.type : 'N/A'}`);
        
        // Check frame textures
        for (let i = 0; i <= 5; i++) {
            const frameKey = `thanos-animation_${i.toString().padStart(2, '0')}`;
            debugInfo.push(`Frame ${i} exists: ${this.scene.textures.exists(frameKey)}`);
        }
        
        // Check animation details
        if (this.scene.anims.exists('thanos_portrait_animation')) {
            const anim = this.scene.anims.get('thanos_portrait_animation');
            debugInfo.push(`Animation frames: ${anim.frames.length}`);
            debugInfo.push(`Frame rate: ${anim.frameRate}`);
            debugInfo.push(`Repeat: ${anim.repeat}`);
        }
        
        const message = this.scene.add.text(this.scene.cameras.main.width / 2, 150, 
            'Thanos Animation Test\nPress T to toggle\n\n' + debugInfo.join('\n'), {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center'
        });
        message.setOrigin(0.5);
        
        this.scene.time.delayedCall(5000, () => {
            if (message && message.scene) {
                this.scene.tweens.add({
                    targets: message,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        if (message && message.scene) {
                            message.destroy();
                        }
                    }
                });
            }
        });
        
        console.log('=== END THANOS ANIMATION TEST ===');
    }
    
    createFallbackPortraitAnimation(animationKey, fallbackTexture) {
        console.log(`Creating fallback animation for ${animationKey} using ${fallbackTexture}`);
        
        if (!this.scene.anims.exists(animationKey)) {
            // Check if fallback texture exists
            if (this.scene.textures.exists(fallbackTexture)) {
                this.scene.anims.create({
                    key: animationKey,
                    frames: [{ key: fallbackTexture, frame: 0 }],
                    frameRate: 1,
                    repeat: 0
                });
                console.log(`✓ Created fallback animation ${animationKey} with static frame`);
            } else {
                console.warn(`Fallback texture ${fallbackTexture} not found for ${animationKey}`);
            }
        }
    }
    
    destroy() {
        // Clean up any references and timers
        this.scene = null;
    }
} 
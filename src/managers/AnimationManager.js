// Animation Manager - handles all animation creation and testing for the game
// Enhanced with cascade synchronization support
window.AnimationManager = class AnimationManager {
    constructor(scene) {
        this.scene = scene;
        
        // Enhanced Cascade Synchronization state
        this.syncState = {
            enabled: false,
            currentPhase: null,
            stepIndex: 0,
            phaseTimings: {},
            animationQueue: [],
            pendingAcknowledgments: new Map(),
            recoveryMode: false,
            syncErrors: []
        };
        
        // Animation timing configuration
        this.timingConfig = {
            win_highlight: { normal: 1000, quick: 400 },
            symbol_removal: { normal: 500, quick: 200 },
            symbol_drop: { normal: 800, quick: 300 },
            symbol_settle: { normal: 300, quick: 100 },
            recovery_fade: { normal: 500, quick: 200 },
            sync_indicator: { normal: 1000, quick: 500 }
        };
        
        // Phase-based animation control
        this.phaseAnimations = {
            win_highlight: [],
            symbol_removal: [],
            symbol_drop: [],
            symbol_settle: [],
            recovery: []
        };
        
        // Sync status visualization elements
        this.syncVisualElements = {
            indicator: null,
            statusText: null,
            progressBar: null,
            errorOverlay: null
        };
        
        // Performance tracking
        this.animationMetrics = {
            phaseStartTimes: {},
            phaseEndTimes: {},
            totalAnimationTime: 0,
            syncAccuracy: 100
        };
        
        // Recovery state
        this.recoveryState = {
            active: false,
            type: null,
            attemptCount: 0,
            savedAnimations: [],
            rollbackPoint: null
        };
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
        
        // Create new burst mode animations
        try {
            // Create burst spin button animation
            const animKey = 'burst_spin_animation';
            if (!this.scene.anims.exists(animKey) && this.scene.textures.exists('ui_bn_spin')) {
                try {
                    this.scene.anims.create({
                        key: animKey,
                        frames: this.scene.anims.generateFrameNumbers('ui_bn_spin', { start: 0, end: 15 }),
                        frameRate: 24,
                        repeat: -1
                    });
                    console.log('✓ Created burst spin button animation');
                } catch (e) {
                    console.warn('Failed to create burst spin animation:', e);
                }
            }
            
            // Create burst magic animation using individual frames
            const magicAnimKey = 'burst_magic_animation';
            if (!this.scene.anims.exists(magicAnimKey)) {
                // Check if at least some magic frames exist
                const frames = [];
                let foundFrames = 0;
                for (let i = 0; i < 48; i++) {
                    const frameNum = String(i).padStart(2, '0');
                    const frameKey = `ui_bn_magic-an_${frameNum}`;
                    if (this.scene.textures.exists(frameKey)) {
                        frames.push({ key: frameKey });
                        foundFrames++;
                    }
                }
                
                if (foundFrames > 0) {
                    try {
                        this.scene.anims.create({
                            key: magicAnimKey,
                            frames: frames,
                            frameRate: 14,
                            repeat: -1
                        });
                        console.log(`✓ Created burst magic animation with ${foundFrames} frames`);
                    } catch (e) {
                        console.warn('Failed to create burst magic animation:', e);
                    }
                } else {
                    console.warn('No burst magic animation frames found');
                }
            }
            
            // Keep legacy burst animations for backward compatibility
            const legacyAnimsData = this.scene.cache.json.get('burst_animations');
            if (legacyAnimsData && legacyAnimsData.anims) {
                legacyAnimsData.anims.forEach(animConfig => {
                    if (!this.scene.anims.exists(animConfig.key)) {
                        try {
                            this.scene.anims.create({
                                key: animConfig.key,
                                frames: animConfig.frames.map(frame => ({
                                    key: frame.key,
                                    frame: frame.frame
                                })),
                                frameRate: animConfig.frameRate,
                                repeat: animConfig.repeat
                            });
                        } catch (e) {
                            console.warn(`Failed to create animation ${animConfig.key}:`, e);
                        }
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

            // Create spin button LIGHT animations
            // Spin button LIGHT animations (supports both Phaser-Editor formats)
            let lightAnimsData = this.scene.cache.json.get('button_light_animations');
            if (!lightAnimsData) {
                // Should not happen, but keep defensive
                lightAnimsData = this.scene.cache.json.get('button_light_animation');
            }
            if (lightAnimsData && lightAnimsData.anims) {
                lightAnimsData.anims.forEach(animConfig => {
                    const key = `light_${animConfig.key || 'button_light'}`; // namespace to avoid collisions
                    if (!this.scene.anims.exists(key)) {
                        // Phaser Editor sometimes outputs frames with duration only; normalize
                        const frames = (animConfig.frames || []).map(frame => {
                            if (frame.key && (frame.frame !== undefined)) {
                                return { key: frame.key, frame: frame.frame };
                            }
                            // Duration-only format: assume sequential frames 0..N-1 on button_light_sprite
                            if (frame.key && (frame.duration !== undefined)) {
                                return { key: frame.key, frame: frame.frame || 0 };
                            }
                            return { key: 'button_light_sprite', frame: 0 };
                        });
                        this.scene.anims.create({
                            key,
                            frames,
                            frameRate: animConfig.frameRate || 24,
                            repeat: (animConfig.repeat !== undefined) ? animConfig.repeat : -1,
                            skipMissedFrames: true
                        });
                    }
                });
            } else if (this.scene.textures.exists('button_light_sprite')) {
                // Fallback: generate a simple 0..19 animation if JSON missing
                const fallbackKey = 'light_button_light';
                if (!this.scene.anims.exists(fallbackKey)) {
                    this.scene.anims.create({
                        key: fallbackKey,
                        frames: this.scene.anims.generateFrameNumbers('button_light_sprite', { start: 0, end: 19 }),
                        frameRate: 24,
                        repeat: -1
                    });
                }
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
        
        // Create Scarlet Witch portrait animations - IDLE and ATTACK
        try {
            const scarletWitchAnimsData = this.scene.cache.json.get('scarlet_witch_animations');
            if (scarletWitchAnimsData && scarletWitchAnimsData.anims) {
                // Create idle animation
                const idleConfig = scarletWitchAnimsData.anims.find(anim => anim.key === 'idle');
                const idleAnimKey = 'scarlet_witch_idle_animation';
                
                if (idleConfig && !this.scene.anims.exists(idleAnimKey)) {
                    // Handle idle animation
                    let idleFrames = idleConfig.frames.map(frame => ({
                        key: frame.key,
                        frame: frame.frame || 0
                    }));
                    
                    // Filter out frames that don't exist
                    const validIdleFrames = idleFrames.filter(frame => this.scene.textures.exists(frame.key));
                    
                    if (validIdleFrames.length > 0) {
                        this.scene.anims.create({
                            key: idleAnimKey,
                            frames: validIdleFrames,
                            frameRate: idleConfig.frameRate || 20,
                            repeat: idleConfig.repeat !== undefined ? idleConfig.repeat : -1,
                            skipMissedFrames: true
                        });
                        console.log(`✓ Created Scarlet Witch idle animation with ${validIdleFrames.length} frames at ${idleConfig.frameRate || 20} FPS`);
                    } else {
                        console.warn('No valid frames found for Scarlet Witch idle animation');
                        this.createFallbackPortraitAnimation(idleAnimKey, 'redwitch-idle2_32');
                    }
                }
                
                // Create attack animation
                const attackConfig = scarletWitchAnimsData.anims.find(anim => anim.key === 'attack');
                const attackAnimKey = 'scarlet_witch_attack_animation';
                
                if (attackConfig && !this.scene.anims.exists(attackAnimKey)) {
                    // Handle attack animation
                    let attackFrames = attackConfig.frames.map(frame => ({
                        key: frame.key,
                        frame: frame.frame || 0
                    }));
                    
                    // Filter out frames that don't exist
                    const validAttackFrames = attackFrames.filter(frame => this.scene.textures.exists(frame.key));
                    
                    if (validAttackFrames.length > 0) {
                        this.scene.anims.create({
                            key: attackAnimKey,
                            frames: validAttackFrames,
                            frameRate: attackConfig.frameRate || 24,
                            repeat: 0, // Attack animation plays once
                            skipMissedFrames: true
                        });
                        console.log(`✓ Created Scarlet Witch attack animation with ${validAttackFrames.length} frames at ${attackConfig.frameRate || 24} FPS`);
                    } else {
                        console.warn('No valid frames found for Scarlet Witch attack animation');
                        this.createFallbackPortraitAnimation(attackAnimKey, 'redwitch-attack_00');
                    }
                }
                
                // Create the legacy animation key for compatibility
                if (!this.scene.anims.exists('scarlet_witch_portrait_animation')) {
                    // Default to idle animation for compatibility
                    const idleAnim = this.scene.anims.get(idleAnimKey);
                    if (idleAnim) {
                        this.scene.anims.create({
                            key: 'scarlet_witch_portrait_animation',
                            frames: idleAnim.frames.map(frame => ({ key: frame.textureKey, frame: frame.textureFrame })),
                            frameRate: idleAnim.frameRate,
                            repeat: idleAnim.repeat,
                            skipMissedFrames: true
                        });
                        console.log('✓ Created legacy Scarlet Witch animation for compatibility');
                    }
                }
            } else {
                console.warn('Scarlet Witch animation data not found in cache');
                this.createFallbackPortraitAnimation('scarlet_witch_idle_animation', 'redwitch-idle2_32');
                this.createFallbackPortraitAnimation('scarlet_witch_attack_animation', 'redwitch-attack_00');
                this.createFallbackPortraitAnimation('scarlet_witch_portrait_animation', 'redwitch-idle2_32');
            }
        } catch (error) {
            console.warn('Failed to create Scarlet Witch portrait animations:', error);
            this.createFallbackPortraitAnimation('scarlet_witch_idle_animation', 'redwitch-idle2_32');
            this.createFallbackPortraitAnimation('scarlet_witch_attack_animation', 'redwitch-attack_00');
            this.createFallbackPortraitAnimation('scarlet_witch_portrait_animation', 'redwitch-idle2_32');
        }
        
        // Create Thanos portrait animations (idle, attack, and snap)
        try {
            const thanosAnimsData = this.scene.cache.json.get('thanos_new_animations');
            if (thanosAnimsData && thanosAnimsData.anims) {
                // Create idle animation
                const idleConfig = thanosAnimsData.anims.find(anim => anim.key === 'idle');
                const idleAnimKey = 'thanos_idle_animation';
                
                if (idleConfig && !this.scene.anims.exists(idleAnimKey)) {
                    let idleFrames;
                    if (idleConfig.frames && idleConfig.frames.length > 0) {
                        if (idleConfig.frames[0].duration !== undefined) {
                            // Phaser Editor format
                            idleFrames = idleConfig.frames.map(frame => ({
                                key: frame.key,
                                duration: frame.duration || 0
                            }));
                        } else {
                            // Fallback format
                            idleFrames = idleConfig.frames.map(frame => ({
                                key: frame.key,
                                frame: frame.frame || 0
                            }));
                        }
                        
                        const validIdleFrames = idleFrames.filter(frame => this.scene.textures.exists(frame.key));
                        
                        if (validIdleFrames.length > 0) {
                            this.scene.anims.create({
                                key: idleAnimKey,
                                frames: validIdleFrames,
                                frameRate: idleConfig.frameRate || 24,
                                repeat: idleConfig.repeat !== undefined ? idleConfig.repeat : -1,
                                skipMissedFrames: true
                            });
                            console.log(`✓ Created Thanos idle animation with ${validIdleFrames.length} frames`);
                        }
                    }
                }
                
                // Create attack animation
                const attackConfig = thanosAnimsData.anims.find(anim => anim.key === 'attack');
                const attackAnimKey = 'thanos_attack_animation';
                
                if (attackConfig && !this.scene.anims.exists(attackAnimKey)) {
                    let attackFrames;
                    if (attackConfig.frames && attackConfig.frames.length > 0) {
                        if (attackConfig.frames[0].duration !== undefined) {
                            // Phaser Editor format
                            attackFrames = attackConfig.frames.map(frame => ({
                                key: frame.key,
                                duration: frame.duration || 0
                            }));
                        } else {
                            // Fallback format
                            attackFrames = attackConfig.frames.map(frame => ({
                                key: frame.key,
                                frame: frame.frame || 0
                            }));
                        }
                        
                        const validAttackFrames = attackFrames.filter(frame => this.scene.textures.exists(frame.key));
                        
                        if (validAttackFrames.length > 0) {
                            this.scene.anims.create({
                                key: attackAnimKey,
                                frames: validAttackFrames,
                                frameRate: attackConfig.frameRate || 18,
                                repeat: 0, // Force attack animation to play only once
                                skipMissedFrames: true
                            });
                            console.log(`✓ Created Thanos attack animation with ${validAttackFrames.length} frames`);
                        }
                    }
                }

                // Create snap animation (plays once)
                const snapConfig = thanosAnimsData.anims.find(anim => anim.key === 'snap');
                const snapAnimKey = 'thanos_snap_animation';
                if (snapConfig && !this.scene.anims.exists(snapAnimKey)) {
                    let snapFrames;
                    if (snapConfig.frames && snapConfig.frames.length > 0) {
                        if (snapConfig.frames[0].duration !== undefined) {
                            // Phaser Editor format (duration-based)
                            snapFrames = snapConfig.frames.map(frame => ({
                                key: frame.key,
                                duration: frame.duration || 0
                            }));
                        } else {
                            // Fallback format
                            snapFrames = snapConfig.frames.map(frame => ({
                                key: frame.key,
                                frame: frame.frame || 0
                            }));
                        }
                        const validSnapFrames = snapFrames.filter(frame => this.scene.textures.exists(frame.key));
                        if (validSnapFrames.length > 0) {
                            this.scene.anims.create({
                                key: snapAnimKey,
                                frames: validSnapFrames,
                                frameRate: snapConfig.frameRate || 20,
                                repeat: 0,
                                skipMissedFrames: true
                            });
                            console.log(`✓ Created Thanos snap animation with ${validSnapFrames.length} frames`);
                        } else {
                            console.warn('No valid frames found for Thanos snap animation');
                        }
                    }
                }
            } else {
                console.warn('Thanos animation data not found in cache');
                this.createFallbackPortraitAnimation('thanos_idle_animation', 'thanos-idle_00');
                this.createFallbackPortraitAnimation('thanos_attack_animation', 'thanos-attack_00');
                // Fallback for snap: reuse attack frame as a placeholder
                this.createFallbackPortraitAnimation('thanos_snap_animation', 'thanos-attack_00');
            }
        } catch (error) {
            console.warn('Failed to create Thanos portrait animations:', error);
            this.createFallbackPortraitAnimation('thanos_idle_animation', 'thanos-idle_00');
            this.createFallbackPortraitAnimation('thanos_attack_animation', 'thanos-attack_00');
            this.createFallbackPortraitAnimation('thanos_snap_animation', 'thanos-attack_00');
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
            const hasIdleAnimation = this.scene.anims.exists('scarlet_witch_idle_animation');
            const hasAttackAnimation = this.scene.anims.exists('scarlet_witch_attack_animation');
            const isSprite = this.scene.portrait_scarlet_witch.anims !== undefined;
            const portraitType = this.scene.portrait_scarlet_witch.type;
            
            console.log(`Idle animation exists: ${hasIdleAnimation}`);
            console.log(`Attack animation exists: ${hasAttackAnimation}`);
            console.log(`Portrait is sprite: ${isSprite}`);
            console.log(`Portrait type: ${portraitType}`);
            console.log(`Portrait texture key: ${this.scene.portrait_scarlet_witch.texture.key}`);
            
            if (hasIdleAnimation && isSprite) {
                if (this.scene.portrait_scarlet_witch.anims.isPlaying) {
                    this.scene.portrait_scarlet_witch.stop();
                    console.log('✓ Scarlet Witch animation stopped');
                } else {
                    // Play idle animation by default
                    this.scene.portrait_scarlet_witch.play('scarlet_witch_idle_animation');
                    console.log('✓ Scarlet Witch idle animation started');
                    
                    // Test attack animation after 3 seconds
                    this.scene.time.delayedCall(3000, () => {
                        if (this.scene.portrait_scarlet_witch) {
                            this.scene.portrait_scarlet_witch.play('scarlet_witch_attack_animation');
                            console.log('✓ Scarlet Witch attack animation started');
                            
                            // Return to idle after attack completes
                            this.scene.portrait_scarlet_witch.once('animationcomplete', () => {
                                this.scene.portrait_scarlet_witch.play('scarlet_witch_idle_animation');
                                console.log('✓ Returned to idle animation');
                            });
                        }
                    });
                }
            } else {
                console.warn('✗ Scarlet Witch animation not available or portrait is not a sprite');
                
                // Try to force create as sprite if it's not
                if (!isSprite && this.scene.textures.exists('redwitch-idle2_32')) {
                    console.log('Attempting to recreate as sprite...');
                    const x = this.scene.portrait_scarlet_witch.x;
                    const y = this.scene.portrait_scarlet_witch.y;
                    const scaleX = this.scene.portrait_scarlet_witch.scaleX;
                    const scaleY = this.scene.portrait_scarlet_witch.scaleY;
                    const depth = this.scene.portrait_scarlet_witch.depth;
                    
                    this.scene.portrait_scarlet_witch.destroy();
                    this.scene.portrait_scarlet_witch = this.scene.add.sprite(x, y, 'redwitch-idle2_32');
                    this.scene.portrait_scarlet_witch.setScale(scaleX, scaleY);
                    this.scene.portrait_scarlet_witch.setDepth(depth);
                    
                    if (this.scene.anims.exists('scarlet_witch_idle_animation')) {
                        this.scene.portrait_scarlet_witch.play('scarlet_witch_idle_animation');
                        console.log('✓ Recreated as sprite and started idle animation');
                    }
                }
            }
        } else {
            console.warn('✗ Scarlet Witch portrait not found');
        }
        
        // Show debug info
        const debugInfo = [];
        debugInfo.push(`Idle animation exists: ${this.scene.anims.exists('scarlet_witch_idle_animation')}`);
        debugInfo.push(`Attack animation exists: ${this.scene.anims.exists('scarlet_witch_attack_animation')}`);
        debugInfo.push(`Portrait exists: ${this.scene.portrait_scarlet_witch !== undefined}`);
        debugInfo.push(`Portrait is sprite: ${this.scene.portrait_scarlet_witch && this.scene.portrait_scarlet_witch.anims !== undefined}`);
        debugInfo.push(`Portrait type: ${this.scene.portrait_scarlet_witch ? this.scene.portrait_scarlet_witch.type : 'N/A'}`);
        
        // Check idle frame textures
        for (let i = 32; i <= 36; i++) {
            const frameKey = `redwitch-idle2_${i.toString().padStart(2, '0')}`;
            debugInfo.push(`Idle frame ${i} exists: ${this.scene.textures.exists(frameKey)}`);
        }
        
        // Check attack frame textures
        for (let i = 0; i <= 4; i++) {
            const frameKey = `redwitch-attack_${i.toString().padStart(2, '0')}`;
            debugInfo.push(`Attack frame ${i} exists: ${this.scene.textures.exists(frameKey)}`);
        }
        
        // Check animation details
        if (this.scene.anims.exists('scarlet_witch_idle_animation')) {
            const anim = this.scene.anims.get('scarlet_witch_idle_animation');
            debugInfo.push(`Idle animation frames: ${anim.frames.length}`);
            debugInfo.push(`Idle frame rate: ${anim.frameRate}`);
            debugInfo.push(`Idle repeat: ${anim.repeat}`);
        }
        
        if (this.scene.anims.exists('scarlet_witch_attack_animation')) {
            const anim = this.scene.anims.get('scarlet_witch_attack_animation');
            debugInfo.push(`Attack animation frames: ${anim.frames.length}`);
            debugInfo.push(`Attack frame rate: ${anim.frameRate}`);
            debugInfo.push(`Attack repeat: ${anim.repeat}`);
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
    
    // Test method for Thanos animations (idle and attack)
    testThanosAnimation() {
        console.log('=== THANOS ANIMATION TEST ===');
        
        if (this.scene.portrait_thanos) {
            const hasIdleAnimation = this.scene.anims.exists('thanos_idle_animation');
            const hasAttackAnimation = this.scene.anims.exists('thanos_attack_animation');
            const isSprite = this.scene.portrait_thanos.anims !== undefined;
            const portraitType = this.scene.portrait_thanos.type;
            
            console.log(`Idle animation exists: ${hasIdleAnimation}`);
            console.log(`Attack animation exists: ${hasAttackAnimation}`);
            console.log(`Portrait is sprite: ${isSprite}`);
            console.log(`Portrait type: ${portraitType}`);
            console.log(`Portrait texture key: ${this.scene.portrait_thanos.texture.key}`);
            
            if (hasIdleAnimation && hasAttackAnimation && isSprite) {
                // Test sequence: play idle for 3 seconds, then attack, then back to idle
                if (this.scene.portrait_thanos.anims.isPlaying) {
                    this.scene.portrait_thanos.stop();
                    console.log('✓ Thanos animation stopped');
                } else {
                    this.scene.portrait_thanos.play('thanos_idle_animation');
                    console.log('✓ Thanos idle animation started');
                    
                    // After 3 seconds, play attack animation
                    this.scene.time.delayedCall(3000, () => {
                        if (this.scene.portrait_thanos) {
                            this.scene.portrait_thanos.play('thanos_attack_animation');
                            console.log('✓ Thanos attack animation started');
                            
                            // Return to idle after attack completes
                            this.scene.portrait_thanos.once('animationcomplete', () => {
                                if (this.scene.portrait_thanos && hasIdleAnimation) {
                                    this.scene.portrait_thanos.play('thanos_idle_animation');
                                    console.log('✓ Returned to Thanos idle animation');
                                }
                            });
                        }
                    });
                }
            } else {
                console.warn('✗ Thanos animations not available or portrait is not a sprite');
                
                // Try to force create as sprite if it's not
                if (!isSprite && this.scene.textures.exists('thanos-idle_00')) {
                    console.log('Attempting to recreate as sprite...');
                    const x = this.scene.portrait_thanos.x;
                    const y = this.scene.portrait_thanos.y;
                    const scaleX = this.scene.portrait_thanos.scaleX;
                    const scaleY = this.scene.portrait_thanos.scaleY;
                    const depth = this.scene.portrait_thanos.depth;
                    
                    this.scene.portrait_thanos.destroy();
                    this.scene.portrait_thanos = this.scene.add.sprite(x, y, 'thanos-idle_00');
                    this.scene.portrait_thanos.setScale(scaleX, scaleY);
                    this.scene.portrait_thanos.setDepth(depth);
                    
                    if (hasIdleAnimation) {
                        this.scene.portrait_thanos.play('thanos_idle_animation');
                        console.log('✓ Recreated as sprite and started idle animation');
                    }
                }
            }
        } else {
            console.warn('✗ Thanos portrait not found');
        }
        
        // Show debug info
        const debugInfo = [];
        debugInfo.push(`Idle animation exists: ${this.scene.anims.exists('thanos_idle_animation')}`);
        debugInfo.push(`Attack animation exists: ${this.scene.anims.exists('thanos_attack_animation')}`);
        debugInfo.push(`Portrait exists: ${this.scene.portrait_thanos !== undefined}`);
        debugInfo.push(`Portrait is sprite: ${this.scene.portrait_thanos && this.scene.portrait_thanos.anims !== undefined}`);
        debugInfo.push(`Portrait type: ${this.scene.portrait_thanos ? this.scene.portrait_thanos.type : 'N/A'}`);
        
        // Check frame textures
        for (let i = 0; i <= 5; i++) {
            const idleFrameKey = `thanos-idle_${i.toString().padStart(2, '0')}`;
            const attackFrameKey = `thanos-attack_${i.toString().padStart(2, '0')}`;
            debugInfo.push(`Idle frame ${i} exists: ${this.scene.textures.exists(idleFrameKey)}`);
            debugInfo.push(`Attack frame ${i} exists: ${this.scene.textures.exists(attackFrameKey)}`);
        }
        
        // Check animation details
        if (this.scene.anims.exists('thanos_idle_animation')) {
            const anim = this.scene.anims.get('thanos_idle_animation');
            debugInfo.push(`Idle animation frames: ${anim.frames.length}`);
            debugInfo.push(`Idle frame rate: ${anim.frameRate}`);
        }
        if (this.scene.anims.exists('thanos_attack_animation')) {
            const anim = this.scene.anims.get('thanos_attack_animation');
            debugInfo.push(`Attack animation frames: ${anim.frames.length}`);
            debugInfo.push(`Attack frame rate: ${anim.frameRate}`);
        }
        
        const message = this.scene.add.text(this.scene.cameras.main.width / 2, 150, 
            'Thanos Animation Test\nPress T to toggle\nWill play idle → attack → idle\n\n' + debugInfo.join('\n'), {
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
    
    // ============== ENHANCED CASCADE SYNCHRONIZATION FEATURES ==============
    
    /**
     * Task 3.4.1: Animation timing synchronization
     * Synchronizes animation timings with server-provided cascade step data
     */
    synchronizeAnimationTiming(cascadeStep, quickSpinMode = false) {
        if (!cascadeStep || !cascadeStep.timing) {
            console.warn('Invalid cascade step timing data');
            return false;
        }
        
        const mode = quickSpinMode ? 'quick' : 'normal';
        
        // Update phase timings based on server data
        Object.keys(cascadeStep.timing).forEach(phase => {
            if (this.timingConfig[phase]) {
                // Store server timing for this phase
                this.phaseTimings[phase] = cascadeStep.timing[phase];
                
                // Calculate timing adjustment factor
                const expectedTiming = this.timingConfig[phase][mode];
                const serverTiming = cascadeStep.timing[phase];
                const adjustmentFactor = serverTiming / expectedTiming;
                
                // Apply adjustment to maintain sync
                if (Math.abs(adjustmentFactor - 1) > 0.1) {
                    console.log(`Adjusting ${phase} timing: ${expectedTiming}ms -> ${serverTiming}ms`);
                    this.adjustAnimationSpeed(phase, adjustmentFactor);
                }
            }
        });
        
        // Track synchronization accuracy
        this.updateSyncAccuracy(cascadeStep);
        
        return true;
    }
    
    /**
     * Adjust animation speed for a specific phase
     */
    adjustAnimationSpeed(phase, factor) {
        const animations = this.phaseAnimations[phase];
        if (!animations || animations.length === 0) return;
        
        animations.forEach(anim => {
            if (anim && anim.timeline) {
                // Adjust timeline speed
                anim.timeline.timeScale = factor;
            } else if (anim && anim.duration) {
                // Adjust duration
                anim.duration = anim.duration / factor;
            }
        });
    }
    
    /**
     * Task 3.4.2: Phase-based animation control
     * Controls animations based on cascade phases
     */
    startPhaseAnimation(phase, gridData, callback) {
        if (!this.syncState.enabled) {
            // Run animations normally if sync is disabled
            return this.runPhaseAnimationNormal(phase, gridData, callback);
        }
        
        // Clear previous phase animations
        this.clearPhaseAnimations(this.syncState.currentPhase);
        
        // Update current phase
        this.syncState.currentPhase = phase;
        const phaseStartTime = Date.now();
        this.animationMetrics.phaseStartTimes[phase] = phaseStartTime;
        
        // Store animation data for potential recovery
        if (this.recoveryState.active) {
            this.recoveryState.savedAnimations.push({
                phase,
                gridData: JSON.parse(JSON.stringify(gridData)),
                timestamp: phaseStartTime
            });
        }
        
        // Execute phase-specific animations
        switch(phase) {
            case 'win_highlight':
                this.executeWinHighlightPhase(gridData, callback);
                break;
                
            case 'symbol_removal':
                this.executeSymbolRemovalPhase(gridData, callback);
                break;
                
            case 'symbol_drop':
                this.executeSymbolDropPhase(gridData, callback);
                break;
                
            case 'symbol_settle':
                this.executeSymbolSettlePhase(gridData, callback);
                break;
                
            case 'recovery':
                this.executeRecoveryPhase(gridData, callback);
                break;
                
            default:
                console.warn(`Unknown animation phase: ${phase}`);
                if (callback) callback();
        }
        
        // Update sync visualization
        this.updateSyncVisualization(phase);
    }
    
    /**
     * Execute win highlight phase animations
     */
    executeWinHighlightPhase(gridData, callback) {
        const mode = this.syncState.quickSpinMode ? 'quick' : 'normal';
        const duration = this.timingConfig.win_highlight[mode];
        const animations = [];
        
        // Highlight winning clusters
        if (gridData.winningClusters) {
            gridData.winningClusters.forEach(cluster => {
                cluster.positions.forEach(pos => {
                    const symbol = this.getSymbolAtPosition(pos.col, pos.row);
                    if (symbol) {
                        const highlightTween = this.scene.tweens.add({
                            targets: symbol,
                            scaleX: 1.2,
                            scaleY: 1.2,
                            alpha: 1,
                            duration: duration / 2,
                            yoyo: true,
                            ease: 'Power2'
                        });
                        animations.push(highlightTween);
                    }
                });
            });
        }
        
        this.phaseAnimations.win_highlight = animations;
        
        // Complete phase after duration
        this.scene.time.delayedCall(duration, () => {
            this.completePhase('win_highlight', callback);
        });
    }
    
    /**
     * Execute symbol removal phase animations
     */
    executeSymbolRemovalPhase(gridData, callback) {
        const mode = this.syncState.quickSpinMode ? 'quick' : 'normal';
        const duration = this.timingConfig.symbol_removal[mode];
        const animations = [];
        
        // Remove matched symbols with animation
        if (gridData.removedPositions) {
            gridData.removedPositions.forEach(pos => {
                const symbol = this.getSymbolAtPosition(pos.col, pos.row);
                if (symbol) {
                    const removeTween = this.scene.tweens.add({
                        targets: symbol,
                        scaleX: 0,
                        scaleY: 0,
                        alpha: 0,
                        duration: duration,
                        ease: 'Back.easeIn',
                        onComplete: () => {
                            if (symbol && symbol.destroy) {
                                symbol.destroy();
                            }
                        }
                    });
                    animations.push(removeTween);
                }
            });
        }
        
        this.phaseAnimations.symbol_removal = animations;
        
        // Complete phase after duration
        this.scene.time.delayedCall(duration, () => {
            this.completePhase('symbol_removal', callback);
        });
    }
    
    /**
     * Execute symbol drop phase animations
     */
    executeSymbolDropPhase(gridData, callback) {
        const mode = this.syncState.quickSpinMode ? 'quick' : 'normal';
        const duration = this.timingConfig.symbol_drop[mode];
        const animations = [];
        
        // Animate symbols dropping from above
        if (gridData.dropPatterns) {
            Object.keys(gridData.dropPatterns).forEach(col => {
                const drops = gridData.dropPatterns[col];
                drops.forEach(drop => {
                    const symbol = this.getSymbolAtPosition(parseInt(col), drop.toRow);
                    if (symbol) {
                        const dropTween = this.scene.tweens.add({
                            targets: symbol,
                            y: this.calculateSymbolY(drop.toRow),
                            duration: duration,
                            ease: 'Bounce.easeOut'
                        });
                        animations.push(dropTween);
                    }
                });
            });
        }
        
        this.phaseAnimations.symbol_drop = animations;
        
        // Complete phase after duration
        this.scene.time.delayedCall(duration, () => {
            this.completePhase('symbol_drop', callback);
        });
    }
    
    /**
     * Execute symbol settle phase animations
     */
    executeSymbolSettlePhase(gridData, callback) {
        const mode = this.syncState.quickSpinMode ? 'quick' : 'normal';
        const duration = this.timingConfig.symbol_settle[mode];
        const animations = [];
        
        // Subtle bounce animation for settling
        if (gridData.settledPositions) {
            gridData.settledPositions.forEach(pos => {
                const symbol = this.getSymbolAtPosition(pos.col, pos.row);
                if (symbol) {
                    const settleTween = this.scene.tweens.add({
                        targets: symbol,
                        y: symbol.y + 5,
                        duration: duration / 2,
                        yoyo: true,
                        ease: 'Sine.easeInOut'
                    });
                    animations.push(settleTween);
                }
            });
        }
        
        this.phaseAnimations.symbol_settle = animations;
        
        // Complete phase after duration
        this.scene.time.delayedCall(duration, () => {
            this.completePhase('symbol_settle', callback);
        });
    }
    
    /**
     * Task 3.4.3: Recovery animation sequences
     * Handles animation recovery when desync is detected
     */
    executeRecoveryPhase(recoveryData, callback) {
        console.log('Executing recovery animations:', recoveryData.type);
        
        this.recoveryState.active = true;
        this.recoveryState.type = recoveryData.type;
        this.recoveryState.attemptCount++;
        
        const mode = this.syncState.quickSpinMode ? 'quick' : 'normal';
        const fadeDuration = this.timingConfig.recovery_fade[mode];
        
        // Create recovery overlay
        this.createRecoveryOverlay();
        
        // Stop all current animations
        this.stopAllAnimations();
        
        switch(recoveryData.type) {
            case 'state_resync':
                this.performStateResync(recoveryData, callback);
                break;
                
            case 'step_replay':
                this.performStepReplay(recoveryData, callback);
                break;
                
            case 'timing_adjustment':
                this.performTimingAdjustment(recoveryData, callback);
                break;
                
            case 'full_resync':
                this.performFullResync(recoveryData, callback);
                break;
                
            default:
                console.warn('Unknown recovery type:', recoveryData.type);
                this.recoveryState.active = false;
                if (callback) callback();
        }
        
        // Fade out recovery overlay after completion
        this.scene.time.delayedCall(fadeDuration, () => {
            this.removeRecoveryOverlay();
        });
    }
    
    /**
     * Perform state resynchronization
     */
    performStateResync(recoveryData, callback) {
        console.log('Performing state resync...');
        
        // Quick fade to hide inconsistencies
        const fadeOut = this.scene.tweens.add({
            targets: this.scene.gridContainer || this.scene,
            alpha: 0.3,
            duration: 200,
            onComplete: () => {
                // Update grid state from recovery data
                if (recoveryData.gridState && window.GridManager) {
                    window.GridManager.setGrid(recoveryData.gridState);
                }
                
                // Fade back in
                this.scene.tweens.add({
                    targets: this.scene.gridContainer || this.scene,
                    alpha: 1,
                    duration: 300,
                    onComplete: () => {
                        this.recoveryState.active = false;
                        if (callback) callback();
                    }
                });
            }
        });
    }
    
    /**
     * Perform step replay recovery
     */
    performStepReplay(recoveryData, callback) {
        console.log('Performing step replay...');
        
        // Replay the last N steps quickly
        const stepsToReplay = recoveryData.steps || [];
        let currentStep = 0;
        
        const replayNextStep = () => {
            if (currentStep >= stepsToReplay.length) {
                this.recoveryState.active = false;
                if (callback) callback();
                return;
            }
            
            const step = stepsToReplay[currentStep];
            currentStep++;
            
            // Play step animation at 2x speed
            this.syncState.quickSpinMode = true;
            this.startPhaseAnimation(step.phase, step.gridData, replayNextStep);
        };
        
        replayNextStep();
    }
    
    /**
     * Perform timing adjustment recovery
     */
    performTimingAdjustment(recoveryData, callback) {
        console.log('Performing timing adjustment...');
        
        // Adjust all animation timings
        if (recoveryData.timingAdjustments) {
            Object.keys(recoveryData.timingAdjustments).forEach(phase => {
                const adjustment = recoveryData.timingAdjustments[phase];
                this.timingConfig[phase].normal *= adjustment;
                this.timingConfig[phase].quick *= adjustment;
            });
        }
        
        // Show adjustment indicator
        this.showTimingAdjustmentIndicator();
        
        this.scene.time.delayedCall(500, () => {
            this.recoveryState.active = false;
            if (callback) callback();
        });
    }
    
    /**
     * Perform full resynchronization
     */
    performFullResync(recoveryData, callback) {
        console.log('Performing full resync...');
        
        // Complete grid reset with dramatic effect
        const resetEffect = this.scene.tweens.add({
            targets: this.scene.gridContainer || this.scene,
            scaleX: 0,
            scaleY: 0,
            rotation: Math.PI,
            duration: 500,
            ease: 'Power2',
            onComplete: () => {
                // Reset entire grid state
                if (recoveryData.fullGridState && window.GridManager) {
                    window.GridManager.resetGrid();
                    window.GridManager.setGrid(recoveryData.fullGridState);
                }
                
                // Reset animation state
                this.resetAnimationState();
                
                // Restore grid with animation
                this.scene.tweens.add({
                    targets: this.scene.gridContainer || this.scene,
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0,
                    duration: 500,
                    ease: 'Back.easeOut',
                    onComplete: () => {
                        this.recoveryState.active = false;
                        if (callback) callback();
                    }
                });
            }
        });
    }
    
    /**
     * Task 3.4.4: Sync status visualization
     * Creates visual indicators for synchronization status
     */
    createSyncStatusIndicator() {
        if (this.syncVisualElements.indicator) return;
        
        const x = 20;
        const y = 20;
        
        // Create sync indicator container
        const container = this.scene.add.container(x, y);
        container.setDepth(1000);
        
        // Background panel
        const bg = this.scene.add.rectangle(0, 0, 200, 60, 0x000000, 0.7);
        bg.setOrigin(0, 0);
        container.add(bg);
        
        // Sync status icon (animated circle)
        const statusIcon = this.scene.add.circle(20, 30, 8, 0x00ff00);
        container.add(statusIcon);
        
        // Pulse animation for status icon
        this.scene.tweens.add({
            targets: statusIcon,
            scaleX: 1.2,
            scaleY: 1.2,
            alpha: 0.7,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Status text
        const statusText = this.scene.add.text(40, 20, 'SYNC: OK', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#00ff00'
        });
        container.add(statusText);
        
        // Progress bar
        const progressBg = this.scene.add.rectangle(40, 40, 140, 8, 0x333333);
        progressBg.setOrigin(0, 0.5);
        container.add(progressBg);
        
        const progressBar = this.scene.add.rectangle(40, 40, 0, 8, 0x00ff00);
        progressBar.setOrigin(0, 0.5);
        container.add(progressBar);
        
        // Store references
        this.syncVisualElements.indicator = container;
        this.syncVisualElements.statusIcon = statusIcon;
        this.syncVisualElements.statusText = statusText;
        this.syncVisualElements.progressBar = progressBar;
        
        return container;
    }
    
    /**
     * Update sync status visualization
     */
    updateSyncVisualization(phase) {
        if (!this.syncVisualElements.indicator) {
            this.createSyncStatusIndicator();
        }
        
        const statusIcon = this.syncVisualElements.statusIcon;
        const statusText = this.syncVisualElements.statusText;
        const progressBar = this.syncVisualElements.progressBar;
        
        // Update based on sync state
        if (this.recoveryState.active) {
            // Recovery mode - yellow
            statusIcon.setFillStyle(0xffff00);
            statusText.setText('SYNC: RECOVERING');
            statusText.setColor('#ffff00');
            progressBar.setFillStyle(0xffff00);
        } else if (this.syncState.syncErrors.length > 0) {
            // Error state - red
            statusIcon.setFillStyle(0xff0000);
            statusText.setText('SYNC: ERROR');
            statusText.setColor('#ff0000');
            progressBar.setFillStyle(0xff0000);
        } else {
            // Normal state - green
            statusIcon.setFillStyle(0x00ff00);
            statusText.setText(`SYNC: ${phase || 'OK'}`);
            statusText.setColor('#00ff00');
            progressBar.setFillStyle(0x00ff00);
        }
        
        // Update progress bar based on phase
        const phaseProgress = this.calculatePhaseProgress(phase);
        this.scene.tweens.add({
            targets: progressBar,
            scaleX: phaseProgress,
            duration: 200,
            ease: 'Linear'
        });
    }
    
    /**
     * Show desync warning overlay
     */
    showDesyncWarning(message) {
        // Remove existing warning
        if (this.syncVisualElements.errorOverlay) {
            this.syncVisualElements.errorOverlay.destroy();
        }
        
        const centerX = this.scene.cameras.main.width / 2;
        const centerY = this.scene.cameras.main.height / 2;
        
        // Create warning container
        const warningContainer = this.scene.add.container(centerX, centerY);
        warningContainer.setDepth(2000);
        
        // Semi-transparent background
        const bg = this.scene.add.rectangle(0, 0, 400, 150, 0x000000, 0.9);
        bg.setStrokeStyle(2, 0xff0000);
        warningContainer.add(bg);
        
        // Warning icon
        const icon = this.scene.add.text(0, -40, '⚠', {
            fontSize: '48px',
            color: '#ff0000'
        });
        icon.setOrigin(0.5);
        warningContainer.add(icon);
        
        // Warning message
        const text = this.scene.add.text(0, 20, message || 'Synchronization Lost', {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 350 }
        });
        text.setOrigin(0.5);
        warningContainer.add(text);
        
        // Auto-hide after 3 seconds
        this.scene.time.delayedCall(3000, () => {
            this.scene.tweens.add({
                targets: warningContainer,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    warningContainer.destroy();
                }
            });
        });
        
        this.syncVisualElements.errorOverlay = warningContainer;
    }
    
    /**
     * Create recovery overlay
     */
    createRecoveryOverlay() {
        const centerX = this.scene.cameras.main.width / 2;
        const centerY = this.scene.cameras.main.height / 2;
        
        // Create overlay container
        const overlay = this.scene.add.container(centerX, centerY);
        overlay.setDepth(1500);
        
        // Semi-transparent background
        const bg = this.scene.add.rectangle(0, 0, this.scene.cameras.main.width, this.scene.cameras.main.height, 0x000000, 0.5);
        overlay.add(bg);
        
        // Recovery spinner
        const spinner = this.scene.add.sprite(0, -30, 'ui_bn_magic-an_00');
        if (this.scene.anims.exists('burst_magic_animation')) {
            spinner.play('burst_magic_animation');
        }
        overlay.add(spinner);
        
        // Recovery text
        const text = this.scene.add.text(0, 30, 'Synchronizing...', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffffff'
        });
        text.setOrigin(0.5);
        overlay.add(text);
        
        // Fade in
        overlay.setAlpha(0);
        this.scene.tweens.add({
            targets: overlay,
            alpha: 1,
            duration: 300
        });
        
        this.syncVisualElements.recoveryOverlay = overlay;
    }
    
    /**
     * Remove recovery overlay
     */
    removeRecoveryOverlay() {
        if (this.syncVisualElements.recoveryOverlay) {
            this.scene.tweens.add({
                targets: this.syncVisualElements.recoveryOverlay,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    this.syncVisualElements.recoveryOverlay.destroy();
                    this.syncVisualElements.recoveryOverlay = null;
                }
            });
        }
    }
    
    /**
     * Show timing adjustment indicator
     */
    showTimingAdjustmentIndicator() {
        const indicator = this.scene.add.text(
            this.scene.cameras.main.width / 2,
            100,
            'Timing Adjusted',
            {
                fontSize: '20px',
                fontFamily: 'Arial',
                color: '#ffff00',
                stroke: '#000000',
                strokeThickness: 2
            }
        );
        indicator.setOrigin(0.5);
        indicator.setDepth(1000);
        
        // Fade in and out
        indicator.setAlpha(0);
        this.scene.tweens.add({
            targets: indicator,
            alpha: 1,
            duration: 300,
            yoyo: true,
            hold: 1000,
            onComplete: () => {
                indicator.destroy();
            }
        });
    }
    
    // ============== HELPER METHODS ==============
    
    /**
     * Enable cascade synchronization
     */
    enableSync(quickSpinMode = false) {
        this.syncState.enabled = true;
        this.syncState.quickSpinMode = quickSpinMode;
        this.createSyncStatusIndicator();
        console.log('Animation synchronization enabled');
    }
    
    /**
     * Disable cascade synchronization
     */
    disableSync() {
        this.syncState.enabled = false;
        if (this.syncVisualElements.indicator) {
            this.syncVisualElements.indicator.destroy();
            this.syncVisualElements.indicator = null;
        }
        console.log('Animation synchronization disabled');
    }
    
    /**
     * Get symbol at grid position
     */
    getSymbolAtPosition(col, row) {
        if (window.GridManager && window.GridManager.grid) {
            return window.GridManager.grid[col] && window.GridManager.grid[col][row];
        }
        return null;
    }
    
    /**
     * Calculate symbol Y position
     */
    calculateSymbolY(row) {
        // Use GridManager's calculation if available
        if (window.GridManager && window.GridManager.calculateSymbolY) {
            return window.GridManager.calculateSymbolY(row);
        }
        // Fallback calculation
        return 200 + (row * 100);
    }
    
    /**
     * Run phase animation without sync
     */
    runPhaseAnimationNormal(phase, gridData, callback) {
        // Default non-synchronized animation execution
        console.log(`Running ${phase} animation (non-synchronized)`);
        if (callback) {
            this.scene.time.delayedCall(500, callback);
        }
    }
    
    /**
     * Complete animation phase
     */
    completePhase(phase, callback) {
        this.animationMetrics.phaseEndTimes[phase] = Date.now();
        
        // Send acknowledgment if sync is enabled
        if (this.syncState.enabled && window.CascadeAPI) {
            const acknowledgment = {
                phase: phase,
                stepIndex: this.syncState.stepIndex,
                completedAt: Date.now(),
                duration: this.animationMetrics.phaseEndTimes[phase] - this.animationMetrics.phaseStartTimes[phase]
            };
            
            // Send acknowledgment via CascadeAPI
            if (window.CascadeAPI.sendStepAcknowledgment) {
                window.CascadeAPI.sendStepAcknowledgment(acknowledgment);
            }
        }
        
        // Clear phase animations
        this.clearPhaseAnimations(phase);
        
        if (callback) callback();
    }
    
    /**
     * Clear animations for a specific phase
     */
    clearPhaseAnimations(phase) {
        if (!phase || !this.phaseAnimations[phase]) return;
        
        this.phaseAnimations[phase].forEach(anim => {
            if (anim && anim.stop) {
                anim.stop();
            } else if (anim && anim.remove) {
                anim.remove();
            }
        });
        
        this.phaseAnimations[phase] = [];
    }
    
    /**
     * Stop all animations
     */
    stopAllAnimations() {
        Object.keys(this.phaseAnimations).forEach(phase => {
            this.clearPhaseAnimations(phase);
        });
        
        // Stop all scene tweens
        if (this.scene.tweens) {
            this.scene.tweens.killAll();
        }
    }
    
    /**
     * Reset animation state
     */
    resetAnimationState() {
        this.syncState.currentPhase = null;
        this.syncState.stepIndex = 0;
        this.syncState.animationQueue = [];
        this.syncState.pendingAcknowledgments.clear();
        this.syncState.syncErrors = [];
        this.animationMetrics = {
            phaseStartTimes: {},
            phaseEndTimes: {},
            totalAnimationTime: 0,
            syncAccuracy: 100
        };
        this.recoveryState = {
            active: false,
            type: null,
            attemptCount: 0,
            savedAnimations: [],
            rollbackPoint: null
        };
    }
    
    /**
     * Calculate phase progress (0-1)
     */
    calculatePhaseProgress(phase) {
        if (!phase || !this.animationMetrics.phaseStartTimes[phase]) {
            return 0;
        }
        
        const startTime = this.animationMetrics.phaseStartTimes[phase];
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        
        const mode = this.syncState.quickSpinMode ? 'quick' : 'normal';
        const expectedDuration = this.timingConfig[phase] ? this.timingConfig[phase][mode] : 1000;
        
        return Math.min(1, elapsed / expectedDuration);
    }
    
    /**
     * Update synchronization accuracy metric
     */
    updateSyncAccuracy(cascadeStep) {
        if (!cascadeStep || !cascadeStep.timing) return;
        
        // Calculate accuracy based on timing differences
        let totalDiff = 0;
        let count = 0;
        
        Object.keys(cascadeStep.timing).forEach(phase => {
            if (this.animationMetrics.phaseEndTimes[phase] && this.animationMetrics.phaseStartTimes[phase]) {
                const actualDuration = this.animationMetrics.phaseEndTimes[phase] - this.animationMetrics.phaseStartTimes[phase];
                const expectedDuration = cascadeStep.timing[phase];
                const diff = Math.abs(actualDuration - expectedDuration);
                totalDiff += diff;
                count++;
            }
        });
        
        if (count > 0) {
            const avgDiff = totalDiff / count;
            // Convert to accuracy percentage (0-100)
            this.animationMetrics.syncAccuracy = Math.max(0, 100 - (avgDiff / 10));
        }
    }
    
    /**
     * Log sync error
     */
    logSyncError(error) {
        this.syncState.syncErrors.push({
            timestamp: Date.now(),
            phase: this.syncState.currentPhase,
            stepIndex: this.syncState.stepIndex,
            error: error
        });
        
        // Keep only last 10 errors
        if (this.syncState.syncErrors.length > 10) {
            this.syncState.syncErrors.shift();
        }
        
        console.error('Animation sync error:', error);
    }
    
    destroy() {
        // Clean up sync visualization
        if (this.syncVisualElements.indicator) {
            this.syncVisualElements.indicator.destroy();
        }
        if (this.syncVisualElements.errorOverlay) {
            this.syncVisualElements.errorOverlay.destroy();
        }
        if (this.syncVisualElements.recoveryOverlay) {
            this.syncVisualElements.recoveryOverlay.destroy();
        }
        
        // Stop all animations
        this.stopAllAnimations();
        
        // Clean up any references and timers
        this.scene = null;
        this.syncState = null;
        this.phaseAnimations = null;
        this.syncVisualElements = null;
        this.animationMetrics = null;
        this.recoveryState = null;
    }

    // Play Thanos portrait SNAP animation once, then return to idle (no SFX here)
    playThanosSnap() {
        try {
            if (!this.scene || !this.scene.portrait_thanos) return;
            if (!this.scene.anims || !this.scene.anims.exists('thanos_snap_animation')) return;
            if (!this.scene.portrait_thanos.anims) return;

            try { this.scene.portrait_thanos.stop(); } catch (_) {}
            this.scene.portrait_thanos.play('thanos_snap_animation');
            this.scene.portrait_thanos.once('animationcomplete', () => {
                try {
                    if (this.scene.anims.exists('thanos_idle_animation')) {
                        this.scene.portrait_thanos.play('thanos_idle_animation');
                    }
                } catch (_) {}
            });
        } catch (e) {
            console.warn('Failed to play Thanos snap animation:', e);
        }
    }
} 
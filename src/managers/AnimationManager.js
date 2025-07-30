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
        
        // Create Thanos portrait animations (idle and attack)
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
            } else {
                console.warn('Thanos animation data not found in cache');
                this.createFallbackPortraitAnimation('thanos_idle_animation', 'thanos-idle_00');
                this.createFallbackPortraitAnimation('thanos_attack_animation', 'thanos-attack_00');
            }
        } catch (error) {
            console.warn('Failed to create Thanos portrait animations:', error);
            this.createFallbackPortraitAnimation('thanos_idle_animation', 'thanos-idle_00');
            this.createFallbackPortraitAnimation('thanos_attack_animation', 'thanos-attack_00');
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
    
    destroy() {
        // Clean up any references and timers
        this.scene = null;
    }
} 
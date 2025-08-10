// Win Presentation Manager - handles all win presentation animations and effects
window.WinPresentationManager = class WinPresentationManager {
    constructor(scene) {
        this.scene = scene;
        this.isShowingWinPresentation = false;
    }
    
    showWinPresentation(totalWin) {
        const winCategory = this.scene.winCalculator.getWinCategory(totalWin, this.scene.stateManager.gameData.currentBet);
        
        if (winCategory) {
            this.isShowingWinPresentation = true;
            const width = this.scene.cameras.main.width;
            const height = this.scene.cameras.main.height;
            
            // Map win categories to animation keys
            const animationMap = {
                SMALL: 'win_01',      // Small Win
                MEDIUM: 'win_01',     // Medium Win (use same as small)
                BIG: 'win_02',        // Big Win
                MEGA: 'win_03',       // Mega Win
                EPIC: 'win_04',       // Ultra Win
                LEGENDARY: 'win_05'   // Legendary Win
            };
            
            const animKey = animationMap[winCategory.key] || 'win_01';
            
            // Create win animation sprite
            const winSprite = this.scene.add.sprite(width / 2, height / 2 - 50, animKey);
            winSprite.setDepth(window.GameConfig.UI_DEPTHS.FX);
            winSprite.setScale(0);
            
            // Play the animation only if it exists
            if (this.scene.anims.exists(animKey)) {
                winSprite.play(animKey);
            } else {
                console.warn(`Win animation ${animKey} not found`);
                // Set a default frame if animation doesn't exist
                winSprite.setFrame(0);
            }
            
            // Add win particles for bigger wins
            if (winCategory.key === 'BIG' || winCategory.key === 'MEGA' || 
                winCategory.key === 'EPIC' || winCategory.key === 'LEGENDARY') {
                this.createWinParticles(width / 2, height / 2);
            }
            
            // Add win amount text
            const winAmountText = this.scene.add.text(
                width / 2,
                height / 2 + 100,
                `$${totalWin.toFixed(2)}`,
                {
                    fontSize: '48px',
                    fontFamily: 'Arial Black',
                    color: '#FFD700',
                    stroke: '#000000',
                    strokeThickness: 6
                }
            );
            winAmountText.setOrigin(0.5);
            winAmountText.setDepth(window.GameConfig.UI_DEPTHS.FX + 1);
            winAmountText.setScale(0);
            
            // Animate entrance
            this.scene.tweens.add({
                targets: winSprite,
                scaleX: 1,
                scaleY: 1,
                duration: 500,
                ease: 'Back.out',
                onComplete: () => {
                    // Pulse effect for legendary wins
                    if (winCategory.key === 'LEGENDARY') {
                        this.scene.tweens.add({
                            targets: winSprite,
                            scaleX: 1.1,
                            scaleY: 1.1,
                            duration: 500,
                            yoyo: true,
                            repeat: -1,
                            ease: 'Sine.easeInOut'
                        });
                    }
                }
            });
            
            this.scene.tweens.add({
                targets: winAmountText,
                scaleX: 1,
                scaleY: 1,
                duration: 600,
                delay: 200,
                ease: 'Back.out'
            });
            
            // Play win sound based on category
            const soundMap = {
                SMALL: 'kaching',
                MEDIUM: 'kaching',
                BIG: 'bonus',
                MEGA: 'bonus',
                EPIC: 'bonus',
                LEGENDARY: 'bonus'
            };
            window.SafeSound.play(this.scene, soundMap[winCategory.key] || 'kaching');
            
            // Remove after delay
            const displayDuration = winCategory.key === 'LEGENDARY' ? 5000 : 3000;
            this.scene.time.delayedCall(displayDuration, () => {
                this.scene.tweens.add({
                    targets: [winSprite, winAmountText],
                    alpha: 0,
                    scaleX: 0,
                    scaleY: 0,
                    duration: 500,
                    ease: 'Power2',
                    onComplete: () => {
                        // Safety checks before destroying objects
                        if (winSprite && winSprite.scene) {
                            winSprite.destroy();
                        }
                        if (winAmountText && winAmountText.scene) {
                            winAmountText.destroy();
                        }
                        // Only clear flag if scene is still active
                        if (this.scene.scene && this.scene.scene.isActive()) {
                            this.isShowingWinPresentation = false;
                        }
                    }
                });
            });
        }
    }
    
    createWinParticles(x, y) {
        // Create particle animation using the skeleton-animation frames
        const particleCount = 8;
        const radius = 200;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const particleX = x + Math.cos(angle) * radius;
            const particleY = y + Math.sin(angle) * radius;
            
            // Create animated particle
            const frameCount = 32;
            const randomStart = Math.floor(Math.random() * frameCount);
            
            let currentFrame = randomStart;
            const particle = this.scene.add.image(particleX, particleY, `skeleton-animation_${currentFrame.toString().padStart(2, '0')}`);
            particle.setScale(0.5);
            particle.setDepth(window.GameConfig.UI_DEPTHS.FX_UNDERLAY);
            particle.setAlpha(0);
            
            // Animate particle
            this.scene.tweens.add({
                targets: particle,
                x: x,
                y: y,
                alpha: 1,
                scaleX: 1,
                scaleY: 1,
                duration: 1000,
                ease: 'Power2',
                onComplete: () => {
                    // Explode outward
                    this.scene.tweens.add({
                        targets: particle,
                        x: x + Math.cos(angle) * radius * 2,
                        y: y + Math.sin(angle) * radius * 2,
                        alpha: 0,
                        scaleX: 0.2,
                        scaleY: 0.2,
                        duration: 1000,
                        ease: 'Power2',
                        onComplete: () => {
                            if (particle && particle.scene) {
                                particle.destroy();
                            }
                        }
                    });
                }
            });
            
            // Animate through frames
            const frameTimer = this.scene.time.addEvent({
                delay: 50,
                repeat: 40,
                callback: () => {
                    // Safety check to ensure particle and scene still exist
                    if (particle && particle.scene && this.scene.scene.isActive()) {
                        currentFrame = (currentFrame + 1) % frameCount;
                        const frameKey = `skeleton-animation_${currentFrame.toString().padStart(2, '0')}`;
                        if (this.scene.textures.exists(frameKey)) {
                            particle.setTexture(frameKey);
                        }
                    } else {
                        // Stop the timer if particle or scene is destroyed
                        frameTimer.destroy();
                    }
                }
            });
        }
    }
    
    async showFreeSpinsCompleteScreen(totalWin) {
        return new Promise(resolve => {
            console.log(`=== SHOW FREE SPINS COMPLETE SCREEN ===`);
            console.log(`Total Free Spins Win: $${totalWin.toFixed(2)}`);

            const width = this.scene.cameras.main.width;
            const height = this.scene.cameras.main.height;

            const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0);
            overlay.setDepth(window.GameConfig.UI_DEPTHS.FX_UNDERLAY);
            this.scene.tweens.add({
                targets: overlay,
                fillAlpha: 0.8,
                duration: 500
            });

            const winCategory = this.scene.winCalculator.getWinCategory(totalWin, this.scene.stateManager.gameData.currentBet) || { name: 'Amazing Win', key: 'BIG' };
            
            // Map win categories to animation keys
            const animationMap = {
                SMALL: 'win_01',
                MEDIUM: 'win_01',
                BIG: 'win_02',
                MEGA: 'win_03',
                EPIC: 'win_04',
                LEGENDARY: 'win_05'
            };

            const animKey = animationMap[winCategory.key] || 'win_02';
            
            // Create win animation sprite
            const winSprite = this.scene.add.sprite(width / 2, height / 2 - 100, animKey);
            winSprite.setDepth(window.GameConfig.UI_DEPTHS.FX);
            winSprite.setScale(0);
            
            // Play the animation only if it exists
            if (this.scene.anims.exists(animKey)) {
                winSprite.play(animKey);
            } else {
                console.warn(`Win animation ${animKey} not found for free spins complete`);
                winSprite.setFrame(0);
            }
            
            // Add win particles for free spins complete
            this.createWinParticles(width / 2, height / 2 - 100);

            const totalWinText = this.scene.add.text(width / 2, height / 2, 'Total Win', {
                fontSize: '32px',
                fontFamily: 'Arial',
                color: '#FFFFFF'
            });
            totalWinText.setOrigin(0.5);
            totalWinText.setDepth(window.GameConfig.UI_DEPTHS.FX);
            totalWinText.setAlpha(0);

            const amountText = this.scene.add.text(width / 2, height / 2 + 70, `$${totalWin.toFixed(2)}`, {
                fontSize: '72px',
                fontFamily: 'Arial Black',
                color: '#FFD700',
                stroke: '#000000',
                strokeThickness: 6
            });
            amountText.setOrigin(0.5);
            amountText.setDepth(window.GameConfig.UI_DEPTHS.FX);
            amountText.setScale(0);

            // Add a golden glow effect behind the win amount
            const glowGraphics = this.scene.add.graphics();
            glowGraphics.setDepth(window.GameConfig.UI_DEPTHS.FX_UNDERLAY);
            
            // Animate the glow with pulsing effect
            let glowScale = 1;
            const glowUpdate = () => {
                if (glowGraphics && glowGraphics.scene && this.scene.scene && this.scene.scene.isActive()) {
                    try {
                        glowGraphics.clear();
                        const time = Date.now() * 0.001;
                        glowScale = 1 + Math.sin(time * 2) * 0.1;
                        
                        const glowRadius = 200 * glowScale;
                        for (let i = 0; i < 3; i++) {
                            const alpha = (0.3 - (i * 0.1)) * (0.8 + Math.sin(time * 3) * 0.2);
                            const radius = glowRadius + (i * 50);
                            glowGraphics.fillStyle(0xFFD700, alpha);
                            glowGraphics.fillCircle(width / 2, height / 2 + 70, radius);
                        }
                        requestAnimationFrame(glowUpdate);
                    } catch (error) {
                        console.warn('Error updating glow effect:', error);
                        // Stop the glow update loop if there's an error
                    }
                }
            };
            glowUpdate();
            
            // Create money particle emitters
            const moneyParticles = this.createMoneyParticles(width, height);
            
            // First tween - animate win sprite
            this.scene.tweens.add({
                targets: winSprite,
                scale: 1,
                duration: 800,
                ease: 'Back.out',
                onStart: () => {
                    window.SafeSound.play(this.scene, 'bonus');
                },
                onComplete: () => {
                    // Second tween - animate text and start particles
                    this.scene.tweens.add({
                        targets: [totalWinText, amountText],
                        scale: 1,
                        alpha: 1,
                        duration: 800,
                        ease: 'Back.out',
                        onStart: () => {
                            // Start money particle animation
                            this.animateMoneyParticles(moneyParticles);
                        },
                        onComplete: () => {
                            // Wait longer to enjoy the money rain effect
                            this.scene.time.delayedCall(14000, () => {
                                // Stop and destroy any remaining money particles
                                moneyParticles.forEach(particle => {
                                    if (particle && particle.sprite && particle.sprite.scene) {
                                        try {
                                            particle.sprite.destroy();
                                        } catch (error) {
                                            console.warn('Error destroying money particle:', error);
                                        }
                                    }
                                });
                                
                                this.scene.tweens.add({
                                    targets: [overlay, winSprite, totalWinText, amountText, glowGraphics],
                                    alpha: 0,
                                    duration: 1000,
                                    ease: 'Power2',
                                    onComplete: () => {
                                        // Safety checks before destroying objects
                                        if (overlay && overlay.scene) overlay.destroy();
                                        if (winSprite && winSprite.scene) winSprite.destroy();
                                        if (totalWinText && totalWinText.scene) totalWinText.destroy();
                                        if (amountText && amountText.scene) amountText.destroy();
                                        if (glowGraphics && glowGraphics.scene) glowGraphics.destroy();
                                        console.log(`Free spins complete screen removed`);
                                        resolve();
                                    }
                                });
                            });
                        }
                    });
                }
            });
        });
    }
    
    createMoneyParticles(width, height) {
        const moneyParticles = [];
        const particleCount = 20;
        
        // Check if money sprite texture exists
        if (!this.scene.textures.exists('money_sprite')) {
            console.warn('Money sprite texture not found, skipping money particles');
            return moneyParticles;
        }
        
        for (let i = 0; i < particleCount; i++) {
            const emitterX = width / 2 + (Math.random() - 0.5) * 600;
            const moneySprite = this.scene.add.sprite(emitterX, height + 100, 'money_sprite');
            moneySprite.setScale(0.3 + Math.random() * 0.2);
            moneySprite.setDepth(window.GameConfig.UI_DEPTHS.FX + 1);
            moneySprite.setVisible(false);
            
            // Set a random frame first, then start animation
            try {
                const randomFrame = Math.floor(Math.random() * 16);
                moneySprite.setFrame(randomFrame);
                
                // Only play animation if it exists
                if (this.scene.anims.exists('money_animation')) {
                    moneySprite.play('money_animation');
                } else {
                    console.warn('Money animation not found, using static frame');
                }
            } catch (error) {
                console.warn('Failed to setup money sprite animation:', error);
                moneySprite.setFrame(0);
            }
            
            moneyParticles.push({
                sprite: moneySprite,
                velocityY: -(700 + Math.random() * 400),
                velocityX: (Math.random() - 0.5) * 300,
                gravity: 600,
                lifespan: 16000,
                startTime: Date.now() + i * 100,
                active: false,
                rotationSpeed: (Math.random() - 0.5) * 5
            });
        }
        
        return moneyParticles;
    }
    
    animateMoneyParticles(moneyParticles) {
        moneyParticles.forEach(particle => {
            particle.active = true;
        });
        
        const updateParticles = () => {
            const currentTime = Date.now();
            let allInactive = true;
            
            moneyParticles.forEach(particle => {
                if (!particle || !particle.sprite || !particle.sprite.scene) {
                    return;
                }
                
                if (particle.active && currentTime >= particle.startTime) {
                    try {
                        if (!particle.sprite.visible) {
                            particle.sprite.setVisible(true);
                        }
                        
                        // Update position
                        particle.sprite.x += particle.velocityX * 0.016;
                        particle.sprite.y += particle.velocityY * 0.016;
                        particle.velocityY += particle.gravity * 0.016;
                        
                        // Add rotation
                        particle.sprite.rotation += particle.rotationSpeed * 0.016;
                        
                        // Slow down horizontal movement over time
                        particle.velocityX *= 0.995;
                        
                        // Fade out near end of lifespan
                        const elapsed = currentTime - particle.startTime;
                        if (elapsed > particle.lifespan * 0.8) {
                            const fadeProgress = (elapsed - particle.lifespan * 0.8) / (particle.lifespan * 0.2);
                            particle.sprite.setAlpha(1 - fadeProgress);
                        }
                        
                        // Add subtle scale pulsing
                        const baseScale = particle.sprite.scaleX;
                        const pulse = Math.sin(elapsed * 0.003) * 0.1;
                        particle.sprite.setScale(baseScale + pulse);
                        
                        // Deactivate if lifespan exceeded
                        if (elapsed > particle.lifespan) {
                            particle.active = false;
                            particle.sprite.setVisible(false);
                            particle.sprite.destroy();
                        } else {
                            allInactive = false;
                        }
                    } catch (error) {
                        console.warn('Error updating money particle:', error);
                        particle.active = false;
                        if (particle.sprite && particle.sprite.scene) {
                            particle.sprite.destroy();
                        }
                    }
                } else if (currentTime < particle.startTime) {
                    allInactive = false;
                }
            });
            
            if (!allInactive) {
                requestAnimationFrame(updateParticles);
            }
        };
        
        updateParticles();
    }
    
    showBigFreeSpinsMessage(freeSpins) {
        console.log(`=== SHOW BIG FREE SPINS MESSAGE ===`);
        console.log(`Free spins awarded: ${freeSpins}`);
        
        // Create dramatic background overlay
        const overlay = this.scene.add.rectangle(
            this.scene.cameras.main.width / 2,
            this.scene.cameras.main.height / 2,
            this.scene.cameras.main.width,
            this.scene.cameras.main.height,
            0x000000,
            0.8
        );
        overlay.setDepth(window.GameConfig.UI_DEPTHS.FX_UNDERLAY);
        
        // Main title
        const title = this.scene.add.text(
            this.scene.cameras.main.width / 2,
            this.scene.cameras.main.height / 2 - 50,
            'FREE SPINS AWARDED!',
            {
                fontSize: '72px',
                fontFamily: 'Arial Black',
                color: '#FFD700',
                stroke: '#000000',
                strokeThickness: 8
            }
        );
        title.setOrigin(0.5);
        title.setDepth(window.GameConfig.UI_DEPTHS.FX);
        title.setScale(0);
        
        // Number of spins
        const spinsText = this.scene.add.text(
            this.scene.cameras.main.width / 2,
            this.scene.cameras.main.height / 2 + 50,
            `${freeSpins} FREE SPINS`,
            {
                fontSize: '48px',
                fontFamily: 'Arial Black',
                color: '#00FF00',
                stroke: '#000000',
                strokeThickness: 6
            }
        );
        spinsText.setOrigin(0.5);
        spinsText.setDepth(window.GameConfig.UI_DEPTHS.FX);
        spinsText.setScale(0);
        
        // Animate entrance
        this.scene.tweens.add({
            targets: [title, spinsText],
            scaleX: 1,
            scaleY: 1,
            duration: 800,
            ease: 'Back.out',
            delay: 200
        });
        
        // Pulsing effect
        this.scene.tweens.add({
            targets: [title, spinsText],
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 600,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut',
            delay: 1000
        });
        
        // Remove after 4 seconds
        this.scene.time.delayedCall(4000, () => {
            this.scene.tweens.add({
                targets: [overlay, title, spinsText],
                alpha: 0,
                duration: 800,
                ease: 'Power2',
                onComplete: () => {
                    overlay.destroy();
                    title.destroy();
                    spinsText.destroy();
                    console.log(`Big free spins message removed`);
                }
            });
        });
        
        console.log(`=== END SHOW BIG FREE SPINS MESSAGE ===`);
    }
    
    // Getters
    isShowingPresentation() { return this.isShowingWinPresentation; }
} 
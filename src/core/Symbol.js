// Phaser is loaded globally
// GameConfig is loaded globally

window.Symbol = class Symbol extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, texture) {
        super(scene, x, y, texture);
        
        this.scene = scene;
        this.symbolType = texture;
        this.gridCol = -1;
        this.gridRow = -1;
        this.isMatched = false;
        this.multiplier = 1;
        
        // Animation states
        this.states = {
            IDLE: 'idle',
            APPEARING: 'appearing',
            FALLING: 'falling',
            MATCHED: 'matched',
            DESTROYING: 'destroying',
            SPECIAL: 'special'
        };
        
        this.currentState = this.states.IDLE;
        
        // Effects
        this.glowEffect = null;
        this.shadowEffect = null;
        
        // Ensure symbols render above bottom UI panel
        // Depth is chosen to be higher than UI panel (depth 2) and most UI images (depth 3)
        this.setDepth(window.GameConfig.UI_DEPTHS.GRID_SYMBOL);
        
        // Initialize
        this.setDisplaySize(window.GameConfig.SYMBOL_SIZE, window.GameConfig.SYMBOL_SIZE);
        this.setInteractive();
        this.createEffects();
        this.setupAnimations();
    }
    
    setDepthWithEffects(depth) {
        this.setDepth(depth);
        if (this.shadowEffect) {
            this.shadowEffect.setDepth(depth - 1);
        }
        if (this.glowEffect) {
            this.glowEffect.setDepth(depth - 2);
        }
    }
    
    createEffects() {
        // Create shadow
        // Shadow should use the same visual as the symbol; for frame-based sprites, use the base texture key
        this.shadowEffect = this.scene.add.image(this.x + 5, this.y + 5, this.texture.key);
        this.shadowEffect.setDisplaySize(window.GameConfig.SYMBOL_SIZE, window.GameConfig.SYMBOL_SIZE);
        this.shadowEffect.setTint(0x000000);
        this.shadowEffect.setAlpha(0.3);
        this.shadowEffect.setDepth(this.depth - 1);
        
        // Create glow effect container
        this.glowEffect = this.scene.add.graphics();
        this.glowEffect.setDepth(this.depth - 2);
        
        // Initially hide shadow and glow effects during creation
        this.shadowEffect.setVisible(false);
        this.glowEffect.setVisible(false);
        
        // Add hover effects
        this.on('pointerover', () => {
            if (this.currentState === this.states.IDLE) {
                this.setScale(1.1);
            }
        });
        
        this.on('pointerout', () => {
            if (this.currentState === this.states.IDLE) {
                this.setScale(1);
            }
        });
    }
    
    setupAnimations() {
        // Don't start idle animations immediately - they'll be started after cascading
        this.idleTween = null;
        // If this is the Thanos symbol using spritesheet, prefer animation
        try {
            if (this.symbolType === 'thanos' && this.scene.anims && this.scene.anims.exists('thanos_symbol_idle')) {
                this.setTexture('thanos_sprite', 0);
            }
        } catch (_) {}
    }
    
    startIdleAnimation() {
        // Stop any existing idle animation
        if (this.idleTween) {
            this.idleTween.stop();
        }
        
        // Only start idle animation if symbol is in IDLE state
        if (this.currentState === this.states.IDLE) {
            // If Thanos symbol spritesheet is available, run its idle animation; otherwise, fallback tween
            if (this.symbolType === 'thanos' && this.scene.anims && this.scene.anims.exists('thanos_symbol_idle')) {
                try {
                    this.play('thanos_symbol_idle');
                } catch (_) {
                    // Fallback gentle floating
                    this.idleTween = this.scene.tweens.add({
                        targets: this,
                        y: this.y + 5,
                        duration: 2000 + Math.random() * 1000,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }
            } else {
                // Fallback gentle floating
                this.idleTween = this.scene.tweens.add({
                    targets: this,
                    y: this.y + 5,
                    duration: 2000 + Math.random() * 1000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
        }
    }
    
    stopIdleAnimation() {
        if (this.idleTween) {
            this.idleTween.stop();
            this.idleTween = null;
        }
    }
    
    appear(delay = 0) {
        this.currentState = this.states.APPEARING;
        this.setScale(0);
        this.setAlpha(0);
        
        return new Promise(resolve => {
            this.scene.tweens.add({
                targets: this,
                scaleX: 1,
                scaleY: 1,
                alpha: 1,
                duration: 300,
                delay: delay,
                ease: 'Back.out',
                onComplete: () => {
                    this.currentState = this.states.IDLE;
                    resolve();
                }
            });
            
            // Shadow animation
            if (this.shadowEffect) {
                this.shadowEffect.setScale(0);
                this.shadowEffect.setAlpha(0);
                this.scene.tweens.add({
                    targets: this.shadowEffect,
                    scaleX: 1,
                    scaleY: 1,
                    alpha: 0.3,
                    duration: 300,
                    delay: delay,
                    ease: 'Back.out'
                });
            }
        });
    }
    
    fall(targetY, duration = window.GameConfig.CASCADE_SPEED) {
        this.currentState = this.states.FALLING;
        
        // Stop idle animation during fall
        this.stopIdleAnimation();
        
        return new Promise(resolve => {
            this.scene.tweens.add({
                targets: this,
                y: targetY,
                duration: duration,
                ease: 'Bounce.out',
                onComplete: () => {
                    this.currentState = this.states.IDLE;
                    // Don't start idle animation immediately - let cascading finish first
                    resolve();
                }
            });
            
            // Move shadow too
            if (this.shadowEffect) {
                this.scene.tweens.add({
                    targets: this.shadowEffect,
                    y: targetY + 5,
                    duration: duration,
                    ease: 'Bounce.out'
                });
            }
        });
    }
    
    showMatched() {
        this.currentState = this.states.MATCHED;
        this.isMatched = true;
        
        // Stop idle animation
        if (this.idleTween) {
            this.idleTween.stop();
        }
        
        // Pulsing effect
        this.scene.tweens.add({
            targets: this,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 300,
            yoyo: true,
            repeat: 2,
            ease: 'Power2'
        });
        
        // Glow effect
        this.addGlow(0xFFD700, 0.8);
    }
    
    destroy(playDestructionAnimation = false) {
        this.currentState = this.states.DESTROYING;
        
        // Stop all tweens and animations
        if (this.idleTween) {
            this.idleTween.stop();
            this.idleTween = null;
        }
        
        // Stop any glow tweens
        if (this.glowTween) {
            this.glowTween.stop();
            this.glowTween = null;
        }
        
        // Stop multiplier pulse tween
        if (this.multiplierPulseTween) {
            this.multiplierPulseTween.stop();
            this.multiplierPulseTween = null;
        }
        
        // Clear any delayed calls
        if (this.delayedCalls) {
            this.delayedCalls.forEach(call => {
                if (call && call.remove) call.remove();
            });
            this.delayedCalls = null;
        }
        
        // Remove event listeners
        this.removeAllListeners();
        
        // Clean up multiplier text if it exists
        if (this.multiplierText) {
            this.multiplierText.destroy();
            this.multiplierText = null;
        }
        
        // Check if we should play destruction animation
        // Only play if explicitly requested AND not in burst mode
        let hasDestructionAnim = false;
        let destructionAnimKey = '';
        
        if (playDestructionAnimation && !this.scene.burstModeActive) {
            // Map symbol types to new animation keys
            const symbolToAnimMap = {
                'time_gem': 'timegem_destruction',
                'reality_gem': 'realitygem_destruction',
                'power_gem': 'powergem_destruction',
                'space_gem': 'spacegem_destruction',
                'soul_gem': 'soulgem_destruction',
                'mind_gem': 'mindgem_destruction'
            };
            
            destructionAnimKey = symbolToAnimMap[this.symbolType] || `${this.symbolType}_destruction`;
            hasDestructionAnim = this.scene.anims.exists(destructionAnimKey);
        }
        
        if (hasDestructionAnim) {
            // Create a sprite for the destruction animation at the same position
            const destructionSprite = this.scene.add.sprite(this.x, this.y, destructionAnimKey);
            destructionSprite.setDisplaySize(window.GameConfig.SYMBOL_SIZE * 1.5, window.GameConfig.SYMBOL_SIZE * 1.5);
            destructionSprite.setDepth(window.GameConfig.UI_DEPTHS.FX); // Above UI and symbols
            
            // Play the destruction animation
            destructionSprite.play(destructionAnimKey);
            
            // Play destruction sound
            window.SafeSound.play(this.scene, 'cascade');
            
            // Hide the original symbol immediately
            this.setAlpha(0);
            if (this.shadowEffect) {
                this.shadowEffect.setAlpha(0);
            }
            
            // Clean up after animation completes
            destructionSprite.once('animationcomplete', () => {
                destructionSprite.destroy();
                
                // Clean up the symbol and its effects
                if (this.shadowEffect) {
                    this.shadowEffect.destroy();
                }
                if (this.glowEffect) {
                    this.glowEffect.destroy();
                }
                
                // Nullify references to prevent memory leaks
                this.shadowEffect = null;
                this.glowEffect = null;
                this.multiplierText = null;
                this.scene = null;
                
                super.destroy();
            });
            
            // Still create explosion effect for high value symbols
            if (this.symbolType === 'thanos' || this.symbolType === 'scarlet_witch') {
                this.createExplosion();
            }
        } else {
            // Fallback to original destruction animation if no sprite animation exists
            // Destruction animation
            this.scene.tweens.add({
                targets: this,
                scaleX: 0,
                scaleY: 0,
                alpha: 0,
                duration: window.GameConfig.ANIMATIONS.SYMBOL_DESTROY_TIME,
                ease: 'Power2',
                onComplete: () => {
                    if (this.shadowEffect) {
                        this.shadowEffect.destroy();
                    }
                    if (this.glowEffect) {
                        this.glowEffect.destroy();
                    }
                    
                    // Nullify references to prevent memory leaks
                    this.shadowEffect = null;
                    this.glowEffect = null;
                    this.multiplierText = null;
                    this.scene = null;
                    
                    super.destroy();
                }
            });
            
            // Explode effect for high value symbols
            if (this.symbolType === 'thanos' || this.symbolType === 'scarlet_witch') {
                this.createExplosion();
            }
            
            // Shadow fade
            if (this.shadowEffect) {
                this.scene.tweens.add({
                    targets: this.shadowEffect,
                    alpha: 0,
                    scaleX: 0,
                    scaleY: 0,
                    duration: window.GameConfig.ANIMATIONS.SYMBOL_DESTROY_TIME,
                    ease: 'Power2'
                });
            }
        }
    }
    
    addGlow(color = 0xFFD700, intensity = 0.5) {
        if (!this.glowEffect) return;
        
        // Stop any existing glow tween first
        if (this.glowTween) {
            this.glowTween.stop();
            this.glowTween = null;
        }
        
        this.glowEffect.clear();
        
        const glowSize = GameConfig.SYMBOL_SIZE + 20;
        const x = this.x;
        const y = this.y;
        
        // Animated glow
        this.glowTween = this.scene.tweens.add({
            targets: { radius: 0 },
            radius: 10,
            duration: 500,
            yoyo: true,
            repeat: -1,
            onUpdate: (tween) => {
                const radius = tween.getValue();
                this.glowEffect.clear();
                
                // Draw multiple circles for glow effect
                for (let i = 3; i > 0; i--) {
                    this.glowEffect.lineStyle(i * 2, color, intensity / i);
                    this.glowEffect.strokeRect(
                        x - glowSize / 2 - radius,
                        y - glowSize / 2 - radius,
                        glowSize + radius * 2,
                        glowSize + radius * 2
                    );
                }
            }
        });
    }
    
    removeGlow() {
        // Stop the glow tween
        if (this.glowTween) {
            this.glowTween.stop();
            this.glowTween = null;
        }
        
        // Clear the graphics
        if (this.glowEffect) {
            this.glowEffect.clear();
        }
    }
    
    showMultiplier(value) {
        // Don't show multiplier effects in burst mode
        if (this.scene.burstModeActive) {
            return;
        }
        
        const multText = this.scene.add.text(this.x, this.y - 30, `x${value}`, {
            fontSize: '28px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4
        });
        multText.setOrigin(0.5);
        
        this.scene.tweens.add({
            targets: multText,
            y: multText.y - 40,
            alpha: 0,
            duration: 1500,
            ease: 'Power2',
            onComplete: () => multText.destroy()
        });
        
        // Special effect for high multipliers
        if (value >= 10) {
            this.playSpecialAnimation();
        }
    }
    
    playSpecialAnimation() {
        this.currentState = this.states.SPECIAL;
        
        // Rainbow tint animation
        const colors = [0xFF0000, 0xFF7F00, 0xFFFF00, 0x00FF00, 0x0000FF, 0x4B0082, 0x9400D3];
        let colorIndex = 0;
        
        const colorTween = this.scene.time.addEvent({
            delay: 100,
            repeat: colors.length * 2,
            callback: () => {
                if (this.scene && this.setTint) {
                    this.setTint(colors[colorIndex % colors.length]);
                    colorIndex++;
                }
            },
            callbackScope: this
        });
        
        // Store reference for cleanup
        if (!this.delayedCalls) this.delayedCalls = [];
        this.delayedCalls.push(colorTween);
        
        // Rotation
        this.scene.tweens.add({
            targets: this,
            angle: 360,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => {
                this.clearTint();
                this.currentState = this.states.IDLE;
            }
        });
    }
    
    
    createExplosion() {
        const explosion = this.scene.add.particles(this.x, this.y, 'particle', {
            speed: { min: 200, max: 400 },
            scale: { start: 1, end: 0 },
            blendMode: 'ADD',
            lifespan: 400,
            quantity: 20,
            tint: this.symbolType === 'thanos' ? 0x9400D3 : 0xDC143C
        });
        
        const cleanupTimer = this.scene.time.delayedCall(500, () => {
            if (explosion && explosion.scene) {
                explosion.destroy();
            }
        });
        
        // Store reference for cleanup
        if (!this.delayedCalls) this.delayedCalls = [];
        this.delayedCalls.push(cleanupTimer);
    }
    
    updatePosition(x, y) {
        this.x = x;
        this.y = y;
        
        if (this.shadowEffect) {
            this.shadowEffect.x = x + 5;
            this.shadowEffect.y = y + 5;
        }
        
        if (this.glowEffect) {
            this.glowEffect.x = x;
            this.glowEffect.y = y;
        }
        
        // Update multiplier text position if it exists
        if (this.multiplierText) {
            this.multiplierText.x = x;
            this.multiplierText.y = y - 30;
        }
    }
    
    setGridPosition(col, row) {
        this.gridCol = col;
        this.gridRow = row;
    }
    
    reset() {
        this.isMatched = false;
        this.multiplier = 1;
        this.currentState = this.states.IDLE;
        this.clearTint();
        this.removeGlow();
        this.setScale(1);
        this.setAlpha(1);
    }
} 
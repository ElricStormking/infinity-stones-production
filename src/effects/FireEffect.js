// Fire Effect Manager for Free Spins Transition
// Uses shader-based fire effect matching the provided sample
window.FireEffect = class FireEffect {
    constructor(scene) {
        this.scene = scene;
        this.isActive = false;
        this.shader = null;
        this.fireQuad = null;
    }
    
    /**
     * Trigger the fire effect for Free Spins transition
     * @param {Function} onComplete - Callback when effect is complete
     */
    triggerFire(onComplete) {
        if (this.isActive) {
            console.warn('Fire effect already active');
            return;
        }
        
        this.isActive = true;
        console.log('🔥 Starting Fire Effect');
        
        // Create the fire effect
        this.createFireEffect(onComplete);
    }
    
    createFireEffect(onComplete) {
        console.log('🔥 Creating shader-based fire effect');
        
        try {
            // Create the fire shader
            this.initializeShader();
            
            // Create fullscreen quad to apply the shader
            this.createFireQuad();
            
            // Animate the fire effect
            this.animateFireShader(onComplete);
            
        } catch (error) {
            console.error('🔥 Failed to create shader-based fire effect:', error);
            // Fallback to simple color overlay
            this.createFallbackFireEffect(onComplete);
        }
        
        // Play fire sound effect
        window.SafeSound.play(this.scene, 'winning_big', 0.8);
    }
    
    initializeShader() {
        console.log('🔥 Initializing fire shader...');
        
        // Check if we have a WebGL renderer first
        if (!this.scene.game.renderer || this.scene.game.renderer.type !== Phaser.WEBGL) {
            throw new Error('WebGL renderer not available - falling back to graphics effect');
        }
        
        // Try to create the fire shader
        console.log('🔥 Creating new Fire pipeline...');
        this.shader = window.createFireShader(this.scene);
        console.log('🔥 Fire shader created successfully');
        
        // Set initial shader parameters
        this.shader.setIntensity(0.0);
        this.shader.setFireScale(1.0);
        
        console.log('🔥 Fire shader initialized successfully');
    }
    
    createFireQuad() {
        // Create a fullscreen quad to apply the fire shader
        const width = this.scene.game.config.width;
        const height = this.scene.game.config.height;
        
        // Create a fullscreen graphics object
        this.fireQuad = this.scene.add.graphics();
        this.fireQuad.fillStyle(0x000000, 1.0); // Black background - shader will override this
        this.fireQuad.fillRect(0, 0, width, height);
        this.fireQuad.setDepth(10000); // Above everything
        
        // Apply the fire shader pipeline
        this.fireQuad.setPipeline('Fire');
        
        console.log('🔥 Fire quad created and shader applied');
    }
    
    animateFireShader(onComplete) {
        const duration = 4000; // 4 seconds for fire effect
        const phases = [
            { // Phase 1: Fire ignition (0-800ms)
                duration: 800,
                intensity: { from: 0.0, to: 0.6 },
                scale: { from: 0.8, to: 1.0 },
                ease: 'Power2.easeOut'
            },
            { // Phase 2: Fire growth (800-2000ms)
                duration: 1200,
                intensity: { from: 0.6, to: 1.0 },
                scale: { from: 1.0, to: 1.2 },
                ease: 'Sine.easeOut'
            },
            { // Phase 3: Fire peak (2000-3200ms)
                duration: 1200,
                intensity: { from: 1.0, to: 1.0 },
                scale: { from: 1.2, to: 1.1 },
                ease: 'Sine.easeInOut'
            },
            { // Phase 4: Fire fade (3200-4000ms)
                duration: 800,
                intensity: { from: 1.0, to: 0.0 },
                scale: { from: 1.1, to: 1.0 },
                ease: 'Power2.easeIn'
            }
        ];
        
        let currentTime = 0;
        
        phases.forEach((phase, index) => {
            // Intensity animation
            this.scene.tweens.addCounter({
                from: phase.intensity.from,
                to: phase.intensity.to,
                duration: phase.duration,
                delay: currentTime,
                ease: phase.ease,
                onUpdate: (tween) => {
                    if (this.shader && this.isActive) {
                        this.shader.setIntensity(tween.getValue());
                    }
                }
            });
            
            // Scale animation
            this.scene.tweens.addCounter({
                from: phase.scale.from,
                to: phase.scale.to,
                duration: phase.duration,
                delay: currentTime,
                ease: phase.ease,
                onUpdate: (tween) => {
                    if (this.shader && this.isActive) {
                        this.shader.setFireScale(tween.getValue());
                    }
                },
                onComplete: () => {
                    if (index === phases.length - 1) {
                        // Last phase complete
                        this.completeFireEffect(onComplete);
                    }
                }
            });
            
            currentTime += phase.duration;
        });
        
        console.log('🔥 Fire shader animation started');
    }
    
    createFallbackFireEffect(onComplete) {
        // Simple fallback fire effect using graphics
        console.log('🔥 Creating fallback fire effect');
        
        const width = this.scene.game.config.width;
        const height = this.scene.game.config.height;
        
        // Create fire overlay
        this.fireQuad = this.scene.add.graphics();
        this.fireQuad.setDepth(10000);
        
        // Create animated fire colors
        const animateFallback = () => {
            if (!this.isActive) return;
            
            this.fireQuad.clear();
            
            // Create gradient fire effect
            const t = this.scene.game.loop.time / 1000.0;
            const intensity = Math.sin(t * 2) * 0.3 + 0.7;
            
            // Multiple fire layers
            for (let i = 0; i < 5; i++) {
                const offset = i * 0.2;
                const alpha = intensity * (1 - i * 0.15);
                const color = [0xff0000, 0xff3300, 0xff6600, 0xff9900, 0xffcc00][i];
                
                this.fireQuad.fillStyle(color, alpha * 0.3);
                this.fireQuad.fillRect(0, height * offset * 0.1, width, height * (1 - offset * 0.1));
            }
            
            this.scene.time.delayedCall(50, animateFallback);
        };
        
        animateFallback();
        
        // Complete after duration
        this.scene.time.delayedCall(4000, () => {
            this.completeFireEffect(onComplete);
        });
    }
    
    completeFireEffect(onComplete) {
        console.log('🔥 Fire Effect Complete');
        
        this.isActive = false;
        
        // Clean up fire quad
        if (this.fireQuad && !this.fireQuad.destroyed) {
            this.scene.tweens.add({
                targets: this.fireQuad,
                alpha: 0,
                duration: 800,
                ease: 'Sine.easeIn',
                onComplete: () => {
                    if (this.fireQuad && !this.fireQuad.destroyed) {
                        this.fireQuad.destroy();
                    }
                    this.fireQuad = null;
                    
                    // Call completion callback
                    if (onComplete && typeof onComplete === 'function') {
                        onComplete();
                    }
                }
            });
        } else {
            // Immediate callback if quad already destroyed
            if (onComplete && typeof onComplete === 'function') {
                onComplete();
            }
        }
    }
    
    /**
     * Force stop the fire effect
     */
    stop() {
        if (!this.isActive) return;
        
        console.log('🔥 Stopping Fire Effect');
        this.isActive = false;
        
        if (this.fireQuad && !this.fireQuad.destroyed) {
            this.fireQuad.destroy();
        }
        this.fireQuad = null;
    }
    
    /**
     * Check if fire effect is currently active
     */
    isPlaying() {
        return this.isActive;
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        this.stop();
        this.shader = null;
    }
};
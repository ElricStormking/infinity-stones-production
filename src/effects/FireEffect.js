// Fire Effect Manager for Free Spins Transition
// Uses shader-based fire effect matching the provided sample
window.FireEffect = class FireEffect {
    constructor(scene) {
        this.scene = scene;
        this.isActive = false;
        this.shader = null;
        this.fireQuad = null;
        this.effectInProgress = false; // Additional flag to prevent concurrent effects
        this.completionCalled = false; // Prevent multiple completion calls

        // Debug hotkey (F) removed per request; keep fields for safety/no-op
        this._debugKeyRegistered = false;
        this._debugKeyHandler = null;

        // Debug timer UI shown above spin button
        this._timerText = null;
        this._timerEvent = null;
        this._timerEndEpochMs = 0;
    }
    
    /**
     * Trigger the fire effect for Free Spins transition
     * @param {Function} onComplete - Callback when effect is complete
     */
    triggerFire(onComplete) {
        // Global guard to avoid back-to-back triggers coming from any caller
        const now = Date.now();
        if (typeof window !== 'undefined') {
            if (!window.__FIRE_COOLDOWN_UNTIL) window.__FIRE_COOLDOWN_UNTIL = 0;
            if (!window.__FIRE_ACTIVE) window.__FIRE_ACTIVE = false;
            if (window.__FIRE_ACTIVE || now < window.__FIRE_COOLDOWN_UNTIL) {
                console.warn('🔥 FireEffect ignored by global guard (active or cooldown).');
                return;
            }
        }

        if (this.isActive || this.effectInProgress) {
            console.warn('🔥 Fire effect already active or in progress - PREVENTING DUPLICATE DISPLAY');
            // Do NOT call onComplete again here; the first effect will invoke it when finished
            return;
        }
        
        this.isActive = true;
        this.effectInProgress = true;
        this.completionCalled = false; // Reset completion flag for new effect
        if (typeof window !== 'undefined') window.__FIRE_ACTIVE = true;
        console.log('🔥 Starting Fire Effect (flags set: isActive=true, effectInProgress=true)');
        
        // Create the fire effect
        this.createFireEffect(onComplete);
    }
    
    // Debug key registration removed

    createFireEffect(onComplete) {
        // Additional safety check
        if (this.fireQuad) {
            console.warn('🔥 Fire quad already exists - cleaning up old one');
            if (!this.fireQuad.destroyed) {
                this.fireQuad.destroy();
            }
            this.fireQuad = null;
        }
        
        console.log('🔥 Creating shader-based fire effect');
        console.trace('🔥 createFireEffect stack trace');
        
        let shaderSuccessful = false;
        
        try {
            // Create the fire shader
            this.initializeShader();
            
            // Create fullscreen quad to apply the shader
            this.createFireQuad();
            
            // Animate the fire effect
            this.animateFireShader(onComplete);
            
            shaderSuccessful = true;
            
        } catch (error) {
            console.error('🔥 Failed to create shader-based fire effect:', error);
            // Only use fallback if shader failed
            if (!shaderSuccessful) {
                // Fallback to simple color overlay
                this.createFallbackFireEffect(onComplete);
            }
        }
        
        // Don't play winning_big here - it will be played at the end of free spins
        // Just play a fire/magic sound effect if available
        // window.SafeSound.play(this.scene, 'thanos_power', 0.6);
    }
    
    initializeShader() {
        console.log('🔥 Initializing fire shader...');
        
        // Check if we have a WebGL renderer first
        if (!this.scene.game.renderer || this.scene.game.renderer.type !== Phaser.WEBGL) {
            throw new Error('WebGL renderer not available - falling back to graphics effect');
        }
        
        // Check if the Fire pipeline already exists
        const pipelines = this.scene.game.renderer.pipelines || this.scene.game.renderer;
        const existingPipeline = pipelines.get ? pipelines.get('Fire') : pipelines.getPipeline ? pipelines.getPipeline('Fire') : null;
        
        if (existingPipeline) {
            console.log('🔥 Reusing existing Fire pipeline');
            this.shader = existingPipeline;
        } else {
            // Try to create the fire shader
            console.log('🔥 Creating new Fire pipeline...');
            this.shader = window.createFireShader(this.scene);
            console.log('🔥 Fire shader created successfully');
        }
        
        // Set initial shader parameters
        if (this.shader) {
            this.shader.setIntensity(0.0);
            this.shader.setFireScale(1.0);
            console.log('🔥 Fire shader initialized successfully');
        }
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
        const duration = 3200; // 3.2 seconds for fire effect
        const startEpochMs = Date.now();
        const startLoopMs = this.scene.game.loop.time || 0;

        // Create/update a small timer label above the spin button (debug only)
        this.createOrUpdateTimerUI(startEpochMs);
        const phases = [
            { // Phase 1: Fire ignition (0-600ms)
                duration: 600,
                intensity: { from: 0.0, to: 0.6 },
                scale: { from: 0.8, to: 1.0 },
                ease: 'Power2.easeOut'
            },
            { // Phase 2: Fire growth (600-1600ms)
                duration: 1000,
                intensity: { from: 0.6, to: 1.0 },
                scale: { from: 1.0, to: 1.2 },
                ease: 'Sine.easeOut'
            },
            { // Phase 3: Fire peak (1600-2600ms)
                duration: 1000,
                intensity: { from: 1.0, to: 1.0 },
                scale: { from: 1.2, to: 1.1 },
                ease: 'Sine.easeInOut'
            },
            { // Phase 4: Fire fade (2600-3200ms)
                duration: 600,
                intensity: { from: 1.0, to: 0.0 },
                scale: { from: 1.1, to: 1.0 },
                ease: 'Power2.easeIn'
            }
        ];
        
        let currentTime = 0;
        let animationCompleted = false; // Prevent multiple completion calls
        
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
                },
                // Only add onComplete to the LAST intensity animation
                onComplete: (index === phases.length - 1) ? () => {
                    if (!animationCompleted) {
                        // Last phase complete - only call once
                        animationCompleted = true;
                        const endEpochMs = Date.now();
                        const endLoopMs = this.scene.game.loop.time || 0;
                        const elapsedSecReal = ((endEpochMs - startEpochMs) / 1000).toFixed(3);
                        const elapsedSecGame = ((endLoopMs - startLoopMs) / 1000).toFixed(3);
                        console.log(`🔥 Fire phase 4 COMPLETE at ${new Date(endEpochMs).toLocaleTimeString()} (+${elapsedSecReal}s real, +${elapsedSecGame}s game)`);
                        this.completeFireEffect(onComplete);
                    }
                } : undefined
            });
            
            // Scale animation (NO onComplete here to avoid duplicate calls)
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
                }
            });
            
            currentTime += phase.duration;
        });
        
        console.log(`🔥 Fire shader animation started (${phases.length} phases, total duration: ${currentTime}ms)`);
    }
    
    createFallbackFireEffect(onComplete) {
        // Simple fallback fire effect using graphics
        console.log('🔥 Creating fallback fire effect');
        
        // Additional safety check
        if (this.fireQuad) {
            console.warn('🔥 Fallback: Fire quad already exists - cleaning up');
            if (!this.fireQuad.destroyed) {
                this.fireQuad.destroy();
            }
            this.fireQuad = null;
        }
        
        const width = this.scene.game.config.width;
        const height = this.scene.game.config.height;
        
        // Create fire overlay
        this.fireQuad = this.scene.add.graphics();
        this.fireQuad.setDepth(10000);
        
        let animationActive = true;
        
        // Create animated fire colors
        const animateFallback = () => {
            if (!this.isActive || !animationActive) return;
            
            if (this.fireQuad && !this.fireQuad.destroyed) {
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
            }
        };
        
        animateFallback();
        
        // Complete after duration - with safety check (3.2 seconds)
        let completeCalled = false;
        this.scene.time.delayedCall(3200, () => {
            if (!completeCalled) {
                completeCalled = true;
                animationActive = false;
                console.log('🔥 Fallback fire effect duration complete (3.2s)');
                this.completeFireEffect(onComplete);
            }
        });
    }
    
    completeFireEffect(onComplete) {
        // Prevent multiple completion calls
        if (this.completionCalled) {
            console.warn('🔥 Fire effect completion already called - preventing duplicate');
            return;
        }
        this.completionCalled = true;
        
        console.log('🔥 Fire Effect Complete (resetting flags)');
        
        this.isActive = false;
        this.effectInProgress = false;
        // Do not destroy the timer immediately; it will self-destroy after 10s from start
        if (typeof window !== 'undefined') {
            // Small cooldown to prevent immediate re-triggering by stray inputs
            window.__FIRE_ACTIVE = false;
            window.__FIRE_COOLDOWN_UNTIL = Date.now() + 1000; // 1s cooldown
        }
        
        // Clean up fire quad immediately (no extra fade) to keep total duration at 3.2s
        if (this.fireQuad && !this.fireQuad.destroyed) {
            this.fireQuad.destroy();
        }
        this.fireQuad = null;

        // Call completion callback immediately
        if (onComplete && typeof onComplete === 'function') {
            console.log('🔥 Calling fire effect completion callback');
            onComplete();
        }
        // Reset completion flag after callback
        this.completionCalled = false;
    }
    
    /**
     * Force stop the fire effect
     */
    stop() {
        if (!this.isActive && !this.effectInProgress) return;
        
        console.log('🔥 Stopping Fire Effect');
        this.isActive = false;
        this.effectInProgress = false;
        // Do not destroy the timer immediately; it will self-destroy after 10s from start
        if (typeof window !== 'undefined') {
            window.__FIRE_ACTIVE = false;
            window.__FIRE_COOLDOWN_UNTIL = Date.now() + 1000;
        }
        
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

    // === Debug Timer UI helpers ===
    createOrUpdateTimerUI(startEpochMs) {
        if (!window.DEBUG) return; // show only when DEBUG
        try {
            const spin = this.scene.uiManager && this.scene.uiManager.getSpinButton ? this.scene.uiManager.getSpinButton() : null;
            const x = spin ? spin.x : this.scene.cameras.main.width - 150;
            const y = spin ? (spin.y - (spin.displayHeight || 64) / 2 - 18) : 24;
            if (!this._timerText) {
                this._timerText = this.scene.add.text(x, y, 'FIRE: 0.000s', {
                    fontSize: '14px',
                    fontFamily: 'Arial Bold',
                    color: '#FFFFFF',
                    stroke: '#000000',
                    strokeThickness: 3
                });
                this._timerText.setOrigin(0.5);
                this._timerText.setDepth(10001);
            } else {
                this._timerText.setPosition(x, y);
                this._timerText.setText('FIRE: 0.000s');
                this._timerText.setVisible(true);
            }
            if (this._timerEvent) {
                this._timerEvent.remove();
                this._timerEvent = null;
            }
            // Keep timer visible for 10 seconds after start
            this._timerEndEpochMs = startEpochMs + 10000;
            this._timerEvent = this.scene.time.addEvent({
                delay: 100,
                loop: true,
                callback: () => {
                    if (!this._timerText) return;
                    const now = Date.now();
                    const elapsed = ((now - startEpochMs) / 1000).toFixed(3);
                    this._timerText.setText(`FIRE: ${elapsed}s`);
                    if (now >= this._timerEndEpochMs) {
                        this.destroyTimerUI();
                    }
                }
            });
        } catch (e) {
            console.warn('Failed to create/update fire timer UI:', e);
        }
    }

    destroyTimerUI() {
        try {
            if (this._timerEvent) {
                this._timerEvent.remove();
                this._timerEvent = null;
            }
            if (this._timerText) {
                this._timerText.destroy();
                this._timerText = null;
            }
        } catch (e) {
            // ignore
        }
    }
};
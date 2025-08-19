// Bonus Manager - handles all bonus features and multiplier systems
window.BonusManager = class BonusManager {
    constructor(scene) {
        this.scene = scene;
        this.thanosPowerGripEffect = null;
        // Holds persistent random-multiplier overlays: key `${col},${row}` -> {container, text}
        this.randomMultiplierOverlays = {};
    }
    
    cleanup() {
        // Clean up Thanos Power Grip effect
        if (this.thanosPowerGripEffect) {
            this.thanosPowerGripEffect.destroy();
            this.thanosPowerGripEffect = null;
        }
        // Remove overlays
        this.clearRandomMultiplierOverlays();
    }

    clearRandomMultiplierOverlays() {
        Object.values(this.randomMultiplierOverlays).forEach(entry => {
            try { if (entry && entry.container && !entry.container.destroyed) entry.container.destroy(); } catch {}
        });
        this.randomMultiplierOverlays = {};
    }
    
    async checkRandomMultiplier() {
        // Don't trigger Random Multiplier in burst mode to avoid slowdown
        if (this.scene.burstModeManager && this.scene.burstModeManager.isActive()) {
            return;
        }
        
        // SECURITY: Use controlled RNG for Random Multiplier trigger
        if (!window.RNG) {
            throw new Error('SECURITY: BonusManager requires window.RNG to be initialized.');
        }
        const rng = new window.RNG();
        
        // Check if Random Multiplier should trigger
        const shouldTrigger = rng.chance(window.GameConfig.RANDOM_MULTIPLIER.TRIGGER_CHANCE);
        
        if (!shouldTrigger) {
            return;
        }
        
        // Only apply if there's a win worth applying multiplier to
        if (this.scene.totalWin < window.GameConfig.RANDOM_MULTIPLIER.MIN_WIN_REQUIRED) {
            return;
        }
        
        // Select random multiplier from weighted table using controlled RNG
        const multiplierTable = window.GameConfig.RANDOM_MULTIPLIER.TABLE;
        const multiplier = multiplierTable[
            rng.int(0, multiplierTable.length - 1)
        ];
        
        // Select random position to replace a symbol using controlled RNG
        const col = rng.int(0, this.scene.gridManager.cols - 1);
        const row = rng.int(0, this.scene.gridManager.rows - 1);
        
        console.log(`=== RANDOM MULTIPLIER TRIGGERED ===`);
        console.log(`Multiplier: ${multiplier}x`);
        console.log(`Position: (${col}, ${row})`);
        console.log(`Original Win: $${this.scene.totalWin.toFixed(2)}`);
        
        // Randomly choose between Thanos and Scarlet Witch using controlled RNG
        // 50/50 distribution between characters for random multipliers
        const useThanos = rng.chance(0.5); // 50% Thanos, 50% Scarlet Witch
        
        // Always trigger character attack animation and show multiplier effect
        if (useThanos) {
            // Always attempt to trigger Thanos attack animation
            this.triggerThanosAttack();
            await this.showThanosRandomMultiplier(col, row, multiplier);
        } else {
            // Always attempt to trigger Scarlet Witch attack animation
            this.triggerScarletWitchAttack();
            await this.showScarletWitchRandomMultiplier(col, row, multiplier);
        }
        
        // Always play a bonus sound as fallback
        window.SafeSound.play(this.scene, 'bonus');
        
        // Apply multiplier to total win
        const originalWin = this.scene.totalWin;
        this.scene.totalWin *= multiplier;
        // Track applied multiplier for win math (product). Sum is updated by FX on arrival
        if (typeof this.scene.spinAppliedMultiplier === 'number') {
            this.scene.spinAppliedMultiplier *= multiplier;
        }
        
        // Accumulate multiplier during free spins
        this.scene.freeSpinsManager.applyFreeSpinsMultiplier(multiplier);
        
        console.log(`New Win: $${this.scene.totalWin.toFixed(2)}`);
        console.log(`=== END RANDOM MULTIPLIER ===`);
        
        // Update win display
        this.scene.updateWinDisplay();
        
        // Place persistent multiplier frame on replaced symbol
        this.placeRandomMultiplierOverlay(col, row, multiplier);

        // FX: shooting star to plaque and incremental sum update
        if (this.scene && this.scene.playRandomMultiplierShootingStar) {
            this.scene.playRandomMultiplierShootingStar(col, row, multiplier);
        }

        // Show multiplier message with appropriate character
        const characterName = useThanos ? 'THANOS POWER GRIP!' : 'SCARLET WITCH CHAOS MAGIC!';
        this.scene.showMessage(`${characterName} ${multiplier}x MULTIPLIER!\nWin: $${originalWin.toFixed(2)} → $${this.scene.totalWin.toFixed(2)}`);
    }

    placeRandomMultiplierOverlay(col, row, multiplier) {
        const x = this.scene.gridManager.getSymbolScreenX(col);
        const y = this.scene.gridManager.getSymbolScreenY(row);

        // remove any existing overlay at this cell
        const key = `${col},${row}`;
        const prev = this.randomMultiplierOverlays[key];
        if (prev && prev.container && !prev.container.destroyed) {
            prev.container.destroy();
        }

        // Create a special Symbol that behaves as a normal grid entry
        const container = this.scene.add.container(x, y);
        container.setDepth(window.GameConfig.UI_DEPTHS.MULTIPLIER_SLOT);

        const size = window.GameConfig.SYMBOL_SIZE;
        // Prefer animated frame if available, else fallback to static image
        let frame;
        if (this.scene.textures && this.scene.textures.exists('random_multiplier_frame_bonus_sprite') && this.scene.anims && this.scene.anims.exists('random_multiplier_frame_bonus')) {
            frame = this.scene.add.sprite(0, 0, 'random_multiplier_frame_bonus_sprite', 0);
            frame.play('random_multiplier_frame_bonus');
            frame.setDisplaySize(size, size);
        } else {
            frame = this.scene.add.image(0, 0, 'random_multiplier_frame');
            frame.setDisplaySize(size, size);
        }
        container.add(frame);
        const txt = this.scene.add.text(0, 0, `x${multiplier}`, {
            fontSize: Math.floor(size * 0.38) + 'px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: Math.max(2, Math.floor(size * 0.06)),
            align: 'center'
        });
        txt.setOrigin(0.5);
        container.add(txt);

        // slight pop animation for feedback
        container.setScale(0.6);
        this.scene.tweens.add({ targets: container, scale: 1, duration: 220, ease: 'Back.out' });

        // Create a lightweight symbol wrapper so it participates in cascades
        const rmSymbol = new window.Symbol(this.scene, x, y, 'time_gem'); // use any valid texture for base Sprite
        rmSymbol.isRandomMultiplier = true;
        rmSymbol.multiplierValue = multiplier;
        rmSymbol.setDisplaySize(size, size);
        rmSymbol.setDepth(window.GameConfig.UI_DEPTHS.GRID_SYMBOL);
        // Hide internal effects; we render with container
        if (rmSymbol.shadowEffect) rmSymbol.shadowEffect.setVisible(false);
        if (rmSymbol.glowEffect) rmSymbol.glowEffect.setVisible(false);
        // Link container so GridManager can move both if needed
        rmSymbol.overlayContainer = container;
        rmSymbol.updatePosition(x, y);
        rmSymbol.setGridPosition(col, row);

        // Replace grid slot with this special symbol
        if (!this.scene.gridManager.grid[col]) this.scene.gridManager.grid[col] = [];
        this.scene.gridManager.grid[col][row] = rmSymbol;

        // Make sure this slot isn’t counted as a normal match and never pooled inadvertently
        rmSymbol.symbolType = 'random_multiplier';

        this.randomMultiplierOverlays[key] = { container, text: txt, col, row, symbol: rmSymbol };
    }
    
    async showThanosRandomMultiplier(col, row, multiplier) {
        return new Promise(resolve => {
            // Initialize Thanos Power Grip effect if not already created
            if (!this.thanosPowerGripEffect) {
                this.thanosPowerGripEffect = new window.ThanosPowerGripEffect(this.scene);
            }
            
            // Get all symbols that will be affected (in this case, just one)
            const positions = [{ row, col }];
            
            // Trigger the Thanos Power Grip effect with magic circle and multiplier
            this.thanosPowerGripEffect.triggerEffect(positions, multiplier);
            
            // Get the symbol position for additional effects
            const symbolX = this.scene.gridManager.getSymbolScreenX(col);
            const symbolY = this.scene.gridManager.getSymbolScreenY(row);
            
            // Hide the original symbol with Thanos power effect
            const originalSymbol = this.scene.gridManager.grid[col][row];
            if (originalSymbol) {
                // Purple flash before destruction
                originalSymbol.setTint(0x6B46C1);
                this.scene.tweens.add({
                    targets: originalSymbol,
                    alpha: 0,
                    scaleX: 0.1,
                    scaleY: 0.1,
                    angle: 720,
                    duration: 500,
                    ease: 'Power3.in',
                    onComplete: () => {
                        originalSymbol.setVisible(false);
                    }
                });
            }
            
            // Immediately place persistent overlay for reliability (in case flow changes)
            this.placeRandomMultiplierOverlay(col, row, multiplier);

            // Wait for effect to complete
            this.scene.time.delayedCall(2000, () => {
                resolve();
            });
            
            // Play Thanos power sound
            window.SafeSound.play(this.scene, 'thanos_power');
            window.SafeSound.play(this.scene, 'bonus');
        });
    }
    
    async showScarletWitchRandomMultiplier(col, row, multiplier) {
        return new Promise(async resolve => {
            // Get the symbol position on screen
            const symbolX = this.scene.gridManager.getSymbolScreenX(col);
            const symbolY = this.scene.gridManager.getSymbolScreenY(row);
            
            console.log(`🔥 SEQUENCE: Lightning strikes symbol at (${col}, ${row}) then shows multiplier ${multiplier}x`);
            
            // STEP 1: Lightning strikes the symbol first
            await this.createRedLightningEffect(symbolX, symbolY);
            
            // STEP 2: Destroy the original symbol with dramatic effect and clear grid cell
            const originalSymbol = this.scene.gridManager.grid[col][row];
            if (originalSymbol) {
                console.log(`💥 Destroying original symbol at (${col}, ${row})`);
                // Flash the symbol white before destroying
                originalSymbol.setTint(0xFFFFFF);
                this.scene.tweens.add({
                    targets: originalSymbol,
                    alpha: 0,
                    scaleX: 0.5,
                    scaleY: 0.5,
                    duration: 200,
                    ease: 'Power2',
                    onComplete: () => {
                        // remove from grid and destroy fully
                        this.scene.gridManager.grid[col][row] = null;
                        if (originalSymbol.destroy) {
                            originalSymbol.destroy();
                        } else {
                            originalSymbol.setVisible(false);
                        }
                    }
                });
            }
            
            // Place overlay right away so it survives any later animations
            this.placeRandomMultiplierOverlay(col, row, multiplier);

            // STEP 3: Show Scarlet Witch power effect and multiplier
            // Create Scarlet Witch power effect
            const scarletWitch = this.scene.add.image(symbolX, symbolY, 'scarlet_witch');
            scarletWitch.setScale(0.3);
            scarletWitch.setAlpha(0);
            scarletWitch.setDepth(1000);
            scarletWitch.setTint(0xFF1493); // Pink tint for chaos magic
            
            // Create multiplier text
            const multiplierText = this.scene.add.text(symbolX, symbolY - 50, `x${multiplier}`, {
                fontSize: '48px',
                fontFamily: 'Arial Black',
                color: '#FFD700',
                stroke: '#FF1493',
                strokeThickness: 4
            });
            multiplierText.setOrigin(0.5);
            multiplierText.setScale(0);
            multiplierText.setDepth(1001);
            
            // Create energy particles around the symbol
            const particles = this.scene.add.particles(symbolX, symbolY, 'reality_gem', {
                speed: { min: 50, max: 150 },
                scale: { start: 0.3, end: 0 },
                lifespan: 1000,
                quantity: 2,
                frequency: 100,
                blendMode: 'ADD',
                tint: 0xFF1493
            });
            particles.setDepth(999);
            
            // Animation sequence
            this.scene.tweens.add({
                targets: scarletWitch,
                alpha: 0.8,
                scaleX: 0.5,
                scaleY: 0.5,
                duration: 300,
                ease: 'Power2',
                onComplete: () => {
                    // Show multiplier text
                    this.scene.tweens.add({
                        targets: multiplierText,
                        scaleX: 1,
                        scaleY: 1,
                        duration: 400,
                        ease: 'Back.out',
                        onComplete: () => {
                            // Pulsing effect
                            this.scene.tweens.add({
                                targets: [scarletWitch, multiplierText],
                                scaleX: 1.2,
                                scaleY: 1.2,
                                duration: 200,
                                yoyo: true,
                                repeat: 2,
                                ease: 'Sine.easeInOut',
                                onComplete: () => {
                                    // Fade out
                                    particles.stop();
                                    this.scene.tweens.add({
                                        targets: [scarletWitch, multiplierText],
                                        alpha: 0,
                                        scaleX: 0,
                                        scaleY: 0,
                                        duration: 500,
                                        ease: 'Power2',
                                        onComplete: () => {
                                            scarletWitch.destroy();
                                            multiplierText.destroy();
                                            particles.destroy();
                                            resolve();
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
            
            // Play bonus sound
            window.SafeSound.play(this.scene, 'bonus');
        });
    }
    
    async checkCascadingRandomMultipliers() {
        // Don't trigger Cascading Random Multipliers in burst mode to avoid slowdown
        if (this.scene.burstModeManager && this.scene.burstModeManager.isActive()) {
            return;
        }
        
        // SECURITY: Use controlled RNG for Cascading Random Multipliers
        if (!window.RNG) {
            throw new Error('SECURITY: BonusManager requires window.RNG to be initialized.');
        }
        const rng = new window.RNG();
        
        // Check if Cascading Random Multipliers should trigger
        const shouldTrigger = rng.chance(window.GameConfig.CASCADE_RANDOM_MULTIPLIER.TRIGGER_CHANCE);
        
        if (!shouldTrigger) {
            return;
        }
        
        // Only apply if there's a win worth applying multipliers to
        if (this.scene.totalWin < window.GameConfig.CASCADE_RANDOM_MULTIPLIER.MIN_WIN_REQUIRED) {
            return;
        }
        
        // Determine number of multipliers to apply (1-3) using controlled RNG
        const minMults = window.GameConfig.CASCADE_RANDOM_MULTIPLIER.MIN_MULTIPLIERS;
        const maxMults = window.GameConfig.CASCADE_RANDOM_MULTIPLIER.MAX_MULTIPLIERS;
        const numMultipliers = rng.int(minMults, maxMults);
        
        console.log(`=== CASCADING RANDOM MULTIPLIERS TRIGGERED ===`);
        console.log(`Number of multipliers: ${numMultipliers}`);
        console.log(`Original Win: $${this.scene.totalWin.toFixed(2)}`);
        
        // Apply multiple multipliers
        const multipliers = [];
        const positions = [];
        
        for (let i = 0; i < numMultipliers; i++) {
            // Select random multiplier from weighted table
            const multiplierTable = window.GameConfig.RANDOM_MULTIPLIER.TABLE;
            const multiplier = multiplierTable[
                rng.int(0, multiplierTable.length - 1)
            ];
            multipliers.push(multiplier);
            
            // Select random position to replace a symbol (avoid duplicates)
            let col, row;
            let attempts = 0;
            do {
                col = rng.int(0, this.scene.gridManager.cols - 1);
                row = rng.int(0, this.scene.gridManager.rows - 1);
                attempts++;
            } while (positions.some(pos => pos.col === col && pos.row === row) && attempts < 20);
            
            positions.push({ col, row });
            
            console.log(`Multiplier ${i + 1}: ${multiplier}x at position (${col}, ${row})`);
        }
        
        // Show cascading multiplier effects
        await this.showCascadingRandomMultipliers(positions, multipliers);
        
        // Calculate total multiplier effect - ADD multipliers together first
        let totalMultiplier = 0;
        multipliers.forEach(mult => {
            totalMultiplier += mult;
        });
        
        // Apply total multiplier to win
        const originalWin = this.scene.totalWin;
        this.scene.totalWin *= totalMultiplier;
        // Track applied multiplier for win math (product). Sum is updated by FX on arrival
        if (typeof this.scene.spinAppliedMultiplier === 'number') {
            this.scene.spinAppliedMultiplier *= totalMultiplier;
        }
        
        // Accumulate each multiplier during free spins
        this.scene.freeSpinsManager.applyCascadingMultipliers(multipliers);
        
        console.log(`Total Multiplier: ${totalMultiplier}x`);
        console.log(`New Win: $${this.scene.totalWin.toFixed(2)}`);
        console.log(`=== END CASCADING RANDOM MULTIPLIERS ===`);
        
        // Update win display
        this.scene.updateWinDisplay();
        
        // Show cascading multiplier message
        const multiplierText = multipliers.map(m => `${m}x`).join(' × ');
        this.scene.showMessage(`CASCADING POWER! ${multiplierText} = ${totalMultiplier}x MULTIPLIER!\nWin: $${originalWin.toFixed(2)} → $${this.scene.totalWin.toFixed(2)}`);

        // Fire a shooting star per applied multiplier to build the plaque sum visually, arrival controls sum
        if (this.scene && this.scene.playRandomMultiplierShootingStar) {
            positions.forEach((pos, idx) => {
                const m = multipliers[idx];
                // stagger each star slightly
                this.scene.time.delayedCall(140 * idx, () => {
                    this.scene.playRandomMultiplierShootingStar(pos.col, pos.row, m);
                });
            });
        }
    }
    
    async showCascadingRandomMultipliers(positions, multipliers) {
        return new Promise(resolve => {
            const promises = [];
            
            positions.forEach((pos, index) => {
                const promise = this.showSingleCascadingMultiplier(pos.col, pos.row, multipliers[index], index * 300);
                promises.push(promise);
            });
            
            Promise.all(promises).then(resolve);
        });
    }
    
    async showSingleCascadingMultiplier(col, row, multiplier, delay) {
        return new Promise(resolve => {
            // Delay for staggered effect
            this.scene.time.delayedCall(delay, () => {
                // SECURITY: Use controlled RNG for character selection
                if (!window.RNG) {
                    throw new Error('SECURITY: BonusManager requires window.RNG to be initialized.');
                }
                const rng = new window.RNG();
                
                // Get the symbol position on screen
                const symbolX = this.scene.gridManager.getSymbolScreenX(col);
                const symbolY = this.scene.gridManager.getSymbolScreenY(row);
                
                // Randomly choose between Thanos and Scarlet Witch animation
                // 50/50 distribution between characters for cascading multipliers
                const useThanos = rng.chance(0.5); // 50% Thanos, 50% Scarlet Witch
                const characterKey = useThanos ? 'thanos' : 'scarlet_witch';
                const characterTint = useThanos ? 0x6B46C1 : 0xFF1493; // Purple for Thanos, Pink for Scarlet Witch
                
                // Trigger character attack animation based on which one is shown
                if (useThanos) {
                    this.triggerThanosAttack();
                    
                    // Use the new Thanos Power Grip effect
                    if (!this.thanosPowerGripEffect) {
                        this.thanosPowerGripEffect = new window.ThanosPowerGripEffect(this.scene);
                    }
                    
                    // Trigger the magic circle effect
                    const positions = [{ row, col }];
                    this.thanosPowerGripEffect.triggerEffect(positions, multiplier);
                    
                    // Remove the original symbol and replace with Random Mult tile immediately
                    const originalSymbol = this.scene.gridManager.grid[col][row];
                    if (originalSymbol) {
                        originalSymbol.setTint(0x6B46C1);
                        this.scene.tweens.add({
                            targets: originalSymbol,
                            alpha: 0,
                            scaleX: 0.1,
                            scaleY: 0.1,
                            angle: 360,
                            duration: 300,
                            ease: 'Power2.in',
                            onComplete: () => {
                                this.scene.gridManager.grid[col][row] = null;
                                if (originalSymbol.destroy) originalSymbol.destroy();
                            }
                        });
                    }
                    // Place the Random Multiplier symbol grid now
                    this.placeRandomMultiplierOverlay(col, row, multiplier);
                    
                    // Wait for effect to complete
                    this.scene.time.delayedCall(1500, () => {
                        resolve();
                    });
                    
                    // Play Thanos power sound
                    window.SafeSound.play(this.scene, 'thanos_power');
                } else {
                    // Scarlet Witch effect (keep existing implementation)
                    this.triggerScarletWitchAttack();
                    // Add targeted lightning effect for Scarlet Witch
                    this.createRedLightningEffect(symbolX, symbolY);
                    
                    // Create character power effect
                    const character = this.scene.add.image(symbolX, symbolY, characterKey);
                    character.setScale(0.25);
                    character.setAlpha(0);
                    character.setDepth(1000);
                    character.setTint(characterTint);
                    
                    // Create multiplier text
                    const multiplierText = this.scene.add.text(symbolX, symbolY - 60, `x${multiplier}`, {
                        fontSize: '36px',
                        fontFamily: 'Arial Black',
                        color: '#FFD700',
                        stroke: '#FF1493',
                        strokeThickness: 3
                    });
                    multiplierText.setOrigin(0.5);
                    multiplierText.setScale(0);
                    multiplierText.setDepth(1001);
                    
                    // Create energy particles
                    const particles = this.scene.add.particles(symbolX, symbolY, 'reality_gem', {
                        speed: { min: 30, max: 100 },
                        scale: { start: 0.2, end: 0 },
                        lifespan: 800,
                        quantity: 1,
                        frequency: 80,
                        blendMode: 'ADD',
                        tint: characterTint
                    });
                    particles.setDepth(999);
                    
                    // Animation sequence
                    this.scene.tweens.add({
                        targets: character,
                        alpha: 0.7,
                        scaleX: 0.4,
                        scaleY: 0.4,
                        duration: 250,
                        ease: 'Power2',
                        onComplete: () => {
                            // Show multiplier text
                            this.scene.tweens.add({
                                targets: multiplierText,
                                scaleX: 1,
                                scaleY: 1,
                                duration: 300,
                                ease: 'Back.out',
                                onComplete: () => {
                                    // Brief pulsing effect
                                    this.scene.tweens.add({
                                        targets: [character, multiplierText],
                                        scaleX: 1.1,
                                        scaleY: 1.1,
                                        duration: 150,
                                        yoyo: true,
                                        repeat: 1,
                                        ease: 'Sine.easeInOut',
                                        onComplete: () => {
                                            // Fade out
                                            particles.stop();
                                            this.scene.tweens.add({
                                                targets: [character, multiplierText],
                                                alpha: 0,
                                                scaleX: 0,
                                                scaleY: 0,
                                                duration: 400,
                                                ease: 'Power2',
                                                onComplete: () => {
                                                    character.destroy();
                                                    multiplierText.destroy();
                                                    particles.destroy();
                                                    resolve();
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });

                    // Ensure replacement happens even if animations are interrupted
                    const existing = this.scene.gridManager.grid[col][row];
                    if (existing) {
                        this.scene.gridManager.grid[col][row] = null;
                        if (existing.destroy) existing.destroy();
                    }
                    this.placeRandomMultiplierOverlay(col, row, multiplier);
                }
                
                // Play bonus sound
                window.SafeSound.play(this.scene, 'bonus');
            });
        });
    }
    
    showMultiplier(multiplier) {
        // Don't show multiplier effects in burst mode
        if (this.scene.burstModeManager && this.scene.burstModeManager.isActive()) {
            return;
        }
        
        const multText = this.scene.add.text(
            this.scene.cameras.main.width / 2,
            this.scene.cameras.main.height / 2 - 100,
            `x${multiplier}`,
            {
                fontSize: '64px',
                fontFamily: 'Arial Black',
                color: '#FF00FF',
                stroke: '#FFFFFF',
                strokeThickness: 4
            }
        );
        multText.setOrigin(0.5);
        multText.setScale(2);
        
        this.scene.tweens.add({
            targets: multText,
            scaleX: 1,
            scaleY: 1,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                this.scene.time.delayedCall(800, () => {
                    this.scene.tweens.add({
                        targets: multText,
                        alpha: 0,
                        scaleX: 0,
                        scaleY: 0,
                        duration: 300,
                        onComplete: () => multText.destroy()
                    });
                });
            }
        });
    }
    
    // Burst mode bonus checking (no character animations - portraits are hidden)
    checkBonusesInBurstMode(cascadeCount) {
        // SECURITY: Use controlled RNG for burst mode bonuses
        if (!window.RNG) {
            throw new Error('SECURITY: BonusManager requires window.RNG to be initialized.');
        }
        const rng = new window.RNG();
        
        // Check for Cascading Random Multipliers in burst mode
        if (cascadeCount > 0) {
            const shouldTriggerCRM = rng.chance(window.GameConfig.CASCADE_RANDOM_MULTIPLIER.TRIGGER_CHANCE);
            if (shouldTriggerCRM && this.scene.totalWin >= window.GameConfig.CASCADE_RANDOM_MULTIPLIER.MIN_WIN_REQUIRED) {
                console.log('=== BURST MODE CASCADING MULTIPLIERS TRIGGERED ===');
                
                // Determine number of multipliers to apply (1-3) using controlled RNG
                const minMults = window.GameConfig.CASCADE_RANDOM_MULTIPLIER.MIN_MULTIPLIERS;
                const maxMults = window.GameConfig.CASCADE_RANDOM_MULTIPLIER.MAX_MULTIPLIERS;
                const numMultipliers = rng.int(minMults, maxMults);
                
                console.log(`Burst Mode Cascading Multipliers: ${numMultipliers} multipliers`);
                
                // Apply multiple multipliers - ADD multipliers together
                let totalMultiplier = 0;
                const multipliers = [];
                for (let i = 0; i < numMultipliers; i++) {
                    const multiplierTable = window.GameConfig.RANDOM_MULTIPLIER.TABLE;
                    const multiplier = multiplierTable[
                        rng.int(0, multiplierTable.length - 1)
                    ];
                    multipliers.push(multiplier);
                    totalMultiplier += multiplier;
                    
                    // Accumulate each multiplier during free spins
                    if (this.scene.stateManager.freeSpinsData.active) {
                        this.scene.stateManager.accumulateMultiplier(multiplier);
                        this.scene.updateAccumulatedMultiplierDisplay();
                    }
                }
                
                this.scene.totalWin *= totalMultiplier;
                
                // Show appropriate message
                const multiplierText = multipliers.map(m => `${m}x`).join(' × ');
                
                if (this.scene.stateManager.freeSpinsData.active) {
                    this.scene.showMessage(`BURST MODE CASCADE ${multiplierText} = ${totalMultiplier}x!`);
                } else {
                    this.scene.showMessage(`BURST CASCADE ${multiplierText} = ${totalMultiplier}x!`);
                }
                
                // Always play bonus sound
                window.SafeSound.play(this.scene, 'bonus');
                
                console.log(`Total Burst Mode Multiplier: ${totalMultiplier}x`);
                console.log('=== END BURST MODE CASCADING MULTIPLIERS ===');
            }
        }
    }
    
    checkRandomMultiplierInBurstMode() {
        // SECURITY: Use controlled RNG for burst mode random multiplier
        if (!window.RNG) {
            throw new Error('SECURITY: BonusManager requires window.RNG to be initialized.');
        }
        const rng = new window.RNG();
        
        // Check for Random Multiplier in burst mode (no character animations - portraits are hidden)
        const shouldTriggerRM = rng.chance(window.GameConfig.RANDOM_MULTIPLIER.TRIGGER_CHANCE);
        if (shouldTriggerRM && this.scene.totalWin >= window.GameConfig.RANDOM_MULTIPLIER.MIN_WIN_REQUIRED) {
            console.log('=== BURST MODE RANDOM MULTIPLIER TRIGGERED ===');
            
            const multiplierTable = window.GameConfig.RANDOM_MULTIPLIER.TABLE;
            const multiplier = multiplierTable[
                rng.int(0, multiplierTable.length - 1)
            ];
            
            console.log(`Burst Mode Random Multiplier: ${multiplier}x`);
            
            // Apply multiplier
            this.scene.totalWin *= multiplier;
            
            // Accumulate multiplier during free spins
            if (this.scene.stateManager.freeSpinsData.active) {
                this.scene.stateManager.accumulateMultiplier(multiplier);
                this.scene.updateAccumulatedMultiplierDisplay();
                
                // Show appropriate message for free spins
                this.scene.showMessage(`BURST MODE ${multiplier}x MULTIPLIER!`);
            } else {
                // Regular burst mode message
                this.scene.showMessage(`BURST ${multiplier}x MULTIPLIER!`);
            }
            
            // Always play bonus sound
            window.SafeSound.play(this.scene, 'bonus');
            
            console.log('=== END BURST MODE RANDOM MULTIPLIER ===');
        }
    }
    
    triggerScarletWitchAttack() {
        console.log('Attempting to trigger Scarlet Witch attack animation...');
        
        // Check each condition separately for better debugging
        if (!this.scene.portrait_scarlet_witch) {
            console.warn('❌ portrait_scarlet_witch not found in scene');
            return;
        }
        
        if (!this.scene.portrait_scarlet_witch.anims) {
            console.warn('❌ portrait_scarlet_witch has no anims property');
            return;
        }
        
        if (!this.scene.anims.exists('scarlet_witch_attack_animation')) {
            console.warn('❌ scarlet_witch_attack_animation does not exist in scene animations');
            // Try alternative animation names
            if (this.scene.anims.exists('scarlet_witch_attack')) {
                console.log('✓ Found alternative: scarlet_witch_attack');
                this.scene.portrait_scarlet_witch.play('scarlet_witch_attack');
            } else if (this.scene.anims.exists('redwitch_attack')) {
                console.log('✓ Found alternative: redwitch_attack');
                this.scene.portrait_scarlet_witch.play('redwitch_attack');
            } else {
                console.warn('❌ No attack animation found. Available animations:', this.scene.anims.anims.entries);
            }
            return;
        }
        
        // All checks passed - play the animation
        try {
            this.scene.portrait_scarlet_witch.stop();
            this.scene.portrait_scarlet_witch.play('scarlet_witch_attack_animation');
            
            // Return to idle animation after attack completes
            this.scene.portrait_scarlet_witch.once('animationcomplete', () => {
                if (this.scene.anims.exists('scarlet_witch_idle_animation')) {
                    this.scene.portrait_scarlet_witch.play('scarlet_witch_idle_animation');
                } else if (this.scene.anims.exists('scarlet_witch_idle')) {
                    this.scene.portrait_scarlet_witch.play('scarlet_witch_idle');
                }
            });
            
            console.log('✓ Scarlet Witch attack animation triggered successfully');
        } catch (error) {
            console.error('❌ Error playing Scarlet Witch attack animation:', error);
        }
        
        // Always play sound effect
        window.SafeSound.play(this.scene, 'scarlet_witch_attack');
    }
    
    triggerThanosAttack() {
        console.log('Attempting to trigger Thanos attack animation...');
        
        // Check each condition separately for better debugging
        if (!this.scene.portrait_thanos) {
            console.warn('❌ portrait_thanos not found in scene');
            return;
        }
        
        if (!this.scene.portrait_thanos.anims) {
            console.warn('❌ portrait_thanos has no anims property');
            return;
        }
        
        if (!this.scene.anims.exists('thanos_attack_animation')) {
            console.warn('❌ thanos_attack_animation does not exist in scene animations');
            // Try alternative animation names
            if (this.scene.anims.exists('thanos_attack')) {
                console.log('✓ Found alternative: thanos_attack');
                this.scene.portrait_thanos.play('thanos_attack');
            } else {
                console.warn('❌ No attack animation found. Available animations:', this.scene.anims.anims.entries);
            }
            return;
        }
        
        // All checks passed - play the animation
        try {
            this.scene.portrait_thanos.stop();
            this.scene.portrait_thanos.play('thanos_attack_animation');
            
            // Return to idle animation after attack completes
            this.scene.portrait_thanos.once('animationcomplete', () => {
                if (this.scene.anims.exists('thanos_idle_animation')) {
                    this.scene.portrait_thanos.play('thanos_idle_animation');
                } else if (this.scene.anims.exists('thanos_idle')) {
                    this.scene.portrait_thanos.play('thanos_idle');
                }
            });
            
            console.log('✓ Thanos attack animation triggered successfully');
        } catch (error) {
            console.error('❌ Error playing Thanos attack animation:', error);
        }
        
        // Play Thanos power sound effect
        console.log('🔊 Playing Thanos power sound effect');
        window.SafeSound.play(this.scene, 'thanos_power');
    }
    
    createRedLightningEffect(targetX, targetY) {
        console.log('🔥 Creating TARGETED red lightning effect for Scarlet Witch');
        console.log(`🎯 Target position: X=${targetX}, Y=${targetY}`);
        
        // Play lightning sound effect with fallback
        console.log('🔊 Attempting to play lightning_struck sound effect');
        let soundResult = window.SafeSound.play(this.scene, 'lightning_struck');
        
        // If lightning sound doesn't play, try symbol_shattering as fallback
        if (!soundResult) {
            console.log('🔊 Lightning sound failed, trying symbol_shattering as fallback');
            soundResult = window.SafeSound.play(this.scene, 'symbol_shattering');
        }
        
        console.log('🔊 Sound play result:', soundResult);
        
        // Create single targeted lightning bolt
        const graphics = this.scene.add.graphics();
        graphics.setDepth(window.GameConfig.UI_DEPTHS.FX_UNDERLAY); // Just below particles
        
        const screenTop = 0;
        
        console.log(`⚡ Creating THICKER lightning from top (${targetX}, ${screenTop}) to target (${targetX}, ${targetY})`);
        
        // Create single targeted lightning bolt with 3 variants for 3x thickness
        const lightningBolts = [];
        
        for (let variant = 0; variant < 3; variant++) {
            lightningBolts.push({
                segments: this.generateVerticalLightningPath(
                    targetX + (variant - 1) * 12, // Increased horizontal offset for 3x thickness
                    screenTop, 
                    targetX + (variant - 1) * 12, 
                    targetY
                ),
                alpha: 0,
                width: 24 - variant * 6, // MUCH thicker strokes (24px, 18px, 12px) - 3x original
                delay: variant * 50, // Small stagger for thickness effect
                variant: variant
            });
        }
        
        console.log(`⚡ Created ${lightningBolts.length} THICK lightning bolts targeting single position`);
        
        // Return a promise for proper sequencing
        return new Promise((resolve) => {
            // Track when explosion should trigger
            let explosionTriggered = false;
            
            // Animate lightning strike sequence with extended duration
            lightningBolts.forEach((bolt, index) => {
                this.scene.time.delayedCall(bolt.delay, () => {
                    console.log(`⚡ Animating THICK targeted bolt ${index} variant ${bolt.variant}`);
                    
                    // Fade in quickly for dramatic strike
                    this.scene.tweens.add({
                        targets: bolt,
                        alpha: 1,
                        duration: 60, // Half duration - was 120
                        ease: 'Power2',
                        onUpdate: () => {
                            this.drawVerticalLightning(graphics, lightningBolts);
                        },
                        onComplete: () => {
                            // Shorter flicker effect for lightning strike
                            this.scene.tweens.add({
                                targets: bolt,
                                alpha: 0.3,
                                duration: 25, // Half duration - was 50
                                yoyo: true,
                                repeat: 10, // Half repeats - was 20
                                onUpdate: () => {
                                    this.drawVerticalLightning(graphics, lightningBolts);
                                },
                                onComplete: () => {
                                    // Trigger explosion effect when main bolt completes flickering
                                    if (index === 0 && !explosionTriggered) {
                                        explosionTriggered = true;
                                        this.createLightningExplosion(targetX, targetY);
                                    }
                                    
                                    // Faster fade out after strike
                                    this.scene.tweens.add({
                                        targets: bolt,
                                        alpha: 0,
                                        duration: 150, // Half duration - was 300
                                        onUpdate: () => {
                                            this.drawVerticalLightning(graphics, lightningBolts);
                                        },
                                        onComplete: () => {
                                            if (index === lightningBolts.length - 1) {
                                                console.log('⚡ THICK targeted lightning strike complete, destroying graphics');
                                                graphics.destroy();
                                                resolve(); // Resolve promise when lightning is complete
                                            }
                                        }
                                    });
                                }
                            });
                        }
                    });
                });
            });
            
            // Add enhanced targeted red flash effect around the impact point
            const flash = this.scene.add.graphics();
            flash.setDepth(window.GameConfig.UI_DEPTHS.FX_UNDERLAY);
            flash.fillStyle(0xff1493, 0);
            // Create larger circular flash around target
            flash.fillCircle(targetX, targetY, 120); // Larger radius flash
            
            console.log('🔥 Adding enhanced targeted flash effect');
            
            this.scene.time.delayedCall(40, () => { // Half delay - was 80
                this.scene.tweens.add({
                    targets: flash,
                    alpha: 0.6, // Brighter flash
                    duration: 50, // Half duration - was 100
                    yoyo: true,
                    repeat: 1, // Fewer flash pulses - was 2
                    onComplete: () => {
                        flash.destroy();
                        console.log('🔥 Enhanced targeted flash complete');
                    }
                });
            });
        });
    }
    
    createLightningExplosion(x, y) {
        console.log(`⚡ Creating subtle lightning sparks at (${x}, ${y})`);
        
        // Create subtle lightning spark particles that spill around the impact point
        
        // Small electric sparks that scatter around
        const lightningSparkParticles = this.scene.add.particles(x, y, 'reality_gem', {
            speed: { min: 50, max: 150 },
            scale: { start: 0.4, end: 0 },
            lifespan: 600,
            quantity: 8,
            blendMode: 'ADD',
            tint: [0xFF1493, 0xFFB6C1], // Pink to light pink
            emitZone: {
                type: 'circle',
                source: new Phaser.Geom.Circle(0, 0, 5),
                quantity: 8
            }
        });
        lightningSparkParticles.setDepth(1002);
        
        // Tiny electric sparks that fall with gravity
        const fallingSparkParticles = this.scene.add.particles(x, y, 'power_gem', {
            speed: { min: 30, max: 80 },
            scale: { start: 0.3, end: 0.1 },
            lifespan: 800,
            quantity: 5,
            frequency: 100,
            blendMode: 'ADD',
            tint: 0xFF1493, // Pink
            gravityY: 150,
            angle: { min: -30, max: 30 } // Mostly downward
        });
        fallingSparkParticles.setDepth(1002);
        
        // Small electric crackles radiating outward
        const crackleParticles = this.scene.add.particles(x, y, 'mind_gem', {
            speed: { min: 80, max: 120 },
            scale: { start: 0.25, end: 0 },
            lifespan: 400,
            quantity: 6,
            blendMode: 'ADD',
            tint: [0xFF1493, 0xFFFFFF], // Pink to white
            angle: { min: 0, max: 360 }
        });
        crackleParticles.setDepth(1002);
        
        // Stop emitting after initial burst and clean up
        this.scene.time.delayedCall(100, () => {
            lightningSparkParticles.stop();
            crackleParticles.stop();
        });
        
        this.scene.time.delayedCall(300, () => {
            fallingSparkParticles.stop();
        });
        
        this.scene.time.delayedCall(1500, () => {
            lightningSparkParticles.destroy();
            fallingSparkParticles.destroy();
            crackleParticles.destroy();
            console.log('⚡ Lightning spark particles cleaned up');
        });
        
        // Very subtle screen shake for impact
        this.scene.cameras.main.shake(100, 0.005);
        
        // Play a subtle electric spark sound effect
        window.SafeSound.play(this.scene, 'bonus');
    }
    
    generateVerticalLightningPath(x1, y1, x2, y2) {
        const segments = [];
        const numSegments = 12; // More segments for smoother vertical lightning
        const horizontalVariance = 25; // Horizontal zigzag variance
        const verticalVariance = 10; // Small vertical variance
        
        segments.push({ x: x1, y: y1 });
        
        for (let i = 1; i < numSegments; i++) {
            const progress = i / numSegments;
            const x = x1 + (x2 - x1) * progress;
            const y = y1 + (y2 - y1) * progress;
            
            // Add horizontal zigzag for lightning effect (more dramatic)
            // Use controlled RNG for visual effect variations
            const effectRng = new window.RNG();
            const horizontalOffset = (effectRng.random() - 0.5) * horizontalVariance * (1 - progress * 0.3); // Reduce variance as it goes down
            const verticalOffset = (effectRng.random() - 0.5) * verticalVariance;
            
            segments.push({
                x: x + horizontalOffset,
                y: y + verticalOffset
            });
        }
        
        segments.push({ x: x2, y: y2 });
        
        return segments;
    }
    
    generateLightningPath(x1, y1, x2, y2) {
        const segments = [];
        const numSegments = 8;
        const variance = 30;
        
        segments.push({ x: x1, y: y1 });
        
        for (let i = 1; i < numSegments; i++) {
            const progress = i / numSegments;
            const x = x1 + (x2 - x1) * progress;
            const y = y1 + (y2 - y1) * progress;
            
            // Add random offset for jagged effect
            // Use controlled RNG for visual effect variations
            const effectRng = new window.RNG();
            const offsetX = (effectRng.random() - 0.5) * variance;
            const offsetY = (effectRng.random() - 0.5) * variance;
            
            segments.push({
                x: x + offsetX,
                y: y + offsetY
            });
        }
        
        segments.push({ x: x2, y: y2 });
        
        return segments;
    }
    
    drawVerticalLightning(graphics, bolts) {
        graphics.clear();
        
        bolts.forEach(bolt => {
            if (bolt.alpha <= 0) return;
            
            // Draw outer glow (thicker for vertical lightning)
            graphics.lineStyle(bolt.width + 12, 0xff1493, bolt.alpha * 0.25); // Doubled glow thickness
            graphics.beginPath();
            graphics.moveTo(bolt.segments[0].x, bolt.segments[0].y);
            
            for (let i = 1; i < bolt.segments.length; i++) {
                graphics.lineTo(bolt.segments[i].x, bolt.segments[i].y);
            }
            
            graphics.strokePath();
            
            // Draw middle glow (thicker)
            graphics.lineStyle(bolt.width + 6, 0xff69b4, bolt.alpha * 0.5); // Doubled glow thickness
            graphics.beginPath();
            graphics.moveTo(bolt.segments[0].x, bolt.segments[0].y);
            
            for (let i = 1; i < bolt.segments.length; i++) {
                graphics.lineTo(bolt.segments[i].x, bolt.segments[i].y);
            }
            
            graphics.strokePath();
            
            // Draw bright core (thicker)
            graphics.lineStyle(bolt.width + 2, 0xffffff, bolt.alpha * 0.9); // Brighter white core
            graphics.beginPath();
            graphics.moveTo(bolt.segments[0].x, bolt.segments[0].y);
            
            for (let i = 1; i < bolt.segments.length; i++) {
                graphics.lineTo(bolt.segments[i].x, bolt.segments[i].y);
            }
            
            graphics.strokePath();
            
            // Draw inner core for extra intensity
            graphics.lineStyle(bolt.width, 0xfff5f5, bolt.alpha); // Near-white core
            graphics.beginPath();
            graphics.moveTo(bolt.segments[0].x, bolt.segments[0].y);
            
            for (let i = 1; i < bolt.segments.length; i++) {
                graphics.lineTo(bolt.segments[i].x, bolt.segments[i].y);
            }
            
            graphics.strokePath();
        });
    }
    
    drawLightning(graphics, bolts) {
        graphics.clear();
        
        bolts.forEach(bolt => {
            if (bolt.alpha <= 0) return;
            
            // Draw outer glow
            graphics.lineStyle(bolt.width + 6, 0xff1493, bolt.alpha * 0.3);
            graphics.beginPath();
            graphics.moveTo(bolt.segments[0].x, bolt.segments[0].y);
            
            for (let i = 1; i < bolt.segments.length; i++) {
                graphics.lineTo(bolt.segments[i].x, bolt.segments[i].y);
            }
            
            graphics.strokePath();
            
            // Draw middle glow
            graphics.lineStyle(bolt.width + 2, 0xff69b4, bolt.alpha * 0.6);
            graphics.beginPath();
            graphics.moveTo(bolt.segments[0].x, bolt.segments[0].y);
            
            for (let i = 1; i < bolt.segments.length; i++) {
                graphics.lineTo(bolt.segments[i].x, bolt.segments[i].y);
            }
            
            graphics.strokePath();
            
            // Draw core
            graphics.lineStyle(bolt.width, 0xffffff, bolt.alpha);
            graphics.beginPath();
            graphics.moveTo(bolt.segments[0].x, bolt.segments[0].y);
            
            for (let i = 1; i < bolt.segments.length; i++) {
                graphics.lineTo(bolt.segments[i].x, bolt.segments[i].y);
            }
            
            graphics.strokePath();
        });
    }
}; 
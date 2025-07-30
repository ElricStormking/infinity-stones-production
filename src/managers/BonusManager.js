// Bonus Manager - handles all bonus features and multiplier systems
window.BonusManager = class BonusManager {
    constructor(scene) {
        this.scene = scene;
    }
    
    async checkRandomMultiplier() {
        // Don't trigger Random Multiplier in burst mode to avoid slowdown
        if (this.scene.burstModeManager && this.scene.burstModeManager.isActive()) {
            return;
        }
        
        // Check if Random Multiplier should trigger
        const shouldTrigger = Math.random() < window.GameConfig.RANDOM_MULTIPLIER.TRIGGER_CHANCE;
        
        if (!shouldTrigger) {
            return;
        }
        
        // Only apply if there's a win worth applying multiplier to
        if (this.scene.totalWin < window.GameConfig.RANDOM_MULTIPLIER.MIN_WIN_REQUIRED) {
            return;
        }
        
        // Select random multiplier from weighted table
        const multiplierTable = window.GameConfig.RANDOM_MULTIPLIER.TABLE;
        const multiplier = multiplierTable[
            Math.floor(Math.random() * multiplierTable.length)
        ];
        
        // Select random position to replace a symbol
        const col = Math.floor(Math.random() * this.scene.gridManager.cols);
        const row = Math.floor(Math.random() * this.scene.gridManager.rows);
        
        console.log(`=== RANDOM MULTIPLIER TRIGGERED ===`);
        console.log(`Multiplier: ${multiplier}x`);
        console.log(`Position: (${col}, ${row})`);
        console.log(`Original Win: $${this.scene.totalWin.toFixed(2)}`);
        
        // Show Thanos power grip animation
        await this.showThanosRandomMultiplier(col, row, multiplier);
        
        // Apply multiplier to total win
        const originalWin = this.scene.totalWin;
        this.scene.totalWin *= multiplier;
        
        // Accumulate multiplier during free spins
        this.scene.freeSpinsManager.applyFreeSpinsMultiplier(multiplier);
        
        console.log(`New Win: $${this.scene.totalWin.toFixed(2)}`);
        console.log(`=== END RANDOM MULTIPLIER ===`);
        
        // Update win display
        this.scene.updateWinDisplay();
        
        // Show multiplier message
        this.scene.showMessage(`THANOS POWER GRIP! ${multiplier}x MULTIPLIER!\nWin: $${originalWin.toFixed(2)} → $${this.scene.totalWin.toFixed(2)}`);
    }
    
    async showThanosRandomMultiplier(col, row, multiplier) {
        return new Promise(resolve => {
            // Get the symbol position on screen
            const symbolX = this.scene.gridManager.getSymbolScreenX(col);
            const symbolY = this.scene.gridManager.getSymbolScreenY(row);
            
            // Create Thanos power grip effect
            const thanosGrip = this.scene.add.image(symbolX, symbolY, 'thanos');
            thanosGrip.setScale(0.3);
            thanosGrip.setAlpha(0);
            thanosGrip.setDepth(1000);
            thanosGrip.setTint(0x6B46C1); // Purple tint for power
            
            // Create multiplier text
            const multiplierText = this.scene.add.text(symbolX, symbolY - 50, `x${multiplier}`, {
                fontSize: '48px',
                fontFamily: 'Arial Black',
                color: '#FFD700',
                stroke: '#4B0082',
                strokeThickness: 4
            });
            multiplierText.setOrigin(0.5);
            multiplierText.setScale(0);
            multiplierText.setDepth(1001);
            
            // Create energy particles around the symbol
            const particles = this.scene.add.particles(symbolX, symbolY, 'power_gem', {
                speed: { min: 50, max: 150 },
                scale: { start: 0.3, end: 0 },
                lifespan: 1000,
                quantity: 2,
                frequency: 100,
                blendMode: 'ADD',
                tint: 0x6B46C1
            });
            particles.setDepth(999);
            
            // Animation sequence
            this.scene.tweens.add({
                targets: thanosGrip,
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
                                targets: [thanosGrip, multiplierText],
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
                                        targets: [thanosGrip, multiplierText],
                                        alpha: 0,
                                        scaleX: 0,
                                        scaleY: 0,
                                        duration: 500,
                                        ease: 'Power2',
                                        onComplete: () => {
                                            thanosGrip.destroy();
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
        
        // Check if Cascading Random Multipliers should trigger
        const shouldTrigger = Math.random() < window.GameConfig.CASCADE_RANDOM_MULTIPLIER.TRIGGER_CHANCE;
        
        if (!shouldTrigger) {
            return;
        }
        
        // Only apply if there's a win worth applying multipliers to
        if (this.scene.totalWin < window.GameConfig.CASCADE_RANDOM_MULTIPLIER.MIN_WIN_REQUIRED) {
            return;
        }
        
        // Determine number of multipliers to apply (1-3)
        const minMults = window.GameConfig.CASCADE_RANDOM_MULTIPLIER.MIN_MULTIPLIERS;
        const maxMults = window.GameConfig.CASCADE_RANDOM_MULTIPLIER.MAX_MULTIPLIERS;
        const numMultipliers = Math.floor(Math.random() * (maxMults - minMults + 1)) + minMults;
        
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
                Math.floor(Math.random() * multiplierTable.length)
            ];
            multipliers.push(multiplier);
            
            // Select random position to replace a symbol (avoid duplicates)
            let col, row;
            let attempts = 0;
            do {
                col = Math.floor(Math.random() * this.scene.gridManager.cols);
                row = Math.floor(Math.random() * this.scene.gridManager.rows);
                attempts++;
            } while (positions.some(pos => pos.col === col && pos.row === row) && attempts < 20);
            
            positions.push({ col, row });
            
            console.log(`Multiplier ${i + 1}: ${multiplier}x at position (${col}, ${row})`);
        }
        
        // Show cascading multiplier effects
        await this.showCascadingRandomMultipliers(positions, multipliers);
        
        // Calculate total multiplier effect
        let totalMultiplier = 1;
        multipliers.forEach(mult => {
            totalMultiplier *= mult;
        });
        
        // Apply total multiplier to win
        const originalWin = this.scene.totalWin;
        this.scene.totalWin *= totalMultiplier;
        
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
                // Get the symbol position on screen
                const symbolX = this.scene.gridManager.getSymbolScreenX(col);
                const symbolY = this.scene.gridManager.getSymbolScreenY(row);
                
                // Randomly choose between Thanos and Scarlet Witch animation
                const useThanos = Math.random() < 0.5;
                const characterKey = useThanos ? 'thanos' : 'scarlet_witch';
                const characterTint = useThanos ? 0x6B46C1 : 0xFF1493; // Purple for Thanos, Pink for Scarlet Witch
                
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
                    stroke: useThanos ? '#4B0082' : '#FF1493',
                    strokeThickness: 3
                });
                multiplierText.setOrigin(0.5);
                multiplierText.setScale(0);
                multiplierText.setDepth(1001);
                
                // Create energy particles
                const particles = this.scene.add.particles(symbolX, symbolY, useThanos ? 'power_gem' : 'reality_gem', {
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
    
    // Simplified bonus checking for burst mode
    checkBonusesInBurstMode(cascadeCount) {
        // Check for Cascading Random Multipliers in burst mode (simplified)
        if (cascadeCount > 0) {
            const shouldTriggerCRM = Math.random() < window.GameConfig.CASCADE_RANDOM_MULTIPLIER.TRIGGER_CHANCE;
            if (shouldTriggerCRM && this.scene.totalWin >= window.GameConfig.CASCADE_RANDOM_MULTIPLIER.MIN_WIN_REQUIRED) {
                // Determine number of multipliers to apply (1-3)
                const minMults = window.GameConfig.CASCADE_RANDOM_MULTIPLIER.MIN_MULTIPLIERS;
                const maxMults = window.GameConfig.CASCADE_RANDOM_MULTIPLIER.MAX_MULTIPLIERS;
                const numMultipliers = Math.floor(Math.random() * (maxMults - minMults + 1)) + minMults;
                
                // Apply multiple multipliers (simplified for burst mode)
                let totalMultiplier = 1;
                const multipliers = [];
                for (let i = 0; i < numMultipliers; i++) {
                    const multiplierTable = window.GameConfig.RANDOM_MULTIPLIER.TABLE;
                    const multiplier = multiplierTable[
                        Math.floor(Math.random() * multiplierTable.length)
                    ];
                    multipliers.push(multiplier);
                    totalMultiplier *= multiplier;
                    
                    // Accumulate each multiplier during free spins
                    if (this.scene.stateManager.freeSpinsData.active) {
                        this.scene.stateManager.accumulateMultiplier(multiplier);
                        this.scene.updateAccumulatedMultiplierDisplay();
                    }
                }
                
                this.scene.totalWin *= totalMultiplier;
            }
        }
    }
    
    checkRandomMultiplierInBurstMode() {
        // Check for Random Multiplier in burst mode (simplified)
        const shouldTriggerRM = Math.random() < window.GameConfig.RANDOM_MULTIPLIER.TRIGGER_CHANCE;
        if (shouldTriggerRM && this.scene.totalWin >= window.GameConfig.RANDOM_MULTIPLIER.MIN_WIN_REQUIRED) {
            const multiplierTable = window.GameConfig.RANDOM_MULTIPLIER.TABLE;
            const multiplier = multiplierTable[
                Math.floor(Math.random() * multiplierTable.length)
            ];
            this.scene.totalWin *= multiplier;
            
            // Accumulate multiplier during free spins
            if (this.scene.stateManager.freeSpinsData.active) {
                this.scene.stateManager.accumulateMultiplier(multiplier);
                this.scene.updateAccumulatedMultiplierDisplay();
            }
        }
    }
}; 
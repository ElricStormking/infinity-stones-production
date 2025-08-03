// Thanos Power Grip Effect Manager
window.ThanosPowerGripEffect = class ThanosPowerGripEffect {
    constructor(scene) {
        this.scene = scene;
        this.activeEffects = [];
        this.multiplierTexts = [];
    }
    
    /**
     * Trigger the Thanos Power Grip effect at specified grid positions
     * @param {Array} positions - Array of {row, col} positions
     * @param {number} multiplier - The multiplier value to display
     */
    triggerEffect(positions, multiplier = null) {
        if (!positions || positions.length === 0) return;
        
        // Calculate center position of affected symbols
        const centerPos = this.calculateCenterPosition(positions);
        
        // Create magic circle effect
        this.createMagicCircle(centerPos.x, centerPos.y);
        
        // Show multiplier if provided
        if (multiplier) {
            this.showMultiplier(centerPos.x, centerPos.y, multiplier);
        }
        
        // Apply destruction effect to each symbol
        positions.forEach(pos => {
            this.destroySymbolWithEffect(pos);
        });
        
        // Play power grip sound
        window.SafeSound.play(this.scene, 'thanos_power_grip');
    }
    
    calculateCenterPosition(positions) {
        let sumX = 0, sumY = 0;
        
        positions.forEach(pos => {
            const worldPos = this.getWorldPosition(pos.row, pos.col);
            sumX += worldPos.x;
            sumY += worldPos.y;
        });
        
        return {
            x: sumX / positions.length,
            y: sumY / positions.length
        };
    }
    
    getWorldPosition(row, col) {
        // Use the same positioning as BonusManager for consistency
        if (this.scene.gridManager) {
            return {
                x: this.scene.gridManager.getSymbolScreenX(col),
                y: this.scene.gridManager.getSymbolScreenY(row)
            };
        }
        
        // Fallback calculation if gridManager not available
        const gridStartX = 400;
        const gridStartY = 150;
        const cellSize = 80;
        
        return {
            x: gridStartX + col * cellSize + cellSize / 2,
            y: gridStartY + row * cellSize + cellSize / 2
        };
    }
    
    createMagicCircle(x, y) {
        // Create container for the effect
        const container = this.scene.add.container(x, y);
        
        // Create the magic circle using graphics (no shader dependencies)
        this.createMagicCircleGraphics(container);
        
        // Animate the magic circle
        container.setScale(0.1);
        container.setAlpha(0);
        
        // Phase 1: Expand to full size
        this.scene.tweens.add({
            targets: container,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 1,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                // Phase 2: Spin twice faster for 1.5 seconds (720 degrees in 1500ms)
                this.scene.tweens.add({
                    targets: container,
                    angle: 1440, // Two full rotations (twice faster)
                    duration: 1800, // 1.8 seconds
                    ease: 'Linear',
                    onComplete: () => {
                        // Phase 3: Shrink and spin faster then disappear
                        this.scene.tweens.add({
                            targets: container,
                            scaleX: 0,
                            scaleY: 0,
                            alpha: 0,
                            angle: 1080, // Additional 360 degrees while shrinking (faster spin)
                            duration: 600,
                            ease: 'Power2.in',
                            onComplete: () => {
                                container.destroy();
                            }
                        });
                    }
                });
            }
        });
        
        // Add particle effects
        this.createMagicParticles(x, y);
        
        this.activeEffects.push(container);
    }
    
    createMagicCircleGraphics(container) {
        // Create multiple layers for sophisticated pattern
        this.createOuterRings(container);
        this.createSummoningCircle(container);
        this.createEnergyFlowLines(container);
        this.createRunicSymbols(container);
        this.createInnerGeometry(container);
    }
    
    createOuterRings(container) {
        const graphics = this.scene.add.graphics();
        const time = this.scene.time.now / 1000;
        
        // Multiple energy rings with varying intensity - scaled down to fit 1.5x cell size
        for (let ring = 0; ring < 3; ring++) {
            const radius = 30 + ring * 8; // Much smaller radii
            const intensity = 0.8 - ring * 0.15;
            const color = ring % 2 === 0 ? 0x9932cc : 0xff8c00;
            
            graphics.lineStyle(3 - ring, color, intensity);
            graphics.strokeCircle(0, 0, radius);
            
            // Add energy flow segments
            for (let segment = 0; segment < 8; segment++) {
                const angle = (segment / 8) * Math.PI * 2 + time * 0.5;
                const segmentLength = Math.PI / 6;
                const innerRadius = radius - 2;
                const outerRadius = radius + 2;
                
                if (segment % 3 === Math.floor(time * 2) % 3) {
                    graphics.lineStyle(1, 0xffd700, 0.9);
                    const x1 = Math.cos(angle) * innerRadius;
                    const y1 = Math.sin(angle) * innerRadius;
                    const x2 = Math.cos(angle + segmentLength) * outerRadius;
                    const y2 = Math.sin(angle + segmentLength) * outerRadius;
                    graphics.lineBetween(x1, y1, x2, y2);
                }
            }
        }
        
        container.add(graphics);
    }
    
    createSummoningCircle(container) {
        const graphics = this.scene.add.graphics();
        
        // Create complex geometric patterns similar to shader sample - scaled down
        // Hexagonal base structure
        graphics.lineStyle(2, 0xffd700, 0.9);
        this.drawPolygon(graphics, 0, 0, 25, 6);
        
        // Inner triangular structure
        graphics.lineStyle(2, 0xff8c00, 0.8);
        this.drawPolygon(graphics, 0, 0, 18, 3);
        
        // Rotated inner triangle
        graphics.lineStyle(1, 0x9932cc, 0.8);
        this.drawPolygon(graphics, 0, 0, 12, 3, Math.PI);
        
        // Create intricate line patterns
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const x1 = Math.cos(angle) * 25;
            const y1 = Math.sin(angle) * 25;
            const x2 = Math.cos(angle + Math.PI) * 8;
            const y2 = Math.sin(angle + Math.PI) * 8;
            
            graphics.lineStyle(1, 0xffd700, 0.6);
            graphics.lineBetween(x1, y1, x2, y2);
        }
        
        container.add(graphics);
    }
    
    createEnergyFlowLines(container) {
        const graphics = this.scene.add.graphics();
        const time = this.scene.time.now / 1000;
        
        // Create flowing energy lines using math from shader sample - scaled down
        for (let flow = 0; flow < 6; flow++) {
            const baseAngle = (flow / 6) * Math.PI * 2;
            
            graphics.lineStyle(1, 0x9932cc, 0.7);
            graphics.beginPath();
            
            for (let t = 0; t < 1; t += 0.05) {
                const radius = 20 + Math.sin(t * Math.PI * 4 + time + flow) * 4; // Much smaller radius
                const angle = baseAngle + t * Math.PI * 0.5;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                
                if (t === 0) {
                    graphics.moveTo(x, y);
                } else {
                    graphics.lineTo(x, y);
                }
            }
            graphics.strokePath();
        }
        
        container.add(graphics);
    }
    
    createRunicSymbols(container) {
        const graphics = this.scene.add.graphics();
        
        // Create runic symbols at key positions - scaled down
        for (let rune = 0; rune < 8; rune++) {
            const angle = (rune / 8) * Math.PI * 2;
            const x = Math.cos(angle) * 38; // Much smaller radius
            const y = Math.sin(angle) * 38;
            
            graphics.lineStyle(1, 0xffd700, 0.8);
            
            // Create different runic patterns
            const runeType = rune % 4;
            switch (runeType) {
                case 0: // Diamond
                    this.drawDiamond(graphics, x, y, 3);
                    break;
                case 1: // Cross
                    this.drawCross(graphics, x, y, 2);
                    break;
                case 2: // Star
                    this.drawStar(graphics, x, y, 2, 4);
                    break;
                case 3: // Triangle
                    this.drawPolygon(graphics, x, y, 2, 3);
                    break;
            }
        }
        
        container.add(graphics);
    }
    
    createInnerGeometry(container) {
        const graphics = this.scene.add.graphics();
        
        // Central complex star using mathematical functions from shader - scaled down
        graphics.lineStyle(2, 0xffff00, 1);
        this.drawComplexStar(graphics, 0, 0, 12, 6, 8);
        
        // Inner circle with radiating lines
        graphics.lineStyle(1, 0xff8c00, 0.9);
        graphics.strokeCircle(0, 0, 8);
        
        for (let ray = 0; ray < 12; ray++) {
            const angle = (ray / 12) * Math.PI * 2;
            const x1 = Math.cos(angle) * 5;
            const y1 = Math.sin(angle) * 5;
            const x2 = Math.cos(angle) * 11;
            const y2 = Math.sin(angle) * 11;
            
            graphics.lineStyle(1, 0xffd700, 0.7);
            graphics.lineBetween(x1, y1, x2, y2);
        }
        
        container.add(graphics);
    }
    
    // Helper functions for complex geometric patterns
    drawPolygon(graphics, x, y, radius, sides, rotation = 0) {
        graphics.beginPath();
        for (let i = 0; i <= sides; i++) {
            const angle = (i / sides) * Math.PI * 2 + rotation;
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;
            if (i === 0) {
                graphics.moveTo(px, py);
            } else {
                graphics.lineTo(px, py);
            }
        }
        graphics.strokePath();
    }
    
    drawComplexStar(graphics, x, y, outerRadius, innerRadius, points) {
        graphics.beginPath();
        for (let i = 0; i <= points * 2; i++) {
            const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;
            if (i === 0) {
                graphics.moveTo(px, py);
            } else {
                graphics.lineTo(px, py);
            }
        }
        graphics.strokePath();
    }
    
    drawDiamond(graphics, x, y, size) {
        graphics.beginPath();
        graphics.moveTo(x, y - size);
        graphics.lineTo(x + size, y);
        graphics.lineTo(x, y + size);
        graphics.lineTo(x - size, y);
        graphics.lineTo(x, y - size);
        graphics.strokePath();
    }
    
    drawCross(graphics, x, y, size) {
        graphics.lineBetween(x - size, y, x + size, y);
        graphics.lineBetween(x, y - size, x, y + size);
    }
    
    drawStar(graphics, x, y, radius, points) {
        graphics.beginPath();
        for (let i = 0; i <= points * 2; i++) {
            const angle = (i / (points * 2)) * Math.PI * 2;
            const r = i % 2 === 0 ? radius : radius * 0.5;
            const px = x + Math.cos(angle) * r;
            const py = y + Math.sin(angle) * r;
            if (i === 0) {
                graphics.moveTo(px, py);
            } else {
                graphics.lineTo(px, py);
            }
        }
        graphics.strokePath();
    }
    
    createMagicParticles(x, y) {
        try {
            // Use available gem textures for particles
            const particleTexture = this.scene.textures.exists('power_gem') ? 'power_gem' : 
                                   this.scene.textures.exists('reality_gem') ? 'reality_gem' : 
                                   '__DEFAULT';
            
            if (particleTexture !== '__DEFAULT') {
                const particles = this.scene.add.particles(particleTexture);
                
                const emitter = particles.createEmitter({
                    x: x,
                    y: y,
                    speed: { min: 100, max: 300 },
                    scale: { start: 0.3, end: 0 },
                    blendMode: 'ADD',
                    lifespan: 1000,
                    quantity: 15,
                    angle: { min: 0, max: 360 },
                    tint: [0x9932cc, 0xff8c00, 0xffd700]
                });
                
                // Stop emitting after initial burst
                this.scene.time.delayedCall(200, () => {
                    emitter.stop();
                });
                
                // Clean up particles after animation
                this.scene.time.delayedCall(2500, () => {
                    if (particles && !particles.destroyed) {
                        particles.destroy();
                    }
                });
            }
        } catch (error) {
            console.warn('Could not create particles:', error);
        }
    }
    
    destroySymbolWithEffect(position) {
        const worldPos = this.getWorldPosition(position.row, position.col);
        
        // Create simple burst effect using graphics
        const burst = this.scene.add.graphics();
        burst.x = worldPos.x;
        burst.y = worldPos.y;
        burst.fillStyle(0x9932cc, 1);
        burst.fillCircle(0, 0, 25);
        burst.setBlendMode(Phaser.BlendModes.ADD);
        
        // Animate burst
        this.scene.tweens.add({
            targets: burst,
            scaleX: 4,
            scaleY: 4,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => {
                burst.destroy();
            }
        });
        
        // Add shockwave effect
        this.createShockwave(worldPos.x, worldPos.y);
    }
    
    createShockwave(x, y) {
        const shockwave = this.scene.add.graphics();
        shockwave.x = x;
        shockwave.y = y;
        shockwave.setBlendMode(Phaser.BlendModes.ADD);
        
        let radius = 0;
        const maxRadius = 150;
        
        const updateShockwave = () => {
            if (shockwave.destroyed) return;
            
            shockwave.clear();
            
            if (radius < maxRadius) {
                const alpha = 1 - (radius / maxRadius);
                shockwave.lineStyle(4, 0x9932cc, alpha);
                shockwave.strokeCircle(0, 0, radius);
                
                radius += 8;
                this.scene.time.delayedCall(16, updateShockwave);
            } else {
                shockwave.destroy();
            }
        };
        
        updateShockwave();
    }
    
    showMultiplier(x, y, multiplier) {
        // Create multiplier text
        const multiplierText = this.scene.add.text(x, y, `×${multiplier}`, {
            fontSize: '72px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#9932CC',
            strokeThickness: 8,
            shadow: {
                offsetX: 3,
                offsetY: 3,
                color: '#000000',
                blur: 10,
                fill: true
            }
        });
        
        multiplierText.setOrigin(0.5);
        multiplierText.setScale(0);
        multiplierText.setDepth(1000);
        
        // Animate multiplier
        this.scene.tweens.add({
            targets: multiplierText,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 300,
            ease: 'Back.easeOut',
            yoyo: true,
            hold: 500,
            onComplete: () => {
                this.scene.tweens.add({
                    targets: multiplierText,
                    y: y - 100,
                    alpha: 0,
                    duration: 500,
                    ease: 'Power2',
                    onComplete: () => {
                        multiplierText.destroy();
                    }
                });
            }
        });
        
        this.multiplierTexts.push(multiplierText);
    }
    
    cleanup() {
        // Clean up active effects
        this.activeEffects.forEach(effect => {
            if (effect && !effect.destroyed) {
                effect.destroy();
            }
        });
        this.activeEffects = [];
        
        // Clean up multiplier texts
        this.multiplierTexts.forEach(text => {
            if (text && !text.destroyed) {
                text.destroy();
            }
        });
        this.multiplierTexts = [];
    }
    
    destroy() {
        this.cleanup();
    }
};
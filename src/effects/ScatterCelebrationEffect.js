/**
 * ScatterCelebrationEffect.js
 * 
 * Handles the big scatter symbol celebration animation when 4+ scatters trigger free spins.
 * Displays the ui_gem_scatter_big animation at each scatter position with:
 * - 1.5x scale enlargement
 * - Pulse visual effect
 * - Blinking effect
 */

class ScatterCelebrationEffect {
    constructor(scene) {
        this.scene = scene;
        this.activeEffects = [];
    }

    /**
     * Play scatter celebration animations at all scatter positions
     * @param {Array} scatterPositions - Array of {col, row} positions with scatter symbols
     * @param {Function} onComplete - Callback when all animations complete
     */
    async playAtPositions(scatterPositions, onComplete = null) {
        if (!scatterPositions || scatterPositions.length === 0) {
            console.warn('ScatterCelebrationEffect: No scatter positions provided');
            if (onComplete) onComplete();
            return;
        }

        console.log(`✨ Playing scatter celebration at ${scatterPositions.length} positions:`, scatterPositions);

        // Check if animation exists
        if (!this.scene.anims.exists('ui_gem_scatter_big')) {
            console.warn('ScatterCelebrationEffect: ui_gem_scatter_big animation not found');
            if (onComplete) onComplete();
            return;
        }

        const promises = [];

        // Create animation sprite at each scatter position
        scatterPositions.forEach((pos, index) => {
            const promise = this.createScatterEffect(pos, index);
            if (promise) {
                promises.push(promise);
            }
        });

        // Wait for all animations to complete
        if (promises.length > 0) {
            await Promise.all(promises);
        }

        console.log('✅ All scatter celebrations completed');
        
        if (onComplete) {
            onComplete();
        }
    }

    /**
     * Create a single scatter celebration effect at a grid position
     * @param {Object} pos - Position {col, row}
     * @param {Number} index - Index for staggered animation start
     * @returns {Promise}
     */
    createScatterEffect(pos, index = 0) {
        return new Promise((resolve) => {
            // Get world position from grid coordinates
            const worldPos = this.getWorldPosition(pos.col, pos.row);
            
            if (!worldPos) {
                console.warn(`ScatterCelebrationEffect: Invalid position for scatter at col=${pos.col}, row=${pos.row}`);
                resolve();
                return;
            }

            console.log(`✨ Creating scatter effect #${index} at grid[${pos.col}][${pos.row}] -> world(${worldPos.x}, ${worldPos.y})`);

            // Hide the original scatter symbol at this position to prevent overlap
            let originalSymbol = null;
            if (this.scene.gridManager && this.scene.gridManager.grid) {
                try {
                    originalSymbol = this.scene.gridManager.grid[pos.col]?.[pos.row];
                    if (originalSymbol && originalSymbol.setVisible) {
                        originalSymbol.setVisible(false);
                        console.log(`  Hidden original scatter symbol at [${pos.col}][${pos.row}]`);
                    }
                } catch (e) {
                    console.warn('Could not hide original scatter symbol:', e);
                }
            }

            // Create the box frame (background)
            let boxFrame = null;
            if (this.scene.textures.exists('ui_gem_scatter_box')) {
                boxFrame = this.scene.add.image(worldPos.x, worldPos.y, 'ui_gem_scatter_box');
                const boxScale = 1.1; // Same scale as sprite
                boxFrame.setScale(boxScale);
                boxFrame.setDepth(window.GameConfig?.UI_DEPTHS?.OVERLAY_HIGH || 5000);
                boxFrame.setAlpha(1);
                this.activeEffects.push(boxFrame);
                console.log(`  Created box frame at position`);
            } else {
                console.warn('ui_gem_scatter_box texture not found');
            }

            // Create the sprite animation (foreground)
            const sprite = this.scene.add.sprite(worldPos.x, worldPos.y, 'ui_gem_scatter_big');
            
            // Set initial properties
            const baseScale = 1.1; // 1.1x larger than normal
            sprite.setScale(baseScale);
            // Place sprite above the box frame
            sprite.setDepth((window.GameConfig?.UI_DEPTHS?.OVERLAY_HIGH || 5000) + 1);
            sprite.setAlpha(1);
            
            this.activeEffects.push(sprite);

            // Add stagger delay based on index
            const staggerDelay = index * 50; // 50ms between each scatter animation

            this.scene.time.delayedCall(staggerDelay, () => {
                // Play the animation
                sprite.play('ui_gem_scatter_big');

                // Add pulse effect to both box and sprite
                if (boxFrame) {
                    this.addPulseEffect(boxFrame, 1.2);
                }
                this.addPulseEffect(sprite, baseScale);

                // Add blinking effect (alpha oscillation)
                this.addBlinkingEffect(sprite);

                // Clean up when animation completes
                sprite.once('animationcomplete', () => {
                    // Restore original symbol visibility
                    if (originalSymbol && originalSymbol.setVisible) {
                        originalSymbol.setVisible(true);
                        console.log(`  Restored original scatter symbol at [${pos.col}][${pos.row}]`);
                    }
                    
                    // Clean up box and sprite
                    if (boxFrame) {
                        this.cleanupEffect(boxFrame);
                    }
                    this.cleanupEffect(sprite);
                    resolve();
                });

                // Safety timeout in case animation doesn't complete
                this.scene.time.delayedCall(2000, () => {
                    if (sprite && sprite.active) {
                        console.warn('ScatterCelebrationEffect: Animation timeout, forcing cleanup');
                        // Restore original symbol
                        if (originalSymbol && originalSymbol.setVisible) {
                            originalSymbol.setVisible(true);
                        }
                        if (boxFrame) {
                            this.cleanupEffect(boxFrame);
                        }
                        this.cleanupEffect(sprite);
                        resolve();
                    }
                });
            });
        });
    }

    /**
     * Add pulse effect to a sprite (scale oscillation)
     * @param {Phaser.GameObjects.Sprite} sprite
     * @param {Number} baseScale - Base scale to pulse from/to
     */
    addPulseEffect(sprite, baseScale) {
        // Pulse between baseScale and baseScale * 1.2
        this.scene.tweens.add({
            targets: sprite,
            scaleX: baseScale * 1.2,
            scaleY: baseScale * 1.2,
            duration: 300,
            yoyo: true,
            repeat: 2, // Pulse 3 times total (repeat 2 = 3 cycles)
            ease: 'Sine.easeInOut'
        });
    }

    /**
     * Add blinking effect to a sprite (alpha oscillation)
     * @param {Phaser.GameObjects.Sprite} sprite
     */
    addBlinkingEffect(sprite) {
        // Blink by oscillating alpha
        this.scene.tweens.add({
            targets: sprite,
            alpha: 0.3,
            duration: 200,
            yoyo: true,
            repeat: 3, // Blink 4 times total (repeat 3 = 4 cycles)
            ease: 'Linear'
        });
    }

    /**
     * Get world position from grid coordinates
     * @param {Number} col - Column index
     * @param {Number} row - Row index
     * @returns {Object|null} - {x, y} world position or null if invalid
     */
    getWorldPosition(col, row) {
        // Try to get position from GridManager (correct method name: getSymbolPosition)
        if (this.scene.gridManager && typeof this.scene.gridManager.getSymbolPosition === 'function') {
            return this.scene.gridManager.getSymbolPosition(col, row);
        }

        // Fallback: calculate position manually
        const SYMBOL_SIZE = window.GameConfig?.SYMBOL_SIZE || 120;
        const GRID_OFFSET_X = window.GameConfig?.GRID_OFFSET_X || 300;
        const GRID_OFFSET_Y = window.GameConfig?.GRID_OFFSET_Y || 100;

        return {
            x: GRID_OFFSET_X + col * SYMBOL_SIZE + SYMBOL_SIZE / 2,
            y: GRID_OFFSET_Y + row * SYMBOL_SIZE + SYMBOL_SIZE / 2
        };
    }

    /**
     * Clean up a scatter effect sprite
     * @param {Phaser.GameObjects.Sprite} sprite
     */
    cleanupEffect(sprite) {
        if (!sprite) return;

        // Remove from active effects
        const index = this.activeEffects.indexOf(sprite);
        if (index > -1) {
            this.activeEffects.splice(index, 1);
        }

        // Stop all tweens on this sprite
        this.scene.tweens.killTweensOf(sprite);

        // Fade out and destroy
        this.scene.tweens.add({
            targets: sprite,
            alpha: 0,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
                if (sprite && sprite.destroy) {
                    sprite.destroy();
                }
            }
        });
    }

    /**
     * Clean up all active effects
     */
    destroyAll() {
        this.activeEffects.forEach(sprite => {
            if (sprite && sprite.destroy) {
                this.scene.tweens.killTweensOf(sprite);
                sprite.destroy();
            }
        });
        this.activeEffects = [];
    }

    /**
     * Destroy this effect manager
     */
    destroy() {
        this.destroyAll();
        this.scene = null;
    }
}

// Make it globally available
if (typeof window !== 'undefined') {
    window.ScatterCelebrationEffect = ScatterCelebrationEffect;
}


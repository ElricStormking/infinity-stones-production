// UI Manager - handles all UI creation and updates for the game
window.UIManager = class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.uiElements = {};
    }
    
    createUI() {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        
        // Scale factor for UI elements (matching Phaser Editor scene)
        const uiScale = 0.67;
        
        // Create UI elements based on Phaser Editor scene positioning
        // Adjusted for 1920x1080 resolution (original was 1280x720)
        const scaleX = width / 1280;
        const scaleY = height / 720;
        
        // Helper function to safely create UI elements
        const safeCreateImage = (x, y, key, scale = uiScale) => {
            try {
                if (this.scene.textures.exists(key)) {
                    const image = this.scene.add.image(x * scaleX, y * scaleY, key);
                    image.setScale(scale * scaleX, scale * scaleY);
                    return image;
                } else {
                    console.warn(`Texture ${key} not found, skipping`);
                    return null;
                }
            } catch (error) {
                console.warn(`Failed to create image ${key}:`, error);
                return null;
            }
        };
        
        // Background elements
        this.ui_bg = safeCreateImage(640, 361, 'bg_infinity_storm');
        if (this.ui_bg) this.ui_bg.setDepth(window.GameConfig.UI_DEPTHS.BACKGROUND);
        
        // Character portraits
        this.createCharacterPortraits(scaleX, scaleY);
        
        // Bottom panel
        this.ui_bottom_panel = safeCreateImage(633, 685, 'ui_bottom_panel');
        if (this.ui_bottom_panel) this.ui_bottom_panel.setDepth(window.GameConfig.UI_DEPTHS.BOTTOM_PANEL);
        
        // Grid frame (ui_plane)
        this.ui_plane = safeCreateImage(650, 327, 'ui_box');
        if (this.ui_plane) this.ui_plane.setDepth(window.GameConfig.UI_DEPTHS.FRAME); // bring frame above symbols

        // Grid background image just behind symbol layer
        this.ui_grid_bg = safeCreateImage(650, 327, 'ui_boxBG');
        if (this.ui_grid_bg) this.ui_grid_bg.setDepth(window.GameConfig.UI_DEPTHS.GRID_BG);
        
        // Title
        this.ui_title = safeCreateImage(650, 44, 'ui_title');
        if (this.ui_title) this.ui_title.setDepth(window.GameConfig.UI_DEPTHS.TITLE); // title on top of frame
        
        // Top elements removed (ui_top not used currently)
        this.ui_top_1 = this.ui_top_2 = this.ui_top_3 = this.ui_top_4 = null;
        
        // Free game indicator
        this.ui_freegame = safeCreateImage(168, 549, 'ui_freegame');
        if (this.ui_freegame) {
            this.ui_freegame.setDepth(3);
            this.ui_freegame.setVisible(false); // Initially hidden
        }
        
        // Number displays
        this.ui_number_score = safeCreateImage(250, 675, 'ui_number_score');
        this.ui_number_win = safeCreateImage(561, 675, 'ui_number_win');
        this.ui_number_bet = safeCreateImage(931, 675, 'ui_number_bet');
        [this.ui_number_score, this.ui_number_win, this.ui_number_bet].forEach(display => {
            if (display) display.setDepth(window.GameConfig.UI_DEPTHS.NUMBER_PANEL);
        });
        
        // Create buttons
        this.createButtons(scaleX, scaleY, uiScale);
        
        // Create text overlays
        this.createTextOverlays(scaleX, scaleY);
        
        // Create auto spin counter text overlay
        this.createAutoSpinCounterText(scaleX, scaleY);
        
        // Store UI elements for easy access
        this.uiElements = {
            bg: this.ui_bg,
            portraits: {
                scarletWitch: this.portrait_scarlet_witch,
                thanos: this.portrait_thanos
            },
            panels: {
                bottom: this.ui_bottom_panel,
                plane: this.ui_plane,
                title: this.ui_title,
                freegame: this.ui_freegame,
                accumulatedMultiplier: this.ui_accumulated_multiplier
            },
            buttons: {
                spin: this.ui_spin,
                stop: this.ui_small_stop,
                burst: this.ui_small_burst,
                menu: this.ui_small_menu,
                betMinus: this.ui_number_bet_minus,
                betPlus: this.ui_number_bet_plus
            },
            displays: {
                score: this.ui_number_score,
                win: this.ui_number_win,
                bet: this.ui_number_bet
            },
            texts: {
                balance: this.balanceText,
                win: this.winText,
                bet: this.betText,
                accumulatedMultiplier: this.accumulatedMultiplierText,
                freeSpins: this.freeSpinsText,
                autoSpinCounter: this.autoSpinCounterText
            }
        };
        
        // Add hover effects to interactive elements
        this.addButtonHoverEffects();
        
        // Create fallback buttons if UI images failed to load
        this.createFallbackButtons();
        
        return this.uiElements;
    }
    
    createCharacterPortraits(scaleX, scaleY) {
        // Create animated Scarlet Witch portrait sprite
        try {
            const hasIdleAnimation = this.scene.anims.exists('scarlet_witch_idle_animation');
            const hasAttackAnimation = this.scene.anims.exists('scarlet_witch_attack_animation');
            const hasFirstFrame = this.scene.textures.exists('redwitch-idle2_32');
            
            console.log(`Scarlet Witch setup - Idle animation exists: ${hasIdleAnimation}, Attack animation exists: ${hasAttackAnimation}, First frame exists: ${hasFirstFrame}`);
            
            if (hasIdleAnimation && hasFirstFrame) {
                this.portrait_scarlet_witch = this.scene.add.sprite(1123 * scaleX, 320 * scaleY, 'redwitch-idle2_32');
                this.portrait_scarlet_witch.setScale(0.4464 * scaleX * 1.05, 0.4464 * scaleY * 1.05);
                this.portrait_scarlet_witch.setDepth(window.GameConfig.UI_DEPTHS.PORTRAIT);
                
                // Set reference on scene for BonusManager access
                this.scene.portrait_scarlet_witch = this.portrait_scarlet_witch;
                
                try {
                    this.portrait_scarlet_witch.play('scarlet_witch_idle_animation');
                    console.log('✓ Scarlet Witch sprite created and idle animation started successfully');
                } catch (animError) {
                    console.error('✗ Failed to start Scarlet Witch animation:', animError);
                }
            } else {
                console.warn(`Scarlet Witch animation not available - Idle animation exists: ${hasIdleAnimation}, First frame exists: ${hasFirstFrame}`);
                
                if (hasFirstFrame) {
                    this.portrait_scarlet_witch = this.scene.add.sprite(1123 * scaleX, 320 * scaleY, 'redwitch-idle2_32');
                    this.portrait_scarlet_witch.setScale(0.4464 * scaleX * 1.05, 0.4464 * scaleY * 1.05);
                    this.portrait_scarlet_witch.setDepth(window.GameConfig.UI_DEPTHS.PORTRAIT);
                    console.log('✓ Created Scarlet Witch as sprite with first frame (no animation)');
                } else {
                    this.portrait_scarlet_witch = this.safeCreateImage(1123, 320, 'portrait_scarlet_witch', 0.4464);
                    if (this.portrait_scarlet_witch) {
                        this.portrait_scarlet_witch.setScale(0.4464 * scaleX * 1.05, 0.4464 * scaleY * 1.05);
                        this.portrait_scarlet_witch.setDepth(window.GameConfig.UI_DEPTHS.PORTRAIT);
                        console.log('✓ Created Scarlet Witch as static image fallback');
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to create animated Scarlet Witch portrait:', error);
            this.portrait_scarlet_witch = this.safeCreateImage(1123, 320, 'portrait_scarlet_witch', 0.4464);
            if (this.portrait_scarlet_witch) {
                this.portrait_scarlet_witch.setScale(0.4464 * scaleX * 1.05, 0.4464 * scaleY * 1.05);
                this.portrait_scarlet_witch.setDepth(window.GameConfig.UI_DEPTHS.PORTRAIT);
            }
        }
        
        // Create animated Thanos portrait sprite
        try {
            const hasIdleAnimation = this.scene.anims.exists('thanos_idle_animation');
            const hasAttackAnimation = this.scene.anims.exists('thanos_attack_animation');
            const hasFirstFrame = this.scene.textures.exists('thanos-idle_00');
            
            console.log(`Thanos setup - Idle animation exists: ${hasIdleAnimation}, Attack animation exists: ${hasAttackAnimation}, First frame exists: ${hasFirstFrame}`);
            
            if (hasIdleAnimation && hasFirstFrame) {
                this.portrait_thanos = this.scene.add.sprite(221 * scaleX, 380 * scaleY, 'thanos-idle_00');
                this.portrait_thanos.setScale(0.56 * scaleX * 1.05, 0.56 * scaleY * 1.05);
                this.portrait_thanos.setDepth(window.GameConfig.UI_DEPTHS.PORTRAIT);
                
                // Set reference on scene for BonusManager access
                this.scene.portrait_thanos = this.portrait_thanos;
                
                try {
                    this.portrait_thanos.play('thanos_idle_animation');
                    console.log('✓ Thanos sprite created and idle animation started successfully');
                } catch (animError) {
                    console.error('✗ Failed to start Thanos animation:', animError);
                }
            } else {
                console.warn(`Thanos animation not available - Idle animation exists: ${hasIdleAnimation}, First frame exists: ${hasFirstFrame}`);
                
                if (hasFirstFrame) {
                    this.portrait_thanos = this.scene.add.sprite(221 * scaleX, 380 * scaleY, 'thanos-idle_00');
                    this.portrait_thanos.setScale(0.56 * scaleX * 1.05, 0.56 * scaleY * 1.05);
                    this.portrait_thanos.setDepth(window.GameConfig.UI_DEPTHS.PORTRAIT);
                    console.log('✓ Created Thanos as sprite with first frame (no animation)');
                } else {
                    this.portrait_thanos = this.safeCreateImage(221, 380, 'portrait_thanos', 0.56);
                    if (this.portrait_thanos) {
                        this.portrait_thanos.setScale(0.56 * scaleX * 1.05, 0.56 * scaleY * 1.05);
                        this.portrait_thanos.setDepth(window.GameConfig.UI_DEPTHS.PORTRAIT);
                        console.log('✓ Created Thanos as static image fallback');
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to create animated Thanos portrait:', error);
            this.portrait_thanos = this.safeCreateImage(221, 380, 'portrait_thanos', 0.56);
            if (this.portrait_thanos) {
                this.portrait_thanos.setScale(0.56 * scaleX * 1.05, 0.56 * scaleY * 1.05);
                this.portrait_thanos.setDepth(window.GameConfig.UI_DEPTHS.PORTRAIT);
            }
        }
    }
    
    createButtons(scaleX, scaleY, uiScale) {
        // Bet adjustment buttons
        this.ui_number_bet_minus = this.safeCreateImage(830, 675, 'ui_number_bet-');
        if (this.ui_number_bet_minus) {
            this.ui_number_bet_minus.setDepth(window.GameConfig.UI_DEPTHS.NUMBER_PANEL);
            this.ui_number_bet_minus.setInteractive();
            this.ui_number_bet_minus.on('pointerdown', () => this.scene.adjustBet(-1));
        }
        
        this.ui_number_bet_plus = this.safeCreateImage(1034, 675, 'ui_number_bet+');
        if (this.ui_number_bet_plus) {
            this.ui_number_bet_plus.setDepth(window.GameConfig.UI_DEPTHS.NUMBER_PANEL);
            this.ui_number_bet_plus.setInteractive();
            this.ui_number_bet_plus.on('pointerdown', () => this.scene.adjustBet(1));
        }
        
        // Control buttons - spin button as animated sprite
        let spinSpriteKey = 'ui_buttonloop_sprite';
        if (!this.scene.textures.exists(spinSpriteKey)) {
            console.warn('ui_buttonloop_sprite not found, using fallback');
            spinSpriteKey = 'ui_spin';
        }
        
        this.ui_spin = this.scene.add.sprite(1161 * scaleX, 636 * scaleY, spinSpriteKey);
        if (this.ui_spin) {
            this.ui_spin.setScale(uiScale * scaleX, uiScale * scaleY);
            this.ui_spin.setDepth(window.GameConfig.UI_DEPTHS.BUTTON);
            this.ui_spin.setInteractive();
            this.ui_spin.on('pointerdown', () => this.scene.handleSpinButtonClick());
            this.ui_spin.setFrame(0);
            
            // Store original scale values to prevent accumulation bugs
            this.ui_spin.originalScaleX = uiScale * scaleX;
            this.ui_spin.originalScaleY = uiScale * scaleY;
        }
        
        this.ui_small_stop = this.safeCreateImage(1038, 578, 'ui_small_stop');
        if (this.ui_small_stop) {
            this.ui_small_stop.setDepth(window.GameConfig.UI_DEPTHS.BUTTON);
            this.ui_small_stop.setInteractive();
            this.ui_small_stop.on('pointerdown', () => this.scene.toggleAutoplay());
        }
        
        this.ui_small_burst = this.safeCreateImage(1102, 512, 'ui_small_burst');
        if (this.ui_small_burst) {
            this.ui_small_burst.setDepth(window.GameConfig.UI_DEPTHS.BUTTON);
            this.ui_small_burst.setInteractive();
            this.ui_small_burst.on('pointerup', () => {
                // Add cooldown to prevent double-triggering
                if (!this.burstButtonCooldown) {
                    this.burstButtonCooldown = true;
                    this.scene.toggleBurstMode();
                    // Reset cooldown after 500ms
                    this.scene.time.delayedCall(500, () => {
                        this.burstButtonCooldown = false;
                    });
                }
            });
        }
        
        this.ui_small_menu = this.safeCreateImage(1182, 499, 'ui_small_menu');
        if (this.ui_small_menu) {
            this.ui_small_menu.setDepth(window.GameConfig.UI_DEPTHS.BUTTON);
            this.ui_small_menu.setInteractive();
            this.ui_small_menu.on('pointerdown', () => this.scene.showPurchaseUI());
        }
        
        // Accumulated multiplier indicator
        const accumulatedMultiplierX = 977;
        const accumulatedMultiplierY = 102;
        this.ui_accumulated_multiplier = this.safeCreateImage(accumulatedMultiplierX, accumulatedMultiplierY, 'ui_accumulated_multiplier');
        if (this.ui_accumulated_multiplier) {
            this.ui_accumulated_multiplier.setDepth(window.GameConfig.UI_DEPTHS.MULTIPLIER_TEXT);
            this.ui_accumulated_multiplier.setVisible(false);
        }
    }
    
    createTextOverlays(scaleX, scaleY) {
        // Text overlays for values
        this.balanceText = this.scene.add.text(250 * scaleX, 675 * scaleY, `$${this.scene.stateManager.gameData.balance.toFixed(2)}`, {
            fontSize: Math.floor(18 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Bold',
            color: '#FFD700',
            align: 'center'
        });
        this.balanceText.setOrigin(0.5);
        this.balanceText.setDepth(window.GameConfig.UI_DEPTHS.TEXT_OVERLAY);
        
        this.winText = this.scene.add.text(561 * scaleX, 675 * scaleY, '$0.00', {
            fontSize: Math.floor(18 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Bold',
            color: '#00FF00',
            align: 'center'
        });
        this.winText.setOrigin(0.5);
        this.winText.setDepth(window.GameConfig.UI_DEPTHS.TEXT_OVERLAY);

        // Top-center winning amount visual (inside the plaque on the frame)
        // Position tuned for the 1280x720 design; scaled at runtime
        this.winTopText = this.scene.add.text(650 * scaleX, 50 * scaleY, '', {
            fontSize: Math.floor(28 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        });
        this.winTopText.setOrigin(0.5);
        this.winTopText.setDepth(window.GameConfig.UI_DEPTHS.TEXT_OVERLAY);
        this.winTopText.setVisible(false);
        // Save original scale to avoid accumulation during tweens
        this.winTopText.originalScaleX = this.winTopText.scaleX;
        this.winTopText.originalScaleY = this.winTopText.scaleY;
        
        this.betText = this.scene.add.text(931 * scaleX, 675 * scaleY, `$${this.scene.stateManager.gameData.currentBet.toFixed(2)}`, {
            fontSize: Math.floor(18 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Bold',
            color: '#FFFFFF',
            align: 'center'
        });
        this.betText.setOrigin(0.5);
        this.betText.setDepth(window.GameConfig.UI_DEPTHS.TEXT_OVERLAY);
        
        // Create accumulated multiplier text
        if (this.ui_accumulated_multiplier) {
            this.accumulatedMultiplierText = this.scene.add.text(
                this.ui_accumulated_multiplier.x, 
                this.ui_accumulated_multiplier.y, 
                'x1', 
                {
                    fontSize: Math.floor(24 * Math.min(scaleX, scaleY)) + 'px',
                    fontFamily: 'Arial Black',
                    color: '#FFD700',
                    stroke: '#000000',
                    strokeThickness: 3
                }
            );
            this.accumulatedMultiplierText.setOrigin(0.5);
            this.accumulatedMultiplierText.setDepth(window.GameConfig.UI_DEPTHS.MULTIPLIER_TEXT);
            this.accumulatedMultiplierText.setVisible(false);
        }
    }
    
    createAutoSpinCounterText(scaleX, scaleY) {
        // Create auto spin counter text overlay on top of the spin button
        if (this.ui_spin) {
            this.autoSpinCounterText = this.scene.add.text(
                this.ui_spin.x, 
                this.ui_spin.y, 
                '', 
                {
                    fontSize: Math.floor(16 * Math.min(scaleX, scaleY)) + 'px',
                    fontFamily: 'Arial Black',
                    color: '#FFD700',
                    stroke: '#000000',
                    strokeThickness: 3,
                    align: 'center'
                }
            );
            this.autoSpinCounterText.setOrigin(0.5);
            this.autoSpinCounterText.setDepth(window.GameConfig.UI_DEPTHS.TEXT_OVERLAY);
            this.autoSpinCounterText.setVisible(false); // Initially hidden
        }
    }
    
    safeCreateImage(x, y, key, scale = 0.67) {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        const scaleX = width / 1280;
        const scaleY = height / 720;
        
        try {
            if (this.scene.textures.exists(key)) {
                const image = this.scene.add.image(x * scaleX, y * scaleY, key);
                image.setScale(scale * scaleX, scale * scaleY);
                return image;
            } else {
                console.warn(`Texture ${key} not found, skipping`);
                return null;
            }
        } catch (error) {
            console.warn(`Failed to create image ${key}:`, error);
            return null;
        }
    }
    
    addButtonHoverEffects() {
        const interactiveElements = [
            this.ui_small_stop,
            this.ui_small_burst,
            this.ui_small_menu,
            this.ui_number_bet_minus,
            this.ui_number_bet_plus
        ];
        
        interactiveElements.forEach(element => {
            if (element) {
                // Store original scale values to prevent accumulation bugs
                element.originalScaleX = element.scaleX;
                element.originalScaleY = element.scaleY;
                
                element.on('pointerover', () => {
                    // Use original scale * 1.1 to prevent accumulation bugs
                    element.setScale(element.originalScaleX * 1.1, element.originalScaleY * 1.1);
                    element.setTint(0xFFFFFF);
                });
                
                element.on('pointerout', () => {
                    // Reset to original scale to prevent accumulation bugs
                    element.setScale(element.originalScaleX, element.originalScaleY);
                    element.clearTint();
                });
            }
        });
        
        // Special hover effect for spin button (sprite)
        if (this.ui_spin) {
            this.ui_spin.on('pointerover', () => {
                if (!this.scene.isSpinning) {
                    // Use original scale * 1.1 to prevent accumulation bugs
                    this.ui_spin.setScale(this.ui_spin.originalScaleX * 1.1, this.ui_spin.originalScaleY * 1.1);
                    this.ui_spin.setTint(0xFFFFFF);
                }
            });
            
            this.ui_spin.on('pointerout', () => {
                if (!this.scene.isSpinning) {
                    // Reset to original scale to prevent accumulation bugs
                    this.ui_spin.setScale(this.ui_spin.originalScaleX, this.ui_spin.originalScaleY);
                    this.ui_spin.clearTint();
                }
            });
        }
    }
    
    createFallbackButtons() {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        
        // Only create fallback buttons if the main UI elements failed to load
        if (!this.ui_spin) {
            console.log('Creating fallback SPIN button');
            this.scene.fallbackSpinButton = this.scene.createButton(width / 2, height - 100, 'SPIN', () => this.scene.handleSpinButtonClick());
        }
        
        if (!this.ui_number_bet_minus || !this.ui_number_bet_plus) {
            console.log('Creating fallback bet adjustment buttons');
            this.scene.fallbackMinusButton = this.scene.createSmallButton(width / 2 - 150, height - 100, '-', () => this.scene.adjustBet(-1));
            this.scene.fallbackPlusButton = this.scene.createSmallButton(width / 2 + 150, height - 100, '+', () => this.scene.adjustBet(1));
        }
        
        if (!this.ui_small_menu) {
            console.log('Creating fallback MENU button');
            this.scene.fallbackMenuButton = this.scene.createSmallButton(100, height - 50, 'MENU', () => {
                this.scene.sound.stopAll();
                this.scene.scene.start('MenuScene');
            });
        }
        
        if (!this.ui_small_burst) {
            console.log('Creating fallback BURST button');
            this.scene.fallbackBurstButton = this.scene.createSmallButton(width - 100, height - 50, 'BURST', () => {
                // Add cooldown to prevent double-triggering
                if (!this.burstButtonCooldown) {
                    this.burstButtonCooldown = true;
                    this.scene.toggleBurstMode();
                    // Reset cooldown after 500ms
                    this.scene.time.delayedCall(500, () => {
                        this.burstButtonCooldown = false;
                    });
                }
            });
        }
    }
    
    // Update methods
    updateBalanceDisplay() {
        if (this.balanceText) {
            this.balanceText.setText(`$${this.scene.stateManager.gameData.balance.toFixed(2)}`);
        }
    }
    
    updateWinDisplay() {
        if (this.winText) {
            this.winText.setText(`$${this.scene.totalWin.toFixed(2)}`);
        }

        // Mirror win amount to the top-center visual, show only when > 0
        if (this.winTopText) {
            const amount = this.scene.totalWin;
            if (amount > 0) {
                this.winTopText.setText(`$${amount.toFixed(2)}`);
                this.winTopText.setVisible(true);

                // brief pulse to draw attention without changing layout
                this.winTopText.setScale(this.winTopText.originalScaleX, this.winTopText.originalScaleY);
                this.scene.tweens.add({
                    targets: this.winTopText,
                    scaleX: this.winTopText.originalScaleX * 1.12,
                    scaleY: this.winTopText.originalScaleY * 1.12,
                    duration: 180,
                    yoyo: true,
                    ease: 'Power2'
                });
            } else {
                this.winTopText.setVisible(false);
            }
        }
    }
    
    updateBetDisplay() {
        if (this.betText) {
            this.betText.setText(`$${this.scene.stateManager.gameData.currentBet.toFixed(2)}`);
        }
    }
    
    updateFreeSpinsDisplay() {
        const freeSpinsData = this.scene.stateManager.freeSpinsData;
        if (freeSpinsData.active) {
            // Show the free game UI element
            if (this.ui_freegame) {
                this.ui_freegame.setVisible(true);
            }
            
            // Show accumulated multiplier display
            if (this.ui_accumulated_multiplier) {
                this.ui_accumulated_multiplier.setVisible(true);
            }
            if (this.accumulatedMultiplierText) {
                this.accumulatedMultiplierText.setText(`x${freeSpinsData.multiplierAccumulator}`);
                this.accumulatedMultiplierText.setVisible(true);
            }
            
            // Create or update free spins text overlay
            if (!this.freeSpinsText) {
                const width = this.scene.cameras.main.width;
                const height = this.scene.cameras.main.height;
                const scaleX = width / 1280;
                const scaleY = height / 720;
                
                this.freeSpinsText = this.scene.add.text(168 * scaleX, 549 * scaleY, '', {
                    fontSize: Math.floor(16 * Math.min(scaleX, scaleY)) + 'px',
                    fontFamily: 'Arial Bold',
                    color: '#FFD700',
                    align: 'center'
                });
                this.freeSpinsText.setOrigin(0.5);
                this.freeSpinsText.setDepth(4);
            }
            
            this.freeSpinsText.setText(`FREE SPINS: ${freeSpinsData.count}`);
            this.freeSpinsText.setVisible(true);
        } else {
            // Hide the free game UI element
            if (this.ui_freegame) {
                this.ui_freegame.setVisible(false);
            }
            if (this.freeSpinsText) {
                this.freeSpinsText.setVisible(false);
            }
            
            // Hide accumulated multiplier display
            if (this.ui_accumulated_multiplier) {
                this.ui_accumulated_multiplier.setVisible(false);
            }
            if (this.accumulatedMultiplierText) {
                this.accumulatedMultiplierText.setVisible(false);
            }
        }
    }
    
    updateAccumulatedMultiplierDisplay() {
        if (this.accumulatedMultiplierText && this.scene.stateManager.freeSpinsData.active) {
            const multiplier = this.scene.stateManager.freeSpinsData.multiplierAccumulator;
            this.accumulatedMultiplierText.setText(`x${multiplier}`);
            
            // Add a pulse animation when multiplier increases
            this.scene.tweens.add({
                targets: [this.ui_accumulated_multiplier, this.accumulatedMultiplierText],
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 200,
                yoyo: true,
                ease: 'Power2'
            });
        }
    }
    
    updateAutoSpinCounterDisplay() {
        if (this.autoSpinCounterText && this.scene.stateManager) {
            const autoplayData = this.scene.stateManager.gameData;
            
            if (autoplayData.autoplayActive) {
                if (autoplayData.autoplayCount === -1) {
                    // Infinite autoplay
                    this.autoSpinCounterText.setText('∞');
                } else if (autoplayData.autoplayCount > 0) {
                    // Show remaining spins count
                    this.autoSpinCounterText.setText(autoplayData.autoplayCount.toString());
                } else {
                    // No spins left, hide counter
                    this.autoSpinCounterText.setVisible(false);
                    return;
                }
                this.autoSpinCounterText.setVisible(true);
            } else {
                // Autoplay not active, hide counter
                this.autoSpinCounterText.setVisible(false);
            }
        }
    }
    
    setButtonsEnabled(enabled) {
        const buttons = [
            this.ui_small_stop,
            this.ui_small_burst,
            this.ui_small_menu,
            this.ui_number_bet_minus,
            this.ui_number_bet_plus
        ];
        
        buttons.forEach(button => {
            if (button) {
                button.setInteractive(enabled);
                button.setAlpha(enabled ? 1 : 0.5);
            }
        });
        
        // Handle spin button sprite separately
        if (this.ui_spin) {
            this.ui_spin.setInteractive(enabled);
            // Don't change alpha during spinning (animation running)
            if (!this.scene.isSpinning) {
                this.ui_spin.setAlpha(enabled ? 1 : 0.5);
            }
        }
        
        // Also handle fallback buttons
        const fallbackButtons = [
            this.scene.fallbackSpinButton,
            this.scene.fallbackMinusButton,
            this.scene.fallbackPlusButton,
            this.scene.fallbackMenuButton,
            this.scene.fallbackBurstButton
        ];
        
        fallbackButtons.forEach(button => {
            if (button) {
                button.setInteractive(enabled);
                button.setAlpha(enabled ? 1 : 0.5);
            }
        });
    }
    
    // Getters for UI elements
    getSpinButton() { return this.ui_spin; }
    getUIElements() { return this.uiElements; }
} 
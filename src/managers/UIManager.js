// UI Manager - handles all UI creation and updates for the game
window.UIManager = class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.uiElements = {};
        
        // Initialize wallet integration
        this.initializeWalletIntegration();
        
        // Transaction history state
        this.transactionHistoryContainer = null;
        this.isTransactionHistoryVisible = false;
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
        
        // Title / formula plaque
        this.ui_title = safeCreateImage(650, 44, 'ui_formula_plaque');
        if (this.ui_title) this.ui_title.setDepth(window.GameConfig.UI_DEPTHS.TITLE); // title on top of frame
        
        // Top elements removed (ui_top not used currently)
        this.ui_top_1 = this.ui_top_2 = this.ui_top_3 = this.ui_top_4 = null;
        
        // Free game indicator
        this.ui_freegame = safeCreateImage(168, 549, 'ui_freegame');
        if (this.ui_freegame) {
            this.ui_freegame.setDepth(window.GameConfig.UI_DEPTHS.FREE_SPINS);
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
        
        // Initialize server balance after UI creation
        this.initializeServerBalance();
        
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

            // Create spin button LIGHT FX sprite layered above spin button
            const lightKey = this.scene.textures.exists('button_light_sprite') ? 'button_light_sprite' : null;
            if (lightKey) {
                this.ui_spin_light = this.scene.add.sprite(this.ui_spin.x, this.ui_spin.y, lightKey);
                // Correct for differing spritesheet frame sizes (ui_buttonloop ~244px, light uses actual frame size)
                // Compute dynamically from the loaded texture frames to avoid hard-coded assumptions
                const lightTex = this.scene.textures.get('button_light_sprite');
                const firstFrame = lightTex && lightTex.frames && lightTex.frames.__BASE ? lightTex.frames.__BASE : null;
                const lightW = (firstFrame && firstFrame.width) ? firstFrame.width : 512;
                // Scale so the light ring is much larger (requested 7x over previous)
                this.ui_spin_light._scaleMultiplier = (244 / lightW) * 1.38 * 7;
                const applyLightScale = () => {
                    this.ui_spin_light.setScale(
                        this.ui_spin.scaleX * this.ui_spin_light._scaleMultiplier,
                        this.ui_spin.scaleY * this.ui_spin_light._scaleMultiplier
                    );
                };
                applyLightScale();
                // Keep utility to reuse on hover/resets
                this.ui_spin_light.applyScaleFromSpin = applyLightScale;
                this.ui_spin_light.setOrigin(0.5, 0.5);
                this.ui_spin_light.setDepth(window.GameConfig.UI_DEPTHS.BUTTON + 1);
                this.ui_spin_light.setBlendMode(Phaser.BlendModes.ADD);
                this.ui_spin_light.setVisible(false);

                // Ensure animation exists even if JSON parsing failed; create a fallback
                const ensureLightAnim = () => {
                    if (!this.scene.anims.exists('light_button_light') && this.scene.textures.exists('button_light_sprite')) {
                        try {
                            this.scene.anims.create({
                                key: 'light_button_light',
                                frames: this.scene.anims.generateFrameNumbers('button_light_sprite', { start: 0, end: 19 }),
                                frameRate: 24,
                                repeat: -1
                            });
                        } catch (_) {}
                    }
                };
                ensureLightAnim();

                // Keep the light locked to the spin button center each frame to prevent drift
                const syncSpinLight = () => {
                    if (!this.ui_spin || !this.ui_spin_light) return;
                    this.ui_spin_light.setPosition(this.ui_spin.x, this.ui_spin.y);
                    if (this.ui_spin_light.applyScaleFromSpin) this.ui_spin_light.applyScaleFromSpin();
                };
                this.ui_spin_light.on(Phaser.Animations.Events.ANIMATION_START, syncSpinLight);
                this.ui_spin_light.on(Phaser.Animations.Events.ANIMATION_UPDATE, syncSpinLight);
            }
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
        
        // Menu button opens settings overlay
        this.ui_small_menu = this.safeCreateImage(1182, 499, 'ui_small_menu');
        if (this.ui_small_menu) {
            this.ui_small_menu.setDepth(window.GameConfig.UI_DEPTHS.BUTTON);
            this.ui_small_menu.setInteractive({ useHandCursor: true });
            this.ui_small_menu.on('pointerdown', () => this.openSettingsUI());
        }

        // New: Free Game Purchase button on the left side of the scene
        this.ui_freegame_purchase = this.safeCreateImage(150, 530, 'ui_freegame_purchase', 0.6);
        if (this.ui_freegame_purchase) {
            this.ui_freegame_purchase.setDepth(window.GameConfig.UI_DEPTHS.BUTTON);
            this.ui_freegame_purchase.setInteractive({ useHandCursor: true });
            this.ui_freegame_purchase.on('pointerdown', () => this.scene.showPurchaseUI());
            // Overlay cost text on the purchase button (current bet x 100)
            const width = this.scene.cameras.main.width;
            const height = this.scene.cameras.main.height;
            const scaleX = width / 1280;
            const scaleY = height / 720;
            const fontSize = Math.floor(18 * Math.min(scaleX, scaleY));
            this.ui_freegame_purchase_text = this.scene.add.text(
                this.ui_freegame_purchase.x,
                this.ui_freegame_purchase.y + (40 * Math.min(scaleX, scaleY)),
                '',
                {
                    fontSize: fontSize + 'px',
                    fontFamily: 'Arial Black',
                    color: '#FFFFFF',
                    stroke: '#1B4F72',
                    strokeThickness: Math.max(2, Math.floor(fontSize * 0.18)),
                    align: 'center'
                }
            );
            this.ui_freegame_purchase_text.setOrigin(0.5);
            this.ui_freegame_purchase_text.setDepth((window.GameConfig.UI_DEPTHS.BUTTON || 0) + 1);
            this.updatePurchaseButtonCost();
        }
        
        // Accumulated multiplier indicator
        const accumulatedMultiplierX = 987;
        const accumulatedMultiplierY = 62;
        this.ui_accumulated_multiplier = this.safeCreateImage(accumulatedMultiplierX, accumulatedMultiplierY, 'ui_accumulated_multiplier');
        if (this.ui_accumulated_multiplier) {
            this.ui_accumulated_multiplier.setDepth(window.GameConfig.UI_DEPTHS.MULTIPLIER_TEXT);
            this.ui_accumulated_multiplier.setVisible(false);
        }
    }

    // Settings overlay
    openSettingsUI() {
        if (this.settingsContainer) {
            this.settingsContainer.setVisible(true);
            this.setButtonsEnabled(false);
            return;
        }
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        const scaleX = width / 1280;
        const scaleY = height / 720;
        const depth = 1800;

        // Container to group settings UI
        this.settingsContainer = this.scene.add.container(0, 0);
        this.settingsContainer.setDepth(depth);

        // Dim background using full-screen settings background if available
        let dim;
        if (this.scene.textures.exists('settings_ui_bg')) {
            dim = this.scene.add.image(width / 2, height / 2, 'settings_ui_bg');
            dim.setDisplaySize(width, height);
            dim.setAlpha(0.85);
        } else {
            dim = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
        }
        this.settingsContainer.add(dim);

        // Slim right-side column panel (visual backing for buttons)
        const columnWidth = 220 * scaleX;
        const column = this.scene.add.rectangle(width - columnWidth / 2, height / 2, columnWidth, height, 0x000000, 0.55);
        this.settingsContainer.add(column);

        // Example buttons (Rules, History) — display-only for now
        const makeIcon = (x, y, key, fallbackColor, label) => {
            let icon;
            if (this.scene.textures.exists(key)) {
                icon = this.scene.add.image(x, y, key);
                icon.setScale(0.55 * scaleX, 0.55 * scaleY);
            } else {
                icon = this.scene.add.rectangle(x, y, 180 * scaleX, 180 * scaleY, fallbackColor, 1);
                const t = this.scene.add.text(x, y, label, { fontSize: Math.floor(18 * Math.min(scaleX, scaleY)) + 'px', color: '#ffffff' });
                t.setOrigin(0.5);
                this.settingsContainer.add(t);
            }
            this.settingsContainer.add(icon);
            // Hover effect
            icon.setInteractive({ useHandCursor: true });
            icon.on('pointerover', () => {
                icon.setScale(icon.scaleX * 1.08, icon.scaleY * 1.08);
                icon.setTint(0xffffff);
            });
            icon.on('pointerout', () => {
                icon.setScale(icon.scaleX / 1.08, icon.scaleY / 1.08);
                icon.clearTint();
            });
            return icon;
        };

        // Position icons in a vertical stack on the right, similar to the screenshot
        const colX = width - columnWidth / 2;
        const startY = height / 2 - 100 * scaleY;
        const spacing = 120 * scaleY;

        const rulesBtn = makeIcon(colX, startY, 'settings_ui_rules', 0x3366AA, 'RULES');
        const historyBtn = makeIcon(colX, startY + spacing, 'settings_ui_history', 0xAAAA33, 'HISTORY');
        const settingsBtn = makeIcon(colX, startY + spacing * 2, 'settings_ui_settings', 0x888888, 'SETTINGS');

        // Audio toggles (moved from Title Menu)
        const togglesY = startY + spacing * 2 + 100 * scaleY;
        const labelStyle = { fontSize: Math.floor(20 * Math.min(scaleX, scaleY)) + 'px', fontFamily: 'Arial Black', color: '#FFD700' };
        const makeToggle = (y, label, getOn, onToggle) => {
            const container = this.scene.add.container(colX, y);
            const bg = this.scene.add.rectangle(0, 0, 180 * scaleX, 44 * scaleY, 0x6B46C1, 1);
            bg.setStrokeStyle(2, 0xffffff);
            const text = this.scene.add.text(0, 0, `${label}: ${getOn() ? 'ON' : 'OFF'}`, labelStyle);
            text.setOrigin(0.5);
            container.add([bg, text]);
            container.setSize(180 * scaleX, 44 * scaleY);
            container.setInteractive(new Phaser.Geom.Rectangle(-90 * scaleX, -22 * scaleY, 180 * scaleX, 44 * scaleY), Phaser.Geom.Rectangle.Contains);
            container.on('pointerup', () => {
                onToggle();
                text.setText(`${label}: ${getOn() ? 'ON' : 'OFF'}`);
                window.SafeSound.play(this.scene, 'click');
            });
            this.settingsContainer.add(container);
            return container;
        };

        // moved: Sound/Music toggles now live in the dedicated Settings panel
        // makeToggle(togglesY, 'SOUND', () => this.scene.stateManager.gameData.soundEnabled, () => {
        //     this.scene.stateManager.gameData.soundEnabled = !this.scene.stateManager.gameData.soundEnabled;
        // });
        // makeToggle(togglesY + 60 * scaleY, 'MUSIC', () => this.scene.stateManager.gameData.musicEnabled, () => {
        //     const gd = this.scene.stateManager.gameData;
        //     gd.musicEnabled = !gd.musicEnabled;
        //     if (gd.musicEnabled) {
        //         window.SafeSound.startMainBGM(this.scene);
        //     } else if (window.SafeSound.currentBGM) {
        //         try { window.SafeSound.currentBGM.stop(); } catch (_) {}
        //         window.SafeSound.currentBGM = null;
        //     }
        // });

        // Link settings icon to open the dedicated Settings panel
        if (settingsBtn) {
            settingsBtn.on('pointerup', () => {
                window.SafeSound.play(this.scene, 'click');
                this.openSettingsPanel();
            });
        }

        // Exit button
        let exitBtn;
        const exitY = startY + spacing * 3;
        if (this.scene.textures.exists('settings_ui_exit')) {
            exitBtn = this.scene.add.image(colX, exitY, 'settings_ui_exit');
            exitBtn.setScale(0.55 * scaleX, 0.55 * scaleY);
        } else {
            exitBtn = this.scene.add.rectangle(colX, exitY, 200 * scaleX, 60 * scaleY, 0xC0392B, 1);
            const exitText = this.scene.add.text(exitBtn.x, exitBtn.y, 'EXIT', {
                fontSize: Math.floor(24 * Math.min(scaleX, scaleY)) + 'px', color: '#ffffff'
            });
            exitText.setOrigin(0.5);
            this.settingsContainer.add(exitText);
        }
        exitBtn.setInteractive({ useHandCursor: true });
        exitBtn.on('pointerup', () => this.closeSettingsUI());
        this.settingsContainer.add(exitBtn);

        // Simple click handlers for rules/history (placeholder behaviour for now)
        if (rulesBtn) {
            rulesBtn.on('pointerup', () => {
                if (this.scene.showMessage) this.scene.showMessage('Rules coming soon');
            });
        }
        if (historyBtn) {
            historyBtn.on('pointerup', () => {
                window.SafeSound.play(this.scene, 'click');
                this.openTransactionHistory();
            });
        }

        // Block input behind settings, but avoid immediate auto-close (debounce)
        dim.setInteractive();
        this._settingsJustOpened = true;
        this.scene.time.delayedCall(200, () => { this._settingsJustOpened = false; });
        dim.on('pointerup', () => {
            if (this._settingsJustOpened) return;
            this.closeSettingsUI();
        });

        // Disable underlying buttons while open
        this.setButtonsEnabled(false);
    }

    closeSettingsUI() {
        if (this.settingsContainer) {
            this.settingsContainer.destroy();
            this.settingsContainer = null;
        }
        // Re-enable gameplay UI
        this.setButtonsEnabled(true);
    }
    
    // Dedicated Settings panel with Sound/Music toggles
    openSettingsPanel() {
        if (this.settingsPanel) {
            this.settingsPanel.setVisible(true);
            return;
        }
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        const scaleX = width / 1280;
        const scaleY = height / 720;
        const depth = 2000;

        this.settingsPanel = this.scene.add.container(0, 0);
        this.settingsPanel.setDepth(depth);

        // Panel background image if available, else a rectangle
        let panel;
        if (this.scene.textures.exists('settings_ui_panel')) {
            panel = this.scene.add.image(width / 2, height / 2, 'settings_ui_panel');
            panel.setScale(0.9 * scaleX, 0.9 * scaleY);
        } else {
            panel = this.scene.add.rectangle(width / 2, height / 2, 500 * scaleX, 360 * scaleY, 0x1F2937, 0.95);
            panel.setStrokeStyle(4, 0xFFD700);
        }
        this.settingsPanel.add(panel);

        const title = this.scene.add.text(width / 2, (height / 2) - 140 * scaleY, 'SETTINGS', {
            fontSize: Math.floor(26 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Black',
            color: '#FFD700'
        });
        title.setOrigin(0.5);
        this.settingsPanel.add(title);

        const labelStyle = { fontSize: Math.floor(22 * Math.min(scaleX, scaleY)) + 'px', fontFamily: 'Arial Black', color: '#FFFFFF' };
        const makeToggle = (y, label, getOn, onToggle) => {
            const container = this.scene.add.container(width / 2, y);
            const bg = this.scene.add.rectangle(0, 0, 360 * scaleX, 54 * scaleY, 0x6B46C1, 1);
            bg.setStrokeStyle(2, 0xffffff);
            const text = this.scene.add.text(0, 0, `${label}: ${getOn() ? 'ON' : 'OFF'}`, labelStyle);
            text.setOrigin(0.5);
            container.add([bg, text]);
            container.setSize(360 * scaleX, 54 * scaleY);
            container.setInteractive(new Phaser.Geom.Rectangle(-180 * scaleX, -27 * scaleY, 360 * scaleX, 54 * scaleY), Phaser.Geom.Rectangle.Contains);
            container.on('pointerup', () => {
                onToggle();
                text.setText(`${label}: ${getOn() ? 'ON' : 'OFF'}`);
                window.SafeSound.play(this.scene, 'click');
            });
            this.settingsPanel.add(container);
            return container;
        };

        makeToggle((height / 2) - 50 * scaleY, 'SOUND', () => this.scene.stateManager.gameData.soundEnabled, () => {
            this.scene.stateManager.gameData.soundEnabled = !this.scene.stateManager.gameData.soundEnabled;
        });
        makeToggle((height / 2) + 20 * scaleY, 'MUSIC', () => this.scene.stateManager.gameData.musicEnabled, () => {
            const gd = this.scene.stateManager.gameData;
            gd.musicEnabled = !gd.musicEnabled;
            if (gd.musicEnabled) {
                window.SafeSound.startMainBGM(this.scene);
            } else if (window.SafeSound.currentBGM) {
                try { window.SafeSound.currentBGM.stop(); } catch (_) {}
                window.SafeSound.currentBGM = null;
            }
        });

        // Close button
        const closeBtn = this.scene.add.text(width / 2, (height / 2) + 120 * scaleY, 'CLOSE', {
            fontSize: Math.floor(20 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Black',
            color: '#000000',
            backgroundColor: '#FFD700',
            padding: { x: 16, y: 8 }
        });
        closeBtn.setOrigin(0.5);
        closeBtn.setInteractive({ useHandCursor: true });
        closeBtn.on('pointerup', () => {
            window.SafeSound.play(this.scene, 'click');
            this.settingsPanel.setVisible(false);
        });
        this.settingsPanel.add(closeBtn);
    }
    
    createTextOverlays(scaleX, scaleY) {
        // Text overlays for values - initialize with server balance if available
        const initialBalance = window.WalletAPI ? window.WalletAPI.getCurrentBalance() : this.scene.stateManager.gameData.balance;
        this.balanceText = this.scene.add.text(250 * scaleX, 675 * scaleY, `$${initialBalance.toFixed(2)}`, {
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
            fontSize: Math.floor(26 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        });
        this.winTopText.setOrigin(0.5);
        this.winTopText.setDepth(window.GameConfig.UI_DEPTHS.TEXT_OVERLAY);
        // Default guidance text when no win/formula is shown
        this.defaultPlaqueText = '4 Scatter = Free Spins!';
        this.winTopText.setText(this.defaultPlaqueText);
        this.winTopText.setVisible(true);
        // Save original scale to avoid accumulation during tweens
        this.winTopText.originalScaleX = this.winTopText.scaleX;
        this.winTopText.originalScaleY = this.winTopText.scaleY;
        
        // Ensure default text is always visible during losing spins
        if (!this.defaultPlaqueEnforcer) {
            this.defaultPlaqueEnforcer = this.scene.time.addEvent({
                delay: 250,
                loop: true,
                callback: () => {
                    try {
                        if (!this.winTopText) return;
                        const amount = Number(this.scene && this.scene.totalWin) || 0;
                        if (amount <= 0) {
                            const shouldRestore = !this.winTopText.visible || !this.winTopText.text || this.winTopText.text.trim() === '';
                            if (shouldRestore) {
                                const text = this.defaultPlaqueText || '8+ matched symbols wins!';
                                this.winTopText.setText(text);
                                this.winTopText.setVisible(true);
                            }
                        }
                    } catch (_) {}
                }
            });
        }
        
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
            this.ui_freegame_purchase,
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
                    if (this.ui_spin_light && this.ui_spin_light.applyScaleFromSpin) {
                        this.ui_spin_light.applyScaleFromSpin();
                    }
                    this.ui_spin.setTint(0xFFFFFF);
                }
            });
            
            this.ui_spin.on('pointerout', () => {
                if (!this.scene.isSpinning) {
                    // Reset to original scale to prevent accumulation bugs
                    this.ui_spin.setScale(this.ui_spin.originalScaleX, this.ui_spin.originalScaleY);
                    if (this.ui_spin_light && this.ui_spin_light.applyScaleFromSpin) {
                        this.ui_spin_light.applyScaleFromSpin();
                    }
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
    
    // Initialize wallet integration
    initializeWalletIntegration() {
        // Setup wallet event listeners
        if (this.scene && this.scene.events) {
            // Listen for wallet balance updates
            this.scene.events.on('wallet_balance_update', this.handleWalletBalanceUpdate, this);
            this.scene.events.on('wallet_transaction_created', this.handleWalletTransactionCreated, this);
            this.scene.events.on('wallet_error', this.handleWalletError, this);
        }
    }
    
    // Initialize server balance on UI creation
    async initializeServerBalance() {
        if (window.WalletAPI) {
            try {
                await window.WalletAPI.getBalance();
                this.updateBalanceFromServer();
                console.log('✅ Wallet UI initialized with server balance');
            } catch (error) {
                console.warn('⚠️ Failed to initialize wallet balance from server:', error);
                this.handleWalletError({ error: 'Failed to connect to wallet service' });
            }
        }
    }
    
    // Update methods
    updateBalanceDisplay() {
        // Use server balance if available, otherwise fallback to local state
        const balance = window.WalletAPI ? window.WalletAPI.getCurrentBalance() : this.scene.stateManager.gameData.balance;
        if (this.balanceText) {
            this.balanceText.setText(`$${balance.toFixed(2)}`);
        }
    }
    
    // Update balance from server (server-authoritative)
    updateBalanceFromServer() {
        if (window.WalletAPI && this.balanceText) {
            const serverBalance = window.WalletAPI.getCurrentBalance();
            this.balanceText.setText(`$${serverBalance.toFixed(2)}`);
            
            // Also update local state manager for consistency
            if (this.scene.stateManager) {
                this.scene.stateManager.setBalanceFromServer(serverBalance);
            }
            
            console.log(`💰 Balance display updated from server: $${serverBalance.toFixed(2)}`);
        }
    }
    
    updateWinDisplay() {
        if (this.winText) {
            this.winText.setText(`$${this.scene.totalWin.toFixed(2)}`);
        }

        // Mirror win amount or formula to the top-center visual, show only when > 0
        if (this.winTopText) {
            const amount = this.scene.totalWin;
            if (amount > 0) {
                const inFreeSpins = !!(this.scene.stateManager && this.scene.stateManager.freeSpinsData && this.scene.stateManager.freeSpinsData.active);
                let base;
                let mult;
                if (inFreeSpins) {
                    // During Free Spins show (bet x payout) x Accumulated FS Multiplier = total
                    const fsMult = Math.max(1, (this.scene.stateManager.freeSpinsData.multiplierAccumulator || 1));
                    mult = fsMult;
                    base = amount / fsMult; // derive pre-FS base so the equation matches the visible total
                } else {
                    base = Math.max(0, this.scene.baseWinForFormula || 0);
                    mult = Math.max(1, this.scene.spinAppliedMultiplier || 1);
                }
                let text;
                if (base > 0 && mult > 1) {
                    const baseStr = `$${base.toFixed(2)}`;
                    const multStr = `x${mult.toFixed(2).replace(/\.00$/, '')}`;
                    const finalStr = `$${amount.toFixed(2)}`;
                    text = `${baseStr} ${multStr} = ${finalStr}`;
                } else {
                    text = `$${amount.toFixed(2)}`;
                }
                this.winTopText.setText(text);
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
                // Show default guidance text on the plaque when no win/formula
                if (this.defaultPlaqueText) {
                    this.winTopText.setText(this.defaultPlaqueText);
                    this.winTopText.setVisible(true);
                } else {
                    this.winTopText.setVisible(false);
                }
            }
        }
    }

    // Expose the current plaque position for FX targeting
    getPlaquePosition() {
        if (this.winTopText) {
            return { x: this.winTopText.x, y: this.winTopText.y };
        }
        // Fallback to top-center of canvas
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        return { x: width / 2, y: Math.max(30, 50 * (height / 720)) };
    }

    // Expose the accumulated-multiplier badge position (Free Spins UI) for FX targeting
    getAccumulatedMultiplierPosition() {
        if (this.accumulatedMultiplierText) {
            return { x: this.accumulatedMultiplierText.x, y: this.accumulatedMultiplierText.y };
        }
        if (this.ui_accumulated_multiplier) {
            return { x: this.ui_accumulated_multiplier.x, y: this.ui_accumulated_multiplier.y };
        }
        // Fallback to the design-time coordinates scaled to current canvas
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        const scaleX = width / 1280;
        const scaleY = height / 720;
        return { x: 987 * scaleX, y: 62 * scaleY };
    }

    // Set the plaque formula explicitly (used by shooting-star FX incremental updates)
    setWinFormula(baseAmount, accumulatedMultiplier, finalAmount) {
        if (!this.winTopText) return;
        const baseStr = `$${Number(baseAmount || 0).toFixed(2)}`;
        const multStr = `x${Number(accumulatedMultiplier || 0).toFixed(2).replace(/\.00$/, '')}`;
        const finalStr = `$${Number(finalAmount || 0).toFixed(2)}`;
        const text = `${baseStr} ${multStr} = ${finalStr}`;
        this.winTopText.setText(text);
        this.winTopText.setVisible(true);

        // subtle pulse
        this.winTopText.setScale(this.winTopText.originalScaleX, this.winTopText.originalScaleY);
        this.scene.tweens.add({
            targets: this.winTopText,
            scaleX: this.winTopText.originalScaleX * 1.08,
            scaleY: this.winTopText.originalScaleY * 1.08,
            duration: 140,
            yoyo: true,
            ease: 'Power2'
        });
    }
    
    updateBetDisplay() {
        if (this.betText) {
            this.betText.setText(`$${this.scene.stateManager.gameData.currentBet.toFixed(2)}`);
        }
        // Update purchase button overlay cost when bet changes
        this.updatePurchaseButtonCost();
    }
    
    updateFreeSpinsDisplay() {
        const freeSpinsData = this.scene.stateManager.freeSpinsData;
        if (freeSpinsData.active) {
            // Show the free game UI element
            if (this.ui_freegame) {
                this.ui_freegame.setVisible(true);
            }
            // Hide purchase button during Free Spins bonus mode
            if (this.ui_freegame_purchase) {
                this.ui_freegame_purchase.setVisible(false);
                this.ui_freegame_purchase.disableInteractive();
            }
            if (this.ui_freegame_purchase_text) {
                this.ui_freegame_purchase_text.setVisible(false);
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
                this.freeSpinsText.setDepth(window.GameConfig.UI_DEPTHS.FREE_SPINS + 1);
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

            // Re-enable and show purchase button when not in Free Spins
            if (this.ui_freegame_purchase) {
                this.ui_freegame_purchase.setVisible(true);
                this.ui_freegame_purchase.setInteractive({ useHandCursor: true });
                if (this.ui_freegame_purchase_text) {
                    this.ui_freegame_purchase_text.setVisible(true);
                }
                this.updatePurchaseButtonCost();
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
            this.ui_freegame_purchase,
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
        // Mirror alpha/visibility to purchase overlay text
        if (this.ui_freegame_purchase_text) {
            this.ui_freegame_purchase_text.setAlpha(enabled ? 1 : 0.5);
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

    // Enable/disable only the spin button (used to block manual spins during win presentations)
    setSpinEnabled(enabled) {
        if (this.ui_spin) {
            this.ui_spin.setInteractive(enabled);
            if (!this.scene.isSpinning) {
                this.ui_spin.setAlpha(enabled ? 1 : 0.5);
            }
        }
        if (this.scene.fallbackSpinButton) {
            this.scene.fallbackSpinButton.setInteractive(enabled);
            this.scene.fallbackSpinButton.setAlpha(enabled ? 1 : 0.5);
        }
    }
    
    // Getters for UI elements
    getSpinButton() { return this.ui_spin; }
    getUIElements() { return this.uiElements; }

    // Helper to compute and display the Free Spins purchase cost on the button overlay
    updatePurchaseButtonCost() {
        try {
            if (!this.ui_freegame_purchase || !this.ui_freegame_purchase.visible) {
                if (this.ui_freegame_purchase_text) this.ui_freegame_purchase_text.setVisible(false);
                return;
            }
            const bet = (this.scene && this.scene.stateManager && this.scene.stateManager.gameData)
                ? this.scene.stateManager.gameData.currentBet
                : 0;
            const costMult = (window.GameConfig && window.GameConfig.FREE_SPINS && window.GameConfig.FREE_SPINS.BUY_FEATURE_COST)
                ? window.GameConfig.FREE_SPINS.BUY_FEATURE_COST
                : 100;
            const cost = bet * costMult;
            
            // Check if player can afford the purchase using server balance
            const canAfford = window.WalletAPI ? window.WalletAPI.canAffordBet(cost) : true;
            
            if (this.ui_freegame_purchase_text) {
                this.ui_freegame_purchase_text.setText(`$${cost.toFixed(2)}`);
                this.ui_freegame_purchase_text.setVisible(true);
                // Keep overlay centered on the button in case of layout shifts
                const width = this.scene.cameras.main.width;
                const height = this.scene.cameras.main.height;
                const scaleX = width / 1280;
                const scaleY = height / 720;
                this.ui_freegame_purchase_text.setPosition(this.ui_freegame_purchase.x, this.ui_freegame_purchase.y + (20 * Math.min(scaleX, scaleY)));
            }
            
            // Update button appearance based on affordability
            if (this.ui_freegame_purchase) {
                this.ui_freegame_purchase.setAlpha(canAfford ? 1.0 : 0.6);
                this.ui_freegame_purchase.setTint(canAfford ? 0xffffff : 0x999999);
            }
        } catch (e) {
            // fail-safe: hide text if something is wrong
            if (this.ui_freegame_purchase_text) this.ui_freegame_purchase_text.setVisible(false);
        }
    }
    
    // Wallet Event Handlers
    handleWalletBalanceUpdate(data) {
        console.log('💰 Wallet balance update received in UI:', data);
        
        // Update balance display with animation
        if (this.balanceText) {
            const oldBalance = parseFloat(this.balanceText.text.replace('$', ''));
            const newBalance = data.newBalance;
            
            // Update text
            this.balanceText.setText(`$${newBalance.toFixed(2)}`);
            
            // Add visual feedback for balance change
            if (Math.abs(oldBalance - newBalance) > 0.01) {
                this.animateBalanceChange(oldBalance, newBalance);
            }
        }
        
        // Update purchase button affordability
        this.updatePurchaseButtonCost();
    }
    
    handleWalletTransactionCreated(data) {
        console.log('📝 Wallet transaction created in UI:', data);
        
        // Show transaction notification
        this.showTransactionNotification(data.transaction);
        
        // Refresh balance display
        this.updateBalanceFromServer();
    }
    
    handleWalletError(data) {
        console.error('❌ Wallet error in UI:', data);
        
        // Show error message to user
        if (this.scene.showMessage) {
            this.scene.showMessage(`Wallet Error: ${data.error}`);
        }
        
        // Update UI to show disconnected state
        if (this.balanceText) {
            this.balanceText.setTint(0xff6666); // Red tint for error
            this.scene.time.delayedCall(2000, () => {
                if (this.balanceText) this.balanceText.clearTint();
            });
        }
    }
    
    // Animate balance change
    animateBalanceChange(oldBalance, newBalance) {
        if (!this.balanceText) return;
        
        const change = newBalance - oldBalance;
        const isIncrease = change > 0;
        
        // Color animation
        this.balanceText.setTint(isIncrease ? 0x00ff00 : 0xff0000);
        
        // Scale animation
        this.scene.tweens.add({
            targets: this.balanceText,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 200,
            yoyo: true,
            ease: 'Power2',
            onComplete: () => {
                this.balanceText.clearTint();
            }
        });
        
        // Optional: Show change amount
        this.showBalanceChangeText(change, isIncrease);
    }
    
    // Show floating text for balance change
    showBalanceChangeText(change, isIncrease) {
        if (!this.balanceText) return;
        
        const changeText = this.scene.add.text(
            this.balanceText.x, 
            this.balanceText.y - 30, 
            `${isIncrease ? '+' : ''}$${change.toFixed(2)}`,
            {
                fontSize: '16px',
                fontFamily: 'Arial Bold',
                color: isIncrease ? '#00ff00' : '#ff0000'
            }
        );
        changeText.setOrigin(0.5);
        changeText.setDepth(window.GameConfig.UI_DEPTHS.TEXT_OVERLAY + 1);
        
        // Animate floating text
        this.scene.tweens.add({
            targets: changeText,
            y: changeText.y - 40,
            alpha: 0,
            duration: 1500,
            ease: 'Power2',
            onComplete: () => {
                changeText.destroy();
            }
        });
    }
    
    // Show transaction notification
    showTransactionNotification(transaction) {
        const formatted = window.WalletAPI.formatTransaction(transaction);
        const message = `${transaction.type.toUpperCase()}: ${formatted.formattedAmount}`;
        
        if (this.scene.showMessage) {
            this.scene.showMessage(message, 2000);
        }
    }
    
    // Transaction History UI
    openTransactionHistory() {
        if (this.transactionHistoryContainer) {
            this.transactionHistoryContainer.setVisible(true);
            this.isTransactionHistoryVisible = true;
            return;
        }
        
        this.createTransactionHistoryUI();
    }
    
    async createTransactionHistoryUI() {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        const scaleX = width / 1280;
        const scaleY = height / 720;
        const depth = 2500;
        
        this.transactionHistoryContainer = this.scene.add.container(0, 0);
        this.transactionHistoryContainer.setDepth(depth);
        this.isTransactionHistoryVisible = true;
        
        // Background
        const bg = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);
        bg.setInteractive();
        this.transactionHistoryContainer.add(bg);
        
        // Panel
        const panelWidth = 600 * scaleX;
        const panelHeight = 500 * scaleY;
        const panel = this.scene.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x1F2937, 0.95);
        panel.setStrokeStyle(4, 0xFFD700);
        this.transactionHistoryContainer.add(panel);
        
        // Title
        const title = this.scene.add.text(width / 2, (height / 2) - (panelHeight / 2) + 40 * scaleY, 'TRANSACTION HISTORY', {
            fontSize: Math.floor(24 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Black',
            color: '#FFD700'
        });
        title.setOrigin(0.5);
        this.transactionHistoryContainer.add(title);
        
        // Loading text
        const loadingText = this.scene.add.text(width / 2, height / 2, 'Loading transactions...', {
            fontSize: Math.floor(18 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial',
            color: '#FFFFFF'
        });
        loadingText.setOrigin(0.5);
        this.transactionHistoryContainer.add(loadingText);
        
        // Load transactions
        try {
            if (window.WalletAPI) {
                const result = await window.WalletAPI.getTransactions(20);
                loadingText.destroy();
                
                if (result.success) {
                    this.displayTransactionList(result.data.data.transactions, panelWidth, panelHeight, scaleX, scaleY);
                } else {
                    this.showTransactionError('Failed to load transactions');
                }
            } else {
                loadingText.setText('Wallet service not available');
            }
        } catch (error) {
            console.error('Failed to load transactions:', error);
            loadingText.setText('Error loading transactions');
        }
        
        // Close button
        const closeBtn = this.scene.add.text(width / 2, (height / 2) + (panelHeight / 2) - 30 * scaleY, 'CLOSE', {
            fontSize: Math.floor(20 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Black',
            color: '#000000',
            backgroundColor: '#FFD700',
            padding: { x: 16, y: 8 }
        });
        closeBtn.setOrigin(0.5);
        closeBtn.setInteractive({ useHandCursor: true });
        closeBtn.on('pointerup', () => {
            this.closeTransactionHistory();
        });
        this.transactionHistoryContainer.add(closeBtn);
        
        // Close on background click
        bg.on('pointerup', () => {
            this.closeTransactionHistory();
        });
    }
    
    displayTransactionList(transactions, panelWidth, panelHeight, scaleX, scaleY) {
        if (!transactions || transactions.length === 0) {
            this.showTransactionError('No transactions found');
            return;
        }
        
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        const startY = (height / 2) - (panelHeight / 2) + 80 * scaleY;
        const itemHeight = 30 * scaleY;
        const maxItems = Math.floor((panelHeight - 120 * scaleY) / itemHeight);
        
        // Display up to maxItems transactions
        const displayTransactions = transactions.slice(0, maxItems);
        
        displayTransactions.forEach((transaction, index) => {
            const formatted = window.WalletAPI.formatTransaction(transaction);
            const y = startY + (index * itemHeight);
            
            // Transaction type
            const typeText = this.scene.add.text((width / 2) - (panelWidth / 2) + 20 * scaleX, y, transaction.type.toUpperCase(), {
                fontSize: Math.floor(14 * Math.min(scaleX, scaleY)) + 'px',
                fontFamily: 'Arial Bold',
                color: '#FFFFFF'
            });
            typeText.setOrigin(0, 0.5);
            this.transactionHistoryContainer.add(typeText);
            
            // Amount
            const amountText = this.scene.add.text(width / 2, y, formatted.formattedAmount, {
                fontSize: Math.floor(14 * Math.min(scaleX, scaleY)) + 'px',
                fontFamily: 'Arial Bold',
                color: formatted.color === 'green' ? '#00ff00' : '#ff6666'
            });
            amountText.setOrigin(0.5, 0.5);
            this.transactionHistoryContainer.add(amountText);
            
            // Date
            const dateText = this.scene.add.text((width / 2) + (panelWidth / 2) - 20 * scaleX, y, formatted.formattedDate.split(' ')[0], {
                fontSize: Math.floor(12 * Math.min(scaleX, scaleY)) + 'px',
                fontFamily: 'Arial',
                color: '#CCCCCC'
            });
            dateText.setOrigin(1, 0.5);
            this.transactionHistoryContainer.add(dateText);
            
            // Separator line
            if (index < displayTransactions.length - 1) {
                const line = this.scene.add.rectangle(width / 2, y + (itemHeight / 2), panelWidth - 40 * scaleX, 1, 0x444444);
                this.transactionHistoryContainer.add(line);
            }
        });
        
        // Summary
        if (window.WalletAPI) {
            const summary = window.WalletAPI.getTransactionSummary();
            const summaryY = startY + (maxItems * itemHeight) + 20 * scaleY;
            
            const summaryText = this.scene.add.text(width / 2, summaryY, `Net Result (30d): ${summary.netResult >= 0 ? '+' : ''}$${summary.netResult.toFixed(2)}`, {
                fontSize: Math.floor(16 * Math.min(scaleX, scaleY)) + 'px',
                fontFamily: 'Arial Bold',
                color: summary.netResult >= 0 ? '#00ff00' : '#ff6666'
            });
            summaryText.setOrigin(0.5);
            this.transactionHistoryContainer.add(summaryText);
        }
    }
    
    showTransactionError(message) {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        
        const errorText = this.scene.add.text(width / 2, height / 2, message, {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#ff6666'
        });
        errorText.setOrigin(0.5);
        this.transactionHistoryContainer.add(errorText);
    }
    
    closeTransactionHistory() {
        if (this.transactionHistoryContainer) {
            this.transactionHistoryContainer.setVisible(false);
            this.isTransactionHistoryVisible = false;
        }
    }
    
    // Wallet validation for bets
    canAffordBet(amount) {
        if (window.WalletAPI) {
            const validation = window.WalletAPI.validateBetAmount(amount);
            return validation.valid;
        }
        return this.scene.stateManager.canAffordBet();
    }
    
    // Get validation error message
    getBetValidationError(amount) {
        if (window.WalletAPI) {
            const validation = window.WalletAPI.validateBetAmount(amount);
            return validation.error || null;
        }
        return null;
    }
    
    // Refresh wallet data
    async refreshWalletData() {
        if (window.WalletAPI) {
            try {
                await window.WalletAPI.refreshBalance();
                console.log('✅ Wallet data refreshed');
            } catch (error) {
                console.error('❌ Failed to refresh wallet data:', error);
                this.handleWalletError({ error: 'Failed to refresh wallet data' });
            }
        }
    }
    
    // Clean up wallet integration
    destroy() {
        // Remove event listeners
        if (this.scene && this.scene.events) {
            this.scene.events.off('wallet_balance_update', this.handleWalletBalanceUpdate, this);
            this.scene.events.off('wallet_transaction_created', this.handleWalletTransactionCreated, this);
            this.scene.events.off('wallet_error', this.handleWalletError, this);
        }
        
        // Clean up transaction history
        if (this.transactionHistoryContainer) {
            this.transactionHistoryContainer.destroy();
            this.transactionHistoryContainer = null;
        }
    }
} 
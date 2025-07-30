// Burst Mode Manager - handles all burst mode functionality
window.BurstModeManager = class BurstModeManager {
    constructor(scene) {
        this.scene = scene;
        this.burstModeActive = false;
        this.burstModeUI = null;
        this.burstSpinResults = [];
        this.burstAutoSpinning = false;
        
        // UI references
        this.burstBalanceText = null;
        this.burstWinText = null;
        this.burstBetText = null;
        this.burstAutoBtn = null;
        this.burstResultsContainer = null;
        this.burstScoreLights = [];
    }
    
    toggle() {
        if (this.scene.isSpinning) {
            this.scene.showMessage('Cannot toggle Burst Mode while spinning!');
            return;
        }
        
        this.burstModeActive = !this.burstModeActive;
        
        if (this.burstModeActive) {
            this.enter();
        } else {
            this.exit();
        }
    }
    
    enter() {
        // Hide normal game elements
        this.setNormalGameVisible(false);
        
        // Create burst mode UI
        this.createUI();
        
        // Enable quick spin for burst mode
        this.scene.quickSpinEnabled = true;
        this.scene.setQuickSpin(true);
        
        this.scene.showMessage('BURST MODE ACTIVATED!');
        window.SafeSound.play(this.scene, 'bonus');
    }
    
    exit() {
        // Show normal game elements
        this.setNormalGameVisible(true);
        
        // Destroy burst mode UI
        if (this.burstModeUI) {
            this.burstModeUI.destroy();
            this.burstModeUI = null;
        }
        
        // Clear burst mode UI references
        this.burstBalanceText = null;
        this.burstWinText = null;
        this.burstBetText = null;
        
        // Stop burst auto spinning
        this.burstAutoSpinning = false;
        
        // Reset quick spin
        this.scene.quickSpinEnabled = false;
        this.scene.setQuickSpin(false);
        
        // Clear results
        this.burstSpinResults = [];
        
        this.scene.showMessage('BURST MODE DEACTIVATED');
        window.SafeSound.play(this.scene, 'click');
    }
    
    setNormalGameVisible(visible) {
        // Hide/show grid and character portraits
        this.scene.gridManager.setVisible(visible);
        
        if (this.scene.characterPortraits) {
            Object.values(this.scene.characterPortraits).forEach(portrait => {
                portrait.setVisible(visible);
            });
        }
        
        // Hide/show debug panel
        if (!visible) {
            this.scene.setDebugPanelVisible(false);
        }
        
        // Hide/show the main background when in burst mode
        if (this.scene.children && this.scene.children.list) {
            this.scene.children.list.forEach(child => {
                // Hide background image and other visual elements
                if (child.texture && child.texture.key === 'bg_infinity_storm') {
                    child.setVisible(visible);
                }
            });
        }
        
        // Handle animated portraits from UIManager
        const uiElements = this.scene.uiManager && this.scene.uiManager.getUIElements();
        if (uiElements && uiElements.portraits) {
            // Scarlet Witch portrait
            if (uiElements.portraits.scarletWitch) {
                uiElements.portraits.scarletWitch.setVisible(visible);
                if (uiElements.portraits.scarletWitch.anims) {
                    if (visible) {
                        if (this.scene.anims.exists('scarlet_witch_portrait_animation')) {
                            uiElements.portraits.scarletWitch.play('scarlet_witch_portrait_animation');
                        }
                    } else {
                        uiElements.portraits.scarletWitch.anims.pause();
                    }
                }
            }
            
            // Thanos portrait
            if (uiElements.portraits.thanos) {
                uiElements.portraits.thanos.setVisible(visible);
                if (uiElements.portraits.thanos.anims) {
                    if (visible) {
                        if (this.scene.anims.exists('thanos_portrait_animation')) {
                            uiElements.portraits.thanos.play('thanos_portrait_animation');
                        }
                    } else {
                        uiElements.portraits.thanos.anims.pause();
                    }
                }
            }
        }
    }
    
    createUI() {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        
        this.burstModeUI = this.scene.add.container(0, 0);
        this.burstModeUI.setDepth(2000); // Set high depth for entire burst mode UI
        
        // Scale factors based on canvas size (burst.js uses 1280x720 design)
        const scaleX = width / 1280;
        const scaleY = height / 720;
        const uiScale = 0.67; // Base scale from burst.js
        
        // Background - ui_burstbg
        const bg = this.scene.add.image(641 * scaleX, 361 * scaleY, 'ui_burstbg');
        bg.setScale(0.68 * scaleX, 0.68 * scaleY);
        this.burstModeUI.add(bg);
        
        // Three background panels
        const threebg03 = this.scene.add.image(643 * scaleX, 320 * scaleY, 'ui_threebg03_1');
        threebg03.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(threebg03);
        
        const threebg01 = this.scene.add.image(385 * scaleX, 365 * scaleY, 'ui_threebg01');
        threebg01.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(threebg01);
        
        const threebg02 = this.scene.add.image(904 * scaleX, 365 * scaleY, 'ui_threebg02');
        threebg02.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(threebg02);
        
        // Burst boxes for value displays
        const burstbox1 = this.scene.add.image(386 * scaleX, 570 * scaleY, 'ui_burstbox');
        burstbox1.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(burstbox1);
        
        const burstbox2 = this.scene.add.image(644 * scaleX, 570 * scaleY, 'ui_burstbox');
        burstbox2.setScale(0.85 * scaleX, uiScale * scaleY);
        this.burstModeUI.add(burstbox2);
        
        const burstbox3 = this.scene.add.image(906 * scaleX, 570 * scaleY, 'ui_burstbox');
        burstbox3.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(burstbox3);
        
        // Results container for scrolling text
        this.burstResultsContainer = this.scene.add.container(643 * scaleX - 400, 220 * scaleY);
        this.burstModeUI.add(this.burstResultsContainer);
        
        // Add a subtle background for the results area
        const resultsBg = this.scene.add.rectangle(400, 100, 800, 200, 0x000000, 0.3);
        resultsBg.setStrokeStyle(1, 0x666666);
        this.burstResultsContainer.add(resultsBg);
        
        // Create buttons
        this.createButtons(scaleX, scaleY, uiScale);
        
        // Create text displays
        this.createTextDisplays(scaleX, scaleY);
        
        // Title at top
        const title = this.scene.add.text(width / 2, 50 * scaleY, 'BURST MODE', {
            fontSize: Math.floor(48 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4
        });
        title.setOrigin(0.5);
        this.burstModeUI.add(title);
        
        // Create score light effects (initially invisible)
        this.createScoreLights(scaleX, scaleY, uiScale);
    }
    
    createButtons(scaleX, scaleY, uiScale) {
        // Single spin button
        const singleSpinBtn = this.scene.add.image(455 * scaleX, 652 * scaleY, 'ui_burst_buttonplay');
        singleSpinBtn.setScale(uiScale * scaleX, uiScale * scaleY);
        singleSpinBtn.setInteractive({ useHandCursor: true });
        this.burstModeUI.add(singleSpinBtn);
        
        singleSpinBtn.on('pointerup', () => {
            if (!this.scene.isSpinning) {
                window.SafeSound.play(this.scene, 'click');
                this.singleSpin();
            }
        });
        
        singleSpinBtn.on('pointerover', () => {
            singleSpinBtn.setScale(singleSpinBtn.scaleX * 1.1, singleSpinBtn.scaleY * 1.1);
            singleSpinBtn.setTint(0xFFFFFF);
        });
        
        singleSpinBtn.on('pointerout', () => {
            singleSpinBtn.setScale(singleSpinBtn.scaleX / 1.1, singleSpinBtn.scaleY / 1.1);
            singleSpinBtn.clearTint();
        });
        
        // Auto spin button - animated sprite
        this.burstAutoBtn = this.scene.add.sprite(646 * scaleX, 652 * scaleY, 'ui_burst_buttonplayloop_sprites');
        this.burstAutoBtn.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstAutoBtn.setInteractive({ useHandCursor: true });
        this.burstModeUI.add(this.burstAutoBtn);
        
        this.burstAutoBtn.on('pointerup', () => {
            window.SafeSound.play(this.scene, 'click');
            this.toggleAutoSpin();
        });
        
        this.burstAutoBtn.on('pointerover', () => {
            if (!this.burstAutoSpinning) {
                this.burstAutoBtn.setScale(this.burstAutoBtn.scaleX * 1.1, this.burstAutoBtn.scaleY * 1.1);
            }
        });
        
        this.burstAutoBtn.on('pointerout', () => {
            if (!this.burstAutoSpinning) {
                this.burstAutoBtn.setScale(this.burstAutoBtn.scaleX / 1.1, this.burstAutoBtn.scaleY / 1.1);
            }
        });
        
        // Bet adjustment buttons
        const betMinus = this.scene.add.image(543 * scaleX, 652 * scaleY, 'ui_number_bet-');
        betMinus.setScale(uiScale * scaleX, uiScale * scaleY);
        betMinus.setInteractive({ useHandCursor: true });
        this.burstModeUI.add(betMinus);
        
        betMinus.on('pointerup', () => {
            window.SafeSound.play(this.scene, 'click');
            this.scene.adjustBet(-1);
            this.updateDisplays();
        });
        
        betMinus.on('pointerover', () => {
            betMinus.setScale(betMinus.scaleX * 1.1, betMinus.scaleY * 1.1);
            betMinus.setTint(0xFFFFFF);
        });
        
        betMinus.on('pointerout', () => {
            betMinus.setScale(betMinus.scaleX / 1.1, betMinus.scaleY / 1.1);
            betMinus.clearTint();
        });
        
        const betPlus = this.scene.add.image(750 * scaleX, 652 * scaleY, 'ui_number_bet+');
        betPlus.setScale(uiScale * scaleX, uiScale * scaleY);
        betPlus.setInteractive({ useHandCursor: true });
        this.burstModeUI.add(betPlus);
        
        betPlus.on('pointerup', () => {
            window.SafeSound.play(this.scene, 'click');
            this.scene.adjustBet(1);
            this.updateDisplays();
        });
        
        betPlus.on('pointerover', () => {
            betPlus.setScale(betPlus.scaleX * 1.1, betPlus.scaleY * 1.1);
            betPlus.setTint(0xFFFFFF);
        });
        
        betPlus.on('pointerout', () => {
            betPlus.setScale(betPlus.scaleX / 1.1, betPlus.scaleY / 1.1);
            betPlus.clearTint();
        });
        
        // Exit button
        const exitBtn = this.scene.add.image(840 * scaleX, 652 * scaleY, 'ui_burst_buttonexit');
        exitBtn.setScale(uiScale * scaleX, uiScale * scaleY);
        exitBtn.setInteractive({ useHandCursor: true });
        this.burstModeUI.add(exitBtn);
        
        exitBtn.on('pointerup', () => {
            window.SafeSound.play(this.scene, 'click');
            this.toggle();
        });
        
        exitBtn.on('pointerover', () => {
            exitBtn.setScale(exitBtn.scaleX * 1.1, exitBtn.scaleY * 1.1);
            exitBtn.setTint(0xFF6666);
        });
        
        exitBtn.on('pointerout', () => {
            exitBtn.setScale(exitBtn.scaleX / 1.1, exitBtn.scaleY / 1.1);
            exitBtn.clearTint();
        });
    }
    
    createTextDisplays(scaleX, scaleY) {
        // Text labels
        const labelStyle = {
            fontSize: Math.floor(30 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Bold',
            color: '#FFFFFF'
        };
        
        const totalLabel = this.scene.add.text(339 * scaleX, 498 * scaleY, 'TOTAL', labelStyle);
        totalLabel.setOrigin(0.5);
        this.burstModeUI.add(totalLabel);
        
        const winLabel = this.scene.add.text(614 * scaleX, 498 * scaleY, 'WIN', labelStyle);
        winLabel.setOrigin(0.5);
        this.burstModeUI.add(winLabel);
        
        const betLabel = this.scene.add.text(877 * scaleX, 498 * scaleY, 'BET', labelStyle);
        betLabel.setOrigin(0.5);
        this.burstModeUI.add(betLabel);
        
        // Value displays
        const valueStyle = {
            fontSize: Math.floor(36 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Black',
            color: '#FFD700'
        };
        
        this.burstBalanceText = this.scene.add.text(339 * scaleX, 545 * scaleY, `$${this.scene.stateManager.gameData.balance.toFixed(2)}`, valueStyle);
        this.burstBalanceText.setOrigin(0.5);
        this.burstModeUI.add(this.burstBalanceText);
        
        this.burstWinText = this.scene.add.text(614 * scaleX, 545 * scaleY, '$0.00', {
            ...valueStyle,
            color: '#00FF00'
        });
        this.burstWinText.setOrigin(0.5);
        this.burstModeUI.add(this.burstWinText);
        
        this.burstBetText = this.scene.add.text(877 * scaleX, 545 * scaleY, `$${this.scene.stateManager.gameData.currentBet.toFixed(2)}`, {
            ...valueStyle,
            color: '#FFFFFF'
        });
        this.burstBetText.setOrigin(0.5);
        this.burstModeUI.add(this.burstBetText);
    }
    
    createScoreLights(scaleX, scaleY, uiScale) {
        this.burstScoreLights = [];
        const lightPositions = [
            { x: 339 * scaleX, y: 570 * scaleY }, // Total box
            { x: 614 * scaleX, y: 570 * scaleY }, // Win box
            { x: 877 * scaleX, y: 570 * scaleY }  // Bet box
        ];
        
        lightPositions.forEach((pos, index) => {
            const light = this.scene.add.sprite(pos.x, pos.y, 'ui_scoreup_light_sprite');
            light.setScale(uiScale * scaleX * 1.5, uiScale * scaleY * 1.5);
            light.setAlpha(0);
            light.setBlendMode(Phaser.BlendModes.ADD);
            this.burstScoreLights.push(light);
            this.burstModeUI.add(light);
        });
    }
    
    async singleSpin() {
        if (!this.burstModeActive) return;
        
        // Start spin button animation in burst mode
        const spinButton = this.scene.uiManager && this.scene.uiManager.getSpinButton();
        if (spinButton && this.scene.anims.exists('animation')) {
            spinButton.play('animation');
        }
        
        const spinResult = await this.performSpin();
        this.addResult(spinResult);
        
        // Stop spin button animation
        if (spinButton) {
            spinButton.stop();
            spinButton.setFrame(0);
        }
        
        // Handle bonus notifications
        if (spinResult.bonusTriggered) {
            if (!spinResult.freeSpinsActive) {
                // Show free spins message in burst mode
                this.scene.showMessage(`Free Spins Triggered! ${this.scene.stateManager.freeSpinsData.count} spins`);
            } else {
                this.scene.showMessage(`Free Spins Retriggered!`);
            }
        }
        
        if (spinResult.freeSpinsEnded) {
            this.scene.showMessage(`Free Spins Complete! Total: $${this.scene.stateManager.freeSpinsData.totalWin.toFixed(2)}`);
        }
    }
    
    toggleAutoSpin() {
        this.burstAutoSpinning = !this.burstAutoSpinning;
        
        if (this.burstAutoSpinning) {
            // Start button animation
            if (this.burstAutoBtn) {
                this.burstAutoBtn.play('ui_burst_buttonplayloop_animation');
                this.burstAutoBtn.setTint(0x00FF00); // Green tint when auto-spinning
            }
            this.startAutoSpin();
        } else {
            // Stop button animation
            if (this.burstAutoBtn) {
                this.burstAutoBtn.stop();
                this.burstAutoBtn.setFrame(0);
                this.burstAutoBtn.clearTint();
            }
        }
    }
    
    async startAutoSpin() {
        try {
            while (this.burstAutoSpinning && this.burstModeActive) {
                if (!this.scene.isSpinning && (this.scene.stateManager.canAffordBet() || this.scene.stateManager.freeSpinsData.active)) {
                    // Start spin button animation for auto-spin
                    const spinButton = this.scene.uiManager && this.scene.uiManager.getSpinButton();
                    if (spinButton && this.scene.anims.exists('animation')) {
                        spinButton.play('animation');
                    }
                    
                    const spinResult = await this.performSpin();
                    this.addResult(spinResult);
                    
                    // Stop spin button animation
                    if (spinButton) {
                        spinButton.stop();
                        spinButton.setFrame(0);
                    }
                    
                    // Handle bonus notifications
                    if (spinResult.bonusTriggered) {
                        if (!spinResult.freeSpinsActive) {
                            this.scene.showMessage(`Free Spins Triggered! ${this.scene.stateManager.freeSpinsData.count} spins`);
                        } else {
                            this.scene.showMessage(`Free Spins Retriggered!`);
                        }
                    }
                    
                    if (spinResult.freeSpinsEnded) {
                        this.scene.showMessage(`Free Spins Complete! Total: $${this.scene.stateManager.freeSpinsData.totalWin.toFixed(2)}`);
                    }
                    
                    // Short delay between auto spins
                    await this.scene.delay(200);
                } else {
                    // Stop auto spin if can't afford bet and not in free spins
                    if (!this.scene.stateManager.freeSpinsData.active) {
                        this.burstAutoSpinning = false;
                        // Reset button appearance
                        if (this.burstAutoBtn) {
                            this.burstAutoBtn.stop();
                            this.burstAutoBtn.setFrame(0);
                            this.burstAutoBtn.clearTint();
                        }
                        this.scene.showMessage('Insufficient Balance!');
                        break;
                    }
                }
            }
        } catch (error) {
            console.error('Error in burst auto spin:', error);
            this.burstAutoSpinning = false;
            if (this.burstAutoBtn) {
                this.burstAutoBtn.stop();
                this.burstAutoBtn.setFrame(0);
                this.burstAutoBtn.clearTint();
            }
            this.scene.showMessage('Auto-spin stopped due to error');
        }
    }
    
    async performSpin() {
        try {
            // Check if player can afford bet (unless in free spins)
            if (!this.scene.stateManager.freeSpinsData.active && !this.scene.stateManager.canAffordBet()) {
                return { win: 0, bet: 0, balance: this.scene.stateManager.gameData.balance };
            }
            
            this.scene.isSpinning = true;
            this.scene.totalWin = 0;
            this.scene.cascadeMultiplier = 1;
            
            // Use the same bet logic as normal game
            if (this.scene.stateManager.freeSpinsData.active) {
                this.scene.stateManager.useFreeSpins();
            } else {
                this.scene.stateManager.placeBet();
            }
            
            const bet = this.scene.stateManager.gameData.currentBet;
            
            // Clear and fill grid like normal game
            if (this.scene.gridManager) {
                this.scene.gridManager.initializeGrid();
                this.scene.gridManager.fillGrid();
            } else {
                throw new Error('GridManager not available');
            }
            
            // Process cascades exactly like normal game but without animations
            let cascadeCount = 0;
            let hasMatches = true;
            
            while (hasMatches) {
                const matches = this.scene.gridManager.findMatches();
                
                if (matches.length > 0) {
                    // Calculate win using the same WinCalculator as normal game
                    const win = this.scene.winCalculator.calculateTotalWin(matches, bet);
                    this.scene.totalWin += win;
                    
                    // Remove matches without animation
                    if (this.scene.gridManager && this.scene.gridManager.removeMatches) {
                        this.scene.gridManager.removeMatches(matches);
                    }
                    
                    // Cascade symbols without animation (simplified for burst mode)
                    try {
                        if (this.scene.gridManager && this.scene.gridManager.cascadeSymbols) {
                            await this.scene.gridManager.cascadeSymbols();
                        } else {
                            console.warn('GridManager or cascadeSymbols method not available');
                        }
                    } catch (error) {
                        console.warn('Cascade error in burst mode:', error);
                        // Continue without cascading if there's an error
                    }
                    
                    cascadeCount++;
                    
                    // Apply cascade multiplier in free spins like normal game
                    if (this.scene.stateManager.freeSpinsData.active && cascadeCount > 1) {
                        const shouldTrigger = Math.random() < window.GameConfig.FREE_SPINS.ACCUM_TRIGGER_CHANCE_PER_CASCADE;
                        if (shouldTrigger) {
                            const multiplierTable = window.GameConfig.RANDOM_MULTIPLIER.TABLE;
                            const randomMultiplier = multiplierTable[
                                Math.floor(Math.random() * multiplierTable.length)
                            ];
                            this.scene.stateManager.accumulateMultiplier(randomMultiplier);
                            
                            // Update accumulated multiplier display in burst mode too
                            this.scene.updateAccumulatedMultiplierDisplay();
                        }
                    }
                } else {
                    hasMatches = false;
                }
            }
            
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
            
            // Add win to balance like normal game
            if (this.scene.totalWin > 0) {
                this.scene.stateManager.addWin(this.scene.totalWin);
                
                // Add free spins win like normal game
                if (this.scene.stateManager.freeSpinsData.active) {
                    this.scene.stateManager.freeSpinsData.totalWin += this.scene.totalWin;
                }
            }
            
            // Check for bonus features like normal game
            const scatterCount = this.scene.gridManager && this.scene.gridManager.countScatters ? 
                this.scene.gridManager.countScatters() : 0;
            let bonusTriggered = false;
            
            if (scatterCount >= 4 && !this.scene.stateManager.freeSpinsData.active) {
                // Trigger free spins - 4+ scatters = 15 free spins
                const freeSpins = window.GameConfig.FREE_SPINS.SCATTER_4_PLUS;
                this.scene.stateManager.startFreeSpins(freeSpins);
                bonusTriggered = true;
            } else if (scatterCount >= 4 && this.scene.stateManager.freeSpinsData.active) {
                // Retrigger free spins - 4+ scatters = +5 extra free spins
                const extraSpins = window.GameConfig.FREE_SPINS.RETRIGGER_SPINS;
                this.scene.stateManager.addFreeSpins(extraSpins);
                bonusTriggered = true;
            }
            
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
            
            // Check if free spins ended
            let freeSpinsEnded = false;
            if (this.scene.stateManager.freeSpinsData.active && this.scene.stateManager.freeSpinsData.count === 0) {
                this.scene.stateManager.endFreeSpins();
                freeSpinsEnded = true;
            }
            
            this.scene.isSpinning = false;
            
            return {
                win: this.scene.totalWin,
                bet: bet,
                balance: this.scene.stateManager.gameData.balance,
                cascades: cascadeCount,
                scatters: scatterCount,
                bonusTriggered: bonusTriggered,
                freeSpinsEnded: freeSpinsEnded,
                freeSpinsActive: this.scene.stateManager.freeSpinsData.active,
                freeSpinsCount: this.scene.stateManager.freeSpinsData.count,
                multiplierAccumulator: this.scene.stateManager.freeSpinsData.multiplierAccumulator
            };
        } catch (error) {
            console.error('Error in performBurstSpin:', error);
            this.scene.isSpinning = false;
            return {
                win: 0,
                bet: this.scene.stateManager.gameData.currentBet,
                balance: this.scene.stateManager.gameData.balance,
                cascades: 0,
                scatters: 0,
                bonusTriggered: false,
                freeSpinsEnded: false,
                freeSpinsActive: false,
                freeSpinsCount: 0,
                multiplierAccumulator: 1
            };
        }
    }
    
    addResult(result) {
        console.log('Adding burst result:', result);
        
        // Safety check for burst results container
        if (!this.burstResultsContainer) {
            console.warn('Burst results container not found, skipping result display');
            return;
        }
        
        try {
            const resultText = this.createResultText(result);
            this.burstResultsContainer.add(resultText);
            
            const containerSize = this.burstResultsContainer.list ? this.burstResultsContainer.list.length : 0;
            console.log('Burst results container now has', containerSize, 'items');
            
            // Scroll existing results up
            if (this.burstResultsContainer.list) {
                this.burstResultsContainer.list.forEach((text, index) => {
                    if (index < this.burstResultsContainer.list.length - 1) {
                        this.scene.tweens.add({
                            targets: text,
                            y: text.y - 30,
                            duration: 200,
                            ease: 'Power2'
                        });
                    }
                });
                
                // Remove old results if too many
                if (this.burstResultsContainer.list.length > 15) {
                    const oldText = this.burstResultsContainer.list[0];
                    this.burstResultsContainer.remove(oldText);
                    oldText.destroy();
                }
            }
        } catch (error) {
            console.error('Error adding burst result:', error);
        }
        
        // Update UI displays
        this.scene.totalWin = result.win;
        this.scene.updateBalanceDisplay();
        this.scene.updateWinDisplay();
        
        // Update burst mode UI displays
        this.updateDisplays();
    }
    
    createResultText(result) {
        try {
            const width = this.scene.cameras.main.width;
            const isWin = result.win > 0;
            const color = isWin ? '#00FF00' : '#FFFFFF';
            const winMultiplier = result.bet > 0 ? (result.win / result.bet).toFixed(1) : '0.0';
            
            let resultString = '';
            
            // Show free spin status if active
            if (result.freeSpinsActive && this.scene.stateManager.freeSpinsData) {
                const totalCount = this.scene.stateManager.freeSpinsData.totalCount || 0;
                const currentCount = result.freeSpinsCount || 0;
                resultString += `[FREE SPIN ${totalCount - currentCount + 1}/${totalCount}] `;
            }
            
            resultString += `Spin: $${result.bet.toFixed(2)} → `;
            
            if (isWin) {
                resultString += `WIN $${result.win.toFixed(2)} (${winMultiplier}x)`;
                if (result.cascades > 1) {
                    resultString += ` [${result.cascades} cascades]`;
                }
                if (result.freeSpinsActive && result.multiplierAccumulator > 1) {
                    resultString += ` [Multiplier: x${result.multiplierAccumulator}]`;
                }
            } else {
                resultString += `No Win`;
            }
            
            // Add bonus notifications
            if (result.scatters >= 4) {
                if (result.bonusTriggered && !result.freeSpinsActive) {
                    resultString += ` | FREE SPINS TRIGGERED!`;
                } else if (result.bonusTriggered && result.freeSpinsActive) {
                    resultString += ` | FREE SPINS RETRIGGERED!`;
                }
            }
            
            if (result.freeSpinsEnded) {
                resultString += ` | FREE SPINS COMPLETE`;
            }
            
            const yPosition = (this.burstResultsContainer.list ? this.burstResultsContainer.list.length : 0) * 30;
            const text = this.scene.add.text(0, yPosition, resultString, {
                fontSize: '16px',
                fontFamily: 'Arial',
                color: color,
                stroke: '#000000',
                strokeThickness: 1
            });
            
            // Debug: log text creation
            console.log('Created burst text at position:', text.x, text.y, 'with text:', resultString);
            
            // Animate entrance
            text.setAlpha(0);
            this.scene.tweens.add({
                targets: text,
                alpha: 1,
                duration: 300,
                ease: 'Power2'
            });
            
            return text;
        } catch (error) {
            console.error('Error creating burst result text:', error);
            // Return a simple fallback text
            return this.scene.add.text(0, 0, 'Error displaying result', {
                fontSize: '16px',
                fontFamily: 'Arial',
                color: '#FF0000'
            });
        }
    }
    
    updateDisplays() {
        if (this.burstBalanceText) {
            const oldBalance = parseFloat(this.burstBalanceText.text.replace('$', ''));
            const newBalance = this.scene.stateManager.gameData.balance;
            this.burstBalanceText.setText(`$${newBalance.toFixed(2)}`);
            
            // Show light effect if balance changed
            if (Math.abs(oldBalance - newBalance) > 0.01 && this.burstScoreLights) {
                this.showScoreLight(0); // Total box light
            }
        }
        if (this.burstWinText) {
            const oldWin = parseFloat(this.burstWinText.text.replace('$', ''));
            const newWin = this.scene.totalWin;
            this.burstWinText.setText(`$${newWin.toFixed(2)}`);
            
            // Show light effect if win changed and is positive
            if (newWin > 0 && Math.abs(oldWin - newWin) > 0.01 && this.burstScoreLights) {
                this.showScoreLight(1); // Win box light
            }
        }
        if (this.burstBetText) {
            this.burstBetText.setText(`$${this.scene.stateManager.gameData.currentBet.toFixed(2)}`);
        }
    }
    
    showScoreLight(index) {
        if (!this.burstScoreLights || !this.burstScoreLights[index]) return;
        
        const light = this.burstScoreLights[index];
        
        // Reset any existing tweens
        this.scene.tweens.killTweensOf(light);
        
        // Play the light animation
        light.setAlpha(1);
        light.play('ui_scoreup_light_animation');
        
        // Fade out after animation
        this.scene.time.delayedCall(500, () => {
            this.scene.tweens.add({
                targets: light,
                alpha: 0,
                duration: 300,
                ease: 'Power2',
                onComplete: () => {
                    light.stop();
                }
            });
        });
    }
    
    // Getters
    isActive() { return this.burstModeActive; }
} 
// Phaser is loaded globally
// All classes are loaded globally

window.GameScene = class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }
    
    create() {
        this.stateManager = this.game.stateManager;
        this.stateManager.setState(this.stateManager.states.PLAYING);
        
        // Create animation manager and animations FIRST before creating UI elements
        this.animationManager = new window.AnimationManager(this);
        this.animationManager.createAllAnimations();
        
        // Create UI manager and UI elements
        this.uiManager = new window.UIManager(this);
        this.uiElements = this.uiManager.createUI();
        
        // Create burst mode manager
        this.burstModeManager = new window.BurstModeManager(this);
        
        // Create win presentation manager
        this.winPresentationManager = new window.WinPresentationManager(this);
        
        // Create free spins manager
        this.freeSpinsManager = new window.FreeSpinsManager(this);
        
        // Create bonus manager
        this.bonusManager = new window.BonusManager(this);
        
        // Initialize grid manager
        this.gridManager = new window.GridManager(this);
        
        // Initialize win calculator
        this.winCalculator = new window.WinCalculator(this);
        
        // UI manager is now replaced by direct UI element management
        
        // Position grid in center with proper spacing for UI
        const gridWidth = this.gridManager.getGridWidth();
        const gridHeight = this.gridManager.getGridHeight();
        
        // Calculate positioning based on Phaser Editor scene (ui_plane position)
        const canvasWidth = this.cameras.main.width;
        const canvasHeight = this.cameras.main.height;
        const uiScaleX = canvasWidth / 1280;
        const uiScaleY = canvasHeight / 720;
        
        // The ui_plane (ui_box) is positioned at (632, 347) in the 1280x720 design
        // This is the center of the ui_box
        const uiBoxCenterX = 656 * uiScaleX;
        const uiBoxCenterY = 353 * uiScaleY;
        
        // The ui_box has a 0.67 scale factor applied, we need to account for this
        const uiBoxScale = 0.67 * Math.min(uiScaleX, uiScaleY);
        
        // Calculate grid top-left position to center it within the ui_box
        // Fine-tuned offsets to align symbols with ui_box grid cells
        const gridOffsetX = 4;   // Horizontal offset optimized for cell centers
        const gridOffsetY = 4;   // Vertical offset optimized for cell centers
        
        // Position grid centered on ui_box with precise offsets
        const gridX = uiBoxCenterX - (gridWidth / 2) + gridOffsetX;
        const gridY = uiBoxCenterY - (gridHeight / 2) + gridOffsetY;
        
        this.gridManager.setPosition(gridX, gridY);
        
        // UI is now created by UIManager above
        
        // Create debug panel
        this.createDebugPanel();
        
        // Fill initial grid
        this.gridManager.fillGrid();
        
        // Initialize game variables
        this.totalWin = 0;
        this.cascadeMultiplier = 1;
        this.isSpinning = false;
        this.quickSpinEnabled = false;
        
        // Start background music if enabled
        if (this.stateManager.gameData.musicEnabled && !this.sound.get('bgm_infinity_storm')) {
            this.bgMusic = window.SafeSound.add(this, 'bgm_infinity_storm', { loop: true, volume: 0.3 });
            if (this.bgMusic) this.bgMusic.play();
        }
        
        // Debug controls - store references for cleanup
        this.keyboardListeners = [];
        
        // Add test key for gem destruction animations (DEBUG)
        const keyDListener = () => {
            this.animationManager.testGemDestructionAnimations();
        };
        this.input.keyboard.on('keydown-D', keyDListener);
        this.keyboardListeners.push({key: 'keydown-D', callback: keyDListener});
        
        // Add test key for spin button animation (DEBUG)
        const keySListener = () => {
            this.animationManager.testSpinButtonAnimation();
        };
        this.input.keyboard.on('keydown-S', keySListener);
        this.keyboardListeners.push({key: 'keydown-S', callback: keySListener});
        
        // Add test key for Scarlet Witch animation (DEBUG)
        const keyWListener = () => {
            this.animationManager.testScarletWitchAnimation();
        };
        this.input.keyboard.on('keydown-W', keyWListener);
        this.keyboardListeners.push({key: 'keydown-W', callback: keyWListener});
        
        // Add test key for Thanos animation (DEBUG)
        const keyTListener = () => {
            this.animationManager.testThanosAnimation();
        };
        this.input.keyboard.on('keydown-T', keyTListener);
        this.keyboardListeners.push({key: 'keydown-T', callback: keyTListener});
    }
        

    
    createFallbackButtons() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Only create fallback buttons if the main UI elements failed to load
        if (!this.ui_spin) {
            console.log('Creating fallback SPIN button');
            this.fallbackSpinButton = this.createButton(width / 2, height - 100, 'SPIN', () => this.handleSpinButtonClick());
        }
        
        if (!this.ui_number_bet_minus || !this.ui_number_bet_plus) {
            console.log('Creating fallback bet adjustment buttons');
            this.fallbackMinusButton = this.createSmallButton(width / 2 - 150, height - 100, '-', () => this.adjustBet(-1));
            this.fallbackPlusButton = this.createSmallButton(width / 2 + 150, height - 100, '+', () => this.adjustBet(1));
        }
        
        if (!this.ui_small_menu) {
            console.log('Creating fallback MENU button');
            this.fallbackMenuButton = this.createSmallButton(100, height - 50, 'MENU', () => {
                this.sound.stopAll();
                this.scene.start('MenuScene');
            });
        }
        
        if (!this.ui_small_burst) {
            console.log('Creating fallback BURST button');
            this.fallbackBurstButton = this.createSmallButton(width - 100, height - 50, 'BURST', () => this.toggleBurstMode());
        }
    }
    
    createButton(x, y, text, callback) {
        const button = this.add.container(x, y);
        
        const bg = this.add.image(0, 0, 'button');
        bg.setInteractive({ useHandCursor: true });
        bg.setScale(0.6); // Make buttons smaller
        
        const label = this.add.text(0, 0, text, {
            fontSize: '20px', // Smaller font
            fontFamily: 'Arial Black',
            color: '#ffffff'
        });
        label.setOrigin(0.5);
        
        button.add([bg, label]);
        button.callback = callback;
        
        bg.on('pointerup', () => {
            if (!button.disabled) {
                window.SafeSound.play(this, 'click');
                callback();
            }
        });
        
        bg.on('pointerover', () => {
            if (!button.disabled) {
                button.setScale(1.1);
            }
        });
        
        bg.on('pointerout', () => {
            button.setScale(1);
        });
        
        return button;
    }
    
    createSmallButton(x, y, text, callback) {
        const button = this.add.container(x, y);
        
        const bg = this.add.rectangle(0, 0, 70, 35, 0x6B46C1); // Smaller buttons
        bg.setStrokeStyle(2, 0xffffff);
        bg.setInteractive({ useHandCursor: true });
        
        const label = this.add.text(0, 0, text, {
            fontSize: '16px', // Smaller font
            fontFamily: 'Arial',
            color: '#ffffff'
        });
        label.setOrigin(0.5);
        
        button.add([bg, label]);
        
        bg.on('pointerup', () => {
            window.SafeSound.play(this, 'click');
            callback();
        });
        
        bg.on('pointerover', () => {
            bg.setFillStyle(0x9B59B6);
        });
        
        bg.on('pointerout', () => {
            bg.setFillStyle(0x6B46C1);
        });
        
        return button;
    }
    
    createDebugPanel() {
        const width = this.cameras.main.width;
        
        // Debug panel background - top right
        this.debugPanel = this.add.rectangle(width - 200, 120, 380, 200, 0x000000, 0.8);
        this.debugPanel.setStrokeStyle(2, 0xFFFFFF);
        
        // Debug title
        this.debugTitle = this.add.text(width - 200, 50, 'WIN CALCULATION DEBUG', {
            fontSize: '14px',
            fontFamily: 'Arial Bold',
            color: '#FFD700'
        });
        this.debugTitle.setOrigin(0.5);
        
        // Debug text lines
        this.debugLines = [];
        for (let i = 0; i < 8; i++) {
            const line = this.add.text(width - 380, 80 + (i * 18), '', {
                fontSize: '11px',
                fontFamily: 'Arial',
                color: '#FFFFFF'
            });
            line.setOrigin(0, 0);
            this.debugLines.push(line);
        }
        
        // Initially hide debug panel
        this.setDebugPanelVisible(false);
    }
    
    setDebugPanelVisible(visible) {
        this.debugPanel.setVisible(visible);
        this.debugTitle.setVisible(visible);
        this.debugLines.forEach(line => line.setVisible(visible));
    }
    
    updateDebugPanel(matches, totalWin, bet) {
        this.setDebugPanelVisible(true);
        
        let lineIndex = 0;
        this.debugLines[lineIndex++].setText(`Total Win: $${totalWin.toFixed(2)} (${(totalWin/bet).toFixed(1)}x)`);
        this.debugLines[lineIndex++].setText(`Bet: $${bet.toFixed(2)} | Matches: ${matches.length}`);
        this.debugLines[lineIndex++].setText('');
        
        matches.forEach((match, index) => {
            if (lineIndex >= this.debugLines.length) return;
            
            const symbolType = match[0].symbol.symbolType;
            const symbolInfo = window.GameConfig.SYMBOLS[symbolType.toUpperCase()];
            const matchSize = match.length;
            
            // Get highest multiplier in this match
            let highestMultiplier = 1;
            match.forEach(({ symbol }) => {
                if (symbol && symbol.multiplier > highestMultiplier) {
                    highestMultiplier = symbol.multiplier;
                }
            });
            
            // Get the appropriate payout multiplier based on match size
            let payoutMultiplier = 0;
            if (symbolInfo.type === 'scatter') {
                payoutMultiplier = symbolInfo.payouts[matchSize] || 0;
            } else {
                if (matchSize >= 12) {
                    payoutMultiplier = symbolInfo.payouts[12];
                } else if (matchSize >= 10) {
                    payoutMultiplier = symbolInfo.payouts[10];
                } else if (matchSize >= 8) {
                    payoutMultiplier = symbolInfo.payouts[8];
                }
            }
            
            const baseWin = (bet / 20) * payoutMultiplier;
            const finalWin = baseWin * highestMultiplier;
            
            this.debugLines[lineIndex++].setText(`${symbolType}: ${matchSize} symbols`);
            if (lineIndex < this.debugLines.length) {
                this.debugLines[lineIndex++].setText(`  (${bet}/20)*${payoutMultiplier}*${highestMultiplier} = $${finalWin.toFixed(2)}`);
            }
        });
        
        // Clear remaining lines
        for (let i = lineIndex; i < this.debugLines.length; i++) {
            this.debugLines[i].setText('');
        }
    }
    
    adjustBet(direction) {
        const currentIndex = window.GameConfig.BET_LEVELS.indexOf(this.stateManager.gameData.currentBet);
        let newIndex = currentIndex + direction;
        
        newIndex = Math.max(0, Math.min(window.GameConfig.BET_LEVELS.length - 1, newIndex));
        
        this.stateManager.setBet(window.GameConfig.BET_LEVELS[newIndex]);
        this.updateBetDisplay();
    }
    
    toggleAutoplay() {
        if (this.stateManager.gameData.autoplayActive) {
            this.stateManager.stopAutoplay();
            // No need to update button text as ui_small_stop is an image button
        } else {
            this.showAutoplayMenu();
        }
    }
    
    showAutoplayMenu() {
        // Don't show autoplay menu if already spinning or in free spins
        if (this.isSpinning || this.stateManager.freeSpinsData.active) {
            this.showMessage('Cannot start autoplay during Free Spins or while spinning!');
            return;
        }
        
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Create overlay
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);
        overlay.setDepth(1500);
        overlay.setInteractive(); // Block clicks behind it
        
        // Menu background
        const menuBg = this.add.rectangle(width / 2, height / 2, 600, 400, 0x2C3E50, 1);
        menuBg.setStrokeStyle(4, 0xFFD700);
        menuBg.setDepth(1501);
        
        // Title
        const title = this.add.text(width / 2, height / 2 - 150, 'SELECT AUTOPLAY SPINS', {
            fontSize: '32px',
            fontFamily: 'Arial Black',
            color: '#FFD700'
        });
        title.setOrigin(0.5);
        title.setDepth(1502);
        
        // Store references for cleanup
        const menuElements = [overlay, menuBg, title];
        
        // Create autoplay option buttons
        const options = window.GameConfig.AUTOPLAY_OPTIONS;
        const buttonsPerRow = 3;
        const buttonWidth = 140;
        const buttonHeight = 50;
        const buttonSpacing = 20;
        const startX = width / 2 - ((buttonsPerRow * buttonWidth + (buttonsPerRow - 1) * buttonSpacing) / 2);
        const startY = height / 2 - 50;
        
        options.forEach((spins, index) => {
            const row = Math.floor(index / buttonsPerRow);
            const col = index % buttonsPerRow;
            const x = startX + col * (buttonWidth + buttonSpacing) + buttonWidth / 2;
            const y = startY + row * (buttonHeight + buttonSpacing);
            
            const button = this.createAutoplayOptionButton(
                x, y, 
                spins === -1 ? 'INFINITE' : `${spins} SPINS`,
                spins,
                menuElements
            );
            menuElements.push(button);
        });
        
        // Cancel button
        const cancelBtn = this.add.container(width / 2, height / 2 + 120);
        const cancelBg = this.add.rectangle(0, 0, 160, 50, 0xE74C3C);
        cancelBg.setStrokeStyle(2, 0xFFFFFF);
        cancelBg.setInteractive({ useHandCursor: true });
        const cancelLabel = this.add.text(0, 0, 'CANCEL', {
            fontSize: '20px',
            fontFamily: 'Arial Bold',
            color: '#FFFFFF'
        });
        cancelLabel.setOrigin(0.5);
        cancelBtn.add([cancelBg, cancelLabel]);
        cancelBtn.setDepth(1502);
        menuElements.push(cancelBtn);
        
        // Cancel button handler
        cancelBg.on('pointerup', () => {
            menuElements.forEach(element => element.destroy());
            window.SafeSound.play(this, 'click');
        });
        
        // Button hover effects
        cancelBg.on('pointerover', () => cancelBg.setFillStyle(0xC0392B));
        cancelBg.on('pointerout', () => cancelBg.setFillStyle(0xE74C3C));
        
        window.SafeSound.play(this, 'click');
    }
    
    createAutoplayOptionButton(x, y, text, spins, menuElements) {
        const button = this.add.container(x, y);
        
        const bg = this.add.rectangle(0, 0, 140, 50, 0x27AE60);
        bg.setStrokeStyle(2, 0xFFFFFF);
        bg.setInteractive({ useHandCursor: true });
        
        const label = this.add.text(0, 0, text, {
            fontSize: '16px',
            fontFamily: 'Arial Bold',
            color: '#FFFFFF'
        });
        label.setOrigin(0.5);
        
        button.add([bg, label]);
        button.setDepth(1502);
        
        // Button click handler
        bg.on('pointerup', () => {
            // Close menu
            menuElements.forEach(element => element.destroy());
            
            // Start autoplay with selected number of spins
            this.startAutoplay(spins);
            
            window.SafeSound.play(this, 'click');
        });
        
        // Button hover effects
        bg.on('pointerover', () => bg.setFillStyle(0x2ECC71));
        bg.on('pointerout', () => bg.setFillStyle(0x27AE60));
        
        return button;
    }
    
    startAutoplay(spins) {
        this.stateManager.setAutoplay(spins);
        
        // Note: ui_small_stop is an image button, so no text update needed
        // The button functionality remains the same
        
        // Start spinning if not already spinning
        if (!this.isSpinning) {
            this.startSpin();
        }
        
        // Show confirmation message
        const message = spins === -1 ? 'Infinite Autoplay Started!' : `${spins} Autoplay Spins Started!`;
        this.showMessage(message);
    }
    
    async startSpin() {
        if (this.isSpinning) return;
        
        // Check if player can afford bet
        if (!this.stateManager.canAffordBet() && !this.stateManager.freeSpinsData.active) {
            this.showMessage('Insufficient Balance!');
            return;
        }
        
        this.isSpinning = true;
        this.totalWin = 0;
        this.cascadeMultiplier = 1;
        
        // Start spin button animation
        const spinButton = this.uiManager && this.uiManager.getSpinButton();
        if (spinButton && this.anims.exists('animation')) {
            spinButton.play('animation');
        }
        
        // Disable buttons
        this.setButtonsEnabled(false);
        
        // Place bet or use free spin
        if (this.stateManager.freeSpinsData.active) {
            this.stateManager.useFreeSpins();
            this.uiManager.updateFreeSpinsDisplay();
        } else {
            this.stateManager.placeBet();
        }
        
        // Update balance
        this.updateBalanceDisplay();
        
        // Clear current grid with animation
        await this.clearGridWithAnimation();
        
        // Fill new grid with cascading animation
        await this.fillGridWithCascade();
        
        // Play spin sound
        window.SafeSound.play(this, 'spin');
        
        // Debug: Show grid state before cascades
        this.debugGridState();
        
        // Start cascade process
        await this.processCascades();
        
        // Check for other bonus features
        this.freeSpinsManager.checkOtherBonusFeatures();
        
        // Check for Random Multiplier after spin results are decided
        await this.bonusManager.checkRandomMultiplier();
        
        // End spin
        this.endSpin();
    }
    
    async clearGridWithAnimation() {
        const promises = [];
        
        for (let col = 0; col < this.gridManager.cols; col++) {
            for (let row = 0; row < this.gridManager.rows; row++) {
                const symbol = this.gridManager.grid[col][row];
                if (symbol) {
                    const promise = new Promise(resolve => {
                        this.tweens.add({
                            targets: symbol,
                            alpha: 0,
                            scaleX: 0,
                            scaleY: 0,
                            duration: 200,
                            delay: (col + row) * 20,
                            ease: 'Power2',
                            onComplete: () => {
                                symbol.destroy();
                                resolve();
                            }
                        });
                    });
                    promises.push(promise);
                }
            }
        }
        
        await Promise.all(promises);
        this.gridManager.initializeGrid();
    }
    
    async fillGridWithCascade() {
        const promises = [];
        
        // Stop any existing idle animations
        this.gridManager.stopAllIdleAnimations();
        
        // Temporarily disable match checking
        this.gridManager.isInitialFill = true;
        
        // Fill the grid with new symbols starting from above
        for (let col = 0; col < this.gridManager.cols; col++) {
            for (let row = 0; row < this.gridManager.rows; row++) {
                const randomType = this.gridManager.getRandomSymbolType();
                const symbol = this.gridManager.createSymbol(randomType, col, row);
                
                // Start position above the grid
                const startY = this.gridManager.gridY - this.gridManager.symbolSize * (this.gridManager.rows - row + 1);
                const targetPos = this.gridManager.getSymbolPosition(col, row);
                
                symbol.setPosition(targetPos.x, startY);
                symbol.setAlpha(0);
                symbol.setScale(0.8);
                this.gridManager.grid[col][row] = symbol;
                
                // Hide all effects during cascade
                if (symbol.shadowEffect) symbol.shadowEffect.setVisible(false);
                if (symbol.glowEffect) symbol.glowEffect.setVisible(false);
                
                // Create cascading animation with staggered delays
                const promise = new Promise(resolve => {
                    // Fade in
                    this.tweens.add({
                        targets: symbol,
                        alpha: 1,
                        scaleX: 1,
                        scaleY: 1,
                        duration: 200,
                        delay: (col * 50) + (row * 30), // Stagger by column and row
                        ease: 'Power2',
                        onStart: () => {
                            // Show shadow effect when symbol starts appearing
                            if (symbol.shadowEffect) {
                                symbol.shadowEffect.setVisible(true);
                                symbol.shadowEffect.setAlpha(0);
                                this.tweens.add({
                                    targets: symbol.shadowEffect,
                                    alpha: 0.3,
                                    duration: 200
                                });
                            }
                        }
                    });
                    
                    // Drop animation - only resolve when this completes
                    this.tweens.add({
                        targets: symbol,
                        y: targetPos.y,
                        duration: window.GameConfig.CASCADE_SPEED || 400,
                        delay: (col * 50) + (row * 30), // Same stagger
                        ease: 'Bounce.out',
                        onComplete: () => {
                            // Show shadow effect after landing
                            if (symbol.shadowEffect) {
                                symbol.shadowEffect.setVisible(true);
                                symbol.shadowEffect.setPosition(symbol.x + 5, symbol.y + 5);
                            }
                            // Add a small delay to ensure animation fully settles
                            this.time.delayedCall(50, resolve);
                        }
                    });
                    
                    // Move shadow with symbol (but keep it hidden)
                    if (symbol.shadowEffect) {
                        symbol.shadowEffect.setPosition(targetPos.x + 5, startY + 5);
                        this.tweens.add({
                            targets: symbol.shadowEffect,
                            y: targetPos.y + 5,
                            duration: window.GameConfig.CASCADE_SPEED || 400,
                            delay: (col * 50) + (row * 30),
                            ease: 'Bounce.out'
                        });
                    }
                });
                
                promises.push(promise);
            }
        }
        
        // Wait for all symbols to cascade down
        await Promise.all(promises);
        
        // Add a small delay to ensure all animations are fully settled
        await this.delay(100);
        
        // Re-enable match checking
        this.gridManager.isInitialFill = false;
        
        // Start idle animations after all symbols are in place
        this.gridManager.startAllIdleAnimations();
    }
    
    async processCascades() {
        let hasMatches = true;
        let cascadeCount = 0;
        
        while (hasMatches) {
            // Find matches
            const matches = this.gridManager.findMatches();
            
            // Debug: Log match detection
            console.log(`=== MATCH DETECTION (Cascade ${cascadeCount + 1}) ===`);
            console.log(`Matches found: ${matches.length}`);
            matches.forEach((match, index) => {
                const symbolType = match[0].symbol.symbolType;
                const positions = match.map(m => `(${m.col},${m.row})`).join(', ');
                console.log(`Match ${index + 1}: ${symbolType} - ${match.length} symbols at ${positions}`);
            });
            
            if (matches.length > 0) {
                // Calculate win using WinCalculator
                const win = this.winCalculator.calculateTotalWin(matches, this.stateManager.gameData.currentBet);
                this.totalWin += win;
                
                // Debug: Show win calculation details
                this.showWinCalculationDebug(matches, win);
                
                // Update debug panel
                this.updateDebugPanel(matches, win, this.stateManager.gameData.currentBet);
                
                // Update win display
                this.updateWinDisplay();
                
                            // Play win sound
            window.SafeSound.play(this, 'win');
                
                // Highlight matches
                this.gridManager.highlightMatches(matches);
                
                // Wait a bit
                await this.delay(500);
                
                // Stop all animations before removing matches
                this.gridManager.stopAllSymbolAnimations();
                
                // Remove matches
                this.gridManager.removeMatches(matches);
                
                            // Play cascade sound
            window.SafeSound.play(this, 'cascade');
                
                // Wait for removal
                await this.delay(window.GameConfig.ANIMATIONS.SYMBOL_DESTROY_TIME);
                
                // Cascade symbols
                await this.gridManager.cascadeSymbols();
                
                cascadeCount++;
                
                // Apply cascade multiplier in free spins with new trigger chance
                await this.freeSpinsManager.processCascadeMultiplier(cascadeCount);
            } else {
                hasMatches = false;
                // Hide debug panel when no matches
                if (cascadeCount === 0) {
                    this.setDebugPanelVisible(false);
                }
            }
        }
        
        // Check for Cascading Random Multipliers after all cascades finish
        if (cascadeCount > 0) { // Only if there were cascades
            await this.bonusManager.checkCascadingRandomMultipliers();
        }
    }
    
    // Win calculation is now handled by WinCalculator
    
    // Win presentation is now handled by WinPresentationManager
    
    // Win particles are now handled by WinPresentationManager
    // Other bonus features are now handled by FreeSpinsManager
    

    // Free spins triggering is now handled by FreeSpinsManager
    
        // Free spins display updates are now handled by UIManager directly
    
    updateSpinButtonText() {
        // ui_spin is an image button, so no text update needed
        // The button functionality is handled by handleSpinButtonClick()
    }
    
    handleSpinButtonClick() {
        this.freeSpinsManager.handleSpinButtonClick();
    }
    

    

    

    

    


    showMessage(text) {
        console.log(`=== SHOW MESSAGE ===`);
        console.log(`Message: ${text}`);
        
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // In burst mode, show messages at the top instead of center
        const isBurstMode = this.burstModeManager && this.burstModeManager.isActive();
        const messageY = isBurstMode ? 100 : height / 2;
        const fontSize = isBurstMode ? '24px' : '48px';
        
        const message = this.add.text(
            width / 2,
            messageY,
            text,
            {
                fontSize: fontSize,
                fontFamily: 'Arial Black',
                color: '#FFD700',
                stroke: '#000000',
                strokeThickness: isBurstMode ? 3 : 6
            }
        );
        message.setOrigin(0.5);
        message.setScale(0);
        message.setDepth(isBurstMode ? 2100 : 1000); // Higher depth in burst mode
        
        console.log(`Message created at position: (${message.x}, ${message.y})`);
        console.log(`Camera dimensions: ${width} x ${height}`);
        
        this.tweens.add({
            targets: message,
            scaleX: 1,
            scaleY: 1,
            duration: 500,
            ease: 'Back.out',
            onComplete: () => {
                console.log(`Message animation complete, will fade in 1500ms`);
                this.time.delayedCall(1500, () => {
                    this.tweens.add({
                        targets: message,
                        alpha: 0,
                        y: message.y - 50,
                        duration: 500,
                        onComplete: () => {
                            console.log(`Message destroyed`);
                            message.destroy();
                        }
                    });
                });
            }
        });
        
        console.log(`=== END SHOW MESSAGE ===`);
    }
    
    // Big free spins message is now handled by WinPresentationManager
    
    // Free spins complete screen is now handled by WinPresentationManager
    

    
    async endSpin() {
        // Stop spin button animation
        const spinButton = this.uiManager && this.uiManager.getSpinButton();
        if (spinButton) {
            spinButton.stop();
            spinButton.setFrame(0); // Reset to first frame
        }
        
        // Add win to balance
        if (this.totalWin > 0) {
            this.stateManager.addWin(this.totalWin);
            this.updateBalanceDisplay();
            
            // Show win presentation for big wins
            this.winPresentationManager.showWinPresentation(this.totalWin);
            
            // Add free spins win
            this.freeSpinsManager.addFreeSpinsWin(this.totalWin);
        }
        
        // Check if free spins ended
        await this.freeSpinsManager.handleFreeSpinsEnd();
        
        // Start idle animations for all symbols now that spin is complete
        this.gridManager.startAllIdleAnimations();
        
        // Re-enable buttons
        this.setButtonsEnabled(true);
        this.isSpinning = false;
        
        // Update spin button text based on free spins status
        this.updateSpinButtonText();
        
        // Handle free spins auto-play
        const freeSpinsHandled = this.freeSpinsManager.handleFreeSpinsAutoPlay();
        
        // Handle regular autoplay
        if (!freeSpinsHandled && this.stateManager.gameData.autoplayActive) {
            this.stateManager.decrementAutoplay();
            
            // Check if autoplay should continue
            if (this.stateManager.gameData.autoplayCount === 0) {
                // Autoplay finished - ui_small_stop remains as image button
                console.log('Autoplay finished');
            } else {
                // Continue autoplay - ui_small_stop remains as image button
                console.log(`Autoplay continuing: ${this.stateManager.gameData.autoplayCount} spins remaining`);
                
                // Continue autoplay after delay, but wait for win presentation
                const checkAndStartAutoSpin = () => {
                    // Safety check to ensure scene is still active
                    if (!this.scene || !this.scene.isActive()) {
                        return;
                    }
                    
                    if (!this.winPresentationManager.isShowingPresentation() && this.stateManager && 
                        this.stateManager.gameData && this.stateManager.gameData.autoplayActive && !this.isSpinning) {
                        this.startSpin();
                    } else if (this.winPresentationManager.isShowingPresentation() && this.time) {
                        // Check again in 500ms if still showing win presentation
                        this.time.delayedCall(500, checkAndStartAutoSpin);
                    }
                };
                
                // Start checking after 1 second
                this.time.delayedCall(1000, checkAndStartAutoSpin);
            }
        }
        
        // Save game state
        this.stateManager.saveState();
    }
    
    // setButtonsEnabled method is now defined in the helper methods section
    
    showWinCalculationDebug(matches, totalWin) {
        console.log('=== WIN CALCULATION DEBUG ===');
        console.log(`Total Win: $${totalWin.toFixed(2)}`);
        console.log(`Bet: $${this.stateManager.gameData.currentBet.toFixed(2)}`);
        console.log(`Matches found: ${matches.length}`);
        
        matches.forEach((match, index) => {
            const symbolType = match[0].symbol.symbolType;
            const symbolInfo = window.GameConfig.SYMBOLS[symbolType.toUpperCase()];
            const matchSize = match.length;
            
            // Get highest multiplier in this match
            let highestMultiplier = 1;
            match.forEach(({ symbol }) => {
                if (symbol && symbol.multiplier > highestMultiplier) {
                    highestMultiplier = symbol.multiplier;
                }
            });
            
            // Get the appropriate payout multiplier based on match size
            let payoutMultiplier = 0;
            if (symbolInfo.type === 'scatter') {
                payoutMultiplier = symbolInfo.payouts[matchSize] || 0;
            } else {
                if (matchSize >= 12) {
                    payoutMultiplier = symbolInfo.payouts[12];
                } else if (matchSize >= 10) {
                    payoutMultiplier = symbolInfo.payouts[10];
                } else if (matchSize >= 8) {
                    payoutMultiplier = symbolInfo.payouts[8];
                }
            }
            
            const baseWin = (this.stateManager.gameData.currentBet / 20) * payoutMultiplier;
            const finalWin = baseWin * highestMultiplier;
            
            console.log(`Match ${index + 1}:`);
            console.log(`  Symbol: ${symbolType} (${matchSize} symbols)`);
            console.log(`  Formula: (${this.stateManager.gameData.currentBet}/20) * ${payoutMultiplier} = $${baseWin.toFixed(2)}`);
            console.log(`  Highest Symbol Multiplier: ${highestMultiplier}x`);
            console.log(`  Final Match Win: $${finalWin.toFixed(2)}`);
            
            // Show positions with multipliers
            const positions = match.map(({ col, row, symbol }) => {
                const mult = symbol.multiplier || 1;
                return `(${col},${row})${mult > 1 ? ` x${mult}` : ''}`;
            }).join(', ');
            console.log(`  Positions: ${positions}`);
        });
        
        console.log('========================');
    }
    
    debugGridState() {
        console.log('=== GRID STATE ===');
        for (let row = 0; row < this.gridManager.rows; row++) {
            let rowStr = '';
            for (let col = 0; col < this.gridManager.cols; col++) {
                const symbol = this.gridManager.grid[col][row];
                if (symbol) {
                    const shortName = symbol.symbolType.replace('_gem', '').replace('_', '').substring(0, 4).toUpperCase();
                    rowStr += shortName.padEnd(6, ' ');
                } else {
                    rowStr += 'NULL  ';
                }
            }
            console.log(`Row ${row}: ${rowStr}`);
        }
        console.log('==================');
    }

    delay(ms) {
        return new Promise(resolve => {
            this.time.delayedCall(ms, resolve);
        });
    }

    showPurchaseUI() {
        this.freeSpinsManager.showPurchaseUI();
    }
    
    // Free spins purchase is now handled by FreeSpinsManager

    toggleBurstMode() {
        if (this.burstModeManager) {
            this.burstModeManager.toggle();
        }
    }
    
    enterBurstMode() {
        // Hide normal game elements
        this.setNormalGameVisible(false);
        
        // Create burst mode UI
        this.createBurstModeUI();
        
        // ui_small_burst is an image button, no text update needed
        
        // Enable quick spin for burst mode
        this.quickSpinEnabled = true;
        this.setQuickSpin(true);
        
        this.showMessage('BURST MODE ACTIVATED!');
        window.SafeSound.play(this, 'bonus');
    }
    
    exitBurstMode() {
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
        
        // ui_small_burst is an image button, no text update needed
        
        // Reset quick spin
        this.quickSpinEnabled = false;
        this.setQuickSpin(false);
        
        // Clear results
        this.burstSpinResults = [];
        
        this.showMessage('BURST MODE DEACTIVATED');
        window.SafeSound.play(this, 'click');
    }
    
    setNormalGameVisible(visible) {
        // Hide/show grid and character portraits
        this.gridManager.setVisible(visible);
        
        if (this.characterPortraits) {
            Object.values(this.characterPortraits).forEach(portrait => {
                portrait.setVisible(visible);
            });
        }
        
        // Hide/show debug panel
        if (!visible) {
            this.setDebugPanelVisible(false);
        }
        
        // Hide/show the main background when in burst mode
        if (this.children && this.children.list) {
            this.children.list.forEach(child => {
                // Hide background image and other visual elements
                if (child.texture && child.texture.key === 'bg_infinity_storm') {
                    child.setVisible(visible);
                }
            });
        }
        
        // Handle animated Scarlet Witch portrait separately
        if (this.portrait_scarlet_witch) {
            this.portrait_scarlet_witch.setVisible(visible);
            // If hiding in burst mode, pause animation to save performance
            if (this.portrait_scarlet_witch.anims) {
                if (visible) {
                    // Resume animation if it was paused
                    if (this.anims.exists('scarlet_witch_idle_animation')) {
                        this.portrait_scarlet_witch.play('scarlet_witch_idle_animation');
                    }
                } else {
                    // Pause animation when hidden
                    this.portrait_scarlet_witch.anims.pause();
                }
            }
        }
        
        // Handle animated Thanos portrait separately
        if (this.portrait_thanos) {
            this.portrait_thanos.setVisible(visible);
            // If hiding in burst mode, pause animation to save performance
            if (this.portrait_thanos.anims) {
                if (visible) {
                    // Resume animation if it was paused
                    if (this.anims.exists('thanos_idle_animation')) {
                        this.portrait_thanos.play('thanos_idle_animation');
                    }
                } else {
                    // Pause animation when hidden
                    this.portrait_thanos.anims.pause();
                }
            }
        }
    }
    
    createBurstModeUI() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        this.burstModeUI = this.add.container(0, 0);
        this.burstModeUI.setDepth(2000); // Set high depth for entire burst mode UI
        
        // Scale factors based on canvas size (burst.js uses 1280x720 design)
        const scaleX = width / 1280;
        const scaleY = height / 720;
        const uiScale = 0.67; // Base scale from burst.js
        
        // Background - ui_burstbg
        const bg = this.add.image(641 * scaleX, 361 * scaleY, 'ui_burstbg');
        bg.setScale(0.68 * scaleX, 0.68 * scaleY);
        this.burstModeUI.add(bg);
        
        // Three background panels
        const threebg03 = this.add.image(643 * scaleX, 320 * scaleY, 'ui_threebg03_1');
        threebg03.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(threebg03);
        
        const threebg01 = this.add.image(385 * scaleX, 365 * scaleY, 'ui_threebg01');
        threebg01.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(threebg01);
        
        const threebg02 = this.add.image(904 * scaleX, 365 * scaleY, 'ui_threebg02');
        threebg02.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(threebg02);
        
        // Burst boxes for value displays
        const burstbox1 = this.add.image(386 * scaleX, 570 * scaleY, 'ui_burstbox');
        burstbox1.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(burstbox1);
        
        const burstbox2 = this.add.image(644 * scaleX, 570 * scaleY, 'ui_burstbox');
        burstbox2.setScale(0.85 * scaleX, uiScale * scaleY);
        this.burstModeUI.add(burstbox2);
        
        const burstbox3 = this.add.image(906 * scaleX, 570 * scaleY, 'ui_burstbox');
        burstbox3.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(burstbox3);
        
        // Results container for scrolling text - position based on middle background panel
        this.burstResultsContainer = this.add.container(643 * scaleX - 400, 220 * scaleY);
        this.burstModeUI.add(this.burstResultsContainer);
        
        // Add a subtle background for the results area
        const resultsBg = this.add.rectangle(400, 100, 800, 200, 0x000000, 0.3);
        resultsBg.setStrokeStyle(1, 0x666666);
        this.burstResultsContainer.add(resultsBg);
        
        // Buttons
        // Single spin button
        const singleSpinBtn = this.add.image(455 * scaleX, 652 * scaleY, 'ui_burst_buttonplay');
        singleSpinBtn.setScale(uiScale * scaleX, uiScale * scaleY);
        singleSpinBtn.setInteractive({ useHandCursor: true });
        this.burstModeUI.add(singleSpinBtn);
        
        singleSpinBtn.on('pointerup', () => {
            if (!this.isSpinning) {
                window.SafeSound.play(this, 'click');
                this.burstSingleSpin();
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
        this.burstAutoBtn = this.add.sprite(646 * scaleX, 652 * scaleY, 'ui_burst_buttonplayloop_sprites');
        this.burstAutoBtn.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstAutoBtn.setInteractive({ useHandCursor: true });
        this.burstModeUI.add(this.burstAutoBtn);
        
        this.burstAutoBtn.on('pointerup', () => {
            window.SafeSound.play(this, 'click');
            this.toggleBurstAutoSpin();
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
        const betMinus = this.add.image(543 * scaleX, 652 * scaleY, 'ui_number_bet-');
        betMinus.setScale(uiScale * scaleX, uiScale * scaleY);
        betMinus.setInteractive({ useHandCursor: true });
        this.burstModeUI.add(betMinus);
        
        betMinus.on('pointerup', () => {
            window.SafeSound.play(this, 'click');
            this.adjustBet(-1);
            this.updateBurstModeDisplays();
        });
        
        betMinus.on('pointerover', () => {
            betMinus.setScale(betMinus.scaleX * 1.1, betMinus.scaleY * 1.1);
            betMinus.setTint(0xFFFFFF);
        });
        
        betMinus.on('pointerout', () => {
            betMinus.setScale(betMinus.scaleX / 1.1, betMinus.scaleY / 1.1);
            betMinus.clearTint();
        });
        
        const betPlus = this.add.image(750 * scaleX, 652 * scaleY, 'ui_number_bet+');
        betPlus.setScale(uiScale * scaleX, uiScale * scaleY);
        betPlus.setInteractive({ useHandCursor: true });
        this.burstModeUI.add(betPlus);
        
        betPlus.on('pointerup', () => {
            window.SafeSound.play(this, 'click');
            this.adjustBet(1);
            this.updateBurstModeDisplays();
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
        const exitBtn = this.add.image(840 * scaleX, 652 * scaleY, 'ui_burst_buttonexit');
        exitBtn.setScale(uiScale * scaleX, uiScale * scaleY);
        exitBtn.setInteractive({ useHandCursor: true });
        this.burstModeUI.add(exitBtn);
        
        exitBtn.on('pointerup', () => {
            window.SafeSound.play(this, 'click');
            this.toggleBurstMode();
        });
        
        exitBtn.on('pointerover', () => {
            exitBtn.setScale(exitBtn.scaleX * 1.1, exitBtn.scaleY * 1.1);
            exitBtn.setTint(0xFF6666);
        });
        
        exitBtn.on('pointerout', () => {
            exitBtn.setScale(exitBtn.scaleX / 1.1, exitBtn.scaleY / 1.1);
            exitBtn.clearTint();
        });
        
        // Text labels
        const labelStyle = {
            fontSize: Math.floor(30 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Bold',
            color: '#FFFFFF'
        };
        
        const totalLabel = this.add.text(339 * scaleX, 498 * scaleY, 'TOTAL', labelStyle);
        totalLabel.setOrigin(0.5);
        this.burstModeUI.add(totalLabel);
        
        const winLabel = this.add.text(614 * scaleX, 498 * scaleY, 'WIN', labelStyle);
        winLabel.setOrigin(0.5);
        this.burstModeUI.add(winLabel);
        
        const betLabel = this.add.text(877 * scaleX, 498 * scaleY, 'BET', labelStyle);
        betLabel.setOrigin(0.5);
        this.burstModeUI.add(betLabel);
        
        // Value displays
        const valueStyle = {
            fontSize: Math.floor(36 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Black',
            color: '#FFD700'
        };
        
        this.burstBalanceText = this.add.text(339 * scaleX, 545 * scaleY, `$${this.stateManager.gameData.balance.toFixed(2)}`, valueStyle);
        this.burstBalanceText.setOrigin(0.5);
        this.burstModeUI.add(this.burstBalanceText);
        
        this.burstWinText = this.add.text(614 * scaleX, 545 * scaleY, '$0.00', {
            ...valueStyle,
            color: '#00FF00'
        });
        this.burstWinText.setOrigin(0.5);
        this.burstModeUI.add(this.burstWinText);
        
        this.burstBetText = this.add.text(877 * scaleX, 545 * scaleY, `$${this.stateManager.gameData.currentBet.toFixed(2)}`, {
            ...valueStyle,
            color: '#FFFFFF'
        });
        this.burstBetText.setOrigin(0.5);
        this.burstModeUI.add(this.burstBetText);
        
        // Title at top
        const title = this.add.text(width / 2, 50 * scaleY, 'BURST MODE', {
            fontSize: Math.floor(48 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4
        });
        title.setOrigin(0.5);
        this.burstModeUI.add(title);
        
        // Create score light effects (initially invisible)
        this.burstScoreLights = [];
        const lightPositions = [
            { x: 339 * scaleX, y: 570 * scaleY }, // Total box
            { x: 614 * scaleX, y: 570 * scaleY }, // Win box
            { x: 877 * scaleX, y: 570 * scaleY }  // Bet box
        ];
        
        lightPositions.forEach((pos, index) => {
            const light = this.add.sprite(pos.x, pos.y, 'ui_scoreup_light_sprite');
            light.setScale(uiScale * scaleX * 1.5, uiScale * scaleY * 1.5);
            light.setAlpha(0);
            light.setBlendMode(Phaser.BlendModes.ADD);
            this.burstScoreLights.push(light);
            this.burstModeUI.add(light);
        });
    }
    

    
    async burstSingleSpin() {
        if (!this.burstModeActive) return;
        
        // Start spin button animation in burst mode
        const spinButton = this.uiManager && this.uiManager.getSpinButton();
        if (spinButton && this.anims.exists('animation')) {
            spinButton.play('animation');
        }
        
        const spinResult = await this.performBurstSpin();
        this.addBurstResult(spinResult);
        
        // Stop spin button animation
        if (spinButton) {
            spinButton.stop();
            spinButton.setFrame(0);
        }
        
        // Handle bonus notifications
        if (spinResult.bonusTriggered) {
            if (!spinResult.freeSpinsActive) {
                // Show free spins message in burst mode
                this.showMessage(`Free Spins Triggered! ${this.stateManager.freeSpinsData.count} spins`);
            } else {
                this.showMessage(`Free Spins Retriggered!`);
            }
        }
        
        if (spinResult.freeSpinsEnded) {
            this.showMessage(`Free Spins Complete! Total: $${this.stateManager.freeSpinsData.totalWin.toFixed(2)}`);
        }
    }
    
    toggleBurstAutoSpin() {
        this.burstAutoSpinning = !this.burstAutoSpinning;
        
        if (this.burstAutoSpinning) {
            // Start button animation
            if (this.burstAutoBtn) {
                this.burstAutoBtn.play('ui_burst_buttonplayloop_animation');
                this.burstAutoBtn.setTint(0x00FF00); // Green tint when auto-spinning
            }
            this.startBurstAutoSpin();
        } else {
            // Stop button animation
            if (this.burstAutoBtn) {
                this.burstAutoBtn.stop();
                this.burstAutoBtn.setFrame(0);
                this.burstAutoBtn.clearTint();
            }
        }
    }
    
    async startBurstAutoSpin() {
        try {
        while (this.burstAutoSpinning && this.burstModeActive) {
            if (!this.isSpinning && (this.stateManager.canAffordBet() || this.stateManager.freeSpinsData.active)) {
                    // Start spin button animation for auto-spin
                    if (this.ui_spin && this.anims.exists('animation')) {
                        this.ui_spin.play('animation');
                    }
                    
                const spinResult = await this.performBurstSpin();
                this.addBurstResult(spinResult);
                    
                    // Stop spin button animation
                    if (this.ui_spin) {
                        this.ui_spin.stop();
                        this.ui_spin.setFrame(0);
                    }
                
                // Handle bonus notifications
                if (spinResult.bonusTriggered) {
                    if (!spinResult.freeSpinsActive) {
                        this.showMessage(`Free Spins Triggered! ${this.stateManager.freeSpinsData.count} spins`);
                    } else {
                        this.showMessage(`Free Spins Retriggered!`);
                    }
                }
                
                if (spinResult.freeSpinsEnded) {
                    this.showMessage(`Free Spins Complete! Total: $${this.stateManager.freeSpinsData.totalWin.toFixed(2)}`);
                }
                
                // Short delay between auto spins
                await this.delay(200);
            } else {
                // Stop auto spin if can't afford bet and not in free spins
                if (!this.stateManager.freeSpinsData.active) {
                    this.burstAutoSpinning = false;
                    // Reset button appearance
                        if (this.burstAutoBtn) {
                            this.burstAutoBtn.stop();
                            this.burstAutoBtn.setFrame(0);
                            this.burstAutoBtn.clearTint();
                    }
                    this.showMessage('Insufficient Balance!');
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
            this.showMessage('Auto-spin stopped due to error');
        }
    }
    
    async performBurstSpin() {
        try {
        // Check if player can afford bet (unless in free spins)
        if (!this.stateManager.freeSpinsData.active && !this.stateManager.canAffordBet()) {
            return { win: 0, bet: 0, balance: this.stateManager.gameData.balance };
        }
        
        this.isSpinning = true;
        this.totalWin = 0;
        this.cascadeMultiplier = 1;
        
        // Use the same bet logic as normal game
        if (this.stateManager.freeSpinsData.active) {
            this.stateManager.useFreeSpins();
        } else {
            this.stateManager.placeBet();
        }
        
        const bet = this.stateManager.gameData.currentBet;
        
        // Clear and fill grid like normal game
        if (this.gridManager) {
        this.gridManager.initializeGrid();
        this.gridManager.fillGrid();
        } else {
            throw new Error('GridManager not available');
        }
        
        // Process cascades exactly like normal game but without animations
        let cascadeCount = 0;
        let hasMatches = true;
        
        while (hasMatches) {
            const matches = this.gridManager.findMatches();
            
            if (matches.length > 0) {
                // Calculate win using the same WinCalculator as normal game
                const win = this.winCalculator.calculateTotalWin(matches, bet);
                this.totalWin += win;
                
                // Remove matches without animation
                if (this.gridManager && this.gridManager.removeMatches) {
                this.gridManager.removeMatches(matches);
                }
                
                // Cascade symbols without animation (simplified for burst mode)
                try {
                    if (this.gridManager && this.gridManager.cascadeSymbols) {
                await this.gridManager.cascadeSymbols();
                    } else {
                        console.warn('GridManager or cascadeSymbols method not available');
                    }
                } catch (error) {
                    console.warn('Cascade error in burst mode:', error);
                    // Continue without cascading if there's an error
                }
                
                cascadeCount++;
                
                // Apply cascade multiplier in free spins like normal game
                if (this.stateManager.freeSpinsData.active && cascadeCount > 1) {
                    const shouldTrigger = Math.random() < window.GameConfig.FREE_SPINS.ACCUM_TRIGGER_CHANCE_PER_CASCADE;
                    if (shouldTrigger) {
                        const multiplierTable = window.GameConfig.RANDOM_MULTIPLIER.TABLE;
                        const randomMultiplier = multiplierTable[
                            Math.floor(Math.random() * multiplierTable.length)
                    ];
                    this.stateManager.accumulateMultiplier(randomMultiplier);
                    
                    // Update accumulated multiplier display in burst mode too
                    this.updateAccumulatedMultiplierDisplay();
                    }
                }
            } else {
                hasMatches = false;
            }
        }
        
        // Check for Cascading Random Multipliers in burst mode (simplified)
        this.bonusManager.checkBonusesInBurstMode(cascadeCount);
        
        // Add win to balance like normal game
        if (this.totalWin > 0) {
            this.stateManager.addWin(this.totalWin);
            
            // Add free spins win like normal game
            if (this.stateManager.freeSpinsData.active) {
                this.stateManager.freeSpinsData.totalWin += this.totalWin;
            }
        }
        
        // Check for bonus features like normal game
        const scatterCount = this.gridManager && this.gridManager.countScatters ? 
            this.gridManager.countScatters() : 0;
        let bonusTriggered = false;
        
        if (scatterCount >= 4 && !this.stateManager.freeSpinsData.active) {
            // Trigger free spins - 4+ scatters = 15 free spins
            const freeSpins = window.GameConfig.FREE_SPINS.SCATTER_4_PLUS;
            this.stateManager.startFreeSpins(freeSpins);
            bonusTriggered = true;
        } else if (scatterCount >= 4 && this.stateManager.freeSpinsData.active) {
            // Retrigger free spins - 4+ scatters = +5 extra free spins
            const extraSpins = window.GameConfig.FREE_SPINS.RETRIGGER_SPINS;
            this.stateManager.addFreeSpins(extraSpins);
            bonusTriggered = true;
        }
        
        // Check for Random Multiplier in burst mode (simplified)
        this.bonusManager.checkRandomMultiplierInBurstMode();
        
        // Check if free spins ended
        let freeSpinsEnded = false;
        if (this.stateManager.freeSpinsData.active && this.stateManager.freeSpinsData.count === 0) {
            this.stateManager.endFreeSpins();
            freeSpinsEnded = true;
        }
        
        this.isSpinning = false;
        
        return {
            win: this.totalWin,
            bet: bet,
            balance: this.stateManager.gameData.balance,
            cascades: cascadeCount,
            scatters: scatterCount,
            bonusTriggered: bonusTriggered,
            freeSpinsEnded: freeSpinsEnded,
            freeSpinsActive: this.stateManager.freeSpinsData.active,
            freeSpinsCount: this.stateManager.freeSpinsData.count,
            multiplierAccumulator: this.stateManager.freeSpinsData.multiplierAccumulator
        };
        } catch (error) {
            console.error('Error in performBurstSpin:', error);
            this.isSpinning = false;
            return {
                win: 0,
                bet: this.stateManager.gameData.currentBet,
                balance: this.stateManager.gameData.balance,
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
    
    addBurstResult(result) {
        console.log('Adding burst result:', result);
        
        // Safety check for burst results container
        if (!this.burstResultsContainer) {
            console.warn('Burst results container not found, skipping result display');
            return;
        }
        
        try {
        const resultText = this.createBurstResultText(result);
        this.burstResultsContainer.add(resultText);
        
            const containerSize = this.burstResultsContainer.list ? this.burstResultsContainer.list.length : 0;
            console.log('Burst results container now has', containerSize, 'items');
        
        // Scroll existing results up
            if (this.burstResultsContainer.list) {
        this.burstResultsContainer.list.forEach((text, index) => {
            if (index < this.burstResultsContainer.list.length - 1) {
                this.tweens.add({
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
        // Don't directly assign to gameData.balance, it's already updated in performBurstSpin
        this.totalWin = result.win;
        this.updateBalanceDisplay();
        this.updateWinDisplay();
        
        // Update burst mode UI displays
        this.updateBurstModeDisplays();
    }
    
    createBurstResultText(result) {
        try {
        const width = this.cameras.main.width;
        const isWin = result.win > 0;
        const color = isWin ? '#00FF00' : '#FFFFFF';
        const winMultiplier = result.bet > 0 ? (result.win / result.bet).toFixed(1) : '0.0';
        
        let resultString = '';
        
        // Show free spin status if active
            if (result.freeSpinsActive && this.stateManager.freeSpinsData) {
                const totalCount = this.stateManager.freeSpinsData.totalCount || 0;
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
        const text = this.add.text(0, yPosition, resultString, {
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
        this.tweens.add({
            targets: text,
            alpha: 1,
            duration: 300,
            ease: 'Power2'
        });
        
        return text;
        } catch (error) {
            console.error('Error creating burst result text:', error);
            // Return a simple fallback text
            return this.add.text(0, 0, 'Error displaying result', {
                fontSize: '16px',
                fontFamily: 'Arial',
                color: '#FF0000'
            });
        }
    }
    
    burstScreenShake(winAmount) {
        const intensity = Math.min(winAmount / 10, 20); // Scale shake with win amount
        
        // Quick double shake
        this.cameras.main.shake(200, intensity, false, (camera, progress) => {
            if (progress === 1) {
                // Second shake after first completes
                this.time.delayedCall(50, () => {
                    this.cameras.main.shake(150, intensity * 0.7);
                });
            }
        });
        
        // Show win amount popup
        this.showBurstWinPopup(winAmount);
    }
    
    showBurstWinPopup(amount) {
        // Don't show win popup if burst mode is not active (safety check)
        if (!this.burstModeActive) {
            return;
        }
        
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const winPopup = this.add.text(width / 2, height / 2 - 50, `+$${amount.toFixed(2)}`, {
            fontSize: '72px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 6
        });
        winPopup.setOrigin(0.5);
        winPopup.setDepth(2000);
        winPopup.setScale(0);
        
        // Animate popup
        this.tweens.add({
            targets: winPopup,
            scaleX: 1,
            scaleY: 1,
            duration: 300,
            ease: 'Back.out',
            onComplete: () => {
                this.time.delayedCall(800, () => {
                    this.tweens.add({
                        targets: winPopup,
                        alpha: 0,
                        y: winPopup.y - 50,
                        duration: 400,
                        onComplete: () => winPopup.destroy()
                    });
                });
            }
        });
        
        window.SafeSound.play(this, 'win');
    }

    addButtonHoverEffects() {
        // Add hover effects to all interactive buttons
        const interactiveElements = [
            this.ui_small_stop,
            this.ui_small_burst,
            this.ui_small_menu,
            this.ui_number_bet_minus,
            this.ui_number_bet_plus
        ];
        
        interactiveElements.forEach(element => {
            if (element) {
                element.on('pointerover', () => {
                    element.setScale(element.scaleX * 1.1, element.scaleY * 1.1);
                    element.setTint(0xFFFFFF);
                });
                
                element.on('pointerout', () => {
                    element.setScale(element.scaleX / 1.1, element.scaleY / 1.1);
                    element.clearTint();
                });
            }
        });
        
        // Special hover effect for spin button (sprite)
        if (this.ui_spin) {
            this.ui_spin.on('pointerover', () => {
                if (!this.isSpinning) {
                    this.ui_spin.setScale(this.ui_spin.scaleX * 1.1, this.ui_spin.scaleY * 1.1);
                    this.ui_spin.setTint(0xFFFFFF);
                }
            });
            
            this.ui_spin.on('pointerout', () => {
                if (!this.isSpinning) {
                    this.ui_spin.setScale(this.ui_spin.scaleX / 1.1, this.ui_spin.scaleY / 1.1);
                    this.ui_spin.clearTint();
                }
            });
        }
    }

    // Helper methods to update UI elements directly
    updateBalanceDisplay() {
        if (this.uiManager) {
            this.uiManager.updateBalanceDisplay();
        }
    }
    
    updateWinDisplay() {
        if (this.uiManager) {
            this.uiManager.updateWinDisplay();
        }
    }
    
    updateBetDisplay() {
        if (this.uiManager) {
            this.uiManager.updateBetDisplay();
        }
    }
    
    updateBurstModeDisplays() {
        if (this.burstBalanceText) {
            const oldBalance = parseFloat(this.burstBalanceText.text.replace('$', ''));
            const newBalance = this.stateManager.gameData.balance;
            this.burstBalanceText.setText(`$${newBalance.toFixed(2)}`);
            
            // Show light effect if balance changed
            if (Math.abs(oldBalance - newBalance) > 0.01 && this.burstScoreLights) {
                this.showBurstScoreLight(0); // Total box light
            }
        }
        if (this.burstWinText) {
            const oldWin = parseFloat(this.burstWinText.text.replace('$', ''));
            const newWin = this.totalWin;
            this.burstWinText.setText(`$${newWin.toFixed(2)}`);
            
            // Show light effect if win changed and is positive
            if (newWin > 0 && Math.abs(oldWin - newWin) > 0.01 && this.burstScoreLights) {
                this.showBurstScoreLight(1); // Win box light
            }
        }
        if (this.burstBetText) {
            this.burstBetText.setText(`$${this.stateManager.gameData.currentBet.toFixed(2)}`);
        }
    }
    
    showBurstScoreLight(index) {
        if (!this.burstScoreLights || !this.burstScoreLights[index]) return;
        
        const light = this.burstScoreLights[index];
        
        // Reset any existing tweens
        this.tweens.killTweensOf(light);
        
        // Play the light animation
        light.setAlpha(1);
        light.play('ui_scoreup_light_animation');
        
        // Fade out after animation
        this.time.delayedCall(500, () => {
            this.tweens.add({
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
    
    updateAccumulatedMultiplierDisplay() {
        if (this.uiManager) {
            this.uiManager.updateAccumulatedMultiplierDisplay();
        }
    }
    
    setButtonsEnabled(enabled) {
        if (this.uiManager) {
            this.uiManager.setButtonsEnabled(enabled);
        }
    }
    
    setQuickSpin(enabled) {
        // Quick spin functionality - could be implemented with UI feedback
        this.quickSpinEnabled = enabled;
    }
    

    
    // Cleanup method to prevent memory leaks and crashes
    destroy() {
        // Stop any ongoing tweens
        if (this.tweens) {
            this.tweens.killAll();
        }
        
        // Clear any timers
        if (this.time) {
            this.time.removeAllEvents();
        }
        
        // Remove keyboard event listeners
        if (this.keyboardListeners && this.input && this.input.keyboard) {
            this.keyboardListeners.forEach(listener => {
                this.input.keyboard.off(listener.key, listener.callback);
            });
            this.keyboardListeners = null;
        }
        
        // Clean up managers in reverse order of creation
        if (this.bonusManager && this.bonusManager.destroy) {
            this.bonusManager.destroy();
        }
        
        if (this.freeSpinsManager && this.freeSpinsManager.destroy) {
            this.freeSpinsManager.destroy();
        }
        
        if (this.winPresentationManager && this.winPresentationManager.destroy) {
            this.winPresentationManager.destroy();
        }
        
        if (this.burstModeManager && this.burstModeManager.destroy) {
            this.burstModeManager.destroy();
        }
        
        if (this.uiManager && this.uiManager.destroy) {
            this.uiManager.destroy();
        }
        
        if (this.animationManager && this.animationManager.destroy) {
            this.animationManager.destroy();
        }
        
        if (this.winCalculator && this.winCalculator.destroy) {
            this.winCalculator.destroy();
        }
        
        if (this.gridManager && this.gridManager.destroy) {
            this.gridManager.destroy();
        }
        
        // Clear references to prevent memory leaks
        this.stateManager = null;
        this.animationManager = null;
        this.uiManager = null;
        this.uiElements = null;
        this.burstModeManager = null;
        this.winPresentationManager = null;
        this.freeSpinsManager = null;
        this.bonusManager = null;
        this.gridManager = null;
        this.winCalculator = null;
        
        // Call parent destroy
        super.destroy();
    }
} 
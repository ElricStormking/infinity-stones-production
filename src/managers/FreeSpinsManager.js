// Free Spins Manager - handles all free spins logic and functionality
window.FreeSpinsManager = class FreeSpinsManager {
    constructor(scene) {
        this.scene = scene;
        this.freeSpinsAutoPlay = true; // Auto-play free spins by default
    }
    
    checkOtherBonusFeatures() {
        // Check for Free Spins
        const scatterCount = this.scene.gridManager.countScatters();
        if (scatterCount >= 4 && !this.scene.stateManager.freeSpinsData.active) {
            this.triggerFreeSpins(scatterCount);
        } else if (scatterCount >= 4 && this.scene.stateManager.freeSpinsData.active) {
            // Retrigger - 4+ scatter during free spins awards +5 extra free spins
            const extraSpins = window.GameConfig.FREE_SPINS.RETRIGGER_SPINS;
            this.scene.stateManager.addFreeSpins(extraSpins);
            this.scene.showMessage(`+${extraSpins} Free Spins!`);
            this.scene.uiManager.updateFreeSpinsDisplay();
            // Note: Auto-play continues automatically, no need to restart it
        }
    }
    
    triggerFreeSpins(scatterCount) {
        // 4+ scatters always award 15 free spins in base game
        const freeSpins = window.GameConfig.FREE_SPINS.SCATTER_4_PLUS;
        
        this.scene.stateManager.startFreeSpins(freeSpins);
        
        // Show big prominent free spins message
        this.scene.winPresentationManager.showBigFreeSpinsMessage(freeSpins);
        window.SafeSound.play(this.scene, 'bonus');
        this.scene.uiManager.updateFreeSpinsDisplay();
        
        // Start auto-spinning free spins after the message is shown
        this.freeSpinsAutoPlay = true; // Enable auto-play for new free spins
        console.log(`Free spins awarded: ${freeSpins} - will start auto-spinning in 5 seconds`);
        this.scene.time.delayedCall(5000, () => {
            if (this.scene.stateManager.freeSpinsData.active && this.scene.stateManager.freeSpinsData.count > 0 && !this.scene.isSpinning && this.freeSpinsAutoPlay) {
                console.log(`Starting first free spin auto-play`);
                this.scene.startSpin();
            }
        });
    }
    
    handleSpinButtonClick() {
        if (this.scene.stateManager.freeSpinsData.active && this.scene.stateManager.freeSpinsData.count > 0) {
            // During Free Spins Mode, always auto-spin all remaining free spins
            if (!this.freeSpinsAutoPlay) {
                // Enable auto-play and start spinning
                this.freeSpinsAutoPlay = true;
                console.log('Free spins auto-play enabled - starting auto-spins');
                this.scene.showMessage('Auto-spinning Free Spins...');
            }
            // Start the spin regardless of auto-play state
            if (!this.scene.isSpinning) {
                this.scene.startSpin();
            }
        } else {
            // Regular spin
            this.scene.startSpin();
        }
    }
    
    async handleFreeSpinsEnd() {
        // Check if free spins ended
        if (this.scene.stateManager.freeSpinsData.active && this.scene.stateManager.freeSpinsData.count === 0) {
            const totalFreeSpinsWin = this.scene.stateManager.endFreeSpins();
            await this.scene.winPresentationManager.showFreeSpinsCompleteScreen(totalFreeSpinsWin);
            this.scene.uiManager.updateFreeSpinsDisplay();
            return true;
        }
        return false;
    }
    
    handleFreeSpinsAutoPlay() {
        // Handle free spins auto-play
        if (this.scene.stateManager.freeSpinsData.active && this.scene.stateManager.freeSpinsData.count > 0 && this.freeSpinsAutoPlay) {
            console.log(`Free spins active with ${this.scene.stateManager.freeSpinsData.count} remaining - auto-spinning after win presentation`);
            
            // Wait for win presentation to finish before auto-spinning
            const checkAndStartSpin = () => {
                // Safety check to ensure scene is still active
                if (!this.scene.scene || !this.scene.scene.isActive()) {
                    return;
                }
                
                if (!this.scene.winPresentationManager.isShowingPresentation() && this.scene.stateManager && this.scene.stateManager.freeSpinsData && 
                    this.scene.stateManager.freeSpinsData.active && this.scene.stateManager.freeSpinsData.count > 0 && 
                    !this.scene.isSpinning && this.freeSpinsAutoPlay) {
                    console.log(`Auto-spinning free spin ${this.scene.stateManager.freeSpinsData.totalCount - this.scene.stateManager.freeSpinsData.count + 1}`);
                    this.scene.startSpin();
                } else if (this.scene.winPresentationManager.isShowingPresentation() && this.scene.time) {
                    // Check again in 500ms if still showing win presentation
                    this.scene.time.delayedCall(500, checkAndStartSpin);
                }
            };
            
            // Start checking after 2 seconds
            this.scene.time.delayedCall(2000, checkAndStartSpin);
            return true;
        }
        return false;
    }
    
    processCascadeMultiplier(cascadeCount) {
        // Apply cascade multiplier in free spins with new trigger chance
        if (this.scene.stateManager.freeSpinsData.active && cascadeCount > 1) {
            const shouldTrigger = Math.random() < window.GameConfig.FREE_SPINS.ACCUM_TRIGGER_CHANCE_PER_CASCADE;
            if (shouldTrigger) {
                const multiplierTable = window.GameConfig.RANDOM_MULTIPLIER.TABLE;
                const randomMultiplier = multiplierTable[
                    Math.floor(Math.random() * multiplierTable.length)
                ];
                this.scene.stateManager.accumulateMultiplier(randomMultiplier);
                this.scene.bonusManager.showMultiplier(randomMultiplier);
                
                // Update accumulated multiplier display
                this.scene.uiManager.updateAccumulatedMultiplierDisplay();
            }
        }
    }
    
    applyFreeSpinsMultiplier(multiplier) {
        // Accumulate multiplier during free spins
        if (this.scene.stateManager.freeSpinsData.active) {
            this.scene.stateManager.accumulateMultiplier(multiplier);
            this.scene.bonusManager.showMultiplier(multiplier);
            this.scene.uiManager.updateAccumulatedMultiplierDisplay();
            console.log(`Accumulated multiplier to free spins: ${multiplier}x`);
        }
    }
    
    applyCascadingMultipliers(multipliers) {
        // Accumulate each multiplier during free spins
        if (this.scene.stateManager.freeSpinsData.active) {
            multipliers.forEach(mult => {
                this.scene.stateManager.accumulateMultiplier(mult);
                console.log(`Accumulated cascading multiplier to free spins: ${mult}x`);
            });
            
            // Calculate total multiplier for display
            let totalMultiplier = 1;
            multipliers.forEach(mult => {
                totalMultiplier *= mult;
            });
            
            this.scene.bonusManager.showMultiplier(totalMultiplier);
            this.scene.uiManager.updateAccumulatedMultiplierDisplay();
        }
    }
    
    addFreeSpinsWin(totalWin) {
        // Add free spins win
        if (this.scene.stateManager.freeSpinsData.active) {
            this.scene.stateManager.freeSpinsData.totalWin += totalWin;
        }
    }
    
    showPurchaseUI() {
        // Don't show purchase UI if already in free spins or spinning
        if (this.scene.stateManager.freeSpinsData.active || this.scene.isSpinning) {
            this.scene.showMessage('Cannot purchase during Free Spins or while spinning!');
            return;
        }
        
        const freeSpinsCost = this.scene.stateManager.gameData.currentBet * window.GameConfig.FREE_SPINS.BUY_FEATURE_COST; // 100x bet
        const freeSpinsAmount = window.GameConfig.FREE_SPINS.BUY_FEATURE_SPINS; // 15 free spins
        
        // Check if player can afford it
        if (this.scene.stateManager.gameData.balance < freeSpinsCost) {
            this.scene.showMessage('Insufficient Balance!');
            return;
        }
        
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        
        // Create overlay
        const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);
        overlay.setDepth(1500);
        overlay.setInteractive(); // Block clicks behind it
        
        // Purchase dialog background
        const dialogBg = this.scene.add.rectangle(width / 2, height / 2, 500, 300, 0x2C3E50, 1);
        dialogBg.setStrokeStyle(4, 0xFFD700);
        dialogBg.setDepth(1501);
        
        // Title
        const title = this.scene.add.text(width / 2, height / 2 - 80, 'PURCHASE FREE SPINS', {
            fontSize: '28px',
            fontFamily: 'Arial Black',
            color: '#FFD700'
        });
        title.setOrigin(0.5);
        title.setDepth(1502);
        
        // Description
        const description = this.scene.add.text(width / 2, height / 2 - 30, `Get ${freeSpinsAmount} Free Spins for $${freeSpinsCost.toFixed(2)}`, {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#FFFFFF'
        });
        description.setOrigin(0.5);
        description.setDepth(1502);
        
        // Current balance display
        const balanceInfo = this.scene.add.text(width / 2, height / 2 + 10, `Current Balance: $${this.scene.stateManager.gameData.balance.toFixed(2)}`, {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#CCCCCC'
        });
        balanceInfo.setOrigin(0.5);
        balanceInfo.setDepth(1502);
        
        // Purchase button
        const purchaseBtn = this.scene.add.container(width / 2 - 80, height / 2 + 60);
        const purchaseBg = this.scene.add.rectangle(0, 0, 120, 40, 0x27AE60);
        purchaseBg.setStrokeStyle(2, 0xFFFFFF);
        purchaseBg.setInteractive({ useHandCursor: true });
        const purchaseLabel = this.scene.add.text(0, 0, 'PURCHASE', {
            fontSize: '16px',
            fontFamily: 'Arial Bold',
            color: '#FFFFFF'
        });
        purchaseLabel.setOrigin(0.5);
        purchaseBtn.add([purchaseBg, purchaseLabel]);
        purchaseBtn.setDepth(1502);
        
        // Cancel button
        const cancelBtn = this.scene.add.container(width / 2 + 80, height / 2 + 60);
        const cancelBg = this.scene.add.rectangle(0, 0, 120, 40, 0xE74C3C);
        cancelBg.setStrokeStyle(2, 0xFFFFFF);
        cancelBg.setInteractive({ useHandCursor: true });
        const cancelLabel = this.scene.add.text(0, 0, 'CANCEL', {
            fontSize: '16px',
            fontFamily: 'Arial Bold',
            color: '#FFFFFF'
        });
        cancelLabel.setOrigin(0.5);
        cancelBtn.add([cancelBg, cancelLabel]);
        cancelBtn.setDepth(1502);
        
        // Store references for cleanup
        const purchaseElements = [overlay, dialogBg, title, description, balanceInfo, purchaseBtn, cancelBtn];
        
        // Purchase button handler
        purchaseBg.on('pointerup', () => {
            // Double-check balance
            if (this.scene.stateManager.gameData.balance >= freeSpinsCost) {
                // Deduct cost
                this.scene.stateManager.gameData.balance -= freeSpinsCost;
                this.scene.uiManager.updateBalanceDisplay();
                
                // Close purchase UI
                purchaseElements.forEach(element => element.destroy());
                
                // Start free spins immediately
                this.purchaseFreeSpins(freeSpinsAmount);
                
                window.SafeSound.play(this.scene, 'bonus');
            } else {
                this.scene.showMessage('Insufficient Balance!');
            }
        });
        
        // Cancel button handler
        cancelBg.on('pointerup', () => {
            purchaseElements.forEach(element => element.destroy());
            window.SafeSound.play(this.scene, 'click');
        });
        
        // Button hover effects
        purchaseBg.on('pointerover', () => purchaseBg.setFillStyle(0x2ECC71));
        purchaseBg.on('pointerout', () => purchaseBg.setFillStyle(0x27AE60));
        cancelBg.on('pointerover', () => cancelBg.setFillStyle(0xC0392B));
        cancelBg.on('pointerout', () => cancelBg.setFillStyle(0xE74C3C));
        
        window.SafeSound.play(this.scene, 'click');
    }
    
    purchaseFreeSpins(amount) {
        // Start free spins mode
        this.scene.stateManager.startFreeSpins(amount);
        
        // Show purchase confirmation message
        this.scene.showMessage(`${amount} Free Spins Purchased!`);
        
        // Update free spins display
        this.scene.uiManager.updateFreeSpinsDisplay();
        
        // Start auto-spinning free spins after a short delay
        this.freeSpinsAutoPlay = true;
        console.log(`Purchased free spins: ${amount} - will start auto-spinning in 3 seconds`);
        this.scene.time.delayedCall(3000, () => {
            if (this.scene.stateManager.freeSpinsData.active && this.scene.stateManager.freeSpinsData.count > 0 && !this.scene.isSpinning && this.freeSpinsAutoPlay) {
                console.log(`Starting purchased free spin auto-play`);
                this.scene.startSpin();
            }
        });
        
        // Save game state
        this.scene.stateManager.saveState();
    }
    
    // Getters and setters
    isFreeSpinsAutoPlay() { return this.freeSpinsAutoPlay; }
    setFreeSpinsAutoPlay(enabled) { this.freeSpinsAutoPlay = enabled; }
} 
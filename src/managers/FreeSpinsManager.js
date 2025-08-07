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
            
            // Play Thanos finger snap sound for retrigger
            console.log('🔊 Playing Thanos finger snap sound for Free Spins retrigger');
            window.SafeSound.play(this.scene, 'thanos_finger_snap');
            
            this.scene.stateManager.addFreeSpins(extraSpins);
            this.scene.showMessage(`+${extraSpins} Free Spins!`);
            this.scene.uiManager.updateFreeSpinsDisplay();
            // Note: Auto-play continues automatically, no need to restart it
        }
    }
    
    triggerFreeSpins(scatterCount) {
        // 4+ scatters always award 15 free spins in base game
        const freeSpins = window.GameConfig.FREE_SPINS.SCATTER_4_PLUS;
        
        // Show confirmation UI before starting free spins
        this.showFreeSpinsStartUI(freeSpins, 'scatter');
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
            
            // Switch back to main BGM
            console.log('🎵 === FREE SPINS ENDED - SWITCHING BACK TO MAIN BGM ===');
            console.log('🎵 Final Free Spins State:', this.scene.stateManager.freeSpinsData);
            window.SafeSound.startMainBGM(this.scene);
            
            // Play winning big sound for Free Spins completion
            console.log('🔊 Playing winning big sound for Free Spins completion');
            window.SafeSound.play(this.scene, 'winning_big');
            
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
    
    async processCascadeMultiplier(cascadeCount) {
        // Apply cascade multiplier in free spins with new trigger chance
        if (this.scene.stateManager.freeSpinsData.active && cascadeCount > 1) {
            const shouldTrigger = Math.random() < window.GameConfig.FREE_SPINS.ACCUM_TRIGGER_CHANCE_PER_CASCADE;
            if (shouldTrigger) {
                console.log('=== FREE SPINS CASCADE MULTIPLIER TRIGGERED ===');
                
                // Use proper Random Multiplier flow with character animations
                const multiplierTable = window.GameConfig.RANDOM_MULTIPLIER.TABLE;
                const randomMultiplier = multiplierTable[
                    Math.floor(Math.random() * multiplierTable.length)
                ];
                
                // Select random position for the effect
                const col = Math.floor(Math.random() * this.scene.gridManager.cols);
                const row = Math.floor(Math.random() * this.scene.gridManager.rows);
                
                // Choose character for animation
                // TESTING: 80% chance for Thanos to test power grip animation and sound
                const useThanos = Math.random() < 0.8; // 80% Thanos, 20% Scarlet Witch
                
                console.log(`Free Spins Cascade Multiplier: ${randomMultiplier}x at position (${col}, ${row})`);
                console.log(`Using character: ${useThanos ? 'Thanos' : 'Scarlet Witch'}`);
                
                // Always trigger character attack animation
                if (useThanos) {
                    this.scene.bonusManager.triggerThanosAttack();
                    await this.scene.bonusManager.showThanosRandomMultiplier(col, row, randomMultiplier);
                } else {
                    this.scene.bonusManager.triggerScarletWitchAttack();
                    await this.scene.bonusManager.showScarletWitchRandomMultiplier(col, row, randomMultiplier);
                }
                
                // Apply to free spins accumulation
                this.scene.stateManager.accumulateMultiplier(randomMultiplier);
                
                // Show appropriate message
                const characterName = useThanos ? 'THANOS POWER GRIP!' : 'SCARLET WITCH CHAOS MAGIC!';
                this.scene.showMessage(`FREE SPINS ${characterName} ${randomMultiplier}x MULTIPLIER!`);
                
                // Update accumulated multiplier display
                this.scene.uiManager.updateAccumulatedMultiplierDisplay();
                
                // Always play bonus sound
                window.SafeSound.play(this.scene, 'bonus');
                
                console.log('=== END FREE SPINS CASCADE MULTIPLIER ===');
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
            
            // Calculate total multiplier for display - ADD multipliers together
            let totalMultiplier = 0;
            multipliers.forEach(mult => {
                totalMultiplier += mult;
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
        // Show confirmation UI before starting free spins
        this.showFreeSpinsStartUI(amount, 'purchase');
    }
    
    showFreeSpinsStartUI(freeSpins, triggerType) {
        // Stop auto-spin if active
        if (this.scene.stateManager.gameData.autoplayActive) {
            console.log('Stopping auto-spin for Free Spins UI');
            this.scene.stateManager.stopAutoplay();
            // Update auto spin counter display
            if (this.scene.uiManager) {
                this.scene.uiManager.updateAutoSpinCounterDisplay();
            }
        }
        
        // Stop burst auto-spin if active
        if (this.scene.burstAutoSpinning) {
            console.log('Stopping burst auto-spin for Free Spins UI');
            this.scene.burstAutoSpinning = false;
            // Reset burst auto button appearance
            if (this.scene.burstAutoBtn) {
                this.scene.burstAutoBtn.stop();
                this.scene.burstAutoBtn.setFrame(0);
                this.scene.burstAutoBtn.clearTint();
            }
        }
        
        // Pause the game
        this.scene.isSpinning = true; // Prevent any spins while UI is showing
        
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        
        // Create overlay
        const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);
        overlay.setDepth(2000);
        overlay.setInteractive(); // Block clicks behind it
        
        // Create dialog container
        const dialogContainer = this.scene.add.container(width / 2, height / 2);
        dialogContainer.setDepth(2001);
        
        // Dialog background
        const dialogBg = this.scene.add.rectangle(0, 0, 600, 400, 0x2C3E50, 1);
        dialogBg.setStrokeStyle(6, 0xFFD700);
        
        // Title
        const title = this.scene.add.text(0, -140, 'FREE SPINS BONUS!', {
            fontSize: '42px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4
        });
        title.setOrigin(0.5);
        
        // Subtitle based on trigger type
        const subtitleText = triggerType === 'scatter' 
            ? `${freeSpins} FREE SPINS AWARDED!` 
            : `${freeSpins} FREE SPINS PURCHASED!`;
        const subtitle = this.scene.add.text(0, -80, subtitleText, {
            fontSize: '28px',
            fontFamily: 'Arial Bold',
            color: '#FFFFFF'
        });
        subtitle.setOrigin(0.5);
        
        // Infinity gauntlet image or animation placeholder
        const gauntletIcon = this.scene.add.image(0, -20, 'infinity_glove');
        gauntletIcon.setScale(1.5);
        
        // Info text
        const infoText = this.scene.add.text(0, 50, 'Click OK to start your Free Spins!', {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#CCCCCC'
        });
        infoText.setOrigin(0.5);
        
        // OK button
        const okButton = this.scene.add.container(0, 120);
        const okBg = this.scene.add.rectangle(0, 0, 160, 60, 0x27AE60);
        okBg.setStrokeStyle(4, 0xFFD700);
        okBg.setInteractive({ useHandCursor: true });
        
        const okLabel = this.scene.add.text(0, 0, 'OK', {
            fontSize: '32px',
            fontFamily: 'Arial Black',
            color: '#FFFFFF'
        });
        okLabel.setOrigin(0.5);
        
        okButton.add([okBg, okLabel]);
        
        // Add all elements to dialog container
        dialogContainer.add([dialogBg, title, subtitle, gauntletIcon, infoText, okButton]);
        
        // Add floating animation to gauntlet
        this.scene.tweens.add({
            targets: gauntletIcon,
            y: -20 + 10,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        
        // Add pulse effect to OK button
        this.scene.tweens.add({
            targets: okBg,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 800,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        
        // Button hover effects
        okBg.on('pointerover', () => {
            okBg.setFillStyle(0x2ECC71);
            this.scene.tweens.killTweensOf(okBg);
            okBg.setScale(1.1);
        });
        
        okBg.on('pointerout', () => {
            okBg.setFillStyle(0x27AE60);
            okBg.setScale(1);
            // Restart pulse animation
            this.scene.tweens.add({
                targets: okBg,
                scaleX: 1.1,
                scaleY: 1.1,
                duration: 800,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        });
        
        // OK button click handler
        okBg.once('pointerup', () => {
            // Play click sound
            window.SafeSound.play(this.scene, 'click');
            
            // Destroy UI elements
            overlay.destroy();
            dialogContainer.destroy();
            
            // Reset spinning flag
            this.scene.isSpinning = false;
            
            // Trigger fire effect first, then start free spins
            console.log('🔥 Player clicked OK - starting fire effect before Free Spins');
            this.scene.fireEffect.triggerFire(() => {
                // This callback will be called when fire effect completes
                console.log('🔥 Fire complete - starting Free Spins');
                this.startFreeSpinsConfirmed(freeSpins, triggerType);
            });
        });
        
        // Play bonus sound
        window.SafeSound.play(this.scene, 'bonus');
    }
    
    startFreeSpinsConfirmed(freeSpins, triggerType) {
        // Start free spins mode
        this.scene.stateManager.startFreeSpins(freeSpins);
        
        // Switch to Free Spins BGM immediately and mark as initialized
        console.log('🎵 === FREE SPINS CONFIRMED - SWITCHING TO FREE SPINS BGM ===');
        console.log('🎵 Current Free Spins State:', this.scene.stateManager.freeSpinsData);
        
        // Mark BGM as initialized immediately to prevent GameScene from overriding
        window.SafeSound.bgmInitialized = true;
        
        // Switch immediately
        console.log('🎵 Executing IMMEDIATE Free Spins BGM switch');
        window.SafeSound.startFreeSpinsBGM(this.scene);
        
        // Also set a delayed reinforcement to ensure it sticks
        this.scene.time.delayedCall(500, () => {
            console.log('🎵 Reinforcing Free Spins BGM switch (delayed backup)');
            if (this.scene.stateManager.freeSpinsData.active) {
                window.SafeSound.startFreeSpinsBGM(this.scene);
            }
        });
        
        // Play Thanos finger snap sound
        console.log('🔊 Playing Thanos finger snap sound for Free Spins start');
        window.SafeSound.play(this.scene, 'thanos_finger_snap');
        
        // Show big prominent free spins message
        this.scene.winPresentationManager.showBigFreeSpinsMessage(freeSpins);
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
        
        // Save game state
        this.scene.stateManager.saveState();
    }
    
    // Getters and setters
    isFreeSpinsAutoPlay() { return this.freeSpinsAutoPlay; }
    setFreeSpinsAutoPlay(enabled) { this.freeSpinsAutoPlay = enabled; }
} 
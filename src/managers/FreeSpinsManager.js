// Free Spins Manager - handles all free spins logic and functionality
window.FreeSpinsManager = class FreeSpinsManager {
    constructor(scene) {
        this.scene = scene;
        this.freeSpinsAutoPlay = true; // Auto-play free spins by default
        this.isProcessingFreeSpinsUI = false; // Prevent duplicate UI triggers
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
            // Also play Thanos portrait finger snap animation during free spins
            if (this.scene.animationManager && this.scene.animationManager.playThanosSnap) {
                this.scene.animationManager.playThanosSnap();
            } else if (this.scene.portrait_thanos && this.scene.anims && this.scene.anims.exists('thanos_snap_animation') && this.scene.portrait_thanos.anims) {
                try { this.scene.portrait_thanos.stop(); } catch (_) {}
                this.scene.portrait_thanos.play('thanos_snap_animation');
                this.scene.portrait_thanos.once('animationcomplete', () => {
                    try {
                        if (this.scene.anims.exists('thanos_idle_animation')) {
                            this.scene.portrait_thanos.play('thanos_idle_animation');
                        }
                    } catch (_) {}
                });
            }
            
            this.scene.stateManager.addFreeSpins(extraSpins);
            this.scene.showMessage(`+${extraSpins} Free Spins!`);
            this.scene.uiManager.updateFreeSpinsDisplay();
            // Note: Auto-play continues automatically, no need to restart it
        }
    }
    
    triggerFreeSpins(scatterCount) {
        // 4+ scatters always award 15 free spins in base game
        const freeSpins = window.GameConfig.FREE_SPINS.SCATTER_4_PLUS;
        
        // Play Thanos finger snap animation + SFX, then show the Free Spins Start UI
        // Fire shader will run AFTER player clicks OK in the UI
        this.showThanosSnapThenStartUI(freeSpins, 'scatter');
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
            
            // While the final win animation (free spins complete screen) is showing,
            // spit out money sprite particles 3 times in different directions
            try {
                this.spawnMoneyBurstSequence();
            } catch (e) {
                console.warn('Money burst sequence failed:', e);
            }

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
        // SECURITY: Use controlled RNG for free spins cascade multiplier
        if (!window.RNG) {
            throw new Error('SECURITY: FreeSpinsManager requires window.RNG to be initialized.');
        }
        const rng = new window.RNG();
        
        // Apply cascade multiplier in free spins with new trigger chance
        if (this.scene.stateManager.freeSpinsData.active && cascadeCount > 1) {
            const shouldTrigger = rng.chance(window.GameConfig.FREE_SPINS.ACCUM_TRIGGER_CHANCE_PER_CASCADE);
            if (shouldTrigger) {
                console.log('=== FREE SPINS CASCADE MULTIPLIER TRIGGERED ===');
                
                // Use proper Random Multiplier flow with character animations using controlled RNG
                const multiplierTable = window.GameConfig.RANDOM_MULTIPLIER.TABLE;
                const randomMultiplier = multiplierTable[
                    rng.int(0, multiplierTable.length - 1)
                ];
                
                // Select random position for the effect using controlled RNG
                const col = rng.int(0, this.scene.gridManager.cols - 1);
                const row = rng.int(0, this.scene.gridManager.rows - 1);
                
                // Choose character for animation using controlled RNG
                // TESTING: 80% chance for Thanos to test power grip animation and sound
                const useThanos = rng.chance(0.8); // 80% Thanos, 20% Scarlet Witch
                
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
                
                // Defer accumulation to shooting-star arrival; fire the FX to both targets
                if (this.scene && this.scene.playRandomMultiplierShootingStar) {
                    this.scene.playRandomMultiplierShootingStar(col, row, randomMultiplier);
                }

                // Show appropriate message
                const characterName = useThanos ? 'THANOS POWER GRIP!' : 'SCARLET WITCH CHAOS MAGIC!';
                this.scene.showMessage(`FREE SPINS ${characterName} ${randomMultiplier}x MULTIPLIER!`);
                
                // Accumulated display will be updated on star arrival
                
                // Always play bonus sound
                window.SafeSound.play(this.scene, 'bonus');
                
                console.log('=== END FREE SPINS CASCADE MULTIPLIER ===');
            }
        }
    }
    
    applyFreeSpinsMultiplier(multiplier) {
        // Accumulate multiplier during free spins
        if (this.scene.stateManager.freeSpinsData.active) {
            // Do not accumulate immediately; accumulation happens when shooting-star hits the badge
            // Still show a transient multiplier overlay if desired
            this.scene.bonusManager.showMultiplier(multiplier);
            console.log(`[Deferred] Free Spins multiplier will accumulate on star arrival: ${multiplier}x`);
        }
    }
    
    applyCascadingMultipliers(multipliers) {
        // Accumulate each multiplier during free spins
        if (this.scene.stateManager.freeSpinsData.active) {
            // Defer accumulation; stars fired elsewhere will update on arrival
            // Calculate total multiplier for display - ADD multipliers together
            let totalMultiplier = 0;
            multipliers.forEach(mult => {
                totalMultiplier += mult;
            });
            
            this.scene.bonusManager.showMultiplier(totalMultiplier);
            // Display of accumulated value updates as stars arrive
        }
    }

    // Visual: emit money sprite bursts three times in different directions
    spawnMoneyBurstSequence() {
        // Ensure texture exists
        if (!this.scene.textures.exists('money_sprite')) {
            console.warn('money_sprite not loaded; skipping money burst sequence');
            return;
        }

        const cam = this.scene.cameras.main;
        const x = cam.width / 2;
        const y = cam.height / 2;

        // Create particle manager on top of win presentation UI
        const particles = this.scene.add.particles('money_sprite');
        particles.setDepth(3000);

        const frames = [];
        for (let i = 0; i <= 15; i++) frames.push(i);

        // Base config for bursts
        const base = {
            frame: frames,
            speed: { min: 280, max: 520 },
            lifespan: { min: 700, max: 1200 },
            gravityY: 900,
            rotate: { min: -180, max: 180 },
            scale: { start: 0.7, end: 0 },
            alpha: { start: 1, end: 0 },
            on: false,
            blendMode: 'NORMAL'
        };

        // Three emitters with different directions
        const e1 = particles.createEmitter({ ...base, angle: { min: -70, max: -20 } });    // up-left
        const e2 = particles.createEmitter({ ...base, angle: { min: 20, max: 70 } });      // up-right
        const e3 = particles.createEmitter({ ...base, angle: { min: 150, max: 210 } });    // left/right sweep

        // Explode sequence
        const quantities = [24, 24, 24];
        this.scene.time.delayedCall(0,     () => { if (e1 && particles.active) e1.explode(quantities[0], x, y); });
        this.scene.time.delayedCall(550,   () => { if (e2 && particles.active) e2.explode(quantities[1], x, y); });
        this.scene.time.delayedCall(1100,  () => { if (e3 && particles.active) e3.explode(quantities[2], x, y); });

        // Cleanup after particles settle
        this.scene.time.delayedCall(2500, () => {
            try { particles.destroy(); } catch (_) {}
        });
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
        
        // Create overlay (dim)
        const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.82);
        overlay.setDepth(1500);
        overlay.setInteractive(); // Block clicks behind it
        
        // Backdrop character art (prefer animated sprite if available)
        let bgLayer;
        if (this.scene.textures.exists('fg-redwitch_00')) {
            // Use frame-based animated foreground (fg-redwitch_00..)
            bgLayer = this.scene.add.sprite(width / 2, height / 2, 'fg-redwitch_00');
            // Create a loop animation dynamically if missing
            const jsonPreferred = this.scene.anims.exists('fspc_fg_redwitch') ? 'fspc_fg_redwitch' : null;
            const animKey = jsonPreferred || 'fspc_loop';
            if (!this.scene.anims.exists(animKey)) {
                try {
                    const frames = [];
                    for (let i = 0; i <= 39; i++) {
                        const num = i.toString().padStart(2, '0');
                        const key = `fg-redwitch_${num}`;
                        if (this.scene.textures.exists(key)) {
                            frames.push({ key });
                        }
                    }
                    if (frames.length > 0) {
                        this.scene.anims.create({
                            key: animKey,
                            frames,
                            frameRate: 24,
                            repeat: -1
                        });
                    }
                } catch (e) {
                    // Non-fatal; fall back to first frame
                }
            }
            if (this.scene.anims.exists(animKey)) {
                bgLayer.play(animKey);
            }
            // Scale larger than viewport height for more impact
            const desiredHeight = height * 1.25;
            const sourceH = bgLayer.height || 720;
            const scale = desiredHeight / sourceH;
            bgLayer.setScale(scale);
            const CHARACTER_X = 720;
            const CHARACTER_Y = 620;
            bgLayer.setPosition(CHARACTER_X, CHARACTER_Y);
            bgLayer.setAlpha(0.95);
            bgLayer.setDepth(1501);
        } else if (this.scene.textures.exists('free_spins_purchase_check')) {
            bgLayer = this.scene.add.image(width / 2, height / 2, 'free_spins_purchase_check');
            const desiredHeight = height * 1.2;
            const scale = desiredHeight / bgLayer.height;
            bgLayer.setScale(scale);
            const CHARACTER_X = 720; // px
            const CHARACTER_Y = 620; // px
            bgLayer.setPosition(CHARACTER_X, CHARACTER_Y);
            bgLayer.setAlpha(0.95);
            bgLayer.setDepth(1501);
        }
        
        // Purchase dialog background card over character art
        const dialogCenterY = height / 1.5;
        // Use textured background if provided, else colored rectangle
        let dialogBg;
        if (this.scene.textures.exists('fg_confirm_UI')) {
            dialogBg = this.scene.add.image(width / 2, dialogCenterY, 'fg_confirm_UI');
            // Scale UI to fit nicely on various resolutions
            const maxWidth = Math.min(520, width * 0.5);
            const scale = maxWidth / dialogBg.width;
            dialogBg.setScale(scale);
        } else {
            dialogBg = this.scene.add.rectangle(width / 2, dialogCenterY, 520, 250, 0x2C3E50, 0.92);
            dialogBg.setStrokeStyle(4, 0xFFD700);
        }
        dialogBg.setDepth(1502);
        
        // Title
        // Optional deco bar above title
        let titleY = dialogCenterY - 70;
        let deco = null;
        if (this.scene.textures.exists('fg_confirm_deco')) {
            deco = this.scene.add.image(width / 2, dialogCenterY - 94, 'fg_confirm_deco');
            const decoScale = Math.min(1, (dialogBg.displayWidth || dialogBg.width) * 0.9 / deco.width);
            deco.setScale(decoScale);
            deco.setDepth(1503);
            titleY = dialogCenterY - 70;
        }
        const title = this.scene.add.text(width / 2, titleY, 'PURCHASE FREE SPINS', {
            fontSize: '28px',
            fontFamily: 'Arial Black',
            color: '#FFD700'
        });
        title.setOrigin(0.5);
        title.setDepth(1503);
        
        // Description
        const description = this.scene.add.text(width / 2, dialogCenterY - 30, `Get ${freeSpinsAmount} Free Spins for $${freeSpinsCost.toFixed(2)}`, {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#FFFFFF'
        });
        description.setOrigin(0.5);
        description.setDepth(1503);
        
        // Current balance display
        const balanceInfo = this.scene.add.text(width / 2, dialogCenterY + 5, `Current Balance: $${this.scene.stateManager.gameData.balance.toFixed(2)}`, {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#CCCCCC'
        });
        balanceInfo.setOrigin(0.5);
        balanceInfo.setDepth(1503);
        
        // Purchase button (image based)
        const purchaseBtn = this.scene.add.container(width / 2 - 80, dialogCenterY + 45);
        let purchaseHit;
        if (this.scene.textures.exists('fg_button01')) {
            const img = this.scene.add.image(0, 0, 'fg_button01');
            // Scale button to a consistent visual size relative to dialog
            const targetWidth = (dialogBg.displayWidth || 520) * 0.35;
            const btnScale = targetWidth / img.width;
            img.setScale(btnScale);
            purchaseBtn.add(img);
            purchaseHit = img;
        } else {
            const rect = this.scene.add.rectangle(0, 0, 160, 54, 0x27AE60);
            rect.setStrokeStyle(2, 0xFFFFFF);
            purchaseBtn.add(rect);
            purchaseHit = rect;
        }
        purchaseHit.setInteractive({ useHandCursor: true });
        purchaseBtn.setDepth(1504);
        
        // Cancel button (image based)
        const cancelBtn = this.scene.add.container(width / 2 + 80, dialogCenterY + 45);
        let cancelHit;
        if (this.scene.textures.exists('fg_button02')) {
            const img = this.scene.add.image(0, 0, 'fg_button02');
            const targetWidth = (dialogBg.displayWidth || 520) * 0.35;
            const btnScale = targetWidth / img.width;
            img.setScale(btnScale);
            cancelBtn.add(img);
            cancelHit = img;
        } else {
            const rect = this.scene.add.rectangle(0, 0, 160, 54, 0xE74C3C);
            rect.setStrokeStyle(2, 0xFFFFFF);
            cancelBtn.add(rect);
            cancelHit = rect;
        }
        cancelHit.setInteractive({ useHandCursor: true });
        cancelBtn.setDepth(1504);
        
        // Store references for cleanup
        const purchaseElements = [overlay, bgLayer, dialogBg, title, description, balanceInfo, purchaseBtn, cancelBtn];
        if (deco) purchaseElements.push(deco);
        
        // Purchase button handler
        purchaseHit.on('pointerup', () => {
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
        cancelHit.on('pointerup', () => {
            purchaseElements.forEach(element => element.destroy());
            window.SafeSound.play(this.scene, 'click');
        });
        
        // Button hover effects (handle image or rectangle)
        if (purchaseHit.setTint) {
            purchaseHit.on('pointerover', () => purchaseHit.setTint(0xB6FFC8));
            purchaseHit.on('pointerout', () => purchaseHit.clearTint());
        } else if (purchaseHit.setFillStyle) {
            purchaseHit.on('pointerover', () => purchaseHit.setFillStyle(0x2ECC71));
            purchaseHit.on('pointerout', () => purchaseHit.setFillStyle(0x27AE60));
        }
        if (cancelHit.setTint) {
            cancelHit.on('pointerover', () => cancelHit.setTint(0xFFB6C1));
            cancelHit.on('pointerout', () => cancelHit.clearTint());
        } else if (cancelHit.setFillStyle) {
            cancelHit.on('pointerover', () => cancelHit.setFillStyle(0xC0392B));
            cancelHit.on('pointerout', () => cancelHit.setFillStyle(0xE74C3C));
        }
        
        window.SafeSound.play(this.scene, 'click');
    }
    
    purchaseFreeSpins(amount) {
        // Show confirmation UI before starting free spins
        this.showFreeSpinsStartUI(amount, 'purchase');
    }
    
    showFreeSpinsStartUI(freeSpins, triggerType, skipFireOnConfirm = false) {
        // Prevent duplicate UI triggers
        if (this.isProcessingFreeSpinsUI) {
            console.warn('🔥 Free Spins UI already being processed - preventing duplicate');
            return;
        }
        this.isProcessingFreeSpinsUI = true;
        console.log('🔥 Starting Free Spins UI processing');
        
        // Safeguard: Reset flag after 10 seconds in case something goes wrong
        this.scene.time.delayedCall(10000, () => {
            if (this.isProcessingFreeSpinsUI) {
                console.warn('🔥 Resetting Free Spins UI flag due to timeout');
                this.isProcessingFreeSpinsUI = false;
            }
        });
        
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
        const pulseTween = this.scene.tweens.add({
            targets: okBg,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 800,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        
        // Prevent any button interactions after click
        let buttonDisabled = false;
        
        // Button hover effects (only if not disabled)
        okBg.on('pointerover', () => {
            if (!buttonDisabled) {
                okBg.setFillStyle(0x2ECC71);
                this.scene.tweens.killTweensOf(okBg);
                okBg.setScale(1.1);
            }
        });
        
        okBg.on('pointerout', () => {
            if (!buttonDisabled) {
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
            }
        });
        
        // OK button click handler - SINGLE handler with thorough protection
        const handleOKClick = () => {
            // Prevent any further processing
            if (buttonDisabled) {
                console.warn('🔥 Button already disabled - ignoring click');
                return;
            }
            buttonDisabled = true;
            console.log('🔥 OK button clicked - disabling all interactions');
            
            // Kill all tweens immediately
            this.scene.tweens.killTweensOf(okBg);
            
            // Remove ALL event listeners immediately
            okBg.removeAllListeners();
            okBg.disableInteractive();
            
            // Play click sound
            window.SafeSound.play(this.scene, 'click');
            
            // Destroy UI elements immediately
            overlay.destroy();
            dialogContainer.destroy();
            
            // Reset spinning flag
            this.scene.isSpinning = false;
            
            // Always trigger fire effect AFTER OK click, then start free spins
            if (!this.scene.fireEffect.isPlaying()) {
                console.log('🔥 Triggering fire effect for Free Spins (post-OK)');
                this.scene.fireEffect.triggerFire(() => {
                    console.log('🔥 Fire effect complete - starting Free Spins');
                    this.startFreeSpinsConfirmed(freeSpins, triggerType);
                    this.isProcessingFreeSpinsUI = false;
                }, { headline: 'FREE SPINS AWARDED!', subline: `${freeSpins} FREE SPINS` });
            } else {
                console.warn('🔥 Fire effect already playing - skipping to Free Spins');
                this.startFreeSpinsConfirmed(freeSpins, triggerType);
                this.isProcessingFreeSpinsUI = false;
            }
        };
        
        // Register click handler only once
        okBg.once('pointerup', handleOKClick);
        
        // Play bonus sound
        window.SafeSound.play(this.scene, 'bonus');
    }

    // Sequence: Thanos snap animation + finger snap SFX → Free Spins Start UI (OK will run fire)
    showThanosSnapThenStartUI(freeSpins, triggerType) {
        // Prevent duplicate triggers
        if (this.isProcessingFreeSpinsUI) {
            console.warn('🔥 Free Spins UI already being processed - preventing duplicate (pre-UI sequence)');
            return;
        }
        this.isProcessingFreeSpinsUI = true;

        // Stop any auto spins that might interfere
        if (this.scene.stateManager.gameData.autoplayActive) {
            console.log('Stopping autoplay before Thanos snap sequence');
            this.scene.stateManager.stopAutoplay();
            if (this.scene.uiManager) this.scene.uiManager.updateAutoSpinCounterDisplay();
        }
        if (this.scene.burstAutoSpinning) {
            console.log('Stopping burst auto-spin before Thanos snap sequence');
            this.scene.burstAutoSpinning = false;
            if (this.scene.burstAutoBtn) {
                try { this.scene.burstAutoBtn.stop(); this.scene.burstAutoBtn.setFrame(0); this.scene.burstAutoBtn.clearTint(); } catch (_) {}
            }
        }

        // Block gameplay interactions while we present the sequence
        this.scene.isSpinning = true;
        if (this.scene.uiManager) this.scene.uiManager.setButtonsEnabled(false);

        // Helper to play Thanos snap if available
        const playThanosSnap = () => new Promise(resolve => {
            try {
                const hasPortrait = !!this.scene.portrait_thanos;
                const hasSnapAnim = this.scene.anims && this.scene.anims.exists && this.scene.anims.exists('thanos_snap_animation');
                // Always play snap SFX (once per trigger)
                console.log('🔊 Playing Thanos finger snap SFX');
                window.SafeSound.play(this.scene, 'thanos_finger_snap');

                if (hasPortrait && hasSnapAnim && this.scene.portrait_thanos.anims) {
                    console.log('▶️ Playing Thanos SNAP animation');
                    if (this.scene.animationManager && this.scene.animationManager.playThanosSnap) {
                        this.scene.animationManager.playThanosSnap();
                    } else {
                        try { this.scene.portrait_thanos.stop(); } catch (_) {}
                        this.scene.portrait_thanos.play('thanos_snap_animation');
                        this.scene.portrait_thanos.once('animationcomplete', () => {
                            try {
                                if (this.scene.anims.exists('thanos_idle_animation')) {
                                    this.scene.portrait_thanos.play('thanos_idle_animation');
                                }
                            } catch (_) {}
                        });
                    }
                    // Safety timeout in case animationcomplete never fires
                    this.scene.time.delayedCall(1500, resolve);
                } else {
                    console.warn('Thanos snap animation not available - proceeding with SFX only');
                    // Small delay to pace the sequence
                    this.scene.time.delayedCall(600, resolve);
                }
            } catch (e) {
                console.warn('Error during Thanos snap animation:', e);
                this.scene.time.delayedCall(200, resolve);
            }
        });

        // Run sequence
        (async () => {
            await playThanosSnap();
            // Re-enable UI for the confirmation dialog
            if (this.scene.uiManager) this.scene.uiManager.setButtonsEnabled(true);

            // Allow the UI method to set its own guard flag
            this.isProcessingFreeSpinsUI = false;
            // Show the confirmation UI; fire will play on OK
            this.showFreeSpinsStartUI(freeSpins, triggerType, false);
        })();
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
        
        // Optional SFX cue
        console.log('🔊 Free Spins start cue');
        window.SafeSound.play(this.scene, 'bonus');

        // Update FS UI and start immediately
        this.scene.uiManager.updateFreeSpinsDisplay();
        this.freeSpinsAutoPlay = true;
        if (this.scene.stateManager.freeSpinsData.active && this.scene.stateManager.freeSpinsData.count > 0 && !this.scene.isSpinning) {
            console.log(`Starting first free spin immediately`);
            this.scene.startSpin();
        }
        
        // Save game state
        this.scene.stateManager.saveState();
    }
    
    // Getters and setters
    isFreeSpinsAutoPlay() { return this.freeSpinsAutoPlay; }
    setFreeSpinsAutoPlay(enabled) { this.freeSpinsAutoPlay = enabled; }
} 
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
        this.burstWinsContainer = null; // Center-only feed of winning spins

        // Shader references
        this.blackholeShader = null;
        this.blackholeEffect = null;
        this.blackholeMask = null;

        // Cached scale for dynamic text sizing
        this._scaleX = 1;
        this._scaleY = 1;
    }
    
    toggle() {
        if (this.scene.isSpinning) {
            this.scene.showMessage('Cannot toggle Burst Mode while spinning!');
            return;
        }
        
        // Prevent rapid toggling with cooldown
        if (this.toggleCooldown) {
            console.log('Burst mode toggle on cooldown');
            return;
        }
        
        this.toggleCooldown = true;
        this.scene.time.delayedCall(500, () => {
            this.toggleCooldown = false;
        });
        
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
        this.biggestWinText = null;
        this.bonusRoundsText = null;
        this.bonusWinsText = null;
        this.roundsPlayedText = null;
        this.magicAnimation = null;
        this.spinBtn = null;
        this.autoToggleBtn = null;
        
        // Clean up blackhole shader and mask
        if (this.blackholeEffect) {
            this.blackholeEffect.destroy();
            this.blackholeEffect = null;
        }
        if (this.blackholeMask) {
            this.blackholeMask.destroy();
            this.blackholeMask = null;
        }
        this.blackholeShader = null;
        
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
        // Debug: Check which burst mode textures are loaded
        console.log('Burst Mode Textures Check:');
        const burstTextures = [
            'ui_bn_bg', 'ui_bn_under', 'ui_bn_box',
            'ui_bn_number_score', 'ui_bn_number_win', 'ui_bn_number_bet',
            'ui_bn_number_bet-', 'ui_bn_number_bet+',
            'ui_bn_small_burst', 'ui_bn_small_menu', 'ui_bn_small_stop',
            'ui_bn_spin', 'ui_burst_spin1'
        ];
        burstTextures.forEach(texture => {
            console.log(`${texture}: ${this.scene.textures.exists(texture) ? '✓ Loaded' : '✗ Missing'}`);
        });
        
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        
        this.burstModeUI = this.scene.add.container(0, 0);
        this.burstModeUI.setDepth(2000); // Set high depth for entire burst mode UI
        
        // Scale factors based on canvas size (burstnew.scene uses 1280x720 design)
        const scaleX = width / 1280;
        const scaleY = height / 720;
        this._scaleX = scaleX;
        this._scaleY = scaleY;
        const uiScale = 0.67; // Base scale from burstnew.scene
        
        // Background - ui_bn_bg
        const bg = this.scene.add.image(638 * scaleX, 360 * scaleY, 'ui_bn_bg');
        bg.setScale(0.68 * scaleX, 0.68 * scaleY);
        this.burstModeUI.add(bg);
        
        // Under panel - ui_bn_under
        const underPanel = this.scene.add.image(639 * scaleX, 664 * scaleY, 'ui_bn_under');
        underPanel.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(underPanel);
        
        // Four info boxes - ui_bn_box
        const box1 = this.scene.add.image(335 * scaleX, 480 * scaleY, 'ui_bn_box');
        box1.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(box1);
        
        const box2 = this.scene.add.image(535 * scaleX, 480 * scaleY, 'ui_bn_box');
        box2.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(box2);
        
        const box3 = this.scene.add.image(735 * scaleX, 480 * scaleY, 'ui_bn_box');
        box3.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(box3);
        
        const box4 = this.scene.add.image(935 * scaleX, 480 * scaleY, 'ui_bn_box');
        box4.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(box4);
        
        // Magic animation sprite in the center
        if (this.scene.textures.exists('ui_bn_magic-an_00')) {
            this.magicAnimation = this.scene.add.sprite(632 * scaleX, 215 * scaleY, 'ui_bn_magic-an_00');
            this.magicAnimation.setScale(uiScale * scaleX, uiScale * scaleY);
            this.burstModeUI.add(this.magicAnimation);
        } else {
            console.warn('Magic animation frame not found, creating placeholder');
            this.magicAnimation = this.scene.add.rectangle(632 * scaleX, 215 * scaleY, 100, 100, 0x6a6a6a);
            this.burstModeUI.add(this.magicAnimation);
        }

        // Add blackhole shader effect in the center of the magic portal
        this.createBlackholeEffect(632 * scaleX, 165 * scaleY, scaleX, scaleY);
        
        // Results container for all spins (positioned above magic animation)
        this.burstResultsContainer = this.scene.add.container(width / 2 - 400, 50 * scaleY);
        this.burstModeUI.add(this.burstResultsContainer);
        
        // Add a subtle background for the results area
        const resultsBg = this.scene.add.rectangle(400, 60, 800, 120, 0x000000, 0.3);
        resultsBg.setStrokeStyle(1, 0x666666);
        this.burstResultsContainer.add(resultsBg);
        
        // Create buttons
        this.createButtons(scaleX, scaleY, uiScale);
        
        // Create text displays
        this.createTextDisplays(scaleX, scaleY);
        
        // Create score value displays for the four boxes
        this.createScoreDisplays(scaleX, scaleY);

        // Center feed that shows only winning spins (exciting style)
        // Move the winning-only feed up by 130px (scaled)
        this.burstWinsContainer = this.scene.add.container(width / 2, height / 2 - 150 * scaleY);
        this.burstWinsContainer.setDepth(2005);
        this.burstModeUI.add(this.burstWinsContainer);
        
        // Play magic animation
        if (this.magicAnimation && this.scene.anims.exists('burst_magic_animation')) {
            try {
                this.magicAnimation.play('burst_magic_animation');
            } catch (e) {
                console.warn('Failed to play burst magic animation:', e);
            }
        }
    }
    
    createButtons(scaleX, scaleY, uiScale) {
        // Main spin button - animated sprite
        this.spinBtn = this.scene.add.sprite(1179 * scaleX, 616 * scaleY, 'ui_bn_spin');
        this.spinBtn.setScale(uiScale * scaleX, uiScale * scaleY);
        this.spinBtn.setInteractive({ useHandCursor: true });
        this.burstModeUI.add(this.spinBtn);
        
        this.spinBtn.on('pointerup', () => {
            if (!this.scene.isSpinning && !this.burstAutoSpinning) {
                window.SafeSound.play(this.scene, 'click');
                this.singleSpin();
            } else if (this.burstAutoSpinning) {
                // Stop auto spin
                this.toggleAutoSpin();
            }
        });
        
        this.spinBtn.on('pointerover', () => {
            if (!this.scene.isSpinning) {
                this.spinBtn.setScale(this.spinBtn.scaleX * 1.05, this.spinBtn.scaleY * 1.05);
            }
        });
        
        this.spinBtn.on('pointerout', () => {
            if (!this.scene.isSpinning) {
                this.spinBtn.setScale(this.spinBtn.scaleX / 1.05, this.spinBtn.scaleY / 1.05);
            }
        });
        
        // Auto spin toggle button - stop button
        this.autoToggleBtn = this.scene.add.image(1055 * scaleX, 556 * scaleY, 'ui_bn_small_stop');
        this.autoToggleBtn.setScale(uiScale * scaleX, uiScale * scaleY);
        this.autoToggleBtn.setInteractive({ useHandCursor: true });
        this.burstModeUI.add(this.autoToggleBtn);
        
        this.autoToggleBtn.on('pointerup', () => {
            window.SafeSound.play(this.scene, 'click');
            this.toggleAutoSpin();
        });
        
        this.autoToggleBtn.on('pointerover', () => {
            this.autoToggleBtn.setScale(this.autoToggleBtn.scaleX * 1.1, this.autoToggleBtn.scaleY * 1.1);
            this.autoToggleBtn.setTint(0xFFFFFF);
        });
        
        this.autoToggleBtn.on('pointerout', () => {
            this.autoToggleBtn.setScale(this.autoToggleBtn.scaleX / 1.1, this.autoToggleBtn.scaleY / 1.1);
            this.autoToggleBtn.clearTint();
        });
        
        // Exit/Burst button
        const exitBtn = this.scene.add.image(1114 * scaleX, 497 * scaleY, 'ui_bn_small_burst');
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
        
        // Menu button 
        const menuBtn = this.scene.add.image(1201 * scaleX, 487 * scaleY, 'ui_bn_small_menu');
        menuBtn.setScale(uiScale * scaleX, uiScale * scaleY);
        menuBtn.setInteractive({ useHandCursor: true });
        this.burstModeUI.add(menuBtn);
        
        menuBtn.on('pointerup', () => {
            window.SafeSound.play(this.scene, 'click');
            // TODO: Implement menu functionality
            this.scene.showMessage('Menu coming soon!');
        });
        
        menuBtn.on('pointerover', () => {
            menuBtn.setScale(menuBtn.scaleX * 1.1, menuBtn.scaleY * 1.1);
            menuBtn.setTint(0xFFFFFF);
        });
        
        menuBtn.on('pointerout', () => {
            menuBtn.setScale(menuBtn.scaleX / 1.1, menuBtn.scaleY / 1.1);
            menuBtn.clearTint();
        });
    }
    
    createTextDisplays(scaleX, scaleY) {
        // Bottom row labels
        const labelStyle = {
            fontSize: Math.floor(20 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Bold',
            color: '#FFFFFF'
        };
        
        const uiScale = 0.67; // Base scale from burstnew.scene
        
        // Win label (left)
        const winLabel = this.scene.add.image(254 * scaleX, 658 * scaleY, 'ui_bn_number_win');
        winLabel.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(winLabel);
        
        // Score label (center)
        const scoreLabel = this.scene.add.image(576 * scaleX, 658 * scaleY, 'ui_bn_number_score');
        scoreLabel.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(scoreLabel);
        
        // Bet label (right)
        const betLabel = this.scene.add.image(929 * scaleX, 662 * scaleY, 'ui_bn_number_bet');
        betLabel.setScale(uiScale * scaleX, 0.674 * scaleY);
        this.burstModeUI.add(betLabel);
        
        // Value displays for bottom row
        const valueStyle = {
            fontSize: Math.floor(28 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Black',
            color: '#FFD700'
        };
        
        // Win amount
        this.burstWinText = this.scene.add.text(125 * scaleX, 658 * scaleY, '$0.00', {
            ...valueStyle,
            color: '#00FF00'
        });
        this.burstWinText.setOrigin(0, 0.5);
        this.burstModeUI.add(this.burstWinText);
        
        // Balance/Score
        this.burstBalanceText = this.scene.add.text(450 * scaleX, 658 * scaleY, `$${this.scene.stateManager.gameData.balance.toFixed(2)}`, valueStyle);
        this.burstBalanceText.setOrigin(0, 0.5);
        this.burstModeUI.add(this.burstBalanceText);
        
        // Bet amount2
        this.burstBetText = this.scene.add.text(950 * scaleX, 662 * scaleY, `$${this.scene.stateManager.gameData.currentBet.toFixed(2)}`, {
            ...valueStyle,
            color: '#FFFFFF'
        });
        this.burstBetText.setOrigin(0.5, 0.5);
        this.burstModeUI.add(this.burstBetText);
        
        // Bet adjustment buttons - added after bet label to ensure they appear on top
        // Note: uiScale is already defined above
        
        // Check if bet minus texture exists
        if (this.scene.textures.exists('ui_bn_number_bet-')) {
            const betMinus = this.scene.add.image(832 * scaleX, 660 * scaleY, 'ui_bn_number_bet-');
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
        } else {
            console.warn('ui_bn_number_bet- texture not found, creating fallback button');
            // Create a fallback button
            const betMinus = this.scene.add.text(832 * scaleX, 660 * scaleY, '-', {
                fontSize: Math.floor(32 * Math.min(scaleX, scaleY)) + 'px',
                fontFamily: 'Arial Black',
                color: '#FFFFFF',
                backgroundColor: '#444444',
                padding: { left: 10, right: 10, top: 5, bottom: 5 }
            });
            betMinus.setOrigin(0.5);
            betMinus.setInteractive({ useHandCursor: true });
            this.burstModeUI.add(betMinus);
            
            betMinus.on('pointerup', () => {
                window.SafeSound.play(this.scene, 'click');
                this.scene.adjustBet(-1);
                this.updateDisplays();
            });
        }
        
        // Check if bet plus texture exists
        if (this.scene.textures.exists('ui_bn_number_bet+')) {
            const betPlus = this.scene.add.image(1028 * scaleX, 660 * scaleY, 'ui_bn_number_bet+');
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
        } else {
            console.warn('ui_bn_number_bet+ texture not found, creating fallback button');
            // Create a fallback button
            const betPlus = this.scene.add.text(1028 * scaleX, 660 * scaleY, '+', {
                fontSize: Math.floor(32 * Math.min(scaleX, scaleY)) + 'px',
                fontFamily: 'Arial Black',
                color: '#FFFFFF',
                backgroundColor: '#444444',
                padding: { left: 10, right: 10, top: 5, bottom: 5 }
            });
            betPlus.setOrigin(0.5);
            betPlus.setInteractive({ useHandCursor: true });
            this.burstModeUI.add(betPlus);
            
            betPlus.on('pointerup', () => {
                window.SafeSound.play(this.scene, 'click');
                this.scene.adjustBet(1);
                this.updateDisplays();
            });
        }
    }
    
    createScoreDisplays(scaleX, scaleY) {
        // Text labels for the four info boxes
        const labelStyle = {
            fontSize: Math.floor(16 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial',
            color: '#FFFFFF'
        };
        
        const valueStyle = {
            fontSize: Math.floor(24 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Black',
            color: '#FFD700'
        };
        
        // Box 1 - Biggest Win
        const biggestWinLabel = this.scene.add.text(335 * scaleX, 444 * scaleY, 'Biggest Win', labelStyle);
        biggestWinLabel.setOrigin(0.5);
        this.burstModeUI.add(biggestWinLabel);
        
        this.biggestWinText = this.scene.add.text(335 * scaleX, 480 * scaleY, '$0.00', valueStyle);
        this.biggestWinText.setOrigin(0.5);
        this.burstModeUI.add(this.biggestWinText);
        
        // Box 2 - Bonus Rounds
        const bonusRoundsLabel = this.scene.add.text(535 * scaleX, 444 * scaleY, 'Bonus Rounds', labelStyle);
        bonusRoundsLabel.setOrigin(0.5);
        this.burstModeUI.add(bonusRoundsLabel);
        
        this.bonusRoundsText = this.scene.add.text(535 * scaleX, 480 * scaleY, '0', valueStyle);
        this.bonusRoundsText.setOrigin(0.5);
        this.burstModeUI.add(this.bonusRoundsText);
        
        // Box 3 - Bonus Wins
        const bonusWinsLabel = this.scene.add.text(735 * scaleX, 444 * scaleY, 'Bonus Wins', labelStyle);
        bonusWinsLabel.setOrigin(0.5);
        this.burstModeUI.add(bonusWinsLabel);
        
        this.bonusWinsText = this.scene.add.text(735 * scaleX, 480 * scaleY, '$0.00', valueStyle);
        this.bonusWinsText.setOrigin(0.5);
        this.burstModeUI.add(this.bonusWinsText);
        
        // Box 4 - Rounds Played
        const roundsPlayedLabel = this.scene.add.text(935 * scaleX, 444 * scaleY, 'Rounds played', labelStyle);
        roundsPlayedLabel.setOrigin(0.5);
        this.burstModeUI.add(roundsPlayedLabel);
        
        this.roundsPlayedText = this.scene.add.text(935 * scaleX, 480 * scaleY, '0', valueStyle);
        this.roundsPlayedText.setOrigin(0.5);
        this.burstModeUI.add(this.roundsPlayedText);
        
        // Initialize burst statistics
        this.burstStats = {
            biggestWin: 0,
            bonusRounds: 0,
            bonusWins: 0,
            roundsPlayed: 0
        };
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
            const total = (typeof spinResult.freeSpinsTotalWin === 'number')
                ? spinResult.freeSpinsTotalWin
                : this.scene.stateManager.freeSpinsData.totalWin;
            this.scene.showMessage(`Free Spins Complete! Total: $${total.toFixed(2)}`);
        }
    }
    
    toggleAutoSpin() {
        this.burstAutoSpinning = !this.burstAutoSpinning;
        
        if (this.burstAutoSpinning) {
            // Start spin button animation
            if (this.spinBtn && this.scene.anims.exists('burst_spin_animation')) {
                this.spinBtn.play('burst_spin_animation');
            }
            // Change auto toggle button appearance
            if (this.autoToggleBtn) {
                this.autoToggleBtn.setTint(0x00FF00); // Green tint when auto-spinning
            }
            this.startAutoSpin();
        } else {
            // Stop spin button animation
            if (this.spinBtn) {
                this.spinBtn.stop();
                this.spinBtn.setFrame(0);
            }
            // Reset auto toggle button appearance
            if (this.autoToggleBtn) {
                this.autoToggleBtn.clearTint();
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
                        const total = (typeof spinResult.freeSpinsTotalWin === 'number')
                            ? spinResult.freeSpinsTotalWin
                            : this.scene.stateManager.freeSpinsData.totalWin;
                        this.scene.showMessage(`Free Spins Complete! Total: $${total.toFixed(2)}`);
                    }
                    
                    // Short delay between auto spins
                    await this.scene.delay(200);
                } else {
                    // Stop auto spin if can't afford bet and not in free spins
                    if (!this.scene.stateManager.freeSpinsData.active) {
                        this.burstAutoSpinning = false;
                        // Reset button appearance
                        if (this.spinBtn) {
                            this.spinBtn.stop();
                            this.spinBtn.setFrame(0);
                        }
                        if (this.autoToggleBtn) {
                            this.autoToggleBtn.clearTint();
                        }
                        this.scene.showMessage('Insufficient Balance!');
                        break;
                    }
                }
            }
        } catch (error) {
            console.error('Error in burst auto spin:', error);
            this.burstAutoSpinning = false;
            if (this.spinBtn) {
                this.spinBtn.stop();
                this.spinBtn.setFrame(0);
            }
            if (this.autoToggleBtn) {
                this.autoToggleBtn.clearTint();
            }
            this.scene.showMessage('Auto-spin stopped due to error');
        }
    }
    
    async performSpin() {
        try {
            // SECURITY: Use controlled RNG for burst mode operations
            if (!window.RNG) {
                throw new Error('SECURITY: BurstModeManager requires window.RNG to be initialized.');
            }
            const rng = new window.RNG();
            
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
                    
                    // Apply cascade multiplier in free spins like normal game using controlled RNG
                    if (this.scene.stateManager.freeSpinsData.active && cascadeCount > 1) {
                        const shouldTrigger = rng.chance(window.GameConfig.FREE_SPINS.ACCUM_TRIGGER_CHANCE_PER_CASCADE);
                        if (shouldTrigger) {
                            const multiplierTable = window.GameConfig.RANDOM_MULTIPLIER.TABLE;
                            const randomMultiplier = multiplierTable[
                                rng.int(0, multiplierTable.length - 1)
                            ];
                            // Defer accumulation; handled by star arrival when FX is emitted elsewhere
                        }
                    }
                } else {
                    hasMatches = false;
                }
            }
            
            // Check for Cascading Random Multipliers in burst mode (simplified) using controlled RNG
            if (cascadeCount > 0) {
                const shouldTriggerCRM = rng.chance(window.GameConfig.CASCADE_RANDOM_MULTIPLIER.TRIGGER_CHANCE);
                if (shouldTriggerCRM && this.scene.totalWin >= window.GameConfig.CASCADE_RANDOM_MULTIPLIER.MIN_WIN_REQUIRED) {
                    // Determine number of multipliers to apply (1-3)
                    const minMults = window.GameConfig.CASCADE_RANDOM_MULTIPLIER.MIN_MULTIPLIERS;
                    const maxMults = window.GameConfig.CASCADE_RANDOM_MULTIPLIER.MAX_MULTIPLIERS;
                    const numMultipliers = rng.int(minMults, maxMults);
                    
                    // Apply multiple multipliers (simplified for burst mode) - ADD multipliers together
                    let totalMultiplier = 0;
                    const multipliers = [];
                    for (let i = 0; i < numMultipliers; i++) {
                        const multiplierTable = window.GameConfig.RANDOM_MULTIPLIER.TABLE;
                        const multiplier = multiplierTable[
                            rng.int(0, multiplierTable.length - 1)
                        ];
                        multipliers.push(multiplier);
                        totalMultiplier += multiplier;
                        
                        // Accumulate each multiplier during free spins
                        if (this.scene.stateManager.freeSpinsData.active) {
                            // Defer accumulation to star arrival
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
            const shouldTriggerRM = rng.chance(window.GameConfig.RANDOM_MULTIPLIER.TRIGGER_CHANCE);
            if (shouldTriggerRM && this.scene.totalWin >= window.GameConfig.RANDOM_MULTIPLIER.MIN_WIN_REQUIRED) {
                const multiplierTable = window.GameConfig.RANDOM_MULTIPLIER.TABLE;
                const multiplier = multiplierTable[
                    rng.int(0, multiplierTable.length - 1)
                ];
                this.scene.totalWin *= multiplier;
                
                // Accumulate multiplier during free spins
                if (this.scene.stateManager.freeSpinsData.active) {
                    // Defer accumulation to star arrival
                }
            }
            
            // Check if free spins ended
            let freeSpinsEnded = false;
            if (this.scene.stateManager.freeSpinsData.active && this.scene.stateManager.freeSpinsData.count === 0) {
                // Capture total free spins win BEFORE state reset so UI can show the right number
                const freeSpinsTotalBeforeReset = this.scene.stateManager.freeSpinsData.totalWin;
                this.scene.stateManager.endFreeSpins();
                freeSpinsEnded = true;
                // Attach the captured total to the result object
                // (will be returned below)
                var __freeSpinsTotalForResult = freeSpinsTotalBeforeReset;
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
                multiplierAccumulator: this.scene.stateManager.freeSpinsData.multiplierAccumulator,
                freeSpinsTotalWin: (typeof __freeSpinsTotalForResult === 'number') ? __freeSpinsTotalForResult : undefined
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
        
        // Update burst statistics
        this.burstStats.roundsPlayed++;
        if (result.win > this.burstStats.biggestWin) {
            this.burstStats.biggestWin = result.win;
        }
        if (result.bonusTriggered) {
            this.burstStats.bonusRounds++;
        }
        if (result.freeSpinsActive && result.win > 0) {
            this.burstStats.bonusWins += result.win;
        }
        
        // Update statistics displays
        this.updateStatisticsDisplays();
        
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
                            y: text.y - 20,
                    duration: 100,
                            ease: 'Power2'
                        });
                    }
                });
                
                // Remove old results if too many (reduced to fit smaller container)
                if (this.burstResultsContainer.list.length > 5) {
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

        // Push to the center-only winning feed
        if (result.win > 0) {
            this.addWinningFeedEntry(result);
        }
    }

    addWinningFeedEntry(result) {
        if (!this.burstWinsContainer) return;
        const scaleX = this._scaleX || 1;
        const scaleY = this._scaleY || 1;

        // Removed: Let WinPresentationManager control when win SFX play (no kaching here)

        const winMultiplier = result.bet > 0 ? (result.win / result.bet).toFixed(1) : '0.0';
        const msg = `WIN $${result.win.toFixed(2)}  (${winMultiplier}x)` +
            (result.cascades > 1 ? `  [${result.cascades} Cascades]` : '') +
            ((result.freeSpinsActive && result.multiplierAccumulator > 1) ? `  [x${result.multiplierAccumulator}]` : '');

        // Create an "exciting" styled text with stroke, shadow, and scale pop
        const text = this.scene.add.text(0, 0, msg, {
            fontFamily: 'Impact, Arial Black, Arial',
            fontSize: Math.floor(48 * Math.min(scaleX, scaleY)) + 'px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 8,
        });
        text.setOrigin(0.5);
        text.setShadow(0, 0, '#FF8800', 20, true, true);
        text.setScale(0.6);
        text.setAlpha(0);
        this.burstWinsContainer.add(text);

        // Animate: pop-in, slight float up, then fade out
        this.scene.tweens.add({
            targets: text,
            alpha: 1,
            scale: 1,
            duration: 110,
            ease: 'Back.Out',
        });
        this.scene.tweens.add({
            targets: text,
            y: text.y - 30 * scaleY,
            duration: 700,
            ease: 'Sine.InOut',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: text,
                    alpha: 0,
                    duration: 200,
                    ease: 'Sine.In',
                    onComplete: () => {
                        text.destroy();
                    }
                });
            }
        });
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
            
            const yPosition = (this.burstResultsContainer.list ? this.burstResultsContainer.list.length : 0) * 20 + 10;
            const text = this.scene.add.text(0, yPosition, resultString, {
                fontSize: '14px',
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
                duration: 100,
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
            const newBalance = this.scene.stateManager.gameData.balance;
            this.burstBalanceText.setText(`$${newBalance.toFixed(2)}`);
        }
        if (this.burstWinText) {
            const newWin = this.scene.totalWin;
            this.burstWinText.setText(`$${newWin.toFixed(2)}`);
        }
        if (this.burstBetText) {
            this.burstBetText.setText(`$${this.scene.stateManager.gameData.currentBet.toFixed(2)}`);
        }
    }
    
    updateStatisticsDisplays() {
        if (this.biggestWinText) {
            this.biggestWinText.setText(`$${this.burstStats.biggestWin.toFixed(2)}`);
        }
        if (this.bonusRoundsText) {
            this.bonusRoundsText.setText(this.burstStats.bonusRounds.toString());
        }
        if (this.bonusWinsText) {
            this.bonusWinsText.setText(`$${this.burstStats.bonusWins.toFixed(2)}`);
        }
        if (this.roundsPlayedText) {
            this.roundsPlayedText.setText(this.burstStats.roundsPlayed.toString());
        }
    }
    
    createBlackholeEffect(x, y, scaleX, scaleY) {
        try {
            // Load the blackhole shader if not already loaded
            if (!this.blackholeShader && window.createBlackholeShader) {
                this.blackholeShader = window.createBlackholeShader(this.scene);
                console.log('🕳️ Blackhole shader created for burst mode');
            }
            
            if (this.blackholeShader) {
                // Create a circular container for the blackhole effect
                const radius = Math.min(148 * scaleX, 148 * scaleY); // Radius of the circular effect
                
                // Adjust position to center the black hole in the portal
                // Previously offset pushed it too low; lift it slightly so the center sits fully in the mask
                const adjustedY = y + (50 * scaleY);
                
                // Create a graphics object for the circular mask
                const maskGraphics = this.scene.add.graphics();
                maskGraphics.fillStyle(0xffffff, 1);
                maskGraphics.fillCircle(0, 0, radius); // Draw at origin, position will be set on container
                maskGraphics.setVisible(false); // Hide the mask graphic itself
                
                // Position the mask graphics
                maskGraphics.x = x;
                maskGraphics.y = adjustedY;
                
                // Create a geometry mask from the graphics
                const mask = maskGraphics.createGeometryMask();
                
                // Create a larger rectangle to render the shader effect on
                // Make it larger so the effect fills the circle properly
                const size = radius * 3; // Larger size to show more of the shader effect
                this.blackholeEffect = this.scene.add.rectangle(x, adjustedY, size, size, 0x000000);
                
                // Apply the blackhole shader pipeline FIRST
                this.blackholeEffect.setPipeline(this.blackholeShader);
                
                // Then apply the circular mask to create round shape
                this.blackholeEffect.setMask(mask);
                
                // Set initial shader parameters
                this.blackholeShader.setIntensity(1.0); // Full intensity
                this.blackholeShader.setScale(0.6);     // Reduced scale to show complete blackhole
                // Move shader content up a bit within the circle without moving the mask
                // Tweak 0.05-0.12 as needed; value is in normalized screen units (relative to height)
                if (this.blackholeShader.setCenterOffset) {
                    this.blackholeShader.setCenterOffset(0.0, 0.38);
                }
                
                // Add to burst mode UI with higher depth to appear in center
                this.blackholeEffect.setDepth(2010);
                this.burstModeUI.add(this.blackholeEffect);
                this.burstModeUI.add(maskGraphics); // Add mask graphics but it's invisible
                
                // Store mask reference for cleanup
                this.blackholeMask = maskGraphics;
                
                console.log(`🕳️ Blackhole effect created at (${x}, ${adjustedY}) with radius ${radius}`);
            } else {
                console.warn('🕳️ Blackhole shader not available, skipping effect');
            }
        } catch (error) {
            console.error('🕳️ Failed to create blackhole effect:', error);
        }
    }
    
    // Getters
    isActive() { return this.burstModeActive; }
} 
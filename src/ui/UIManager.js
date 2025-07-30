// Phaser is loaded globally
// GameConfig is loaded globally

window.UIManager = class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.stateManager = scene.game.stateManager;
        
        // UI Groups
        this.topBar = null;
        this.bottomBar = null;
        this.buttons = {};
        this.displays = {};
        
        // Responsive scaling
        this.baseWidth = 1280;
        this.baseHeight = 720;
        this.scaleFactor = 1;
        
        // Animation states
        this.isAnimating = false;
        
        // Keyboard shortcuts
        this.shortcuts = null;
        
        this.create();
    }
    
    create() {
        this.calculateScale();
        this.createButtons();
        this.createKeyboardShortcuts();
    }
    
    calculateScale() {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        
        this.scaleFactor = Math.min(
            width / this.baseWidth,
            height / this.baseHeight
        );
        
        // Limit scale factor
        this.scaleFactor = Math.max(0.5, Math.min(this.scaleFactor, 2));
    }
    
    createButtons() {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        const bottomY = height - 50 * this.scaleFactor;
        
        // Create buttons similar to existing implementation but using UIManager
        // This is a simplified version - full implementation would be much larger
    }
    
    createKeyboardShortcuts() {
        const keys = this.scene.input.keyboard.addKeys({
            space: Phaser.Input.Keyboard.KeyCodes.SPACE,
            enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
            up: Phaser.Input.Keyboard.KeyCodes.UP,
            down: Phaser.Input.Keyboard.KeyCodes.DOWN,
            a: Phaser.Input.Keyboard.KeyCodes.A,
            q: Phaser.Input.Keyboard.KeyCodes.Q,
            m: Phaser.Input.Keyboard.KeyCodes.M,
            s: Phaser.Input.Keyboard.KeyCodes.S
        });
        
        // Spin shortcuts
        keys.space.on('down', () => {
            if (!this.scene.isSpinning) {
                this.scene.startSpin();
            }
        });
        
        keys.enter.on('down', () => {
            if (!this.scene.isSpinning) {
                this.scene.startSpin();
            }
        });
        
        // Bet adjustment
        keys.up.on('down', () => this.scene.adjustBet(1));
        keys.down.on('down', () => this.scene.adjustBet(-1));
        
        // Autoplay
        keys.a.on('down', () => this.scene.toggleAutoplay());
        
        // Quick spin
        keys.q.on('down', () => {
            const quickSpinEnabled = !this.scene.quickSpinEnabled;
            this.setQuickSpin(quickSpinEnabled);
            this.scene.quickSpinEnabled = quickSpinEnabled;
        });
        
        // Menu
        keys.m.on('down', () => {
            this.scene.sound.stopAll();
            this.scene.scene.start('MenuScene');
        });
        
        // Statistics
        keys.s.on('down', () => this.showStatistics());
        
        this.shortcuts = keys;
    }
    
    setQuickSpin(enabled) {
        if (enabled) {
            window.GameConfig.CASCADE_SPEED = 150;
            window.GameConfig.ANIMATIONS.SYMBOL_DROP_TIME = 100;
            window.GameConfig.ANIMATIONS.SYMBOL_DESTROY_TIME = 150;
        } else {
            window.GameConfig.CASCADE_SPEED = 300;
            window.GameConfig.ANIMATIONS.SYMBOL_DROP_TIME = 200;
            window.GameConfig.ANIMATIONS.SYMBOL_DESTROY_TIME = 300;
        }
    }
    
    updateBalance(balance) {
        if (this.scene.balanceText) {
            this.scene.balanceText.setText(`Balance: $${balance.toFixed(2)}`);
            
            // Animate balance change
            this.scene.tweens.add({
                targets: this.scene.balanceText,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 200,
                yoyo: true,
                ease: 'Power2'
            });
        }
    }
    
    updateWin(amount) {
        if (this.scene.winText) {
            this.scene.winText.setText(`Win: $${amount.toFixed(2)}`);
            
            if (amount > 0) {
                // Count up animation
                this.scene.tweens.add({
                    targets: { value: 0 },
                    value: amount,
                    duration: 1000,
                    ease: 'Power2',
                    onUpdate: (tween) => {
                        const value = tween.getValue();
                        this.scene.winText.setText(`Win: $${value.toFixed(2)}`);
                    }
                });
            }
        }
    }
    
    updateBet(bet) {
        if (this.scene.betText) {
            this.scene.betText.setText(`Bet: $${bet.toFixed(2)}`);
        }
    }
    
    updateFreeSpins(count, multiplier) {
        console.log(`=== UI UPDATE FREE SPINS ===`);
        console.log(`Count: ${count}, Multiplier: ${multiplier}`);
        console.log(`freeSpinsText exists: ${!!this.scene.freeSpinsText}`);
        
        if (this.scene.freeSpinsText) {
            if (count > 0) {
                console.log(`Setting free spins text to visible with: Free Spins: ${count} | Multiplier: x${multiplier}`);
                const autoText = this.scene.freeSpinsAutoPlay ? ' [AUTO]' : ' [MANUAL]';
                this.scene.freeSpinsText.setText(
                    `Free Spins: ${count} | Multiplier: x${multiplier}${autoText}`
                );
                this.scene.freeSpinsText.setVisible(true);
                
                // Add pulsing animation to make it more noticeable
                this.scene.tweens.add({
                    targets: this.scene.freeSpinsText,
                    scaleX: 1.2,
                    scaleY: 1.2,
                    duration: 400,
                    yoyo: true,
                    repeat: 1,
                    ease: 'Power2'
                });
                
                // Add continuous glow effect
                this.scene.tweens.add({
                    targets: this.scene.freeSpinsText,
                    alpha: 0.7,
                    duration: 1000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            } else {
                console.log(`Setting free spins text to hidden`);
                this.scene.freeSpinsText.setVisible(false);
                // Stop any running animations
                this.scene.tweens.killTweensOf(this.scene.freeSpinsText);
                this.scene.freeSpinsText.setAlpha(1);
                this.scene.freeSpinsText.setScale(1);
            }
        } else {
            console.log(`ERROR: freeSpinsText not found!`);
        }
        
        console.log(`=== END UI UPDATE FREE SPINS ===`);
    }
    
    setButtonsEnabled(enabled) {
        if (this.scene.spinButton) {
            this.scene.spinButton.disabled = !enabled;
            this.scene.spinButton.setAlpha(enabled ? 1 : 0.5);
        }
        
        if (this.scene.minusButton) {
            this.scene.minusButton.setAlpha(enabled ? 1 : 0.5);
        }
        
        if (this.scene.plusButton) {
            this.scene.plusButton.setAlpha(enabled ? 1 : 0.5);
        }
        
        if (this.scene.buyFreeSpinsButton) {
            this.scene.buyFreeSpinsButton.disabled = !enabled;
            this.scene.buyFreeSpinsButton.setAlpha(enabled ? 1 : 0.5);
        }
        
        if (this.scene.burstModeButton) {
            this.scene.burstModeButton.disabled = !enabled;
            this.scene.burstModeButton.setAlpha(enabled ? 1 : 0.5);
        }
    }
    
    showStatistics() {
        if (this.scene.winCalculator) {
            const stats = this.scene.winCalculator.getSessionStats();
            const streaks = this.scene.winCalculator.getWinStreaks();
            
            const container = this.scene.add.container(
                this.scene.cameras.main.width / 2,
                this.scene.cameras.main.height / 2
            );
            
            // Background
            const bg = this.scene.add.rectangle(0, 0, 600, 400, 0x000000, 0.95);
            bg.setStrokeStyle(3, 0x6B46C1);
            bg.setInteractive();
            container.add(bg);
            
            // Title
            const title = this.scene.add.text(0, -170, 'SESSION STATISTICS', {
                fontSize: '28px',
                fontFamily: 'Arial Black',
                color: '#FFD700'
            });
            title.setOrigin(0.5);
            container.add(title);
            
            // Stats display
            const statsText = [
                `Total Spins: ${stats.totalSpins}`,
                `Win Rate: ${stats.winRate}%`,
                `Total Won: $${stats.totalWon}`,
                `Total Bet: $${stats.totalBet}`,
                `RTP: ${stats.rtp}%`,
                `Biggest Win: $${stats.biggestWin.toFixed(2)}`,
                `Average Win: $${stats.averageWin}`,
                '',
                `Current Win Streak: ${streaks.currentWinStreak}`,
                `Best Win Streak: ${streaks.bestWinStreak}`
            ];
            
            statsText.forEach((text, index) => {
                const statLine = this.scene.add.text(-250, -120 + index * 30, text, {
                    fontSize: '20px',
                    fontFamily: 'Arial',
                    color: '#FFFFFF'
                });
                container.add(statLine);
            });
            
            // Close button
            const closeButton = this.scene.add.rectangle(0, 150, 100, 40, 0x6B46C1);
            closeButton.setInteractive({ useHandCursor: true });
            const closeText = this.scene.add.text(0, 150, 'CLOSE', {
                fontSize: '20px',
                fontFamily: 'Arial',
                color: '#FFFFFF'
            });
            closeText.setOrigin(0.5);
            
            closeButton.on('pointerup', () => {
                this.scene.sound.play('click');
                container.destroy();
            });
            
            container.add([closeButton, closeText]);
        }
    }
    
    destroy() {
        if (this.shortcuts) {
            Object.values(this.shortcuts).forEach(key => key.removeAllListeners());
        }
    }
} 
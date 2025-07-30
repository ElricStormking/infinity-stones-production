// Phaser is loaded globally

window.MenuScene = class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }
    
    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const stateManager = this.game.stateManager;
        
        // Background
        const bg = this.add.tileSprite(0, 0, width, height, 'background');
        bg.setOrigin(0, 0);
        
        // Darken overlay
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.5);
        
        // Title
        const title = this.add.text(width / 2, height / 3, 'INFINITY STORM', {
            fontSize: '72px',
            fontFamily: 'Arial Black',
            color: '#ffffff',
            stroke: '#6B46C1',
            strokeThickness: 8
        });
        title.setOrigin(0.5);
        
        // Add glow effect to title
        this.tweens.add({
            targets: title,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Subtitle
        const subtitle = this.add.text(width / 2, height / 3 + 80, 'Thanos vs Scarlet Witch', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#9B59B6'
        });
        subtitle.setOrigin(0.5);
        
        // Play button
        const playButton = this.createButton(width / 2, height / 2 + 50, 'PLAY', () => {
            window.SafeSound.play(this, 'click');
            this.scene.start('GameScene');
        });
        
        // Balance display
        const balanceText = this.add.text(width / 2, height / 2 + 150, 
            `Balance: $${stateManager.gameData.balance.toFixed(2)}`, {
            fontSize: '28px',
            fontFamily: 'Arial',
            color: '#FFD700'
        });
        balanceText.setOrigin(0.5);
        
        // Sound toggle buttons
        const soundButton = this.createToggleButton(width - 100, 50, 
            stateManager.gameData.soundEnabled ? 'Sound: ON' : 'Sound: OFF',
            () => {
                stateManager.gameData.soundEnabled = !stateManager.gameData.soundEnabled;
                soundButton.text.setText(stateManager.gameData.soundEnabled ? 'Sound: ON' : 'Sound: OFF');
                window.SafeSound.play(this, 'click');
            }
        );
        
        const musicButton = this.createToggleButton(width - 100, 110, 
            stateManager.gameData.musicEnabled ? 'Music: ON' : 'Music: OFF',
            () => {
                stateManager.gameData.musicEnabled = !stateManager.gameData.musicEnabled;
                musicButton.text.setText(stateManager.gameData.musicEnabled ? 'Music: ON' : 'Music: OFF');
                window.SafeSound.play(this, 'click');
                
                if (stateManager.gameData.musicEnabled && !this.bgMusic) {
                    this.bgMusic = window.SafeSound.add(this, 'bgm_infinity_storm', { loop: true, volume: 0.5 });
                    if (this.bgMusic) this.bgMusic.play();
                } else if (!stateManager.gameData.musicEnabled && this.bgMusic) {
                    this.bgMusic.stop();
                }
            }
        );
        
        // Version text
        this.add.text(10, height - 20, 'v1.0.0 - Demo', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#666666'
        });
        
        // Set menu state
        stateManager.setState(stateManager.states.MENU);
    }
    
    createButton(x, y, text, callback) {
        const button = this.add.container(x, y);
        
        // Button background
        const bg = this.add.image(0, 0, 'button');
        bg.setInteractive({ useHandCursor: true });
        
        // Button text
        const label = this.add.text(0, 0, text, {
            fontSize: '32px',
            fontFamily: 'Arial Black',
            color: '#ffffff'
        });
        label.setOrigin(0.5);
        
        button.add([bg, label]);
        
        // Hover effects
        bg.on('pointerover', () => {
            this.tweens.add({
                targets: button,
                scaleX: 1.1,
                scaleY: 1.1,
                duration: 100
            });
        });
        
        bg.on('pointerout', () => {
            this.tweens.add({
                targets: button,
                scaleX: 1,
                scaleY: 1,
                duration: 100
            });
        });
        
        bg.on('pointerdown', () => {
            button.setScale(0.95);
        });
        
        bg.on('pointerup', () => {
            button.setScale(1);
            callback();
        });
        
        return button;
    }
    
    createToggleButton(x, y, text, callback) {
        const button = this.add.container(x, y);
        
        // Small button background
        const bg = this.add.rectangle(0, 0, 150, 40, 0x6B46C1);
        bg.setStrokeStyle(2, 0xffffff);
        bg.setInteractive({ useHandCursor: true });
        
        // Button text
        const label = this.add.text(0, 0, text, {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#ffffff'
        });
        label.setOrigin(0.5);
        
        button.add([bg, label]);
        button.text = label;
        
        bg.on('pointerup', callback);
        
        bg.on('pointerover', () => {
            bg.setFillStyle(0x9B59B6);
        });
        
        bg.on('pointerout', () => {
            bg.setFillStyle(0x6B46C1);
        });
        
        return button;
    }
} 
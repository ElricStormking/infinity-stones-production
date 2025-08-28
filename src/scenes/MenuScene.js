// Phaser is loaded globally

window.MenuScene = class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }
    
    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const stateManager = this.game.stateManager;
        
        // First, validate session before showing menu
        this.validateSessionAndContinue();
    }
    
    async validateSessionAndContinue() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const stateManager = this.game.stateManager;
        
        // Show loading state during validation
        this.showValidatingState();
        
        try {
            // Ensure SessionService is available
            if (!window.SessionService) {
                console.error('🔐 SessionService not available');
                // Fallback - show error or retry
                setTimeout(() => this.validateSessionAndContinue(), 1000);
                return;
            }
            
            // Check session status
            const sessionStatus = window.SessionService.getSessionStatus();
            
            if (!sessionStatus.authenticated) {
                console.log('🔐 No valid session found, continuing in demo mode');
                if (window.SessionService.redirectToPortal) {
                    const redirectResult = window.SessionService.redirectToPortal('no_session');
                    // If redirect was disabled (returns false), continue with demo mode
                    if (redirectResult === false) {
                        console.log('🔐 Demo mode: Showing menu without authentication');
                        this.showMainMenu();
                        return;
                    }
                } else {
                    console.error('🔐 redirectToPortal method not available');
                    this.showMainMenu();
                }
                return;
            }
            
            // Validate session with server
            const isValid = await window.SessionService.validateSession();
            
            if (!isValid) {
                console.log('🔐 Session validation failed, continuing in demo mode');
                if (window.SessionService.redirectToPortal) {
                    const redirectResult = window.SessionService.redirectToPortal('invalid_session');
                    // If redirect was disabled (returns false), continue with demo mode
                    if (redirectResult === false) {
                        console.log('🔐 Demo mode: Showing menu without authentication');
                        this.showMainMenu();
                        return;
                    }
                } else {
                    console.error('🔐 redirectToPortal method not available');
                    this.showMainMenu();
                }
                return;
            }
            
            console.log('🔐 ✅ Session validated, showing menu');
            this.showMainMenu();
            
        } catch (error) {
            console.error('🔐 Session validation error:', error);
            if (window.SessionService && window.SessionService.redirectToPortal) {
                const redirectResult = window.SessionService.redirectToPortal('validation_error');
                // If redirect was disabled (returns false), continue with demo mode
                if (redirectResult === false) {
                    console.log('🔐 Demo mode: Showing menu despite validation error');
                    this.showMainMenu();
                }
            } else {
                console.error('🔐 Cannot redirect to portal - SessionService not available, showing menu anyway');
                this.showMainMenu();
            }
        }
    }
    
    showValidatingState() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Background
        let bg;
        if (this.textures && this.textures.exists('scarlet_witch_loading')) {
            bg = this.add.image(width / 2, height / 2, 'scarlet_witch_loading');
            bg.setOrigin(0.5);
            bg.setDisplaySize(width, height);
        } else {
            bg = this.add.tileSprite(0, 0, width, height, 'background');
            bg.setOrigin(0, 0);
        }
        bg.setDepth(-1000);
        
        // Darken overlay
        const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65);
        shade.setDepth(-900);
        
        // Loading message
        const loadingText = this.add.text(width / 2, height / 2, 'Validating Session...', {
            fontSize: '36px',
            fontFamily: 'Arial Black',
            color: '#ffffff',
            stroke: '#6B46C1',
            strokeThickness: 4
        });
        loadingText.setOrigin(0.5);
        
        // Pulse animation
        this.tweens.add({
            targets: loadingText,
            alpha: 0.5,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Store for cleanup
        this.validatingElements = [bg, shade, loadingText];
    }
    
    showMainMenu() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const stateManager = this.game.stateManager;
        
        // Clear validating state
        if (this.validatingElements) {
            this.validatingElements.forEach(element => element.destroy());
            this.validatingElements = null;
        }
        
        // Background: use Scarlet Witch loading artwork if available
        let bg;
        if (this.textures && this.textures.exists('scarlet_witch_loading')) {
            bg = this.add.image(width / 2, height / 2, 'scarlet_witch_loading');
            bg.setOrigin(0.5);
            bg.setDisplaySize(width, height);
        } else {
            bg = this.add.tileSprite(0, 0, width, height, 'background');
            bg.setOrigin(0, 0);
        }
        bg.setDepth(-1000);
        
        // Darken overlay to improve text contrast
        const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.45);
        shade.setDepth(-900);
        
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
        
        // Session status (in development mode)
        if (window.DEBUG) {
            const sessionStatus = window.SessionService.getSessionStatus();
            const statusText = this.add.text(width / 2, height / 2 + 200, 
                `Session: ${sessionStatus.authenticated ? 'Valid' : 'Invalid'}`, {
                fontSize: '16px',
                fontFamily: 'Arial',
                color: sessionStatus.authenticated ? '#4CAF50' : '#FF6B6B'
            });
            statusText.setOrigin(0.5);
        }
        
        // Logout button (for testing/admin purposes)
        if (window.DEBUG) {
            const logoutButton = this.createButton(width - 100, 50, 'LOGOUT', () => {
                window.SessionService.logout();
            });
            logoutButton.setScale(0.5);
        }
        
        // Version text
        this.add.text(10, height - 20, 'v1.0.0 - Server Mode', {
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
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
        
        // Loading message - mobile-optimized
        const isMobileDevice = window.deviceDetection && window.deviceDetection.isMobileOrTablet();
        const loadingFontSize = isMobileDevice ? 
            Math.max(24, Math.floor(36 * Math.min(width / 1920, 1.0))) : 36;
        
        const loadingText = this.add.text(width / 2, height / 2, 'Validating Session...', {
            fontSize: `${loadingFontSize}px`,
            fontFamily: 'Arial Black',
            color: '#ffffff',
            stroke: '#6B46C1',
            strokeThickness: isMobileDevice ? 3 : 4 // Slightly thinner stroke on mobile
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
        
        // Mobile spacing optimization
        const isMobileDevice = window.deviceDetection && window.deviceDetection.isMobileOrTablet();
        const spacingMultiplier = isMobileDevice ? this.getMobileSpacingMultiplier(height) : 1;
        
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
        
        // Calculate responsive positions for mobile
        const titleY = isMobileDevice ? height * 0.25 : height / 3;
        const subtitleSpacing = isMobileDevice ? 100 * spacingMultiplier : 80;
        const playButtonSpacing = isMobileDevice ? 120 * spacingMultiplier : 50;
        const balanceSpacing = isMobileDevice ? 120 * spacingMultiplier : 100;
        
        // Title - adjust size for mobile readability
        const titleFontSize = isMobileDevice ? this.getResponsiveFontSize(72, width, { category: 'large' }) : 72;
        const title = this.add.text(width / 2, titleY, 'INFINITY STORM', {
            fontSize: `${titleFontSize}px`,
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
        
        // Subtitle - improved mobile spacing and sizing
        const subtitleFontSize = isMobileDevice ? this.getResponsiveFontSize(24, width, { category: 'medium' }) : 24;
        const subtitle = this.add.text(width / 2, titleY + subtitleSpacing, 'Thanos vs Scarlet Witch', {
            fontSize: `${subtitleFontSize}px`,
            fontFamily: 'Arial',
            color: '#9B59B6',
            // Enhanced readability with subtle stroke for mobile
            stroke: isMobileDevice ? '#000000' : undefined,
            strokeThickness: isMobileDevice ? 2 : 0
        });
        subtitle.setOrigin(0.5);
        
        // Play button - optimized positioning for touch
        const playButtonY = titleY + subtitleSpacing + playButtonSpacing;
        const playButton = this.createButton(width / 2, playButtonY, 'PLAY', () => {
            window.SafeSound.play(this, 'click');
            this.scene.start('GameScene');
        });
        
        // Balance display - adequate spacing from button
        const balanceFontSize = isMobileDevice ? this.getResponsiveFontSize(28, width, { category: 'medium' }) : 28;
        const balanceText = this.add.text(width / 2, playButtonY + balanceSpacing, 
            `Balance: $${stateManager.gameData.balance.toFixed(2)}`, {
            fontSize: `${balanceFontSize}px`,
            fontFamily: 'Arial',
            color: '#FFD700',
            // Enhanced readability with stroke for mobile
            stroke: isMobileDevice ? '#000000' : undefined,
            strokeThickness: isMobileDevice ? 2 : 0
        });
        balanceText.setOrigin(0.5);
        
        // Session status (in development mode) - mobile-optimized positioning
        if (window.DEBUG) {
            const sessionStatus = window.SessionService.getSessionStatus();
            const statusSpacing = isMobileDevice ? 80 * spacingMultiplier : 50;
            const statusFontSize = isMobileDevice ? this.getResponsiveFontSize(16, width, { category: 'small' }) : 16;
            const statusText = this.add.text(width / 2, playButtonY + balanceSpacing + statusSpacing, 
                `Session: ${sessionStatus.authenticated ? 'Valid' : 'Invalid'}`, {
                fontSize: `${statusFontSize}px`,
                fontFamily: 'Arial',
                color: sessionStatus.authenticated ? '#4CAF50' : '#FF6B6B',
                // Enhanced readability for small text on mobile
                stroke: isMobileDevice ? '#000000' : undefined,
                strokeThickness: isMobileDevice ? 1 : 0
            });
            statusText.setOrigin(0.5);
        }
        
        // Logout button (for testing/admin purposes) - mobile-optimized positioning
        if (window.DEBUG) {
            const logoutX = isMobileDevice ? width - 80 : width - 100;
            const logoutY = isMobileDevice ? 70 : 50;
            const logoutButton = this.createButton(logoutX, logoutY, 'LOGOUT', () => {
                window.SessionService.logout();
            });
            logoutButton.setScale(isMobileDevice ? 0.4 : 0.5);
        }
        
        // Version text - mobile-optimized positioning and sizing
        const versionFontSize = isMobileDevice ? this.getResponsiveFontSize(14, width, { category: 'small' }) : 14;
        const versionX = isMobileDevice ? 15 : 10;
        const versionY = isMobileDevice ? height - 30 : height - 20;
        this.add.text(versionX, versionY, 'v1.0.0 - Server Mode', {
            fontSize: `${versionFontSize}px`,
            fontFamily: 'Arial',
            color: isMobileDevice ? '#AAAAAA' : '#666666', // Lighter on mobile for better contrast
            // Enhanced readability for version text on mobile
            stroke: isMobileDevice ? '#000000' : undefined,
            strokeThickness: isMobileDevice ? 1 : 0
        });
        
        // Set menu state
        stateManager.setState(stateManager.states.MENU);
    }
    
    createButton(x, y, text, callback) {
        const button = this.add.container(x, y);
        
        // Button background
        const bg = this.add.image(0, 0, 'button');
        
        // Touch optimization: Create larger hit area for mobile devices
        const isMobileDevice = window.deviceDetection && window.deviceDetection.isMobileOrTablet();
        let hitArea;
        
        if (isMobileDevice) {
            // Calculate minimum touch target size (44x44px minimum)
            const minTouchSize = 44;
            const buttonWidth = Math.max(bg.width, minTouchSize);
            const buttonHeight = Math.max(bg.height, minTouchSize);
            
            // Create expanded hit area for touch
            hitArea = new Phaser.Geom.Rectangle(
                -buttonWidth / 2, 
                -buttonHeight / 2, 
                buttonWidth, 
                buttonHeight
            );
            
            bg.setInteractive({ 
                hitArea: hitArea, 
                hitAreaCallback: Phaser.Geom.Rectangle.Contains,
                useHandCursor: true 
            });
        } else {
            // Desktop: Use default hit area
            bg.setInteractive({ useHandCursor: true });
        }
        
        // Button text - responsive sizing for better mobile readability
        const buttonFontSize = isMobileDevice ? 
            this.getResponsiveFontSize(32, this.cameras.main.width, { category: 'medium' }) : 32;
        
        const label = this.add.text(0, 0, text, {
            fontSize: `${buttonFontSize}px`,
            fontFamily: 'Arial Black',
            color: '#ffffff',
            // Enhanced contrast for mobile
            stroke: isMobileDevice ? '#000000' : undefined,
            strokeThickness: isMobileDevice ? 2 : 0
        });
        label.setOrigin(0.5);
        
        button.add([bg, label]);
        
        // Touch/Hover effects - enhanced for mobile
        bg.on('pointerover', () => {
            // Only animate on non-touch devices (avoid hover on mobile)
            if (!isMobileDevice) {
                this.tweens.add({
                    targets: button,
                    scaleX: 1.1,
                    scaleY: 1.1,
                    duration: 100
                });
            }
        });
        
        bg.on('pointerout', () => {
            // Only animate on non-touch devices
            if (!isMobileDevice) {
                this.tweens.add({
                    targets: button,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 100
                });
            }
        });
        
        bg.on('pointerdown', () => {
            // Enhanced touch feedback for mobile
            const scaleAmount = isMobileDevice ? 0.9 : 0.95;
            button.setScale(scaleAmount);
            
            // Add subtle color tint for touch feedback on mobile
            if (isMobileDevice) {
                bg.setTint(0xCCCCCC);
            }
        });
        
        bg.on('pointerup', () => {
            button.setScale(1);
            
            // Remove tint
            if (isMobileDevice) {
                bg.clearTint();
            }
            
            callback();
        });
        
        // Handle touch cancel (finger dragged off button)
        bg.on('pointerupoutside', () => {
            button.setScale(1);
            if (isMobileDevice) {
                bg.clearTint();
            }
        });
        
        return button;
    }
    
    createToggleButton(x, y, text, callback) {
        const button = this.add.container(x, y);
        
        // Touch optimization: Ensure minimum size for mobile
        const isMobileDevice = window.deviceDetection && window.deviceDetection.isMobileOrTablet();
        const minTouchSize = 44;
        
        // Adjust button size for mobile touch targets
        let buttonWidth = 150;
        let buttonHeight = 40;
        
        if (isMobileDevice) {
            buttonWidth = Math.max(buttonWidth, minTouchSize);
            buttonHeight = Math.max(buttonHeight, minTouchSize);
        }
        
        // Small button background
        const bg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x6B46C1);
        bg.setStrokeStyle(2, 0xffffff);
        
        // Set up interactive area
        let hitArea;
        if (isMobileDevice) {
            // Create expanded hit area if needed
            const hitWidth = Math.max(buttonWidth, minTouchSize);
            const hitHeight = Math.max(buttonHeight, minTouchSize);
            
            hitArea = new Phaser.Geom.Rectangle(
                -hitWidth / 2, 
                -hitHeight / 2, 
                hitWidth, 
                hitHeight
            );
            
            bg.setInteractive({ 
                hitArea: hitArea, 
                hitAreaCallback: Phaser.Geom.Rectangle.Contains,
                useHandCursor: true 
            });
        } else {
            bg.setInteractive({ useHandCursor: true });
        }
        
        // Button text - responsive sizing for mobile readability
        const toggleFontSize = isMobileDevice ? 
            this.getResponsiveFontSize(18, this.cameras.main.width, { category: 'small' }) : 18;
        
        const label = this.add.text(0, 0, text, {
            fontSize: `${toggleFontSize}px`,
            fontFamily: 'Arial',
            color: '#ffffff',
            // Enhanced readability for mobile
            stroke: isMobileDevice ? '#000000' : undefined,
            strokeThickness: isMobileDevice ? 1 : 0
        });
        label.setOrigin(0.5);
        
        button.add([bg, label]);
        button.text = label;
        
        // Touch-optimized interactions
        bg.on('pointerdown', () => {
            // Touch feedback
            const scaleAmount = isMobileDevice ? 0.9 : 0.95;
            button.setScale(scaleAmount);
            bg.setFillStyle(0x4A3092); // Darker on press
        });
        
        bg.on('pointerup', () => {
            button.setScale(1);
            bg.setFillStyle(0x6B46C1); // Reset color
            callback();
        });
        
        bg.on('pointerupoutside', () => {
            button.setScale(1);
            bg.setFillStyle(0x6B46C1); // Reset color
        });
        
        bg.on('pointerover', () => {
            // Only show hover on non-touch devices
            if (!isMobileDevice) {
                bg.setFillStyle(0x9B59B6);
            }
        });
        
        bg.on('pointerout', () => {
            // Only handle hover out on non-touch devices
            if (!isMobileDevice) {
                bg.setFillStyle(0x6B46C1);
            }
        });
        
        return button;
    }
    
    // Mobile spacing helper methods
    getMobileSpacingMultiplier(screenHeight) {
        // Adjust spacing based on screen height for better mobile experience
        // Smaller screens get smaller multipliers to prevent overcrowding
        if (screenHeight < 600) {
            return 0.8; // Compact mobile phones
        } else if (screenHeight < 800) {
            return 1.0; // Standard mobile phones
        } else if (screenHeight < 1200) {
            return 1.2; // Large phones and small tablets
        } else {
            return 1.4; // Large tablets
        }
    }
    
    getResponsiveFontSize(baseFontSize, screenWidth, options = {}) {
        // Enhanced responsive font sizing with better readability on small screens
        const scaleFactor = Math.min(screenWidth / 1920, 1.0); // Don't scale up beyond desktop size
        
        // Different scaling strategies based on font size category
        let minScale, maxScale;
        
        if (options.category === 'small') {
            // Small text (12-18px): Prevent it from becoming unreadable
            minScale = 0.85; // Higher minimum for small text
            maxScale = 1.1;  // Allow slight enlargement for better mobile readability
        } else if (options.category === 'large') {
            // Large text (48px+): Can scale down more aggressively
            minScale = 0.6;  // More aggressive scaling for large text
            maxScale = 1.0;
        } else {
            // Medium text (18-48px): Balanced scaling
            minScale = 0.75; // Improved from 0.7
            maxScale = 1.0;
        }
        
        // Apply minimum readable size constraints
        const adjustedScale = Math.max(minScale, Math.min(maxScale, scaleFactor));
        let calculatedSize = Math.floor(baseFontSize * adjustedScale);
        
        // Enforce absolute minimum sizes for readability
        if (options.category === 'small' && calculatedSize < 14) {
            calculatedSize = 14; // Never go below 14px for small text
        } else if (options.category === 'medium' && calculatedSize < 16) {
            calculatedSize = 16; // Never go below 16px for medium text
        }
        
        return calculatedSize;
    }
} 
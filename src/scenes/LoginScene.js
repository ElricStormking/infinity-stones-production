// LoginScene.js - User authentication scene
class LoginScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LoginScene' });
        this.isLoading = false;
        this.currentForm = 'login'; // 'login' or 'register'
        
        // Form data
        this.loginData = { username: '', password: '' };
        this.registerData = { username: '', email: '', password: '', confirmPassword: '' };
    }
    
    preload() {
        // Load background and UI assets
        this.load.image('loginBg', 'assets/images/BG_infinity_storm.png');
    }
    
    create() {
        console.log('🔐 LoginScene accessed - Portal-first architecture active');
        console.log('🔐 This scene is deprecated in portal-first mode');
        
        // Background
        this.add.image(960, 540, 'loginBg').setDisplaySize(1920, 1080);
        
        // Show deprecation message
        const shade = this.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.8);
        
        const title = this.add.text(960, 400, 'PORTAL AUTHENTICATION REQUIRED', {
            fontSize: '48px',
            fontFamily: 'Arial Black',
            color: '#FF6B6B',
            stroke: '#8B0000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        const message = this.add.text(960, 500, 'This game uses portal-first authentication.\nYou will be redirected to the authentication portal.', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center'
        }).setOrigin(0.5);
        
        const redirectingText = this.add.text(960, 600, 'Redirecting in 3 seconds...', {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#FFD700'
        }).setOrigin(0.5);
        
        // Countdown and redirect
        let countdown = 3;
        const timer = this.time.addEvent({
            delay: 1000,
            repeat: 2,
            callback: () => {
                countdown--;
                if (countdown > 0) {
                    redirectingText.setText(`Redirecting in ${countdown} second${countdown > 1 ? 's' : ''}...`);
                } else {
                    redirectingText.setText('Redirecting now...');
                    // Redirect to portal
                    window.SessionService.redirectToPortal('login_scene_deprecated');
                }
            }
        });
        
        // Immediate redirect button
        this.createButton('REDIRECT NOW', 960, 700, 0x4CAF50, () => {
            timer.destroy();
            window.SessionService.redirectToPortal('manual_redirect');
        });
    }
    
    createLoginUI() {
        // Login form container
        this.loginContainer = this.add.container(960, 540);
        
        // Form background
        const formBg = this.add.rectangle(0, 0, 500, 400, 0x000000, 0.8);
        formBg.setStrokeStyle(2, 0xFFD700);
        this.loginContainer.add(formBg);
        
        // Title
        const title = this.add.text(0, -150, 'LOGIN', {
            fontSize: '32px',
            fontFamily: 'Arial Black',
            color: '#FFD700'
        }).setOrigin(0.5);
        this.loginContainer.add(title);
        
        // Username input (simplified - using text display)
        this.loginUsernameText = this.add.text(0, -80, 'Username: ', {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#FFFFFF'
        }).setOrigin(0.5);
        this.loginContainer.add(this.loginUsernameText);
        
        // Password input
        this.loginPasswordText = this.add.text(0, -40, 'Password: ', {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#FFFFFF'
        }).setOrigin(0.5);
        this.loginContainer.add(this.loginPasswordText);
        
        // Login button
        this.createButton('LOGIN', 0, 20, 0x4CAF50, () => this.handleLogin(), this.loginContainer);
        
        // Register link
        this.createButton('REGISTER', 0, 80, 0x2196F3, () => this.showRegisterForm(), this.loginContainer);
        
        // Demo login button
        this.createButton('DEMO LOGIN', 0, 140, 0x9C27B0, () => this.handleDemoLogin(), this.loginContainer);
    }
    
    createRegisterUI() {
        // Register form container
        this.registerContainer = this.add.container(960, 540);
        this.registerContainer.setVisible(false);
        
        // Form background
        const formBg = this.add.rectangle(0, 0, 500, 500, 0x000000, 0.8);
        formBg.setStrokeStyle(2, 0xFFD700);
        this.registerContainer.add(formBg);
        
        // Title
        const title = this.add.text(0, -200, 'REGISTER', {
            fontSize: '32px',
            fontFamily: 'Arial Black',
            color: '#FFD700'
        }).setOrigin(0.5);
        this.registerContainer.add(title);
        
        // Form fields (simplified display)
        this.registerUsernameText = this.add.text(0, -120, 'Username: ', {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#FFFFFF'
        }).setOrigin(0.5);
        this.registerContainer.add(this.registerUsernameText);
        
        this.registerEmailText = this.add.text(0, -80, 'Email: ', {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#FFFFFF'
        }).setOrigin(0.5);
        this.registerContainer.add(this.registerEmailText);
        
        this.registerPasswordText = this.add.text(0, -40, 'Password: ', {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#FFFFFF'
        }).setOrigin(0.5);
        this.registerContainer.add(this.registerPasswordText);
        
        this.registerConfirmText = this.add.text(0, 0, 'Confirm Password: ', {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#FFFFFF'
        }).setOrigin(0.5);
        this.registerContainer.add(this.registerConfirmText);
        
        // Register button
        this.createButton('REGISTER', 0, 60, 0x4CAF50, () => this.handleRegister(), this.registerContainer);
        
        // Back to login
        this.createButton('BACK TO LOGIN', 0, 120, 0x757575, () => this.showLoginForm(), this.registerContainer);
    }
    
    createConnectionStatus() {
        this.connectionStatus = this.add.text(100, 50, '🔴 Disconnected', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#FF6B6B'
        });
        
        this.updateConnectionStatus();
    }
    
    createButton(text, x, y, color, callback, container) {
        const button = this.add.rectangle(x, y, 200, 40, color);
        button.setStrokeStyle(2, 0xFFFFFF);
        
        const buttonText = this.add.text(x, y, text, {
            fontSize: '16px',
            fontFamily: 'Arial Black',
            color: '#FFFFFF'
        }).setOrigin(0.5);
        
        button.setInteractive({ useHandCursor: true });
        button.on('pointerdown', callback);
        button.on('pointerover', () => {
            button.setScale(1.05);
            buttonText.setScale(1.05);
        });
        button.on('pointerout', () => {
            button.setScale(1);
            buttonText.setScale(1);
        });
        
        if (container) {
            container.add([button, buttonText]);
        } else {
            // Add to scene directly if no container
        }
    }
    
    updateConnectionStatus() {
        // For now, just show as disconnected
        // In a real implementation, this would check NetworkService
        this.connectionStatus.setText('🔴 Disconnected');
        this.connectionStatus.setColor('#FF6B6B');
    }
    
    showLoginForm() {
        this.currentForm = 'login';
        this.loginContainer.setVisible(true);
        this.registerContainer.setVisible(false);
    }
    
    showRegisterForm() {
        this.currentForm = 'register';
        this.loginContainer.setVisible(false);
        this.registerContainer.setVisible(true);
    }
    
    async handleLogin() {
        if (this.isLoading) return;
        
        this.setLoading(true);
        this.showMessage('Logging in...', '#4CAF50');
        
        try {
            // For now, simulate login success
            await this.delay(1000);
            
            this.showMessage('Login successful!', '#4CAF50');
            
            setTimeout(() => {
                this.scene.start('MenuScene');
            }, 1000);
        } catch (error) {
            this.showMessage('Login failed: ' + error.message, '#FF6B6B');
        } finally {
            this.setLoading(false);
        }
    }
    
    async handleRegister() {
        if (this.isLoading) return;
        
        this.setLoading(true);
        this.showMessage('Registering...', '#4CAF50');
        
        try {
            // For now, simulate registration success
            await this.delay(1000);
            
            this.showMessage('Registration successful!', '#4CAF50');
            
            setTimeout(() => {
                this.scene.start('MenuScene');
            }, 1000);
        } catch (error) {
            this.showMessage('Registration failed: ' + error.message, '#FF6B6B');
        } finally {
            this.setLoading(false);
        }
    }
    
    async handleDemoLogin() {
        if (this.isLoading) return;
        
        this.setLoading(true);
        this.showMessage('Starting demo...', '#9C27B0');
        
        try {
            await this.delay(500);
            
            this.showMessage('Demo login successful!', '#4CAF50');
            
            setTimeout(() => {
                this.scene.start('MenuScene');
            }, 1000);
        } catch (error) {
            this.showMessage('Demo login failed: ' + error.message, '#FF6B6B');
        } finally {
            this.setLoading(false);
        }
    }
    
    async checkExistingAuth() {
        // Check if we have a stored session from the launcher
        const storedSession = localStorage.getItem('infinity_storm_session');
        const serverMode = localStorage.getItem('infinity_storm_server_mode');
        
        if (storedSession || serverMode === 'false') {
            console.log('Found stored session or offline mode - skipping login');
            this.showMessage('Auto-login from launcher...', '#4CAF50');
            
            // Wait a moment then proceed directly to game
            this.time.delayedCall(1000, () => {
                this.scene.start('GameScene');
            });
            
            return;
        }
        
        // For now, just proceed to login
        // In real implementation, this would check stored tokens
        console.log('No stored session - showing login screen');
    }
    
    showMessage(text, color) {
        if (this.messageText) {
            this.messageText.destroy();
        }
        
        this.messageText = this.add.text(960, 900, text, {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: color,
            stroke: '#000000',
            strokeThickness: 1
        }).setOrigin(0.5);
        
        // Auto-hide after 3 seconds
        this.time.delayedCall(3000, () => {
            if (this.messageText) {
                this.messageText.destroy();
                this.messageText = null;
            }
        });
    }
    
    setLoading(loading) {
        this.isLoading = loading;
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Make LoginScene globally available
window.LoginScene = LoginScene; 
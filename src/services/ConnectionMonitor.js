/**
 * ConnectionMonitor - Monitors server connection status and prevents gameplay when disconnected
 * Critical for online casino games to prevent confusion
 */

class ConnectionMonitor {
    constructor(scene) {
        this.scene = scene;
        this.isConnected = false;
        this.isAuthenticated = false;
        this.lastPingTime = 0;
        this.pingInterval = null;
        this.connectionLostTime = null;
        this.warningOverlay = null;
        this.statusIndicator = null;
        this.checkInterval = 5000; // Check every 5 seconds
        this.pingTimeout = 10000; // 10 seconds timeout
        
        this.initialize();
    }
    
    initialize() {
        // Check if player is authenticated
        const authToken = localStorage.getItem('infinity_storm_token');
        this.isAuthenticated = !!authToken;
        
        // Check initial connection status
        this.checkConnectionStatus();
        
        // Start periodic monitoring
        this.startMonitoring();
        
        // Create connection status indicator
        this.createStatusIndicator();
        
        console.log('🔌 ConnectionMonitor initialized, authenticated:', this.isAuthenticated);
    }
    
    startMonitoring() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        
        this.pingInterval = setInterval(() => {
            this.checkConnectionStatus();
        }, this.checkInterval);
    }
    
    stopMonitoring() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    
    async checkConnectionStatus() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.pingTimeout);
            
            // Ping the server health endpoint
            const response = await fetch(`${window.NetworkService?.baseURL || 'http://localhost:3000'}/health`, {
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            const wasConnected = this.isConnected;
            this.isConnected = response.ok;
            this.lastPingTime = Date.now();
            
            // Connection state changed
            if (wasConnected !== this.isConnected) {
                this.onConnectionChange(this.isConnected);
            }
            
            // Update indicator
            this.updateStatusIndicator();
            
        } catch (error) {
            const wasConnected = this.isConnected;
            this.isConnected = false;
            
            if (wasConnected) {
                this.onConnectionChange(false);
                this.connectionLostTime = Date.now();
            }
            
            // Update indicator
            this.updateStatusIndicator();
            
            console.warn('🔌 Connection check failed:', error.message);
        }
    }
    
    onConnectionChange(connected) {
        if (connected) {
            console.log('✅ Connection restored');
            this.connectionLostTime = null;
            this.hideDisconnectedWarning();
            
            // Show brief "connected" message
            if (this.scene.showMessage) {
                this.scene.showMessage('Connection restored', 1500);
            }
        } else {
            console.error('❌ Connection lost');
            this.connectionLostTime = Date.now();
            
            // Only show warning if player is authenticated
            if (this.isAuthenticated) {
                this.showDisconnectedWarning();
            }
        }
    }
    
    createStatusIndicator() {
        if (!this.scene || !this.scene.add) return;
        
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        
        // Create small indicator in top-right corner
        const x = width - 120;
        const y = 30;
        
        // Background
        const bg = this.scene.add.rectangle(x, y, 100, 30, 0x000000, 0.7);
        bg.setOrigin(0.5, 0.5);
        bg.setDepth(10000);
        
        // Status dot
        const dot = this.scene.add.circle(x - 35, y, 6, 0x00ff00);
        dot.setDepth(10001);
        
        // Status text
        const text = this.scene.add.text(x - 20, y, 'ONLINE', {
            fontSize: '12px',
            fontFamily: 'Arial',
            color: '#00ff00',
            fontStyle: 'bold'
        });
        text.setOrigin(0, 0.5);
        text.setDepth(10001);
        
        this.statusIndicator = { bg, dot, text };
        
        // Update initial state
        this.updateStatusIndicator();
    }
    
    updateStatusIndicator() {
        if (!this.statusIndicator) return;
        
        const { dot, text } = this.statusIndicator;
        
        if (this.isConnected) {
            dot.setFillStyle(0x00ff00); // Green
            text.setText('ONLINE');
            text.setColor('#00ff00');
        } else {
            dot.setFillStyle(0xff0000); // Red
            text.setText('OFFLINE');
            text.setColor('#ff0000');
        }
    }
    
    showDisconnectedWarning() {
        if (this.warningOverlay) return; // Already showing
        
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        
        // Create dark overlay
        const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);
        overlay.setDepth(9999);
        overlay.setInteractive();
        
        // Warning box
        const boxWidth = Math.min(600, width * 0.9);
        const boxHeight = 300;
        const box = this.scene.add.rectangle(width / 2, height / 2, boxWidth, boxHeight, 0x1a1a1a, 1);
        box.setDepth(10000);
        box.setStrokeStyle(3, 0xff0000);
        
        // Warning icon
        const icon = this.scene.add.text(width / 2, height / 2 - 80, '⚠️', {
            fontSize: '48px'
        });
        icon.setOrigin(0.5);
        icon.setDepth(10001);
        
        // Title
        const title = this.scene.add.text(width / 2, height / 2 - 20, 'CONNECTION LOST', {
            fontSize: '24px',
            fontFamily: 'Arial Black',
            color: '#ff0000',
            fontStyle: 'bold'
        });
        title.setOrigin(0.5);
        title.setDepth(10001);
        
        // Message
        const message = this.scene.add.text(width / 2, height / 2 + 20, 
            'You have been disconnected from the server.\nAll gameplay is suspended until connection is restored.\n\nPlease check your internet connection.',
            {
                fontSize: '16px',
                fontFamily: 'Arial',
                color: '#ffffff',
                align: 'center',
                wordWrap: { width: boxWidth - 40 }
            }
        );
        message.setOrigin(0.5);
        message.setDepth(10001);
        
        // Retry button
        const retryBtn = this.scene.add.text(width / 2, height / 2 + 100, 'RETRY CONNECTION', {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#0066cc',
            padding: { x: 20, y: 10 }
        });
        retryBtn.setOrigin(0.5);
        retryBtn.setDepth(10001);
        retryBtn.setInteractive({ useHandCursor: true });
        
        retryBtn.on('pointerover', () => retryBtn.setBackgroundColor('#0088ff'));
        retryBtn.on('pointerout', () => retryBtn.setBackgroundColor('#0066cc'));
        retryBtn.on('pointerup', () => {
            this.checkConnectionStatus();
        });
        
        this.warningOverlay = {
            elements: [overlay, box, icon, title, message, retryBtn]
        };
        
        // Play warning sound
        if (window.SafeSound && window.SafeSound.play) {
            window.SafeSound.play(this.scene, 'error');
        }
    }
    
    hideDisconnectedWarning() {
        if (!this.warningOverlay) return;
        
        this.warningOverlay.elements.forEach(el => {
            if (el && el.destroy) {
                el.destroy();
            }
        });
        
        this.warningOverlay = null;
    }
    
    canSpin() {
        // For authenticated players, require connection
        if (this.isAuthenticated && !this.isConnected) {
            console.warn('🚫 Spin blocked - player is authenticated but disconnected');
            return false;
        }
        
        // For non-authenticated (demo mode), allow spins
        return true;
    }
    
    getDisconnectionDuration() {
        if (!this.connectionLostTime) return 0;
        return Date.now() - this.connectionLostTime;
    }
    
    destroy() {
        this.stopMonitoring();
        this.hideDisconnectedWarning();
        
        if (this.statusIndicator) {
            Object.values(this.statusIndicator).forEach(el => {
                if (el && el.destroy) el.destroy();
            });
            this.statusIndicator = null;
        }
    }
}

// Export for use in GameScene
if (typeof window !== 'undefined') {
    window.ConnectionMonitor = ConnectionMonitor;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConnectionMonitor;
}


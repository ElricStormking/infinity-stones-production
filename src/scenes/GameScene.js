// Phaser is loaded globally
// All classes are loaded globally
// VERSION: 2025-10-23-FIX-DEMO-BALANCE-v3

console.log('🔥🔥🔥 [GAMESCENE] FILE LOADED - VERSION 2025-10-23-v3 🔥🔥🔥');

window.GameScene = class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }
    
    create() {
        console.log('🔥 [GAMESCENE] create() method called');
        window.gameScene = this;
        if (window.GameAPI && typeof window.GameAPI.attachScene === 'function') { window.GameAPI.attachScene(this); }
        this.stateManager = this.game.stateManager;
        this.stateManager.setState(this.stateManager.states.PLAYING);
        
        // DEMO MODE: Always start with $10,000 (no localStorage persistence)
        const authToken = localStorage.getItem('infinity_storm_token');
        if (!authToken) {
            console.log('🎮 [DEMO] Starting with fresh $10,000 balance');
            if (this.stateManager) {
                this.stateManager.gameData.balance = 10000;
            }
            
            // Set WalletAPI balance immediately (UI reads from WalletAPI first)
            if (window.WalletAPI) {
                window.WalletAPI.currentBalance = 10000;
                console.log('🎮 [DEMO] Balance initialized: $10,000');
            }
        }
        
        // Initialize cascade synchronization system
        this.initializeCascadeSync();
        // Create animator and performance monitor
        this.cascadeAnimator = new (window.CascadeAnimator || class { queue(fn){ return fn(); } flush(){ return Promise.resolve(); } })();
        this.frameMonitor = new (window.FrameMonitor || class { startMonitoring(){} })();
        if (this.frameMonitor && this.frameMonitor.startMonitoring) {
            this.frameMonitor.startMonitoring();
        }
        
        // Create animation manager and animations FIRST before creating UI elements
        this.animationManager = new window.AnimationManager(this);
        this.animationManager.createAllAnimations();
        
        // Create UI manager and UI elements
        this.uiManager = new window.UIManager(this);
        this.uiElements = this.uiManager.createUI();
        
        // Create burst mode manager
        this.burstModeManager = new window.BurstModeManager(this);
        
        // Create win presentation manager
        this.winPresentationManager = new window.WinPresentationManager(this);
        
        // Create free spins manager
        this.freeSpinsManager = new window.FreeSpinsManager(this);
        
        // Create bonus manager
        this.bonusManager = new window.BonusManager(this);
        
        // Create fire effect
        this.fireEffect = new window.FireEffect(this);
        
        // Create scatter celebration effect
        this.scatterCelebration = new window.ScatterCelebrationEffect(this);
        
        // Initialize grid manager
        this.gridManager = new window.GridManager(this);
        
        // Initialize grid renderer for server-driven cascades
        this.gridRenderer = new (window.GridRenderer || class {
            constructor(scene) { this.scene = scene; }
            async renderSpinResult(result) { return result; }
        })(this);
        
        // Initialize win calculator
        this.winCalculator = new window.WinCalculator(this);
        
        // UI manager is now replaced by direct UI element management
        
        // Position grid centered inside the actual UI box displayed on screen
        const gridWidth = this.gridManager.getGridWidth();
        const gridHeight = this.gridManager.getGridHeight();

        const uiBox = this.uiManager && this.uiManager.ui_plane;
        const offsetX = (window.GameConfig.UI && window.GameConfig.UI.GRID_OFFSET ? window.GameConfig.UI.GRID_OFFSET.x : 0) || 0;
        const offsetY = (window.GameConfig.UI && window.GameConfig.UI.GRID_OFFSET ? window.GameConfig.UI.GRID_OFFSET.y : 0) || 0;

        if (uiBox) {
            const centerX = uiBox.x;
            const centerY = uiBox.y;
            const gridX = centerX - (gridWidth / 2) + offsetX;
            const gridY = centerY - (gridHeight / 2) + offsetY + 30; // shift down by 10px
            this.gridManager.setPosition(gridX, gridY);
            // Ensure grid draws beneath the frame but above background
            if (this.gridManager && this.gridManager.grid) {
                // Symbols already at depth 4; frame is at 8, title 9
            }
        } else {
            // Fallback to config-based positioning if ui_box is unavailable
            const canvasWidth = this.cameras.main.width;
            const canvasHeight = this.cameras.main.height;
            const uiScaleX = canvasWidth / window.GameConfig.UI.DESIGN_WIDTH;
            const uiScaleY = canvasHeight / window.GameConfig.UI.DESIGN_HEIGHT;
            const centerX = window.GameConfig.UI.UI_BOX_CENTER.x * uiScaleX;
            const centerY = window.GameConfig.UI.UI_BOX_CENTER.y * uiScaleY;
            const gridX = centerX - (gridWidth / 2) + offsetX;
            const gridY = centerY - (gridHeight / 2) + offsetY + 30; // shift down by 10px
            this.gridManager.setPosition(gridX, gridY);
        }
        
        // UI is now created by UIManager above
        
        // Optional FPS meter
        this._fpsText = null;
        if (window.SHOW_FPS) {
            const w = this.cameras.main.width;
            this._fpsText = this.add.text(w - 10, 6, 'FPS: --', {
                fontSize: '12px',
                fontFamily: 'Arial',
                color: '#00FF00'
            });
            this._fpsText.setOrigin(1, 0);
            this._fpsText.setDepth(window.GameConfig.UI_DEPTHS.OVERLAY_HIGH || 5000);
        }

        // Debug panel disabled to avoid obstructing artwork
        // this.createDebugPanel();
        
        // Create cascade sync status display
        this.createCascadeSyncDisplay();

        // Setup network status overlay and listeners
        this.setupNetworkStatusOverlay();
        this.networkStatusHandler = (event) => this.handleNetworkStatus(event);
        window.addEventListener('game-network-status', this.networkStatusHandler);

        // Initialize cascade debug mode if enabled
        this.cascadeDebugMode = window.CASCADE_DEBUG || false;
        this.cascadeSyncEnabled = window.CASCADE_SYNC_ENABLED !== false; // Default to true
        this.manualCascadeControl = false; // Manual step-through mode
        this.cascadeStepPaused = false; // Pause between cascade steps
        this.networkRetryInProgress = false;
        this.failedConnectionTimer = null;
        
        // Initialize server integration
        this.initializeServerIntegration();
        
        // Initialize connection monitor (CRITICAL for casino game)
        if (window.ConnectionMonitor) {
            this.connectionMonitor = new window.ConnectionMonitor(this);
            console.log('🔌 ConnectionMonitor initialized');
        } else {
            console.warn('⚠️ ConnectionMonitor not available - connection checks disabled');
        }
        
        // Initialize network error recovery system (check feature flags)
        const errorRecoveryEnabled = !window.FeatureFlags || window.FeatureFlags.isErrorRecoveryEnabled();
        if (errorRecoveryEnabled && window.NetworkErrorRecovery && window.NetworkService) {
            this.errorRecovery = new window.NetworkErrorRecovery(
                window.NetworkService,
                this
            );
            console.log('🔄 NetworkErrorRecovery initialized');
        } else {
            if (!errorRecoveryEnabled) {
                console.log('🚩 NetworkErrorRecovery disabled by feature flag');
            } else {
                console.warn('⚠️ NetworkErrorRecovery not available - direct network calls will be used');
            }
        }
        
        // Initialize game variables
        this.totalWin = 0;
        this.cascadeMultiplier = 1;
        this.isSpinning = false;
        this.quickSpinEnabled = !!window.QUICK_SPIN;
        this.lastServerBalanceUpdate = null; // Track if server sent balance (null = demo mode)
        
        // Initialize monitoring
        this.syncMonitor = window.SyncMonitor;
        if (this.syncMonitor) {
            console.log('📊 SyncMonitor integrated');
        }
        
        // BGM is now handled by the centralized SafeSound BGM management system
        // Old BGM system disabled to prevent conflicts
        if (window.DEBUG) console.log('?�� Old BGM system disabled - using centralized BGM management');
        
        // Debug controls - store references for cleanup
        this.keyboardListeners = [];
        
        // Add test key for gem destruction animations (DEBUG)
        const keyDListener = () => {
            this.animationManager.testGemDestructionAnimations();
        };
        this.input.keyboard.on('keydown-D', keyDListener);
        this.keyboardListeners.push({key: 'keydown-D', callback: keyDListener});
        
        // Add test key for spin button animation (DEBUG)
        const keySListener = () => {
            this.animationManager.testSpinButtonAnimation();
        };
        this.input.keyboard.on('keydown-S', keySListener);
        this.keyboardListeners.push({key: 'keydown-S', callback: keySListener});
        
        // Add test key for Scarlet Witch animation (DEBUG)
        const keyWListener = () => {
            this.animationManager.testScarletWitchAnimation();
        };
        this.input.keyboard.on('keydown-W', keyWListener);
        this.keyboardListeners.push({key: 'keydown-W', callback: keyWListener});
        
        // Add test key for Thanos animation (DEBUG)
        const keyTListener = () => {
            this.animationManager.testThanosAnimation();
        };
        this.input.keyboard.on('keydown-T', keyTListener);
        this.keyboardListeners.push({key: 'keydown-T', callback: keyTListener});
        
        // Add cascade sync debug controls
        this.addCascadeDebugControls();
        
        // Add test key for BGM switching (DEBUG)
        const keyBListener = () => {
            if (window.DEBUG) console.log('?�� DEBUG: Manual BGM switch test - IMMEDIATE');
            // Stop all audio immediately
            this.sound.stopAll();
            window.SafeSound.currentBGM = null;
            
            if (window.SafeSound.currentBGM && window.SafeSound.currentBGM.key === 'bgm_free_spins') {
            if (window.DEBUG) console.log('?�� DEBUG: Switching to main BGM');
                const mainBGM = this.sound.add('bgm_infinity_storm', { loop: true, volume: 0.5 });
                mainBGM.play();
                window.SafeSound.currentBGM = mainBGM;
            } else {
                if (window.DEBUG) console.log('?�� DEBUG: Switching to Free Spins BGM');
                const freeSpinsBGM = this.sound.add('bgm_free_spins', { loop: true, volume: 0.5 });
                freeSpinsBGM.play();
                window.SafeSound.currentBGM = freeSpinsBGM;
            }
        };
        this.input.keyboard.on('keydown-B', keyBListener);
        this.keyboardListeners.push({key: 'keydown-B', callback: keyBListener});
        
        // Add test key for starting main BGM (DEBUG)
        const keyMListener = () => {
            console.log('?�� DEBUG: Manual main BGM start via SafeSound');
            window.SafeSound.startMainBGM(this);
        };
        this.input.keyboard.on('keydown-M', keyMListener);
        this.keyboardListeners.push({key: 'keydown-M', callback: keyMListener});
        
        // Add test key for DIRECT BGM start (DEBUG) - Changed to 'X' to avoid conflict with gem destruction 'D' key
        const keyXListener = () => {
            if (window.DEBUG) {
                console.log('?�� DEBUG: DIRECT BGM start (bypassing SafeSound)');
                console.log('?�� this.sound:', this.sound);
                console.log('?�� Available cache keys:', this.cache.audio.getKeys());
            }
            
            try {
                if (this.sound && this.cache.audio.exists('bgm_infinity_storm')) {
                    const directBGM = this.sound.add('bgm_infinity_storm', { loop: true, volume: 0.5 });
                    if (window.DEBUG) console.log('?�� Direct BGM created:', directBGM);
                    directBGM.play();
                    if (window.DEBUG) console.log('?�� Direct BGM play() called');
                } else {
                    if (window.DEBUG) console.log('?�� Direct BGM failed - sound or audio not available');
                }
            } catch (error) {
                console.log('?�� Direct BGM error:', error);
            }
        };
        this.input.keyboard.on('keydown-X', keyXListener);
        this.keyboardListeners.push({key: 'keydown-X', callback: keyXListener});
        
        // Start appropriate BGM based on current game state
            if (window.DEBUG) {
                console.log('?�� === GAMESCENE CREATED - CHECKING INITIAL BGM ===');
                console.log('?�� Free Spins Active:', this.stateManager.freeSpinsData.active);
                console.log('?�� Free Spins Count:', this.stateManager.freeSpinsData.count);
            }
        
        // Start initial BGM after a short delay to ensure audio system is ready
        this.time.delayedCall(500, () => {
            if (window.DEBUG) {
                console.log('?�� GameScene: Checking for initial BGM startup');
                console.log('?�� BGM Initialized:', window.SafeSound.bgmInitialized);
                console.log('?�� Current BGM:', window.SafeSound.currentBGM ? window.SafeSound.currentBGM.key : 'None');
            }
            
            // Start BGM if none is currently playing
            if (!window.SafeSound.currentBGM) {
                if (this.stateManager.freeSpinsData.active && this.stateManager.freeSpinsData.count > 0) {
                    if (window.DEBUG) console.log('?�� GameScene: Starting Free Spins BGM (Free Spins active)');
                    window.SafeSound.startFreeSpinsBGM(this);
                } else {
                    if (window.DEBUG) console.log('?�� GameScene: Starting main BGM (Free Spins not active)');
                    window.SafeSound.startMainBGM(this);
                }
            } else {
                if (window.DEBUG) console.log('?�� GameScene: BGM already playing, skipping initial BGM setup');
            }
        });
        
        // Initialize orientation change handling for mobile devices
        this.initializeOrientationHandling();
    }
        

    
    createFallbackButtons() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Only create fallback buttons if the main UI elements failed to load
        if (!this.ui_spin) {
            console.log('Creating fallback SPIN button');
            this.fallbackSpinButton = this.createButton(width / 2, height - 100, 'SPIN', () => this.handleSpinButtonClick());
        }
        
        if (!this.ui_number_bet_minus || !this.ui_number_bet_plus) {
            console.log('Creating fallback bet adjustment buttons');
            this.fallbackMinusButton = this.createSmallButton(width / 2 - 150, height - 100, '-', () => this.adjustBet(-1));
            this.fallbackPlusButton = this.createSmallButton(width / 2 + 150, height - 100, '+', () => this.adjustBet(1));
        }
        
        if (!this.ui_small_menu) {
            console.log('Creating fallback MENU button');
            this.fallbackMenuButton = this.createSmallButton(100, height - 50, 'MENU', () => {
                this.sound.stopAll();
                this.scene.start('MenuScene');
            });
        }
        
        if (!this.ui_small_burst) {
            console.log('Creating fallback BURST button');
            this.fallbackBurstButton = this.createSmallButton(width - 100, height - 50, 'BURST', () => this.toggleBurstMode());
        }
    }
    
    createButton(x, y, text, callback) {
        const button = this.add.container(x, y);
        
        const bg = this.add.image(0, 0, 'button');
        bg.setInteractive({ useHandCursor: true });
        bg.setScale(0.6); // Make buttons smaller
        
        const label = this.add.text(0, 0, text, {
            fontSize: '20px', // Smaller font
            fontFamily: 'Arial Black',
            color: '#ffffff'
        });
        label.setOrigin(0.5);
        
        button.add([bg, label]);
        button.callback = callback;
        
        bg.on('pointerup', () => {
            if (!button.disabled) {
                window.SafeSound.play(this, 'click');
                callback();
            }
        });
        
        bg.on('pointerover', () => {
            if (!button.disabled) {
                button.setScale(1.1);
            }
        });
        
        bg.on('pointerout', () => {
            button.setScale(1);
        });
        
        return button;
    }
    
    createSmallButton(x, y, text, callback) {
        const button = this.add.container(x, y);
        
        const bg = this.add.rectangle(0, 0, 70, 35, 0x6B46C1); // Smaller buttons
        bg.setStrokeStyle(2, 0xffffff);
        bg.setInteractive({ useHandCursor: true });
        
        const label = this.add.text(0, 0, text, {
            fontSize: '16px', // Smaller font
            fontFamily: 'Arial',
            color: '#ffffff'
        });
        label.setOrigin(0.5);
        
        button.add([bg, label]);
        
        bg.on('pointerup', () => {
            window.SafeSound.play(this, 'click');
            callback();
        });
        
        bg.on('pointerover', () => {
            bg.setFillStyle(0x9B59B6);
        });
        
        bg.on('pointerout', () => {
            bg.setFillStyle(0x6B46C1);
        });
        
        return button;
    }
    
    createDebugPanel() {
        // Disabled: no debug UI constructed
        this.debugPanel = null;
        this.debugTitle = null;
        this.debugLines = null;
    }
    
    setDebugPanelVisible(visible) {
        if (!this.debugPanel || !this.debugTitle || !this.debugLines) return;
        this.debugPanel.setVisible(visible);
        this.debugTitle.setVisible(visible);
        this.debugLines.forEach(line => line.setVisible(visible));
    }
    
    // Task 12.2.1: Initialize cascade synchronization system
    initializeCascadeSync() {
        // Initialize cascade API if available
        this.cascadeAPI = window.CascadeAPI ? new window.CascadeAPI() : null;
        
        // Initialize sync state tracking
        this.syncState = {
            enabled: true,
            sessionActive: false,
            currentStep: 0,
            totalSteps: 0,
            lastValidationHash: null,
            desyncCount: 0,
            recoveryAttempts: 0,
            performanceMetrics: {
                stepValidationTime: [],
                averageStepTime: 0,
                syncSuccessRate: 100
            }
        };
        
        // Initialize cascade step queue for manual control
        this.cascadeStepQueue = [];
        this.currentCascadeSession = null;
        
        if (window.DEBUG) {
            console.log('?? Cascade synchronization system initialized');
            console.log('?? CascadeAPI available:', !!this.cascadeAPI);
        }
    }
    
    // Task 6.2: Initialize server integration system
    initializeServerIntegration() {
        // FREE PLAY DEMO MODE: Check for authentication first
        const authToken = localStorage.getItem('infinity_storm_token');
        if (!authToken) {
            try {
                localStorage.removeItem('playerId');
                localStorage.removeItem('playerUsername');
            } catch (_) {}
            console.log('🎮 [FREE PLAY] No auth token - starting in FREE PLAY DEMO MODE');
            this.serverMode = false;
            this.demoMode = true;
            this.isServerSpinning = false;
            
            // Balance already loaded in create() before UI initialization
            // Just sync WalletAPI (no display update needed - UI was created with correct value)
            if (window.WalletAPI) {
                window.WalletAPI.setBalance(this.stateManager.gameData.balance);
            }
            
            // Fill grid with initial symbols
            this.gridManager.fillGrid();
            if (this.gridManager && this.gridManager.startAllIdleAnimations) {
                this.gridManager.startAllIdleAnimations();
            }
            
            // Show demo mode indicator UI
            this.showDemoModeIndicator();
            
            console.log('🎮 [FREE PLAY] Demo mode initialized - balance:', this.stateManager.gameData.balance);
            return;
        }
        
        // Authenticated player flow continues below
        // Load auth token from localStorage if available
        // Use 'infinity_storm_token' to match NetworkService storage key
        const storedToken = authToken;
        if (storedToken && window.NetworkService) {
            console.log('🔐 [GAMESCENE] Loading auth token from localStorage:', storedToken.substring(0, 30) + '...');
            window.NetworkService.setAuthToken(storedToken);
            
            // VERIFY it was set
            setTimeout(() => {
                const isSet = window.NetworkService.authToken ? 'SET' : 'NULL';
                console.log(`🔐 [GAMESCENE] Verification check - NetworkService.authToken is: ${isSet}`);
                if (!window.NetworkService.authToken) {
                    console.error('❌ [GAMESCENE] TOKEN WAS CLEARED! Re-setting it...');
                    window.NetworkService.authToken = storedToken;
                    console.log('✅ [GAMESCENE] Token forcefully re-set');
                }
            }, 200);
        } else if (!storedToken) {
            console.warn('❌ [GAMESCENE] No token found in localStorage');
        }
        
        // Check feature flags for server sync
        const playerId = (window.NetworkService && window.NetworkService.authToken) ? localStorage.getItem('playerId') : null;
        const featureFlagsEnabled = window.FeatureFlags && window.FeatureFlags.shouldUseServerSync(playerId);
        
        // Initialize server mode and demo mode fallback
        this.serverMode = featureFlagsEnabled && (window.GameConfig.SERVER_MODE !== false); // Default to true for server integration
        this.demoMode = false; // Will switch to true if server connection fails
        this.isServerSpinning = false; // Track server spin state separately from UI spinning
        this.serverSpinResult = null; // Store server spin result for processing
        
        console.log('🚩 Server mode enabled:', this.serverMode, '(feature flags:', featureFlagsEnabled, ')');
        
        // Setup GameAPI reference and event listeners
        if (window.GameAPI && this.serverMode) {
            this.gameAPI = window.GameAPI;
            
            // Setup server event listeners
            this.events.on('spin_result', this.handleServerSpinResult, this);
            this.events.on('balance_update', this.handleServerBalanceUpdate, this);
            this.events.on('game_state_change', this.handleServerGameStateChange, this);
            this.events.on('auth_error', this.handleServerAuthError, this);
            
            if (window.DEBUG) {
                console.log('?? Server integration initialized');
                console.log('?? GameAPI available:', !!this.gameAPI);
                console.log('?? Server mode:', this.serverMode);
            }
            if (this.gameAPI && this.gameAPI.gameState) {
                this.applyServerGameState(this.gameAPI.gameState, { source: 'gameapi-cache', initial: true });
            } else {
                this.fetchInitialServerState();
            }
        } else {
            // Fallback to demo mode if GameAPI not available
            this.serverMode = false;
            this.demoMode = true;
            
            this.gridManager.fillGrid();
            if (this.gridManager && this.gridManager.startAllIdleAnimations) {
                this.gridManager.startAllIdleAnimations();
            }
            if (window.DEBUG) {
                console.log('?? Server integration disabled - running in demo mode');
            }
            
            // Balance already initialized in create() - no need to reset here
        }
    }
    
    async fetchInitialServerState() {
        if (!this.serverMode || !window.NetworkService || typeof window.NetworkService.getGameState !== 'function') {
            return;
        }
        try {
            console.log('🔍 Fetching initial server state...');
            const response = await window.NetworkService.getGameState();
            if (!response) {
                console.log('⚠️ No response from getGameState');
                return;
            }
            const gameState = response.gameState || (response.data && response.data.gameState) || response.data || null;
            if (gameState) {
                this.applyServerGameState(gameState, { source: 'initial-request', raw: response, initial: true });
            }
            
            // Extract balance from multiple possible locations
            let balanceValue = null;
            if (typeof response.balance === 'number') {
                balanceValue = response.balance;
            } else if (response.data && typeof response.data.balance === 'number') {
                balanceValue = response.data.balance;
            } else if (gameState && typeof gameState.balance === 'number') {
                balanceValue = gameState.balance;
            } else if (gameState && gameState.state_data && typeof gameState.state_data.balance === 'number') {
                balanceValue = gameState.state_data.balance;
            } else if (response.gameState && typeof response.gameState.balance === 'number') {
                balanceValue = response.gameState.balance;
            } else if (response.gameState && response.gameState.credits !== undefined) {
                // Fallback to credits field
                balanceValue = response.gameState.credits;
            } else if (gameState && gameState.credits !== undefined) {
                balanceValue = gameState.credits;
            }
            
            console.log('🔍 Balance extraction result:', balanceValue, 'from response:', {
                'response.balance': response.balance,
                'response.data?.balance': response.data?.balance,
                'gameState?.balance': gameState?.balance,
                'gameState?.credits': gameState?.credits
            });
            
            if (typeof balanceValue === 'number') {
                this.stateManager.setBalanceFromServer(balanceValue);
                
                // Sync WalletAPI so UI displays correct balance
                if (window.WalletAPI) {
                    window.WalletAPI.setBalance(balanceValue);
                }
                
                this.updateBalanceDisplay();
                console.log('✅ Balance updated on game entry:', balanceValue);
            } else {
                console.warn('⚠️ No valid balance found in server response');
            }
        } catch (error) {
            console.warn('Initial server state fetch failed:', error);
            
            // Check if it's an authentication error
            if (error.response && error.response.status === 401) {
                console.warn('🔐 Authentication failed - clearing token and using demo mode');
                localStorage.removeItem('authToken');
                localStorage.removeItem('playerId');
                if (window.NetworkService) {
                    window.NetworkService.setAuthToken(null);
                }
                // Switch to demo mode
                this.serverMode = false;
                this.demoMode = true;
                this.ensureDemoBalance();
            }
        }
    }
    // Task 12.2.3: Create cascade sync status display
    createCascadeSyncDisplay() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Sync status panel - bottom left
        this.syncStatusPanel = this.add.rectangle(200, height - 120, 380, 180, 0x000033, 0.9);
        this.syncStatusPanel.setStrokeStyle(2, 0x0066FF);
        this.syncStatusPanel.setDepth(window.GameConfig.UI_DEPTHS.OVERLAY_HIGH || 5000);
        
        // Sync status title
        this.syncStatusTitle = this.add.text(200, height - 190, 'CASCADE SYNC STATUS', {
            fontSize: '14px',
            fontFamily: 'Arial Bold',
            color: '#0099FF'
        });
        this.syncStatusTitle.setOrigin(0.5);
        this.syncStatusTitle.setDepth(window.GameConfig.UI_DEPTHS.OVERLAY_HIGH || 5000);
        
        // Sync status lines
        this.syncStatusLines = [];
        for (let i = 0; i < 8; i++) {
            const line = this.add.text(30, height - 170 + (i * 18), '', {
                fontSize: '11px',
                fontFamily: 'Arial',
                color: '#FFFFFF'
            });
            line.setOrigin(0, 0);
            line.setDepth(window.GameConfig.UI_DEPTHS.OVERLAY_HIGH || 5000);
            this.syncStatusLines.push(line);
        }
        
        // Manual control panel - bottom right (only in debug mode)
        if (window.DEBUG || window.CASCADE_DEBUG) {
            this.createManualControlPanel();
        }
        
        // Initially hide sync display
        this.setSyncDisplayVisible(false);
    }
    setupNetworkStatusOverlay() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const container = this.add.container(width / 2, height / 2);
        const backdrop = this.add.rectangle(0, 0, width * 0.6, 160, 0x000000, 0.75);
        backdrop.setStrokeStyle(2, 0x66ccff, 0.6);
        const text = this.add.text(0, -20, '', {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            align: 'center',
            wordWrap: { width: width * 0.55 }
        });
        text.setOrigin(0.5);

        const retryButton = this.add.text(0, 50, 'Retry Connection', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#66CCFF',
            backgroundColor: 'rgba(0,0,0,0.4)',
            padding: { x: 16, y: 8 }
        });
        retryButton.setOrigin(0.5);
        retryButton.setVisible(false);
        retryButton.setDepth((window.GameConfig.UI_DEPTHS?.OVERLAY_HIGH || 5000) + 1);
        retryButton.setInteractive({ useHandCursor: true });
        retryButton.on('pointerup', () => this.retryConnection());
        retryButton.disableInteractive();

        container.add([backdrop, text, retryButton]);
        container.setDepth(window.GameConfig.UI_DEPTHS?.OVERLAY_HIGH || 5000);
        container.setVisible(false);

        this.networkStatusOverlay = container;
        this.networkStatusText = text;
        this.networkRetryButton = retryButton;
    }

    showNetworkStatusOverlay(message, options = {}) {
        if (!this.networkStatusOverlay || !this.networkStatusText) {
            return;
        }
        this.networkStatusText.setText(message);
        this.networkStatusOverlay.setVisible(true);
        this.setNetworkRetryAvailability(!!options.allowRetry, options.retryLabel);
    }

    hideNetworkStatusOverlay() {
        if (this.networkStatusOverlay) {
            this.networkStatusOverlay.setVisible(false);
        }
        this.setNetworkRetryAvailability(false);
    }

    setNetworkRetryAvailability(enabled, label) {
        if (!this.networkRetryButton) {
            return;
        }
        if (label) {
            this.networkRetryButton.setText(label);
        }
        if (enabled) {
            this.networkRetryButton.setVisible(true);
            this.networkRetryButton.setInteractive({ useHandCursor: true });
        } else {
            this.networkRetryButton.setVisible(false);
            if (this.networkRetryButton.disableInteractive) {
                this.networkRetryButton.disableInteractive();
            }
        }
    }

    async retryConnection() {
        if (this.networkRetryInProgress) {
            return;
        }
        this.networkRetryInProgress = true;

        if (this.failedConnectionTimer) {
            this.failedConnectionTimer.remove();
            this.failedConnectionTimer = null;
        }

        try {
            this.showNetworkStatusOverlay('Attempting reconnection...', { allowRetry: false });

            if (window.NetworkService && typeof window.NetworkService.connectSocket === 'function') {
                try {
                    await window.NetworkService.connectSocket();
                } catch (socketError) {
                    if (window.DEBUG) {
                        console.warn('Socket reconnect attempt failed:', socketError);
                    }
                }
            }

            let recovered = 0;
            let outcomes = [];
            if (this.gameAPI?.errorRecovery?.retryPendingRequests) {
                outcomes = await this.gameAPI.errorRecovery.retryPendingRequests({ onlyFailed: false });
                for (const outcome of outcomes) {
                    if (outcome && outcome.status === 'recovered' && outcome.result) {
                        const payload = outcome.result.data || outcome.result;
                        if (payload) {
                            await this.processServerSpinResult(payload);
                            recovered++;
                        }
                    }
                }
            }

            this.isSpinning = false;
            this.isServerSpinning = false;

            if (recovered > 0) {
                this.hideNetworkStatusOverlay();
                const message = recovered === 1 ? 'Recovered pending spin' : `Recovered ${recovered} pending spins`;
                this.showMessage && this.showMessage(message, 1200);
                return;
            }

            if (Array.isArray(outcomes) && outcomes.length > 0) {
                this.showNetworkStatusOverlay('Retry completed. Waiting for server.', { allowRetry: true, retryLabel: 'Retry Again' });
            } else {
                this.showNetworkStatusOverlay('No pending spins detected. Please try again.', { allowRetry: true, retryLabel: 'Retry Connection' });
            }

            this.failedConnectionTimer = this.time.delayedCall(20000, () => {
                if (this.serverMode) {
                    this.switchToDemoMode();
                }
            });

        } catch (error) {
            console.error('Manual retry failed:', error);
            this.showNetworkStatusOverlay('Retry failed. Please check your connection.', { allowRetry: true, retryLabel: 'Retry Again' });
            this.failedConnectionTimer = this.time.delayedCall(20000, () => {
                if (this.serverMode) {
                    this.switchToDemoMode();
                }
            });
        } finally {
            this.networkRetryInProgress = false;
        }
    }
    handleNetworkStatus(event) {
        const detail = event?.detail || {};
        const type = detail.type;

        if (type === 'reconnecting') {
            this.showNetworkStatusOverlay('Reconnecting to server...', { allowRetry: false });
        } else if (type === 'retry') {
            const attempt = detail.attempt || 1;
            const max = this.gameAPI?.errorRecovery?.maxReconnectAttempts || 5;
            this.showNetworkStatusOverlay(`Reconnecting to server (attempt ${attempt}/${max})...`, { allowRetry: false });
        } else if (type === 'recovered') {
            if (this.failedConnectionTimer) {
                this.failedConnectionTimer.remove();
                this.failedConnectionTimer = null;
            }
            this.hideNetworkStatusOverlay();
            this.showMessage && this.showMessage('Connection restored', 800);
        } else if (type === 'manual-retry') {
            this.showNetworkStatusOverlay('Attempting manual recovery...', { allowRetry: false });
        } else if (type === 'failed') {
            const message = detail.error?.message || 'Connection lost. Retry or check your network.';
            this.showNetworkStatusOverlay(message, { allowRetry: true, retryLabel: 'Retry Connection' });
            if (this.failedConnectionTimer) {
                this.failedConnectionTimer.remove();
            }
            this.failedConnectionTimer = this.time.delayedCall(20000, () => {
                if (this.serverMode) {
                    this.switchToDemoMode();
                }
            });
        }
    }

    
    // Task 12.2.4: Create manual override control panel
    createManualControlPanel() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Manual control panel
        this.manualControlPanel = this.add.rectangle(width - 200, height - 120, 380, 180, 0x330033, 0.9);
        this.manualControlPanel.setStrokeStyle(2, 0xFF6600);
        this.manualControlPanel.setDepth(window.GameConfig.UI_DEPTHS.OVERLAY_HIGH || 5000);
        
        // Manual control title
        this.manualControlTitle = this.add.text(width - 200, height - 190, 'MANUAL CASCADE CONTROL', {
            fontSize: '12px',
            fontFamily: 'Arial Bold',
            color: '#FF9900'
        });
        this.manualControlTitle.setOrigin(0.5);
        this.manualControlTitle.setDepth(window.GameConfig.UI_DEPTHS.OVERLAY_HIGH || 5000);
        
        // Control buttons
        const buttonStyle = {
            fontSize: '10px',
            fontFamily: 'Arial Bold',
            color: '#FFFFFF'
        };
        
        // Step button
        this.stepButton = this.add.text(width - 350, height - 160, '[1] STEP', buttonStyle);
        this.stepButton.setInteractive({ useHandCursor: true });
        this.stepButton.setDepth(window.GameConfig.UI_DEPTHS.OVERLAY_HIGH || 5000);
        this.stepButton.on('pointerup', () => this.manualCascadeStep());
        
        // Play/Pause button
        this.playPauseButton = this.add.text(width - 280, height - 160, '[2] PAUSE', buttonStyle);
        this.playPauseButton.setInteractive({ useHandCursor: true });
        this.playPauseButton.setDepth(window.GameConfig.UI_DEPTHS.OVERLAY_HIGH || 5000);
        this.playPauseButton.on('pointerup', () => this.toggleCascadePause());
        
        // Reset button
        this.resetButton = this.add.text(width - 200, height - 160, '[3] RESET', buttonStyle);
        this.resetButton.setInteractive({ useHandCursor: true });
        this.resetButton.setDepth(window.GameConfig.UI_DEPTHS.OVERLAY_HIGH || 5000);
        this.resetButton.on('pointerup', () => this.resetCascadeSync());
        
        // Toggle sync button
        this.toggleSyncButton = this.add.text(width - 350, height - 140, '[4] SYNC: ON', buttonStyle);
        this.toggleSyncButton.setInteractive({ useHandCursor: true });
        this.toggleSyncButton.setDepth(window.GameConfig.UI_DEPTHS.OVERLAY_HIGH || 5000);
        this.toggleSyncButton.on('pointerup', () => this.toggleCascadeSync());
        
        // Recovery button
        this.recoveryButton = this.add.text(width - 260, height - 140, '[5] RECOVER', buttonStyle);
        this.recoveryButton.setInteractive({ useHandCursor: true });
        this.recoveryButton.setDepth(window.GameConfig.UI_DEPTHS.OVERLAY_HIGH || 5000);
        this.recoveryButton.on('pointerup', () => this.triggerSyncRecovery());
        
        // Debug info button
        this.debugInfoButton = this.add.text(width - 170, height - 140, '[6] INFO', buttonStyle);
        this.debugInfoButton.setInteractive({ useHandCursor: true });
        this.debugInfoButton.setDepth(window.GameConfig.UI_DEPTHS.OVERLAY_HIGH || 5000);
        this.debugInfoButton.on('pointerup', () => this.showCascadeDebugInfo());
        
        // Status indicator
        this.manualStatusText = this.add.text(width - 350, height - 120, 'Auto Mode', {
            fontSize: '10px',
            fontFamily: 'Arial',
            color: '#00FF00'
        });
        this.manualStatusText.setDepth(window.GameConfig.UI_DEPTHS.OVERLAY_HIGH || 5000);
        
        // Initially hide manual control panel
        this.setManualControlVisible(false);
    }
    
    // Task 12.2.2: Add cascade debug keyboard controls
    addCascadeDebugControls() {
        if (!window.DEBUG && !window.CASCADE_DEBUG) return;
        
        // 1 - Manual cascade step
        const key1Listener = () => {
            this.manualCascadeStep();
        };
        this.input.keyboard.on('keydown-ONE', key1Listener);
        this.keyboardListeners.push({key: 'keydown-ONE', callback: key1Listener});
        
        // 2 - Toggle cascade pause
        const key2Listener = () => {
            this.toggleCascadePause();
        };
        this.input.keyboard.on('keydown-TWO', key2Listener);
        this.keyboardListeners.push({key: 'keydown-TWO', callback: key2Listener});
        
        // 3 - Reset cascade sync
        const key3Listener = () => {
            this.resetCascadeSync();
        };
        this.input.keyboard.on('keydown-THREE', key3Listener);
        this.keyboardListeners.push({key: 'keydown-THREE', callback: key3Listener});
        
        // 4 - Toggle cascade sync
        const key4Listener = () => {
            this.toggleCascadeSync();
        };
        this.input.keyboard.on('keydown-FOUR', key4Listener);
        this.keyboardListeners.push({key: 'keydown-FOUR', callback: key4Listener});
        
        // 5 - Trigger sync recovery
        const key5Listener = () => {
            this.triggerSyncRecovery();
        };
        this.input.keyboard.on('keydown-FIVE', key5Listener);
        this.keyboardListeners.push({key: 'keydown-FIVE', callback: key5Listener});
        
        // 6 - Show cascade debug info
        const key6Listener = () => {
            this.showCascadeDebugInfo();
        };
        this.input.keyboard.on('keydown-SIX', key6Listener);
        this.keyboardListeners.push({key: 'keydown-SIX', callback: key6Listener});
        
        // 7 - Toggle cascade debug mode
        const key7Listener = () => {
            this.toggleCascadeDebugMode();
        };
        this.input.keyboard.on('keydown-SEVEN', key7Listener);
        this.keyboardListeners.push({key: 'keydown-SEVEN', callback: key7Listener});
        
        // 8 - Toggle manual control panel
        const key8Listener = () => {
            this.toggleManualControlPanel();
        };
        this.input.keyboard.on('keydown-EIGHT', key8Listener);
        this.keyboardListeners.push({key: 'keydown-EIGHT', callback: key8Listener});
        
        if (window.DEBUG) {
            console.log('?? Cascade debug controls added:');
            console.log('??   1 - Manual step');
            console.log('??   2 - Toggle pause');
            console.log('??   3 - Reset sync');
            console.log('??   4 - Toggle sync');
            console.log('??   5 - Trigger recovery');
            console.log('??   6 - Show debug info');
            console.log('??   7 - Toggle debug mode');
            console.log('??   8 - Toggle control panel');
        }
    }
    
    updateDebugPanel(matches, totalWin, bet) {
        // Disabled: do not render any on-screen win calculation details
        return;
    }
    
    adjustBet(direction) {
        // Prevent bet adjustment during Free Spins Mode
        if (this.stateManager.freeSpinsData.active) {
            this.showMessage('Cannot change bet during Free Spins Mode!');
            return;
        }
        
        const currentIndex = window.GameConfig.BET_LEVELS.indexOf(this.stateManager.gameData.currentBet);
        let newIndex = currentIndex + direction;
        
        newIndex = Math.max(0, Math.min(window.GameConfig.BET_LEVELS.length - 1, newIndex));
        
        this.stateManager.setBet(window.GameConfig.BET_LEVELS[newIndex]);
        this.updateBetDisplay();
    }
    
    toggleAutoplay() {
        if (this.stateManager.gameData.autoplayActive) {
            this.stateManager.stopAutoplay();
            // Update auto spin counter display
            if (this.uiManager) {
                this.uiManager.updateAutoSpinCounterDisplay();
                // Refresh mode switch controls after stopping
                this.uiManager.updateModeSwitchButtonsState?.();
            }
            // No need to update button text as ui_small_stop is an image button
        } else {
            this.showAutoplayMenu();
            // If autoplay started from the menu, state will change soon; schedule a refresh
            setTimeout(() => this.uiManager?.updateModeSwitchButtonsState?.(), 0);
        }
    }
    
    showAutoplayMenu() {
        // Don't show autoplay menu if already spinning or in free spins
        if (this.isSpinning || this.stateManager.freeSpinsData.active) {
            this.showMessage('Cannot start autoplay during Free Spins or while spinning!');
            return;
        }
        
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Create overlay
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);
        overlay.setDepth(1500);
        overlay.setInteractive(); // Block clicks behind it

        // Menu background image
        const menuBg = this.add.image(width / 2, height / 2, 'spins_auto_bg');
        menuBg.setDepth(1501);
        // Scale to ~67% of 1280x720 design if needed
        const baseW = 1280; const baseH = 720;
        const bgScale = Math.min(width / baseW, height / baseH) * 0.67;
        menuBg.setScale(bgScale);

        // Store references for cleanup
        const menuElements = [overlay, menuBg];
        
        // Create autoplay option buttons
        const options = window.GameConfig.AUTOPLAY_OPTIONS;
        const buttonsPerRow = 3;
        const spriteW = 210 * bgScale; // approximate visual width
        const spriteH = 70 * bgScale;  // approximate visual height
        const buttonSpacing = 20 * bgScale;
        const startX = width / 2 - ((buttonsPerRow * spriteW + (buttonsPerRow - 1) * buttonSpacing) / 2);
        const startY = height / 2 - (40 * bgScale);
        
        options.forEach((spins, index) => {
            const row = Math.floor(index / buttonsPerRow);
            const col = index % buttonsPerRow;
            const x = startX + col * (spriteW + buttonSpacing) + (spriteW / 2);
            const y = startY + row * (spriteH + buttonSpacing);
            
            const button = this.createAutoplayOptionButton(
                x, y, 
                spins === -1 ? 'INFINITE' : `${spins} SPINS`,
                spins,
                menuElements
            );
            menuElements.push(button);
        });
        
        // Cancel button
        const cancelBtn = this.add.container(width / 2, height / 2 + (120 * bgScale) + 40);
        const cancelImg = this.add.image(0, 0, 'spins_auto_button2');
        cancelImg.setScale(bgScale);
        cancelImg.setInteractive({ useHandCursor: true });
        cancelBtn.add([cancelImg]);
        cancelBtn.setDepth(1502);
        menuElements.push(cancelBtn);
        
        // Cancel button handler
        cancelImg.on('pointerup', () => {
            menuElements.forEach(element => element.destroy());
            window.SafeSound.play(this, 'click');
        });
        
        // Button hover effects
        cancelImg.on('pointerover', () => cancelImg.setTint(0xDD4444));
        cancelImg.on('pointerout', () => cancelImg.clearTint());
        
        window.SafeSound.play(this, 'click');
    }
    
    createAutoplayOptionButton(x, y, text, spins, menuElements) {
        const button = this.add.container(x, y);
        const scale = 0.67 * Math.min(this.cameras.main.width / 1280, this.cameras.main.height / 720);
        const bgImg = this.add.image(0, 0, 'spins_auto_button1');
        bgImg.setScale(scale);
        bgImg.setInteractive({ useHandCursor: true });
        const label = this.add.text(0, 0, text, { fontSize: Math.round(16 * scale) + 'px', fontFamily: 'Arial Black', color: '#FFFFFF' });
        label.setOrigin(0.5);
        button.add([bgImg, label]);
        button.setDepth(1502);
        bgImg.on('pointerup', () => {
            menuElements.forEach(element => element.destroy());
            this.startAutoplay(spins);
            window.SafeSound.play(this, 'click');
        });
        bgImg.on('pointerover', () => bgImg.setTint(0x55FF99));
        bgImg.on('pointerout', () => bgImg.clearTint());
        return button;
    }
    
    startAutoplay(spins) {
        this.stateManager.setAutoplay(spins);
        
        // Update auto spin counter display
        if (this.uiManager) {
            this.uiManager.updateAutoSpinCounterDisplay();
        }
        
        // Note: ui_small_stop is an image button, so no text update needed
        // The button functionality remains the same
        
        // Start spinning if not already spinning
        if (!this.isSpinning) {
            this.startSpin();
        }
        
        // Show confirmation message
        const message = spins === -1 ? 'Infinite Autoplay Started!' : `${spins} Autoplay Spins Started!`;
        this.showMessage(message);
    }
    
    async startSpin() {
        if (this.isSpinning) return;
        
        // Initialize audio on first user interaction
        window.SafeSound.initAudio(this);
        
        // Start main BGM if none is playing (first interaction)
        if (!window.SafeSound.currentBGM) {
            console.log('?�� First user interaction - starting main BGM');
            window.SafeSound.startMainBGM(this);
        }
        
        // CRITICAL: Check connection status for authenticated players (skip for demo mode)
        if (!this.demoMode && this.connectionMonitor && !this.connectionMonitor.canSpin()) {
            console.error('🚫 Spin blocked - server connection required for authenticated players');
            this.showMessage('Connection lost! Please wait for reconnection.');
            
            // Ensure warning is visible
            if (!this.connectionMonitor.warningOverlay) {
                this.connectionMonitor.showDisconnectedWarning();
            }
            return;
        }
        
        // Check if player can afford bet
        if (!this.stateManager.canAffordBet() && !this.stateManager.freeSpinsData.active) {
            this.showMessage('Insufficient Balance!');
            return;
        }
        
        this.isSpinning = true;
        // Clear any persistent random-multiplier overlays from the previous spin
        if (this.bonusManager && this.bonusManager.clearRandomMultiplierOverlays) {
            this.bonusManager.clearRandomMultiplierOverlays();
        }
        this.totalWin = 0;
        this.cascadeMultiplier = 1;
        // Reset per-spin formula helpers
        this.baseWinForFormula = 0; // Win before any Random Multipliers are applied
        this.spinAppliedMultiplier = 1; // Product of all Random Multipliers applied this spin
        this.spinAccumulatedRM = 0; // Sum of all Random Multiplier values that have ARRIVED at the plaque this spin
        this.fsPendingRMStars = 0; // Free Spins: number of RM stars in flight this spin
        
        // Start spin button animation + light FX
        const spinButton = this.uiManager && this.uiManager.getSpinButton();
        if (spinButton && this.anims.exists('animation')) {
            spinButton.play('animation');
        }
        if (this.uiManager && this.uiManager.ui_spin_light) {
            // Re-snap overlay to the button position/scale before play
            // Hard snap center every time we play to avoid drift
            this.uiManager.ui_spin_light.setOrigin(0.5, 0.5);
            this.uiManager.ui_spin_light.setPosition(this.uiManager.ui_spin.x, this.uiManager.ui_spin.y);
            if (this.uiManager.ui_spin_light.applyScaleFromSpin) {
                this.uiManager.ui_spin_light.applyScaleFromSpin();
            }
            this.uiManager.ui_spin_light.setVisible(true);
            // Guarantee the animation exists or create a quick fallback
            if (!this.anims.exists('light_button_light') && this.textures.exists('button_light_sprite')) {
                try {
                    this.anims.create({
                        key: 'light_button_light',
                        frames: this.anims.generateFrameNumbers('button_light_sprite', { start: 0, end: 19 }),
                        frameRate: 24,
                        repeat: -1
                    });
                } catch (_) {}
            }
            // Play with zero offset and no random start to keep centered
            if (this.anims.exists('light_button_light')) {
                this.uiManager.ui_spin_light.play({ key: 'light_button_light', startFrame: 0, delay: 0, repeat: -1 });
            }
        }
        
        // Disable input during spin
        this.setButtonsEnabled(false);
        this.input.enabled = false;
        
        // Place bet or use free spin
        if (this.stateManager.freeSpinsData.active) {
            this.stateManager.useFreeSpins();
            this.uiManager.updateFreeSpinsDisplay();
        } else {
            const balanceBefore = this.stateManager.gameData.balance;
            this.stateManager.placeBet();
            const balanceAfter = this.stateManager.gameData.balance;
            
            // Sync WalletAPI in demo mode
            if (window.WalletAPI) {
                window.WalletAPI.setBalance(balanceAfter);
            }
            
            console.log('💰 Placed bet locally:', {
                before: balanceBefore,
                bet: this.stateManager.gameData.currentBet,
                after: balanceAfter
            });
        }
        
        // Update balance display
        this.updateBalanceDisplay();
        
        // Task 6.2: Server integration - request spin from server or demo mode
        if (this.demoMode) {
            // FREE PLAY DEMO MODE: Use demo spin endpoint
            console.log('🎮 [DEMO] Processing demo spin');
            await this.processServerSpin(); // Will use demo endpoint
        } else if (this.gameAPI) {
            // Real money mode: Use authenticated server endpoint
            await this.processServerSpin();
        } else {
            // Fallback: No server available
            console.warn('⚠️ No server connection - spin skipped');
        }
        
        // End spin
        this.endSpin();
        this.input.enabled = true;
    }

    // FX: shooting star(s) from a grid cell to one or more targets; updates UI on arrival
    // During base game: target is the top plaque (formula)
    // During Free Spins: only send stars to the accumulated-multiplier badge; update plaque after all arrivals
    playRandomMultiplierShootingStar(fromCol, fromRow, multiplierValue) {
        try {
            const startX = this.gridManager.getSymbolScreenX(fromCol);
            const startY = this.gridManager.getSymbolScreenY(fromRow);
            const inFreeSpins = !!(this.stateManager.freeSpinsData && this.stateManager.freeSpinsData.active);
            const targets = [];
            if (inFreeSpins) {
                this.fsPendingRMStars = (this.fsPendingRMStars || 0) + 1;
                targets.push({ type: 'fsAccum', pos: this.uiManager.getAccumulatedMultiplierPosition() });
            } else {
                targets.push({ type: 'plaque', pos: this.uiManager.getPlaquePosition() });
            }
            
            // Pick a consistent texture for all stars in this spin to avoid flickering
            // Store the choice on first star, reuse for subsequent stars
            if (!this.currentShootingStarTexture) {
                if (this.textures.exists('mind_gem')) {
                    this.currentShootingStarTexture = { key: 'mind_gem', scaleX: 0.34, scaleY: 0.58 };
                } else if (this.textures.exists('reality_gem')) {
                    this.currentShootingStarTexture = { key: 'reality_gem', scaleX: 0.32, scaleY: 0.52 };
                } else {
                    this.currentShootingStarTexture = { key: 'fallback', scaleX: 1, scaleY: 1 };
                }
            }

            const fireOneStarTo = (target) => {
                // Create comet head (sprite) with additive glow, elongated look
                let star;
                if (this.currentShootingStarTexture.key === 'fallback') {
                    const g = this.add.graphics({ x: startX, y: startY });
                    g.fillStyle(0xFFD700, 1);
                    g.fillCircle(0, 0, 8);
                    star = g;
                } else {
                    star = this.add.image(startX, startY, this.currentShootingStarTexture.key);
                    star.setScale(this.currentShootingStarTexture.scaleX, this.currentShootingStarTexture.scaleY);
                }
                star.setDepth((window.GameConfig.UI_DEPTHS.FX_OVERLAY || 2500));
                if (star.setBlendMode) star.setBlendMode(Phaser.BlendModes.ADD);

                // Trail particles (comet tail)
                let trail;
                try {
                    const trailKey = this.textures.exists('particle') ? 'particle' : (this.textures.exists('mind_gem') ? 'mind_gem' : 'reality_gem');
                    trail = this.add.particles(startX, startY, trailKey, {
                        speed: { min: 60, max: 120 },
                        lifespan: 700,
                        scale: { start: 1.1, end: 0 },
                        alpha: { start: 1.0, end: 0 },
                        quantity: 4,
                        frequency: 10,
                        gravityY: 0,
                        tint: [0xFFFFFF, 0xFFF2B6, 0xD6ECFF],
                        angle: { min: -10, max: 10 },
                        blendMode: 'ADD'
                    });
                    trail.setDepth((window.GameConfig.UI_DEPTHS.FX_UNDERLAY || 2400));
                } catch (_) {}

                // Ribbon trail (drawn) to emphasize comet tail
                const ribbon = this.add.graphics();
                ribbon.setBlendMode(Phaser.BlendModes.ADD);
                ribbon.setDepth((window.GameConfig.UI_DEPTHS.FX_UNDERLAY || 2400) + 1);
                const ribbonPoints = [];

                // Arc-like tween control points (slightly randomized arc)
                const ctrlX = (startX + target.pos.x) / 2 + Phaser.Math.Between(-60, 60);
                const ctrlY = Math.min(startY, target.pos.y) - Phaser.Math.Between(80, 160);
                const duration = 380; // faster comet

                // Keep previous position to orient the comet and tail
                let prevX = startX, prevY = startY;
                const updatePos = (t) => {
                    const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * ctrlX + t * t * target.pos.x;
                    const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * ctrlY + t * t * target.pos.y;
                    const dx = x - prevX;
                    const dy = y - prevY;
                    const ang = Math.atan2(dy, dx);
                    if (star.setPosition) star.setPosition(x, y); else { star.x = x; star.y = y; }
                    if (star.setRotation) star.setRotation(ang);
                    if (trail) {
                        trail.setPosition(x, y);
                        try { trail.setAngle(Phaser.Math.RadToDeg(ang) + 180); } catch (_) {}
                    }
                    // Update ribbon tail
                    ribbonPoints.push({ x, y });
                    if (ribbonPoints.length > 18) ribbonPoints.shift();
                    ribbon.clear();
                    for (let i = ribbonPoints.length - 1, j = 0; i >= 0; i--, j++) {
                        const p = ribbonPoints[i];
                        const tFade = ribbonPoints.length > 1 ? (j / (ribbonPoints.length - 1)) : 0;
                        const radius = Math.max(1, 12 * (1 - tFade));
                        const alpha = 0.35 * (1 - tFade);
                        ribbon.fillStyle(0xFFF8D0, alpha);
                        ribbon.fillCircle(p.x, p.y, radius);
                    }
                    prevX = x; prevY = y;
                };

                let elapsed = 0;
                const onUpdate = (_, delta) => {
                    elapsed += delta;
                    const t = Math.min(1, elapsed / duration);
                    updatePos(t);
                    if (t >= 1) {
                        this.events.off('update', onUpdate);
                        if (star.destroy) star.destroy(); else if (star.clear) star.clear();
                        if (trail) { try { trail.destroy(); } catch (_) {} }
                        try { ribbon.destroy(); } catch (_) {}

                        if (target.type === 'plaque') {
                            // Normal mode: INCREMENT progressively as each star arrives!
                            const currentMult = this.spinAccumulatedRM || 0;
                            const newMult = currentMult + multiplierValue;
                            
                            console.log(`⭐ Normal mode shooting star arrived! Incrementing multiplier: x${currentMult} + x${multiplierValue} = x${newMult}`);
                            
                            this.spinAccumulatedRM = newMult;
                            
                            // Update formula display progressively
                            const base = Math.max(0, this.baseWinForFormula || 0);
                            // Calculate progressive final amount based on CURRENT multiplier (not total win)
                            const shownFinal = base * newMult;
                            this.uiManager.setWinFormula(base, newMult, shownFinal);

                            // Impact pulse on plaque text
                            const text = this.uiManager && this.uiManager.winTopText;
                            if (text) {
                                const ox = text.originalScaleX || text.scaleX || 1;
                                const oy = text.originalScaleY || text.scaleY || 1;
                                text.setScale(ox, oy);
                                this.tweens.add({ targets: text, scaleX: ox * 1.25, scaleY: oy * 1.25, duration: 140, yoyo: true, ease: 'Back.out' });
                            }
                            
                            // Decrement pending star counter
                            this.normalModePendingStars = Math.max(0, (this.normalModePendingStars || 0) - 1);
                            
                            // When all stars have arrived, verify we reached the server's target value
                            if ((this.normalModePendingStars || 0) === 0) {
                                const finalMult = this.spinAccumulatedRM;
                                const targetMult = this.normalModeTargetMultiplier;
                                
                                // Safety check: ensure we match the server's target value
                                if (typeof targetMult === 'number' && Math.abs(finalMult - targetMult) > 0.01) {
                                    console.warn(`⚠️ Normal mode multiplier mismatch! Client: x${finalMult}, Server target: x${targetMult}. Correcting...`);
                                    this.spinAccumulatedRM = targetMult;
                                    const correctedFinal = base * targetMult;
                                    this.uiManager.setWinFormula(base, targetMult, correctedFinal);
                                }
                                
                                console.log(`✅ All normal mode shooting stars arrived! Final multiplier: x${this.spinAccumulatedRM}`);
                                
                                // All stars done - ensure win display is finalized
                                this.updateWinDisplay();
                            }
                        } else if (target.type === 'fsAccum') {
                            // Free Spins: INCREMENT progressively as each star arrives!
                            // Add the multiplier value this star represents
                            const currentAccum = this.stateManager.freeSpinsData.multiplierAccumulator || 1;
                            const newAccum = currentAccum + multiplierValue;
                            
                            console.log(`⭐ Shooting star arrived! Incrementing accumulator: x${currentAccum} + x${multiplierValue} = x${newAccum}`);
                            
                            this.stateManager.freeSpinsData.multiplierAccumulator = newAccum;
                            this.uiManager.updateAccumulatedMultiplierDisplay();
                            
                            // Impact pulse on FS accumulated multiplier text
                            const aText = this.uiManager && this.uiManager.accumulatedMultiplierText;
                            if (aText) {
                                const ox = aText.originalScaleX || aText.scaleX || 1;
                                const oy = aText.originalScaleY || aText.scaleY || 1;
                                aText.setScale(ox, oy);
                                this.tweens.add({ targets: aText, scaleX: ox * 1.3, scaleY: oy * 1.3, duration: 140, yoyo: true, ease: 'Back.out' });
                            }
                            
                            this.fsPendingRMStars = Math.max(0, (this.fsPendingRMStars || 0) - 1);
                            
                            // When all stars have arrived, verify we reached the server's target value
                            if ((this.fsPendingRMStars || 0) === 0) {
                                const finalAccum = this.stateManager.freeSpinsData.multiplierAccumulator;
                                const targetAccum = this.fsTargetAccumulatedMultiplier;
                                
                                // Safety check: ensure we match the server's target value
                                if (typeof targetAccum === 'number' && finalAccum !== targetAccum) {
                                    console.warn(`⚠️ Accumulated multiplier mismatch! Client: x${finalAccum}, Server target: x${targetAccum}. Correcting...`);
                                    this.stateManager.freeSpinsData.multiplierAccumulator = targetAccum;
                                    this.uiManager.updateAccumulatedMultiplierDisplay();
                                }
                                
                                const fsMult = Math.max(1, (this.stateManager.freeSpinsData && this.stateManager.freeSpinsData.multiplierAccumulator) || 1);
                                // Base for FS should be the pre-FS base win (server totalWin already includes FS multiplier)
                                // If we lack a precomputed base, derive from total using the finalized fsMult as a fallback
                                const total = this.totalWin;
                                const base = fsMult > 0 ? (total / fsMult) : total;
                                this.uiManager.setWinFormula(base, fsMult, total);
                                
                                console.log(`✅ All shooting stars arrived! Final accumulated: x${fsMult}`);
                                
                                // If Free Spins end was deferred waiting for these stars, complete it now
                                if (this.freeSpinsManager && this.freeSpinsManager.pendingFsEnd) {
                                    console.log(`🎬 All stars landed - completing deferred Free Spins end`);
                                    this.freeSpinsManager.pendingFsEnd = false;
                                    // Use a small delay to ensure plaque updates complete before FS end sequence
                                    this.time.delayedCall(300, async () => {
                                        if (this.freeSpinsManager) {
                                            // Actually end FS now
                                            await this.freeSpinsManager.handleFreeSpinsEnd();
                                            // Resolve the promise that's waiting in endSpin()
                                            if (this.freeSpinsManager.fsEndResolve) {
                                                this.freeSpinsManager.fsEndResolve();
                                                this.freeSpinsManager.fsEndResolve = null;
                                            }
                                        }
                                    });
                                }
                            }
                        }

                        // Impact burst at target
                        try {
                            const burst = this.add.particles(target.pos.x, target.pos.y, (this.textures.exists('particle') ? 'particle' : 'space_gem'), {
                                speed: { min: 160, max: 320 },
                                lifespan: 500,
                                scale: { start: 0.7, end: 0 },
                                quantity: 20,
                                angle: { min: 0, max: 360 },
                                blendMode: 'ADD'
                            });
                            burst.setDepth((window.GameConfig.UI_DEPTHS.FX_OVERLAY || 2500));
                            this.time.delayedCall(420, () => { try { burst.destroy(); } catch (_) {} });
                        } catch (_) {}

                        // Softer camera shake to sell the impact
                        try { this.cameras.main.shake(70, 0.0035); } catch (_) {}
                    }
                };
                this.events.on('update', onUpdate);
            };

            // Fire stars (FS: only one target)
            targets.forEach((tgt, i) => {
                const delay = i === 0 ? 0 : 90;
                this.time.delayedCall(delay, () => fireOneStarTo(tgt));
            });
        } catch (e) {
            console.warn('Shooting star FX failed:', e);
        }
    }
    
    // Task 6.2: Server spin processing with loading states and error handling
    async processServerSpin() {
        try {
            // Show loading state
            // Removed transient processing toast per UX request
            this.isServerSpinning = true;
            
            // Request spin from server with error recovery
            const betAmount = this.stateManager.gameData.currentBet;
            
            let spinResult;
            if (this.errorRecovery) {
                // Use error recovery system for resilient network requests
                const fsData = this.stateManager.freeSpinsData || {};
                const currentAccum = fsData.multiplierAccumulator || 1;
                const targetAccum = (typeof this.fsTargetAccumulatedMultiplier === 'number')
                    ? this.fsTargetAccumulatedMultiplier
                    : currentAccum;
                const safeAccumulated = Math.max(currentAccum, targetAccum, 1);
                if (fsData.active) {
                    console.log('🔍 GameScene.startSpin: Sending spin via ErrorRecovery with accumulated multiplier', {
                        currentAccum,
                        targetAccum,
                        safeAccumulated,
                        freeSpinsActive: true
                    });
                }
                spinResult = await this.errorRecovery.handleSpinRequest({
                    betAmount,
                    freeSpinsActive: !!fsData.active,
                    freeSpinsRemaining: fsData.count || 0,
                    accumulatedMultiplier: safeAccumulated,
                    quickSpinMode: this.quickSpinEnabled
                });
            } else {
                // Fallback to direct gameAPI call (no error recovery)
                spinResult = await this.gameAPI.requestSpin(betAmount);
            }
            
            if (spinResult.success && spinResult.data) {
                // Server spin successful - process result through animation system
                if (window.DEBUG) {
                    console.log('?�� Server spin successful:', spinResult.data);
                }
                
                this.totalWin = 0;

                // Clear current grid with animation
                await this.clearGridWithAnimation();
                
                // Play spin sound
                window.SafeSound.play(this, 'spin');
                
                // Process server result through animation system
                // Normalize cascades field for renderer and debug overlay
                const normalized = Object.assign({}, spinResult.data);
                if (!Array.isArray(normalized.cascades) && Array.isArray(normalized.cascadeSteps)) {
                    normalized.cascades = normalized.cascadeSteps;
                }
                if (Array.isArray(normalized.initialGrid)) {
                    normalized.initialGrid = window.NetworkService?.normalizeGrid
                        ? window.NetworkService.normalizeGrid(normalized.initialGrid)
                        : normalized.initialGrid;
                }
                await this.processServerSpinResult(normalized);
                
                // Free spins are handled via server payload in processServerSpinResult
                
                // Update balance from server
                if (spinResult.data.balance !== undefined && spinResult.data.balance !== null) {
                    console.log('💵 [processServerSpin] Setting balance from server:', spinResult.data.balance);
                    this.stateManager.setBalanceFromServer(spinResult.data.balance);
                    
                    // Sync WalletAPI so UI displays correct balance
                    if (window.WalletAPI) {
                        window.WalletAPI.setBalance(spinResult.data.balance);
                    }
                    
                    this.updateBalanceDisplay();
                    this.lastServerBalanceUpdate = spinResult.data.balance;
                } else if (spinResult.data.balance === null) {
                    console.log('💵 [processServerSpin] Server returned null balance - demo mode');
                    this.lastServerBalanceUpdate = null;
                } else {
                    console.warn('⚠️ [processServerSpin] No balance in spinResult.data!', {
                        hasBalance: 'balance' in spinResult.data,
                        balanceValue: spinResult.data.balance,
                        balanceType: typeof spinResult.data.balance,
                        keys: Object.keys(spinResult.data).slice(0, 20)
                    });
                    console.log('🔍 [processServerSpin] Full spinResult.data:', JSON.stringify(spinResult.data, null, 2).substring(0, 500));
                    this.lastServerBalanceUpdate = null;
                }
                if (spinResult.data.rngSeed) {
                    this.lastServerSeed = spinResult.data.rngSeed;
                }
                
            } else {
                // Server spin failed; do NOT switch to client RNG.
                console.warn('??Server spin failed:', spinResult.error || 'Unknown error');
                this.showMessage('Server error - retrying');
            }
            
        } catch (error) {
            console.error('??Server spin error:', error);
            // Stay in server path; NetworkService already falls back to /api/demo-spin without auth
        } finally {
            this.isServerSpinning = false;
            try {
                if (this.isProcessingOverlay) {
                    this.isProcessingOverlay.destroy();
                    this.isProcessingOverlay = null;
                }
            } catch (_) {}
        }
    }
    
    // Task 6.2: Demo mode spin processing (original client-only logic)
    async processDemoSpin() {
        try {
            // Record demo spin to database for tracking (best effort, non-blocking)
            this.recordDemoSpinToDatabase();
            
            // Clear current grid with animation
            await this.clearGridWithAnimation();
            
            // Fill new grid with cascading animation
            await this.fillGridWithCascade();
            
            // Play spin sound
            window.SafeSound.play(this, 'spin');
            
            // Debug: Show grid state before cascades
            if (window.DEBUG) this.debugGridState();
            
            // Start cascade process (original client logic)
            await this.processCascades();
            
            // Check for other bonus features
            this.freeSpinsManager.checkOtherBonusFeatures();
            
            // Capture base win before any Random Multipliers (used for top plaque formula)
            this.baseWinForFormula = this.totalWin;
            this.spinAppliedMultiplier = 1;
            this.spinAccumulatedRM = 0;

            // Random Multiplier is now server-authoritative
            // Server sends multiplierEvents in the spin response, processed in processServerSpinResult
            // No need to call checkRandomMultiplier() - it's handled by server data
            
            // Sync balance with WalletAPI after demo spin
            if (window.WalletAPI) {
                window.WalletAPI.currentBalance = this.stateManager.gameData.balance;
            }
            // Force UI update
            this.updateBalanceDisplay();
            
        } catch (error) {
            console.error('??Demo spin error:', error);
            this.showMessage('Spin error - please try again');
        }

        // Debug overlay: show demo spin info when server spin not used
        try {
            if (window.serverDebugWindow && typeof window.serverDebugWindow.show === 'function') {
                const debugPayload = {
                    betAmount: this.stateManager?.gameData?.currentBet,
                    totalWin: this.totalWin,
                    cascadesCount: this.lastCascadeCount || 0,
                    cascades: [],
                    rngSeed: (window.__symbolSource && window.__symbolSource.rng && window.__symbolSource.rng.seed) || undefined,
                    clientGrid: this.gridManager ? this.gridManager.getCurrentGrid() : undefined,
                    metadata: { mode: 'demo' }
                };
                window.serverDebugWindow.show(debugPayload);
            }
        } catch (_) {}
    }
    
    // Record demo spin to server database (non-blocking)
    async recordDemoSpinToDatabase() {
        try {
            // Only record when in demo mode; endpoint does not require auth
            if (!this.demoMode) return;
            
            const betAmount = this.stateManager.gameData.currentBet;
            const quickSpinMode = !!this.quickSpinEnabled;
            const freeSpinsActive = !!this.stateManager.freeSpinsData.active;
            const accumulatedMultiplier = this.stateManager.freeSpinsData.multiplierAccumulator || 1;
            const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://localhost:3000';
            
            // Fire-and-forget; do not block gameplay
            fetch(`${apiBase}/api/demo-spin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ betAmount, quickSpinMode, freeSpinsActive, accumulatedMultiplier })
            }).then(res => {
                if (res.ok) {
                    console.log('??Demo spin recorded to Supabase (spin_results)');
                } else {
                    console.warn('?��? Demo spin recording responded with non-OK status');
                }
            }).catch(err => {
                console.warn('?��? Demo spin recording failed:', err.message);
            });
        } catch (error) {
            // Non-fatal
            if (window.DEBUG) console.warn('?��? Demo spin recording error:', error.message);
        }
    }
    
    async clearGridWithAnimation() {
        const promises = [];
        
        for (let col = 0; col < this.gridManager.cols; col++) {
            for (let row = 0; row < this.gridManager.rows; row++) {
                const symbol = this.gridManager.grid[col][row];
                if (symbol) {
                    const promise = new Promise(resolve => {
                        this.tweens.add({
                            targets: symbol,
                            alpha: 0,
                            scaleX: 0,
                            scaleY: 0,
                            duration: 200,
                            delay: (col + row) * 20,
                            ease: 'Power2',
                            onComplete: () => {
                                symbol.destroy();
                                resolve();
                            }
                        });
                    });
                    promises.push(promise);
                }
            }
        }
        
        await Promise.all(promises);
        this.gridManager.initializeGrid();
    }
    
    async fillGridWithCascade() {
        const promises = [];
        
        // Stop any existing idle animations
        this.gridManager.stopAllIdleAnimations();
        
        // Temporarily disable match checking
        this.gridManager.isInitialFill = true;
        
        // First, create all symbols in their grid positions (hidden)
        for (let col = 0; col < this.gridManager.cols; col++) {
            for (let row = 0; row < this.gridManager.rows; row++) {
                const randomType = this.gridManager.getRandomSymbolType();
                const symbol = this.gridManager.createSymbol(randomType, col, row);
                this.gridManager.grid[col][row] = symbol;
                symbol.setAlpha(0);
            }
        }
        
        // Now check if this will be a winning spin
        this.gridManager.isInitialFill = false;
        const willHaveWins = this.gridManager.findMatches().length > 0;
        this.gridManager.isInitialFill = true;
        
        // Play spin drop finish sound with a 0.3 second delay after symbols start dropping
        this.time.delayedCall(300, () => {
            console.log('?? Playing spin drop finish sound');
            window.SafeSound.play(this, 'spin_drop_finish');
        });
        
        // Now animate all symbols dropping
        for (let col = 0; col < this.gridManager.cols; col++) {
            for (let row = 0; row < this.gridManager.rows; row++) {
                const symbol = this.gridManager.grid[col][row];
                
                // Start position above the grid
                const startY = this.gridManager.gridY - this.gridManager.symbolSize * (this.gridManager.rows - row + 1);
                const targetPos = this.gridManager.getSymbolPosition(col, row);
                
                symbol.setPosition(targetPos.x, startY);
                symbol.setScale(0.8);
                
                // Hide all effects during cascade
                if (symbol.shadowEffect) symbol.shadowEffect.setVisible(false);
                if (symbol.glowEffect) symbol.glowEffect.setVisible(false);
                
        // Create cascading animation with staggered delays
                const promise = new Promise(resolve => {
                    // Fade in
                    this.tweens.add({
                        targets: symbol,
                        alpha: 1,
                        scaleX: 1,
                        scaleY: 1,
                duration: this.quickSpinEnabled ? 100 : 200,
                delay: (col * 50) + (row * 30), // Stagger by column and row
                        ease: 'Power2',
                        onStart: () => {
                            // Show shadow effect when symbol starts appearing
                            if (symbol.shadowEffect) {
                                symbol.shadowEffect.setVisible(true);
                                symbol.shadowEffect.setAlpha(0);
                                this.tweens.add({
                                    targets: symbol.shadowEffect,
                                    alpha: 0.3,
                                    duration: 200
                                });
                            }
                        }
                    });
                    
            // Drop animation - only resolve when this completes
                    this.tweens.add({
                        targets: symbol,
                        y: targetPos.y,
                duration: this.quickSpinEnabled ? Math.max(150, (window.GameConfig.CASCADE_SPEED || 400) * 0.6) : (window.GameConfig.CASCADE_SPEED || 400),
                delay: (col * 50) + (row * 30), // Same stagger
                        ease: 'Bounce.out',
                        onComplete: () => {
                            // Show shadow effect after landing
                            if (symbol.shadowEffect) {
                                symbol.shadowEffect.setVisible(true);
                                symbol.shadowEffect.setPosition(symbol.x + 5, symbol.y + 5);
                            }
                            // Add a small delay to ensure animation fully settles
                            this.time.delayedCall(50, resolve);
                        }
                    });
                    
                    // Move shadow with symbol (but keep it hidden)
                    if (symbol.shadowEffect) {
                        symbol.shadowEffect.setPosition(targetPos.x + 5, startY + 5);
                        this.tweens.add({
                            targets: symbol.shadowEffect,
                            y: targetPos.y + 5,
                            duration: window.GameConfig.CASCADE_SPEED || 400,
                            delay: (col * 50) + (row * 30),
                            ease: 'Bounce.out'
                        });
                    }
                });
                
                promises.push(promise);
            }
        }
        
        // Wait for all symbols to cascade down
        await Promise.all(promises);
        
        // Add a small delay to ensure all animations are fully settled
        await this.delay(100);
        
        // Re-enable match checking
        this.gridManager.isInitialFill = false;
        
        // Start idle animations after all symbols are in place
        this.gridManager.startAllIdleAnimations();
    }
    
    async processCascades() {
        let hasMatches = true;
        let cascadeCount = 0;
        this.lastCascadeCount = 0;
        this.debugCascadeSteps = 0;
        
        // Initialize cascade sync session if enabled
        if (this.syncState && this.syncState.enabled && this.cascadeAPI) {
            try {
                this.currentCascadeSession = await this.cascadeAPI.startCascadeSession({
                    initialGrid: this.gridManager ? this.gridManager.getCurrentGrid() : null,
                    bet: this.stateManager.gameData.currentBet
                });
                this.syncState.sessionActive = true;
                this.syncState.currentStep = 0;
                this.updateSyncStatusDisplay();
                
                if (window.DEBUG) {
                    console.log('?? Cascade sync session started:', this.currentCascadeSession);
                }
            } catch (error) {
                console.warn('?? Failed to start cascade sync session:', error);
                this.syncState.enabled = false;
            }
        }
        
        while (hasMatches) {
            // Check if in manual control mode and should pause
            if (this.manualCascadeControl && this.cascadeStepPaused && cascadeCount > 0) {
                // Add step to queue for manual execution
                this.cascadeStepQueue.push({
                    stepNumber: cascadeCount + 1,
                    type: 'match_detection',
                    gridState: this.gridManager ? this.gridManager.getCurrentGrid() : null
                });
                
                this.updateSyncStatusDisplay();
                this.showMessage(`Cascade paused at step ${cascadeCount + 1}. Use 1 to continue.`);
                break;
            }
            
            // Find matches
            const matches = this.gridManager.findMatches();
            
            // Debug: Log match detection
            if (window.DEBUG) {
                console.log(`=== MATCH DETECTION (Cascade ${cascadeCount + 1}) ===`);
                console.log(`Matches found: ${matches.length}`);
                matches.forEach((match, index) => {
                    const symbolType = match[0].symbol.symbolType;
                    const positions = match.map(m => `(${m.col},${m.row})`).join(', ');
                    console.log(`Match ${index + 1}: ${symbolType} - ${match.length} symbols at ${positions}`);
                });
            }
            
            if (matches.length > 0) {
                // Calculate win using WinCalculator
                const win = this.winCalculator.calculateTotalWin(matches, this.stateManager.gameData.currentBet);
                this.totalWin += win;
                
                // Debug: Show win calculation details
                this.showWinCalculationDebug(matches, win);
                
                // Update debug panel
                this.updateDebugPanel(matches, win, this.stateManager.gameData.currentBet);
                
                // Update win display
                this.updateWinDisplay();
                
                // Removed: kaching is now only played with Win animations (WinPresentationManager)
                
                // Shake matched symbols before shatter
                await this.shakeMatches(matches, 320);
                // Spawn shatter pieces that fly off while the gem destruction animation plays
                this.createShatterEffect(matches);
                
                // Stop all animations before removing matches
                this.gridManager.stopAllSymbolAnimations();
                
                // Remove matches
                this.gridManager.removeMatches(matches);
                
                            // Play cascade sound
            window.SafeSound.play(this, 'cascade');
                
                // Wait for removal
                await this.delay(window.GameConfig.ANIMATIONS.SYMBOL_DESTROY_TIME);
                
                // Cascade symbols
                await this.gridManager.cascadeSymbols();
                
                cascadeCount++;
                this.debugCascadeSteps++;
                
                // Apply cascade multiplier in free spins with new trigger chance
                await this.freeSpinsManager.processCascadeMultiplier(cascadeCount);
            } else {
                hasMatches = false;
                // Hide debug panel when no matches
                if (cascadeCount === 0) {
                    this.setDebugPanelVisible(false);
                    // No-win sound is now played earlier when symbols start dropping
                }
            }
        }
        
        // Check for Cascading Random Multipliers after all cascades finish
        if (cascadeCount > 0) { // Only if there were cascades
            await this.bonusManager.checkCascadingRandomMultipliers();
        }
        
        // Close cascade sync session if it was active
        if (this.syncState && this.syncState.sessionActive && this.cascadeAPI) {
            try {
                await this.cascadeAPI.completeCascadeSession({
                    sessionId: this.currentCascadeSession ? this.currentCascadeSession.sessionId : null,
                    totalSteps: cascadeCount,
                    finalGrid: this.gridManager ? this.gridManager.getCurrentGrid() : null,
                    totalWin: this.totalWin
                });
                
                this.syncState.sessionActive = false;
                this.syncState.totalSteps = cascadeCount;
                this.updateSyncStatusDisplay();
                
                if (window.DEBUG) {
                    console.log('?? Cascade sync session completed');
                }
            } catch (error) {
                console.warn('?? Failed to complete cascade sync session:', error);
            }
        }
        // Record total cascades for debug/analytics (use the more reliable counter)
        this.lastCascadeCount = this.debugCascadeSteps || cascadeCount;
    }

    // New: shake then shatter visual for matched symbols
    async shakeMatches(matches, duration = 300) {
        const tweens = [];
        const jitter = 6;
        matches.forEach(group => {
            group.forEach(({ symbol }) => {
                if (!symbol) return;
                // Start the UI gem light effect at shake start (only for gems)
                if (typeof symbol.startGemLightEffect === 'function') {
                    symbol.startGemLightEffect();
                }
                const tween = new Promise(resolve => {
                    // Randomized shake around current position
                    this.tweens.add({
                        targets: symbol,
                        x: symbol.x + Phaser.Math.Between(-jitter, jitter),
                        y: symbol.y + Phaser.Math.Between(-jitter, jitter),
                        duration: 60,
                        yoyo: true,
                        repeat: Math.max(2, Math.floor(duration / 60)),
                        onComplete: resolve
                    });
                });
                tweens.push(tween);
            });
        });
        await Promise.all(tweens);
    }

    // Create shatter pieces that fly away from each matched symbol
    createShatterEffect(matches) {
        const cols = 4;
        const rows = 4;
        const pieceDisplayW = window.GameConfig.SYMBOL_SIZE / cols;
        const pieceDisplayH = window.GameConfig.SYMBOL_SIZE / rows;
        const pieceDepth = (window.GameConfig.UI_DEPTHS.GRID_SYMBOL || 4) + 1;

        const makePiecesForSymbol = (symbol) => {
            if (!symbol || !symbol.texture || !symbol.texture.key) return;
            const key = symbol.texture.key;
            const tex = this.textures.get(key);
            if (!tex) return;
            const srcImg = tex.getSourceImage ? tex.getSourceImage() : null;
            const srcW = (srcImg && srcImg.width) || symbol.width || window.GameConfig.SYMBOL_SIZE;
            const srcH = (srcImg && srcImg.height) || symbol.height || window.GameConfig.SYMBOL_SIZE;
            const cropW = Math.floor(srcW / cols);
            const cropH = Math.floor(srcH / rows);

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    // Create a piece cropped from the original texture
                    const px = symbol.x - window.GameConfig.SYMBOL_SIZE / 2 + (c + 0.5) * pieceDisplayW;
                    const py = symbol.y - window.GameConfig.SYMBOL_SIZE / 2 + (r + 0.5) * pieceDisplayH;
                    const piece = this.add.image(px, py, key);
                    piece.setCrop(c * cropW, r * cropH, cropW, cropH);
                    piece.setDisplaySize(pieceDisplayW, pieceDisplayH);
                    piece.setDepth(pieceDepth);

                    // Random fling
                    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                    const distance = Phaser.Math.Between(window.GameConfig.SYMBOL_SIZE * 0.3, window.GameConfig.SYMBOL_SIZE * 1.2);
                    const dx = Math.cos(angle) * distance;
                    const dy = Math.sin(angle) * distance;
                    const rot = Phaser.Math.Between(-360, 360);
                    const dur = Phaser.Math.Between(450, 750);
                    const del = Phaser.Math.Between(0, 60);

                    this.tweens.add({
                        targets: piece,
                        x: px + dx,
                        y: py + dy,
                        angle: rot,
                        alpha: 0,
                        scaleX: 0.9,
                        scaleY: 0.9,
                        duration: dur,
                        delay: del,
                        ease: 'Quad.out',
                        onComplete: () => piece.destroy()
                    });
                }
            }
        };

        matches.forEach(group => {
            group.forEach(({ symbol }) => makePiecesForSymbol(symbol));
        });
    }
    
    // Win calculation is now handled by WinCalculator
    
    // Win presentation is now handled by WinPresentationManager
    
    // Win particles are now handled by WinPresentationManager
    // Other bonus features are now handled by FreeSpinsManager
    

    // Free spins triggering is now handled by FreeSpinsManager
    
        // Free spins display updates are now handled by UIManager directly
    
    updateSpinButtonText() {
        // ui_spin is an image button, so no text update needed
        // The button functionality is handled by handleSpinButtonClick()
    }
    
    handleSpinButtonClick() {
        // Block manual spins during win presentation
        if (this.winPresentationManager && this.winPresentationManager.isShowingPresentation && this.winPresentationManager.isShowingPresentation()) {
            return;
        }
        this.freeSpinsManager.handleSpinButtonClick();
    }
    

    

    

    

    


    showMessage(text) {
        console.log(`=== SHOW MESSAGE ===`);
        console.log(`Message: ${text}`);
        
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // In burst mode, show messages at the top instead of center
        const isBurstMode = this.burstModeManager && this.burstModeManager.isActive();
        const messageY = isBurstMode ? 100 : height / 2;
        const fontSize = isBurstMode ? '24px' : '48px';
        
        const message = this.add.text(
            width / 2,
            messageY,
            text,
            {
                fontSize: fontSize,
                fontFamily: 'Arial Black',
                color: '#FFD700',
                stroke: '#000000',
                strokeThickness: isBurstMode ? 3 : 6
            }
        );
        message.setOrigin(0.5);
        message.setScale(0);
        message.setDepth(isBurstMode ? 2100 : 1000); // Higher depth in burst mode
        
        console.log(`Message created at position: (${message.x}, ${message.y})`);
        console.log(`Camera dimensions: ${width} x ${height}`);
        
        this.tweens.add({
            targets: message,
            scaleX: 1,
            scaleY: 1,
            duration: 500,
            ease: 'Back.out',
            onComplete: () => {
                console.log(`Message animation complete, will fade in 1500ms`);
                this.time.delayedCall(1500, () => {
                    this.tweens.add({
                        targets: message,
                        alpha: 0,
                        y: message.y - 50,
                        duration: 500,
                        onComplete: () => {
                            console.log(`Message destroyed`);
                            message.destroy();
                        }
                    });
                });
            }
        });
        
        console.log(`=== END SHOW MESSAGE ===`);
    }
    
    // Big free spins message is now handled by WinPresentationManager
    
    // Free spins complete screen is now handled by WinPresentationManager
    

    
    async endSpin() {
        // Stop spin button animation + light FX
        const spinButton = this.uiManager && this.uiManager.getSpinButton();
        if (spinButton) {
            spinButton.stop();
            spinButton.setFrame(0); // Reset to first frame
        }
        if (this.uiManager && this.uiManager.ui_spin_light) {
            this.uiManager.ui_spin_light.stop();
            this.uiManager.ui_spin_light.setVisible(false);
            this.uiManager.ui_spin_light.setFrame(0);
        }
        
        // Add win to balance
        // IMPORTANT: Only add win to balance if NOT in server-authoritative mode
        // Server already calculated final balance (bet deducted + win added)
        if (this.totalWin > 0) {
            // Check if we're using server-authoritative balance
            // If server sent balance (not null), then server manages balance
            // If server sent null or no balance, client manages balance (demo mode)
            const serverSentBalance = this.lastServerBalanceUpdate !== undefined && this.lastServerBalanceUpdate !== null;
            
            console.log('💰 [endSpin] Balance update check:', {
                totalWin: this.totalWin,
                lastServerBalanceUpdate: this.lastServerBalanceUpdate,
                serverSentBalance: serverSentBalance,
                demoMode: this.demoMode,
                serverMode: this.serverMode,
                currentBalance: this.stateManager.gameData.balance
            });
            
            if (!serverSentBalance) {
                // Client-side/demo mode: manually add win to balance
                const balanceBefore = this.stateManager.gameData.balance;
                this.stateManager.addWin(this.totalWin);
                const balanceAfter = this.stateManager.gameData.balance;
                
                // Sync WalletAPI in demo mode too!
                if (window.WalletAPI) {
                    window.WalletAPI.setBalance(balanceAfter);
                }
                
                this.updateBalanceDisplay();
                console.log('💰 Client mode: Added win to balance:', {
                    win: this.totalWin,
                    before: balanceBefore,
                    after: balanceAfter
                });
            } else {
                console.log('💰 Server mode: Balance already updated by server, skipping local win addition');
                // Still update display to ensure UI is in sync
                this.updateBalanceDisplay();
            }
            
            // Show win presentation for big wins (regardless of mode)
            this.winPresentationManager.showWinPresentation(this.totalWin);
            
            // Add free spins win (regardless of mode)
            this.freeSpinsManager.addFreeSpinsWin(this.totalWin);
        }
        
        // Check if free spins ended
        await this.freeSpinsManager.handleFreeSpinsEnd();
        
        // Start idle animations for all symbols now that spin is complete
        this.gridManager.startAllIdleAnimations();
        
        // Re-enable buttons
        this.setButtonsEnabled(true);
        this.isSpinning = false;
        
        // Update spin button text based on free spins status
        this.updateSpinButtonText();
        
        // Handle free spins auto-play
        const freeSpinsHandled = this.freeSpinsManager.handleFreeSpinsAutoPlay();
        
        // Handle regular autoplay
        if (!freeSpinsHandled && this.stateManager.gameData.autoplayActive) {
            this.stateManager.decrementAutoplay();
            
            // Update auto spin counter display after decrementing
            if (this.uiManager) {
                this.uiManager.updateAutoSpinCounterDisplay();
            }
            
            // Check if autoplay should continue
            if (this.stateManager.gameData.autoplayCount === 0) {
                // Autoplay finished - ui_small_stop remains as image button
                console.log('Autoplay finished');
            } else {
                // Continue autoplay - ui_small_stop remains as image button
                console.log(`Autoplay continuing: ${this.stateManager.gameData.autoplayCount} spins remaining`);
                
                // Continue autoplay after delay, but wait for win presentation
                const checkAndStartAutoSpin = () => {
                    // Safety check to ensure scene is still active
                    if (!this.scene || !this.scene.isActive()) {
                        return;
                    }
                    
                    if (!this.winPresentationManager.isShowingPresentation() && this.stateManager && 
                        this.stateManager.gameData && this.stateManager.gameData.autoplayActive && !this.isSpinning) {
                        this.startSpin();
                    } else if (this.winPresentationManager.isShowingPresentation() && this.time) {
                        // Check again in 500ms if still showing win presentation
                        this.time.delayedCall(500, checkAndStartAutoSpin);
                    }
                };
                
                // Start checking after 1 second
                this.time.delayedCall(1000, checkAndStartAutoSpin);
            }
        }
        
        // Save game state
        this.stateManager.saveState();

        // Update the top plaque text with detailed formula if we had a positive win
        // CRITICAL FIX: If shooting stars are pending, show ONLY base win (not final total)
        const hasPendingStars = !this.stateManager?.freeSpinsData?.active && (this.normalModePendingStars || 0) > 0;
        
        if (this.uiManager && this.uiManager.winTopText) {
            const amount = this.totalWin || 0;
            if (amount > 0) {
                const inFreeSpins = !!(this.stateManager && this.stateManager.freeSpinsData && this.stateManager.freeSpinsData.active);
                let base, mult;
                if (inFreeSpins) {
                    // Use the FS accumulated multiplier from state and backsolve base for consistent display
                    mult = Math.max(1, (this.stateManager.freeSpinsData.multiplierAccumulator || 1));
                    base = mult > 0 ? amount / mult : amount;
                } else {
                    const multSum = Math.max(0, this.spinAccumulatedRM || 0);
                    mult = multSum > 0 ? multSum : Math.max(1, this.spinAppliedMultiplier || 1);
                    base = Math.max(0, this.baseWinForFormula || 0);
                }
                
                // MODIFICATION: Show only BASE WIN if stars are pending, otherwise show full formula
                let text;
                if (hasPendingStars && base > 0) {
                    // Show only base win while waiting for shooting stars
                    text = `$${base.toFixed(2)}`;
                    console.log(`⏳ endSpin(): Showing base win $${base.toFixed(2)} - waiting for ${this.normalModePendingStars} shooting stars`);
                } else if (!hasPendingStars && mult > 1) {
                    // Show full formula with multiplier
                    const baseStr = `$${base.toFixed(2)}`;
                    const multStr = `x${mult.toFixed(2).replace(/\.00$/, '')}`;
                    const finalStr = `$${amount.toFixed(2)}`;
                    text = `${baseStr} ${multStr} = ${finalStr}`;
                } else {
                    // Fallback: just show the amount
                    text = `$${amount.toFixed(2)}`;
                }
                
                this.uiManager.winTopText.setText(text);
                this.uiManager.winTopText.setVisible(true);
            } else {
                this.uiManager.winTopText.setVisible(false);
            }
        }
    }
    
    // setButtonsEnabled method is now defined in the helper methods section
    
    showWinCalculationDebug(matches, totalWin) {
        console.log('=== WIN CALCULATION DEBUG ===');
        console.log(`Total Win: $${totalWin.toFixed(2)}`);
        console.log(`Bet: $${this.stateManager.gameData.currentBet.toFixed(2)}`);
        console.log(`Matches found: ${matches.length}`);
        
        matches.forEach((match, index) => {
            const symbolType = match[0].symbol.symbolType;
            const symbolInfo = window.GameConfig.SYMBOLS[symbolType.toUpperCase()];
            const matchSize = match.length;
            
            // Get highest multiplier in this match
            let highestMultiplier = 1;
            match.forEach(({ symbol }) => {
                if (symbol && symbol.multiplier > highestMultiplier) {
                    highestMultiplier = symbol.multiplier;
                }
            });
            
            // Get the appropriate payout multiplier based on match size
            let payoutMultiplier = 0;
            if (symbolInfo.type === 'scatter') {
                payoutMultiplier = symbolInfo.payouts[matchSize] || 0;
            } else {
                if (matchSize >= 12) {
                    payoutMultiplier = symbolInfo.payouts[12];
                } else if (matchSize >= 10) {
                    payoutMultiplier = symbolInfo.payouts[10];
                } else if (matchSize >= 8) {
                    payoutMultiplier = symbolInfo.payouts[8];
                }
            }
            
            const baseWin = (this.stateManager.gameData.currentBet / 20) * payoutMultiplier;
            const finalWin = baseWin * highestMultiplier;
            
            console.log(`Match ${index + 1}:`);
            console.log(`  Symbol: ${symbolType} (${matchSize} symbols)`);
            console.log(`  Formula: (${this.stateManager.gameData.currentBet}/20) * ${payoutMultiplier} = $${baseWin.toFixed(2)}`);
            console.log(`  Highest Symbol Multiplier: ${highestMultiplier}x`);
            console.log(`  Final Match Win: $${finalWin.toFixed(2)}`);
            
            // Show positions with multipliers
            const positions = match.map(({ col, row, symbol }) => {
                const mult = symbol.multiplier || 1;
                return `(${col},${row})${mult > 1 ? ` x${mult}` : ''}`;
            }).join(', ');
            console.log(`  Positions: ${positions}`);
        });
        
        console.log('========================');
    }
    
    debugGridState() {
        console.log('=== GRID STATE ===');
        for (let row = 0; row < this.gridManager.rows; row++) {
            let rowStr = '';
            for (let col = 0; col < this.gridManager.cols; col++) {
                const symbol = this.gridManager.grid[col][row];
                if (symbol) {
                    const shortName = symbol.symbolType.replace('_gem', '').replace('_', '').substring(0, 4).toUpperCase();
                    rowStr += shortName.padEnd(6, ' ');
                } else {
                    rowStr += 'NULL  ';
                }
            }
            console.log(`Row ${row}: ${rowStr}`);
        }
        console.log('==================');
    }
    
    // Cascade synchronization control methods
    setSyncDisplayVisible(visible) {
        if (this.syncStatusPanel) this.syncStatusPanel.setVisible(visible);
        if (this.syncStatusTitle) this.syncStatusTitle.setVisible(visible);
        if (this.syncStatusLines) {
            this.syncStatusLines.forEach(line => line.setVisible(visible));
        }
    }
    
    setManualControlVisible(visible) {
        if (this.manualControlPanel) this.manualControlPanel.setVisible(visible);
        if (this.manualControlTitle) this.manualControlTitle.setVisible(visible);
        if (this.stepButton) this.stepButton.setVisible(visible);
        if (this.playPauseButton) this.playPauseButton.setVisible(visible);
        if (this.resetButton) this.resetButton.setVisible(visible);
        if (this.toggleSyncButton) this.toggleSyncButton.setVisible(visible);
        if (this.recoveryButton) this.recoveryButton.setVisible(visible);
        if (this.debugInfoButton) this.debugInfoButton.setVisible(visible);
        if (this.manualStatusText) this.manualStatusText.setVisible(visible);
    }
    
    updateSyncStatusDisplay() {
        if (!this.syncStatusLines || !this.syncState) return;
        
        let lineIndex = 0;
        this.syncStatusLines[lineIndex++].setText(`Sync: ${this.syncState.enabled ? 'ENABLED' : 'DISABLED'}`);
        this.syncStatusLines[lineIndex++].setText(`Session: ${this.syncState.sessionActive ? 'ACTIVE' : 'INACTIVE'}`);
        this.syncStatusLines[lineIndex++].setText(`Step: ${this.syncState.currentStep}/${this.syncState.totalSteps}`);
        this.syncStatusLines[lineIndex++].setText(`Desync Count: ${this.syncState.desyncCount}`);
        this.syncStatusLines[lineIndex++].setText(`Recovery Attempts: ${this.syncState.recoveryAttempts}`);
        this.syncStatusLines[lineIndex++].setText(`Avg Step Time: ${this.syncState.performanceMetrics.averageStepTime.toFixed(1)}ms`);
        this.syncStatusLines[lineIndex++].setText(`Success Rate: ${this.syncState.performanceMetrics.syncSuccessRate.toFixed(1)}%`);
        this.syncStatusLines[lineIndex++].setText(`Queue: ${this.cascadeStepQueue ? this.cascadeStepQueue.length : 0} steps`);
        
        // Color coding based on sync health
        const healthColor = this.syncState.performanceMetrics.syncSuccessRate > 95 ? '#00FF00' : 
                           this.syncState.performanceMetrics.syncSuccessRate > 80 ? '#FFD700' : '#FF4500';
        this.syncStatusLines[6].setColor(healthColor);
    }
    
    // Manual cascade control methods
    manualCascadeStep() {
        if (!this.cascadeStepQueue || this.cascadeStepQueue.length === 0) {
            this.showMessage('No cascade steps in queue');
            return;
        }
        
        const step = this.cascadeStepQueue.shift();
        if (window.DEBUG) {
            console.log('?? Manual cascade step:', step);
        }
        
        this.executeCascadeStep(step);
        this.updateSyncStatusDisplay();
        this.showMessage(`Step ${step.stepNumber} executed`);
    }
    
    toggleCascadePause() {
        this.cascadeStepPaused = !this.cascadeStepPaused;
        this.manualCascadeControl = this.cascadeStepPaused;
        
        if (this.playPauseButton) {
            this.playPauseButton.setText(this.cascadeStepPaused ? '[2] PLAY' : '[2] PAUSE');
        }
        
        if (this.manualStatusText) {
            this.manualStatusText.setText(this.manualCascadeControl ? 'Manual Mode' : 'Auto Mode');
            this.manualStatusText.setColor(this.manualCascadeControl ? '#FF9900' : '#00FF00');
        }
        
        const mode = this.cascadeStepPaused ? 'PAUSED' : 'PLAYING';
        this.showMessage(`Cascade mode: ${mode}`);
        
        if (window.DEBUG) {
            console.log('?? Cascade control toggled:', mode);
        }
    }
    
    resetCascadeSync() {
        // Reset sync state
        if (this.syncState) {
            this.syncState.sessionActive = false;
            this.syncState.currentStep = 0;
            this.syncState.totalSteps = 0;
            this.syncState.lastValidationHash = null;
            this.syncState.recoveryAttempts = 0;
        }
        
        // Clear step queue
        this.cascadeStepQueue = [];
        this.currentCascadeSession = null;
        
        // Reset manual control
        this.manualCascadeControl = false;
        this.cascadeStepPaused = false;
        
        if (this.playPauseButton) {
            this.playPauseButton.setText('[2] PAUSE');
        }
        
        if (this.manualStatusText) {
            this.manualStatusText.setText('Auto Mode');
            this.manualStatusText.setColor('#00FF00');
        }
        
        this.updateSyncStatusDisplay();
        this.showMessage('Cascade sync reset');
        
        if (window.DEBUG) {
            console.log('?? Cascade sync system reset');
        }
    }
    
    toggleCascadeSync() {
        if (this.syncState) {
            this.syncState.enabled = !this.syncState.enabled;
        }
        
        if (this.toggleSyncButton) {
            this.toggleSyncButton.setText(`[4] SYNC: ${this.syncState.enabled ? 'ON' : 'OFF'}`);
        }
        
        this.updateSyncStatusDisplay();
        this.showMessage(`Cascade sync: ${this.syncState.enabled ? 'ENABLED' : 'DISABLED'}`);
        
        if (window.DEBUG) {
            console.log('?? Cascade sync toggled:', this.syncState.enabled ? 'ON' : 'OFF');
        }
    }
    
    async triggerSyncRecovery() {
        if (!this.cascadeAPI) {
            this.showMessage('CascadeAPI not available');
            return;
        }
        
        try {
            this.syncState.recoveryAttempts++;
            this.showMessage('Triggering sync recovery...');
            
            // Attempt recovery using CascadeAPI
            const recoveryResult = await this.cascadeAPI.requestRecovery({
                currentStep: this.syncState.currentStep,
                desyncReason: 'manual_trigger',
                gridState: this.gridManager ? this.gridManager.getCurrentGrid() : null
            });
            
            if (recoveryResult.success) {
                this.showMessage('Sync recovery successful');
                this.syncState.desyncCount = Math.max(0, this.syncState.desyncCount - 1);
            } else {
                this.showMessage('Sync recovery failed');
            }
            
            this.updateSyncStatusDisplay();
            
            if (window.DEBUG) {
                console.log('?? Sync recovery result:', recoveryResult);
            }
        } catch (error) {
            console.error('?? Sync recovery error:', error);
            this.showMessage('Recovery error');
        }
    }
    
    showCascadeDebugInfo() {
        if (!window.DEBUG && !window.CASCADE_DEBUG) return;
        
        console.log('?? === CASCADE DEBUG INFO ===');
        console.log('?? Sync State:', this.syncState);
        console.log('?? Step Queue Length:', this.cascadeStepQueue ? this.cascadeStepQueue.length : 0);
        console.log('?? Manual Control:', this.manualCascadeControl);
        console.log('?? Step Paused:', this.cascadeStepPaused);
        console.log('?? CascadeAPI Available:', !!this.cascadeAPI);
        console.log('?? Current Session:', this.currentCascadeSession);
        console.log('?? GridManager Available:', !!this.gridManager);
        console.log('?? ==========================');
        
        this.showMessage('Debug info logged to console');
    }
    
    toggleCascadeDebugMode() {
        this.cascadeDebugMode = !this.cascadeDebugMode;
        
        // Show/hide debug displays based on mode
        this.setSyncDisplayVisible(this.cascadeDebugMode);
        this.setManualControlVisible(this.cascadeDebugMode);
        
        this.showMessage(`Debug mode: ${this.cascadeDebugMode ? 'ON' : 'OFF'}`);
        
        if (window.DEBUG) {
            console.log('?? Cascade debug mode toggled:', this.cascadeDebugMode ? 'ON' : 'OFF');
        }
    }
    
    toggleManualControlPanel() {
        const visible = this.manualControlPanel ? this.manualControlPanel.visible : false;
        this.setManualControlVisible(!visible);
        
        this.showMessage(`Manual control: ${!visible ? 'SHOWN' : 'HIDDEN'}`);
        
        if (window.DEBUG) {
            console.log('?? Manual control panel toggled:', !visible ? 'SHOWN' : 'HIDDEN');
        }
    }
    
    // Enhanced cascade step execution with sync integration
    async executeCascadeStep(step) {
        if (!step) return;
        
        const startTime = performance.now();
        
        try {
            // Update sync state
            this.syncState.currentStep = step.stepNumber;
            
            // Validate step with server if cascade sync enabled
            if (this.syncState.enabled && this.cascadeAPI) {
                const validationResult = await this.cascadeAPI.validateStep(step);
                if (!validationResult.valid) {
                    this.syncState.desyncCount++;
                    if (window.DEBUG) {
                        console.warn('?? Step validation failed:', validationResult);
                    }
                    return;
                }
                this.syncState.lastValidationHash = validationResult.hash;
            }
            
            // Execute the actual cascade step
            // This would integrate with the existing cascade processing
            if (step.type === 'match_removal') {
                // Remove matched symbols
                if (step.matches && this.gridManager) {
                    this.gridManager.removeMatches(step.matches);
                }
            } else if (step.type === 'symbol_drop') {
                // Drop symbols
                if (this.gridManager) {
                    await this.gridManager.cascadeSymbols();
                }
            }
            
            // Record performance metrics
            const stepTime = performance.now() - startTime;
            this.syncState.performanceMetrics.stepValidationTime.push(stepTime);
            
            // Calculate average (keep last 10 measurements)
            if (this.syncState.performanceMetrics.stepValidationTime.length > 10) {
                this.syncState.performanceMetrics.stepValidationTime.shift();
            }
            
            const avgTime = this.syncState.performanceMetrics.stepValidationTime.reduce((a, b) => a + b, 0) / 
                           this.syncState.performanceMetrics.stepValidationTime.length;
            this.syncState.performanceMetrics.averageStepTime = avgTime;
            
            // Update success rate
            const successfulSteps = this.syncState.performanceMetrics.stepValidationTime.length;
            const totalAttempts = successfulSteps + this.syncState.desyncCount;
            this.syncState.performanceMetrics.syncSuccessRate = totalAttempts > 0 ? 
                (successfulSteps / totalAttempts) * 100 : 100;
                
        } catch (error) {
            console.error('?? Error executing cascade step:', error);
            this.syncState.desyncCount++;
        }
        
        this.updateSyncStatusDisplay();
    }

    // Task 6.2: Server event handlers for game integration
    handleServerSpinResult(data) {
        if (window.DEBUG) {
            console.log('?�� Server spin result received:', data);
        }
        
        // Store server result for processing
        this.serverSpinResult = data;
        this.isServerSpinning = false;
        
        // Process server result through existing animation system
        this.processServerSpinResult(data);
    }
    
    handleServerBalanceUpdate(data) {
        if (window.DEBUG) {
            console.log('?�� Server balance update received:', data);
        }
        
        // Update local balance from server using GameStateManager
        if (data.balance !== undefined) {
            this.stateManager.setBalanceFromServer(data.balance);
            
            // Sync WalletAPI so UI displays correct balance
            if (window.WalletAPI) {
                window.WalletAPI.setBalance(data.balance);
            }
            
            this.updateBalanceDisplay();
        }
    }
    
    applyServerGameState(gameState, options = {}) {
        if (!gameState) {
            return;
        }
        const stateData = gameState.state_data || {};
        const gridFromState = Array.isArray(stateData.current_grid) ? stateData.current_grid : null;
        if (gridFromState) {
            const snapshot = gridFromState.map((col) => Array.isArray(col) ? col.slice() : []);
            if (this.gridManager) {
                this.gridManager.clearGrid();
                this.gridManager.setGrid(snapshot);
                if (this.time && typeof this.time.delayedCall === 'function') {
                    this.time.delayedCall(32, () => {
                        if (this.gridManager && this.gridManager.startAllIdleAnimations) {
                            this.gridManager.startAllIdleAnimations();
                        }
                    });
                }
            }
            if (this.gridRenderer && typeof this.gridRenderer.setInitialGrid === 'function') {
                this.gridRenderer.setInitialGrid(snapshot, { instant: true });
            }
        } else if (options.initial && this.gridManager) {
            // No grid from server - generate a random non-winning grid for initial display
            console.log('🎰 No grid from server, generating fallback grid');
            this.gridManager.fillGrid();
            if (this.time && typeof this.time.delayedCall === 'function') {
                this.time.delayedCall(32, () => {
                    if (this.gridManager && this.gridManager.startAllIdleAnimations) {
                        this.gridManager.startAllIdleAnimations();
                    }
                });
            }
        }
        if (stateData.last_rng_seed) {
            this.lastServerSeed = stateData.last_rng_seed;
        }
        if (typeof gameState.balance === 'number') {
            this.stateManager.setBalanceFromServer(gameState.balance);
            
            // Sync WalletAPI so UI displays correct balance
            if (window.WalletAPI) {
                window.WalletAPI.setBalance(gameState.balance);
            }
            
            this.updateBalanceDisplay();
        } else if (typeof stateData.balance === 'number') {
            this.stateManager.setBalanceFromServer(stateData.balance);
            
            // Sync WalletAPI so UI displays correct balance
            if (window.WalletAPI) {
                window.WalletAPI.setBalance(stateData.balance);
            }
            
            this.updateBalanceDisplay();
        }
        if (typeof gameState.free_spins_remaining === 'number') {
            this.stateManager.freeSpinsData.count = gameState.free_spins_remaining;
            this.stateManager.freeSpinsData.active = gameState.game_mode === 'free_spins';
            
            // CRITICAL: Sync accumulated multiplier from server
            if (typeof gameState.accumulated_multiplier === 'number') {
                this.stateManager.freeSpinsData.multiplierAccumulator = gameState.accumulated_multiplier;
                console.log(`🎰 Synced free spins accumulated multiplier from server: x${gameState.accumulated_multiplier}`);
            }
            
            this.uiManager.updateFreeSpinsDisplay();
        }
    }

    handleServerGameStateChange(payload) {
        if (window.DEBUG) {
            console.log('?? Server game state change:', payload);
        }
        const state = (payload && payload.data) || (payload && payload.gameState) || payload;
        if (state) {
            this.applyServerGameState(state, { source: (payload && payload.meta && payload.meta.source) || 'event' });
        }
        const data = payload && payload.data ? payload.data : {};
        if (data.freeSpinsActive !== undefined) {
            this.stateManager.freeSpinsData.active = data.freeSpinsActive;
            if (data.freeSpinsCount !== undefined) {
                this.stateManager.freeSpinsData.count = data.freeSpinsCount;
            }
            this.uiManager.updateFreeSpinsDisplay();
        }
        if (data.balance !== undefined) {
            this.stateManager.setBalanceFromServer(data.balance);
            
            // Sync WalletAPI so UI displays correct balance
            if (window.WalletAPI) {
                window.WalletAPI.setBalance(data.balance);
            }
            
            this.updateBalanceDisplay();
        }
    }
    
    handleServerAuthError() {
        if (window.DEBUG) {
            console.warn('?? Server authentication error - switching to demo mode');
        }
        
        // Switch to demo mode on authentication error
        this.serverMode = false;
        this.demoMode = true;
        this.isServerSpinning = false;
        
        this.showMessage('Connection lost - switching to demo mode');
    }
    
    async processServerSpinResult(serverResult) {
        try {
            if (!serverResult) {
                throw new Error('Missing server spin result');
            }

            const normalized = Object.assign({}, serverResult);
            if (!Array.isArray(normalized.cascadeSteps) && Array.isArray(normalized.cascades)) {
                normalized.cascadeSteps = normalized.cascades;
            } else if (!Array.isArray(normalized.cascades) && Array.isArray(normalized.cascadeSteps)) {
                normalized.cascades = normalized.cascadeSteps;
            }

            // Clear any stale multiplier overlays from previous spins
            if (this.bonusManager && typeof this.bonusManager.clearAllRandomMultiplierOverlays === 'function') {
                this.bonusManager.clearAllRandomMultiplierOverlays();
            }

            // Show server data in debug overlay BEFORE rendering
            if (window.serverDebugWindow && typeof window.serverDebugWindow.show === 'function') {
                window.serverDebugWindow.show(normalized);
            }

            // Pre-flag pending shooting stars in NORMAL mode before rendering grids
            // so any early win display updates (e.g., from GridRenderer) will
            // show BASE amount instead of FINAL total while stars are pending.
            try {
                const inFreeSpins = !!(this.stateManager && this.stateManager.freeSpinsData && this.stateManager.freeSpinsData.active);
                if (!inFreeSpins) {
                    const rawEvents = Array.isArray(normalized.multiplierEvents) ? normalized.multiplierEvents : [];
                    let earlyPending = 0;
                    for (const evt of rawEvents) {
                        if (Array.isArray(evt?.multipliers) && evt.multipliers.length > 0) {
                            earlyPending += evt.multipliers.length;
                        } else if (typeof evt?.totalMultiplier === 'number' && evt.totalMultiplier > 0) {
                            // Fallback: if we don't have per-entry breakdown yet, assume at least 1 star
                            earlyPending += 1;
                        }
                    }
                    if (earlyPending > 0) {
                        this.normalModePendingStars = earlyPending;
                        console.log(`🛡️ Pre-flagging pending stars before grid render: ${earlyPending}`);
                    }
                }
            } catch (_) {}

            if (this.gridRenderer && typeof this.gridRenderer.renderSpinResult === 'function') {
                await this.gridRenderer.renderSpinResult(normalized);
            } else {
                console.warn('GridRenderer unavailable; using legacy cascade animation.');
                if (Array.isArray(normalized.cascades)) {
                    await this.cascadeAnimator.queue(() => this.animateServerCascades(normalized.cascades));
                }
            }

            console.log(`🎰 FREE SPINS CHECK (client):`, {
                freeSpinsAwarded: normalized.freeSpinsAwarded,
                freeSpinsTriggered: normalized.freeSpinsTriggered,
                bonusFeaturesFreeSpinsAwarded: normalized?.bonusFeatures?.freeSpinsAwarded,
                bonusFeaturesFreeSpinsTriggered: normalized?.bonusFeatures?.freeSpinsTriggered,
                hasBonusFeatures: !!normalized.bonusFeatures
            });
            
            // DISABLED CLIENT FALLBACKS - Server is authoritative!
            // Only process free spins if server explicitly triggers them
            if (normalized.freeSpinsAwarded) {
                // Immediately lock mode switches as soon as server says FS will trigger
                try { this.lockModeSwitches = true; this.uiManager?.updateModeSwitchButtonsState?.(); } catch (_) {}
                console.log(`✅ Free spins triggered via normalized.freeSpinsAwarded: ${normalized.freeSpinsAwarded}`);
                this.triggerFreeSpinsWithScatterCelebration(normalized.freeSpinsAwarded);
            } else if (normalized.freeSpinsTriggered) {
                // Server says free spins triggered but no award count came through
                const award = normalized.bonusFeatures?.freeSpinsAwarded || window.GameConfig?.FREE_SPINS?.SCATTER_4_PLUS || 15;
                try { this.lockModeSwitches = true; this.uiManager?.updateModeSwitchButtonsState?.(); } catch (_) {}
                console.log(`✅ Free spins triggered via normalized.freeSpinsTriggered: ${award}`);
                this.triggerFreeSpinsWithScatterCelebration(award);
            } else {
                // Check bonusFeatures as fallback
                const bfAward = normalized?.bonusFeatures?.freeSpinsAwarded;
                if (typeof bfAward === 'number' && bfAward > 0) {
                    try { this.lockModeSwitches = true; this.uiManager?.updateModeSwitchButtonsState?.(); } catch (_) {}
                    console.log(`✅ Free spins triggered via bonusFeatures.freeSpinsAwarded: ${bfAward}`);
                    this.triggerFreeSpinsWithScatterCelebration(bfAward);
                } else {
                    console.log(`❌ Free spins NOT triggered by server`);
                }
            }

            // Set baseWinForFormula for all spins (with or without multipliers)
            // This is the win BEFORE any random multipliers are applied
            if (typeof normalized.baseWin === 'number') {
                this.baseWinForFormula = normalized.baseWin;
            } else if (typeof normalized.totalWin === 'number') {
                // Fallback: if no multipliers, baseWin = totalWin
                this.baseWinForFormula = normalized.totalWin;
            }
            
            // CRITICAL FIX: Store server's target accumulated multiplier for progressive update
            // Don't update the display immediately - let shooting stars increment it
            if (this.stateManager.freeSpinsData.active) {
                const currentClientValue = this.stateManager.freeSpinsData.multiplierAccumulator || 1;
                const pendingTarget = (typeof this.fsTargetAccumulatedMultiplier === 'number') ? this.fsTargetAccumulatedMultiplier : currentClientValue;
                const effectiveClientValue = Math.max(currentClientValue, pendingTarget);
                const serverTargetValue = normalized.accumulatedMultiplier;
                
                console.log(`🎰 FREE SPINS ACCUMULATED MULTIPLIER - Processing:`, {
                    currentClientValue,
                    serverTargetValue,
                    serverValueType: typeof serverTargetValue,
                    hasServerValue: serverTargetValue !== null && serverTargetValue !== undefined
                });
                
                // CRITICAL: Use accumulatedMultiplier for THIS spin, nextSpinAccumulatedMultiplier for badge reset
                // If free spins ended, server sends accumulatedMultiplier = x14 (this spin) and nextSpinAccumulatedMultiplier = 1 (next spin)
                const nextSpinMultiplier = normalized.nextSpinAccumulatedMultiplier;
                const freeSpinsEnded = normalized.freeSpinsEnded || (normalized.gameMode === 'base' && this.stateManager.freeSpinsData.active);
                
                // Only update if server explicitly sent a value (not null/undefined)
                // IMPORTANT: If server sent a value, it is AUTHORITATIVE
                if (typeof serverTargetValue === 'number' && serverTargetValue > 0) {
                    console.log(`🎰 FREE SPINS ACCUMULATED MULTIPLIER - Server sent value x${serverTargetValue}, current x${effectiveClientValue}, freeSpinsEnded: ${freeSpinsEnded}, nextSpinMultiplier: x${nextSpinMultiplier}`);
                    
                    // Store the target value (where shooting stars will bring us)
                    this.fsTargetAccumulatedMultiplier = serverTargetValue;
                    
                    // Calculate individual multipliers that will be added by shooting stars
                    const newMultipliersThisSpin = serverTargetValue - effectiveClientValue;
                    if (newMultipliersThisSpin > 0) {
                        // We'll increment as each star arrives
                        console.log(`🎰 Will add x${newMultipliersThisSpin} progressively via shooting stars`);
                    } else if (newMultipliersThisSpin < 0) {
                        // Server value is less than client (shouldn't happen, but sync to server if it does)
                        console.warn(`⚠️ Server accumulated multiplier (x${serverTargetValue}) < client (x${effectiveClientValue}). Syncing to server value.`);
                        this.stateManager.freeSpinsData.multiplierAccumulator = serverTargetValue;
                        this.uiManager.updateAccumulatedMultiplierDisplay();
                    } else {
                        // Same value (newMultipliersThisSpin === 0), maintain current
                        // Explicitly ensure we don't reset - keep the current value
                        console.log(`🎰 No new multipliers this spin, explicitly maintaining accumulated: x${effectiveClientValue}`);
                        // HOTFIX: Force set to ensure it's not reset elsewhere
                        this.stateManager.freeSpinsData.multiplierAccumulator = effectiveClientValue;
                        this.fsTargetAccumulatedMultiplier = effectiveClientValue;
                    }
                } else if ((serverTargetValue === 0 || serverTargetValue === 1) && !freeSpinsEnded) {
                    // Server explicitly sent 0 or 1 DURING free spins - this is a bug, maintain client value
                    console.warn(`⚠️ Server sent accumulated multiplier of x${serverTargetValue} during free spins! This seems wrong. Maintaining client value x${effectiveClientValue}`);
                    // Don't reset to server's wrong value, keep client value
                    this.stateManager.freeSpinsData.multiplierAccumulator = effectiveClientValue;
                    this.fsTargetAccumulatedMultiplier = effectiveClientValue;
                } else if ((serverTargetValue === 0 || serverTargetValue === 1) && freeSpinsEnded) {
                    // Server sent 1 because free spins ended - this is expected! Use nextSpinMultiplier
                    console.log(`✅ Free spins ended, server correctly sent nextSpinMultiplier: x${nextSpinMultiplier} for next spin`);
                    // Don't update badge yet - animations still playing! Will update after all animations complete.
                } else {
                    // Server didn't send accumulated multiplier value, maintain current client value
                    console.log(`🎰 Server didn't send accumulated multiplier (${serverTargetValue}), maintaining current: x${effectiveClientValue}`);
                    // HOTFIX: Force set to ensure it's not reset elsewhere
                    this.stateManager.freeSpinsData.multiplierAccumulator = effectiveClientValue;
                    this.fsTargetAccumulatedMultiplier = effectiveClientValue;
                }
            }
            
            const multiplierSummary = normalized.multiplierAwarded || (Array.isArray(normalized.multiplierEvents) && normalized.multiplierEvents.length ? {
                events: normalized.multiplierEvents,
                originalWin: typeof normalized.baseWin === 'number' ? normalized.baseWin : normalized.totalWin,
                finalWin: normalized.totalWin,
                // CRITICAL FIX: Multipliers are ADDED together, not multiplied
                // Example: x4 cascade + x3 random = x7 total (not x12)
                totalAppliedMultiplier: normalized.multiplierEvents.reduce((sum, evt) => sum + (evt.totalMultiplier || 0), 0)
            } : null);
            
            if (multiplierSummary) {
                console.log(`🎯 Using ${normalized.multiplierAwarded ? 'SERVER' : 'FALLBACK'} multiplier summary:`, {
                    totalAppliedMultiplier: multiplierSummary.totalAppliedMultiplier,
                    originalWin: multiplierSummary.originalWin,
                    finalWin: multiplierSummary.finalWin,
                    events: multiplierSummary.events.map(e => ({ type: e.type, total: e.totalMultiplier }))
                });
                // CRITICAL: Await this so normalModePendingStars is set BEFORE we check it below
                await this.bonusManager.showRandomMultiplierResult(multiplierSummary);
            }

            // Final authoritative sync to server value (rounded to cents)
            if (typeof normalized.totalWin === 'number') {
                const finalWin = Math.round(Number(normalized.totalWin) * 100) / 100;
                this.totalWin = finalWin;
                // In normal mode, if we have pending shooting stars, delay the win display update
                // The stars will call updateWinDisplay progressively as they arrive
                const hasPendingStars = !this.stateManager.freeSpinsData.active && (this.normalModePendingStars || 0) > 0;
                console.log(`🔍 Checking if we should update win display: hasPendingStars=${hasPendingStars}, normalModePendingStars=${this.normalModePendingStars || 0}`);
                if (!hasPendingStars) {
                    this.updateWinDisplay();
                } else {
                    console.log(`⏳ Delaying win display update - waiting for ${this.normalModePendingStars} shooting stars to complete`);
                }
            }

            // Update balance from server (check for null - demo mode returns null balance)
            if (normalized.balance !== undefined && normalized.balance !== null) {
                console.log('💵 Setting balance from server:', normalized.balance);
                this.stateManager.setBalanceFromServer(normalized.balance);
                
                // Sync WalletAPI so UI displays correct balance
                if (window.WalletAPI) {
                    window.WalletAPI.setBalance(normalized.balance);
                }
                
                this.updateBalanceDisplay();
                // Track that server sent us a balance (for endSpin logic)
                this.lastServerBalanceUpdate = normalized.balance;
            } else if (typeof normalized.playerCredits === 'number') {
                console.log('💵 Setting balance from server (playerCredits):', normalized.playerCredits);
                this.stateManager.setBalanceFromServer(normalized.playerCredits);
                
                // Sync WalletAPI so UI displays correct balance
                if (window.WalletAPI) {
                    window.WalletAPI.setBalance(normalized.playerCredits);
                }
                
                this.updateBalanceDisplay();
                // Track that server sent us a balance (for endSpin logic)
                this.lastServerBalanceUpdate = normalized.playerCredits;
            } else if (normalized.balance === null || normalized.playerCredits === null) {
                console.log('💵 Server returned null balance - demo mode or not authenticated');
                console.log('💰 Using client-side balance calculation for demo mode');
                // In demo mode, server doesn't manage balance, so client handles it via endSpin()
                this.lastServerBalanceUpdate = null;
            } else {
                console.warn('⚠️ No balance found in server response!', {
                    hasBalance: 'balance' in normalized,
                    hasPlayerCredits: 'playerCredits' in normalized,
                    balanceValue: normalized.balance,
                    playerCreditsValue: normalized.playerCredits,
                    balanceType: typeof normalized.balance,
                    keys: Object.keys(normalized).slice(0, 20)
                });
                console.log('🔍 Full normalized data:', JSON.stringify(normalized, null, 2).substring(0, 500));
                // No valid balance from server, use client-side calculation
                this.lastServerBalanceUpdate = null;
            }

            if (normalized.rngSeed) {
                this.lastServerSeed = normalized.rngSeed;
            }

            return normalized;

        } catch (error) {
            console.error('Error processing server spin result:', error);
            this.switchToDemoMode();
            throw error;
        }
    }

    /**
     * Trigger free spins with scatter celebration animation
     * Plays the big scatter animation at all scatter positions before starting free spins
     * @param {Number} spinsAwarded - Number of free spins awarded
     */
    async triggerFreeSpinsWithScatterCelebration(spinsAwarded) {
        // Get scatter positions from current grid
        const scatterPositions = this.gridManager?.getScatterPositions?.() || [];
        const scatterCount = scatterPositions.length;
        
        console.log(`🎰✨ Triggering free spins with scatter celebration (${scatterCount} scatters at ${scatterPositions.length} positions)`);
        
        // Only play celebration if 4+ scatters (which should always be the case when free spins trigger)
        if (scatterCount >= 4 && this.scatterCelebration) {
            console.log(`✨ Playing scatter celebration animation at positions:`, scatterPositions);
            // Ensure mode switches remain locked during celebration visuals
            try { this.lockModeSwitches = true; this.uiManager?.updateModeSwitchButtonsState?.(); } catch (_) {}
            
            // Play the scatter celebration animation
            await this.scatterCelebration.playAtPositions(scatterPositions);
            
            console.log(`✅ Scatter celebration complete - proceeding with free spins trigger`);
        } else {
            console.log(`⚠️ Skipping scatter celebration (scatterCount: ${scatterCount}, hasEffect: ${!!this.scatterCelebration})`);
        }
        
        // Now proceed with normal free spins trigger
        if (this.freeSpinsManager && this.freeSpinsManager.processFreeSpinsTrigger) {
            this.freeSpinsManager.processFreeSpinsTrigger(spinsAwarded);
        }
    }
    
    async animateServerCascades(cascades) {
        // Animate through each cascade step provided by the server
        for (let i = 0; i < cascades.length; i++) {
            const cascadeStep = cascades[i];
            
            if (window.DEBUG) {
                console.log(`?�� Animating cascade ${i + 1}/${cascades.length}:`, cascadeStep);
            }
            
            // Display the grid state for this cascade
            if (cascadeStep.gridBefore) {
                this.displayServerGrid(cascadeStep.gridBefore);
            }
            
            // Animate matches if provided
            if (cascadeStep.matches && cascadeStep.matches.length > 0) {
                // Convert server matches to client format for animation
                const clientMatches = this.convertServerMatchesToClient(cascadeStep.matches);
                
                // Add win amount for this cascade
                if (cascadeStep.win > 0) {
                    this.totalWin += cascadeStep.win;
                    this.updateWinDisplay();
                }
                
                // Animate the matches using existing system
                await this.cascadeAnimator.queue(() => this.shakeMatches(clientMatches, 320));
                this.createShatterEffect(clientMatches);
                
                // Remove matched symbols
                this.removeServerMatches(cascadeStep.matches);
                
                // Wait for removal animation
                await this.delay(window.GameConfig.ANIMATIONS.SYMBOL_DESTROY_TIME);
            }
            
            // Display the grid state after this cascade
            if (cascadeStep.gridAfter) {
                this.displayServerGrid(cascadeStep.gridAfter);
                await this.cascadeAnimator.queue(() => this.animateSymbolDrop());
            }
            
            // Play cascade sound
            if (i > 0) { // Don't play on first cascade (initial spin)
                window.SafeSound.play(this, 'cascade');
            }
        }
    }
    
    displayServerGrid(serverGrid) {
        // Update the client grid to match the server grid
        if (!serverGrid || !Array.isArray(serverGrid)) {
            console.warn('Invalid server grid:', serverGrid);
            return;
        }
        // Normalize orientation to column-major 6x5 just in case
        const normalized = (window.NetworkService && typeof window.NetworkService.normalizeGrid === 'function')
            ? window.NetworkService.normalizeGrid(serverGrid)
            : serverGrid;

        for (let col = 0; col < 6; col++) {
            for (let row = 0; row < 5; row++) {
                const hasValue = normalized[col] && normalized[col][row];
                if (!hasValue) {
                    // Clear any stale client symbol when server cell is empty
                    if (this.gridManager.grid[col][row]) {
                        try { this.gridManager.grid[col][row].destroy(); } catch (_) {}
                        this.gridManager.grid[col][row] = null;
                    }
                    continue;
                }

                const symbolType = normalized[col][row];

                // Remove existing symbol if present (ensure no duplicates)
                if (this.gridManager.grid[col][row]) {
                    try { this.gridManager.grid[col][row].destroy(); } catch (_) {}
                    this.gridManager.grid[col][row] = null;
                }

                // Create new symbol at this position
                const symbol = this.gridManager.createSymbol(symbolType, col, row);
                this.gridManager.grid[col][row] = symbol;
            }
        }
    }
    
    convertServerMatchesToClient(serverMatches) {
        // Convert server match format to client GridManager format
        const clientMatches = [];
        
        serverMatches.forEach(match => {
            const clientMatch = [];
            match.positions.forEach(pos => {
                const symbol = this.gridManager.grid[pos.col] && this.gridManager.grid[pos.col][pos.row];
                if (symbol) {
                    clientMatch.push({
                        col: pos.col,
                        row: pos.row,
                        symbol: symbol
                    });
                }
            });
            
            if (clientMatch.length > 0) {
                clientMatches.push(clientMatch);
            }
        });
        
        return clientMatches;
    }
    
    removeServerMatches(serverMatches) {
        // Mark matched symbols for removal based on server data
        serverMatches.forEach(match => {
            match.positions.forEach(pos => {
                const symbol = this.gridManager.grid[pos.col] && this.gridManager.grid[pos.col][pos.row];
                if (symbol) {
                    symbol.pendingServerRemoval = true;
                }
            });
        });
    }
    
    async animateSymbolDrop() {
        // Animate symbols dropping down using existing cascade logic
        return this.gridManager.cascadeSymbols();
    }
    
    switchToDemoMode() {
        // CRITICAL: Prevent demo mode fallback for authenticated players
        const authToken = localStorage.getItem('infinity_storm_token');
        if (authToken) {
            console.error('🚫 Cannot switch to demo mode - player is authenticated');
            console.log('🔒 Gameplay suspended until server connection is restored');
            
            // Show persistent warning instead
            if (this.connectionMonitor) {
                this.connectionMonitor.showDisconnectedWarning();
            }
            
            // Block gameplay
            this.serverMode = true; // Keep server mode active
            this.demoMode = false; // Prevent demo mode
            this.isServerSpinning = false;
            
            return;
        }
        
        // For non-authenticated players, allow demo mode
        this.serverMode = false;
        this.demoMode = true;
        this.isServerSpinning = false;
        
        this.showMessage('Server error - switched to demo mode');
        
        if (window.DEBUG) {
            console.log('?? Switched to demo mode due to server error');
        }

        // Top-up demo balance to ensure gameplay
        this.ensureDemoBalance();
    }

    ensureDemoBalance() {
        try {
            // Demo mode always resets to $10,000 (no persistence)
            if (this.demoMode && this.stateManager && this.stateManager.gameData) {
                this.stateManager.gameData.balance = 10000;
                
                if (window.WalletAPI) {
                    window.WalletAPI.currentBalance = 10000;
                }
                this.updateBalanceDisplay();
                console.log('💰 [DEMO] Balance reset to $10,000');
            }
        } catch (e) {
            // Non-fatal
            if (window.DEBUG) console.warn('ensureDemoBalance failed:', e);
        }
    }
    
    showDemoModeIndicator() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Demo banner at top center
        const banner = this.add.text(width / 2, 40, 'FREE PLAY DEMO MODE', {
            fontSize: '24px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4
        });
        banner.setOrigin(0.5);
        banner.setDepth(9998);
        
        // Login button at top-right
        const loginBtn = this.add.text(width - 150, 40, 'Login for Real Money', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#00aa00',
            padding: { x: 15, y: 8 }
        });
        loginBtn.setOrigin(0.5);
        loginBtn.setDepth(9998);
        loginBtn.setInteractive({ useHandCursor: true });
        
        loginBtn.on('pointerover', () => loginBtn.setBackgroundColor('#00cc00'));
        loginBtn.on('pointerout', () => loginBtn.setBackgroundColor('#00aa00'));
        loginBtn.on('pointerup', () => this.showLoginModal());
        
        this.demoModeUI = { banner, loginBtn };
    }
    
    showLoginModal() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Dark overlay
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);
        overlay.setDepth(9999);
        overlay.setInteractive();
        
        // Modal box
        const boxWidth = Math.min(500, width * 0.9);
        const boxHeight = 350;
        const box = this.add.rectangle(width / 2, height / 2, boxWidth, boxHeight, 0x1a1a1a, 1);
        box.setDepth(10000);
        box.setStrokeStyle(3, 0x00aa00);
        
        // Title
        const title = this.add.text(width / 2, height / 2 - 120, 'Switch to Real Money Play', {
            fontSize: '24px',
            fontFamily: 'Arial Black',
            color: '#FFD700'
        });
        title.setOrigin(0.5);
        title.setDepth(10001);
        
        // Message
        const message = this.add.text(width / 2, height / 2 - 50, 
            'You are currently playing in FREE PLAY DEMO MODE.\n\n' +
            'To play with real money and real winnings,\n' +
            'please login through your casino platform.',
            {
                fontSize: '14px',
                fontFamily: 'Arial',
                color: '#ffffff',
                align: 'center',
                wordWrap: { width: boxWidth - 40 }
            }
        );
        message.setOrigin(0.5);
        message.setDepth(10001);
        
        // Login button
        const loginBtn = this.add.text(width / 2, height / 2 + 70, 'Open Login Page', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#00aa00',
            padding: { x: 25, y: 12 }
        });
        loginBtn.setOrigin(0.5);
        loginBtn.setDepth(10001);
        loginBtn.setInteractive({ useHandCursor: true });
        
        // Cancel button
        const cancelBtn = this.add.text(width / 2, height / 2 + 120, 'Continue Demo Play', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#cccccc',
            backgroundColor: '#333333',
            padding: { x: 20, y: 10 }
        });
        cancelBtn.setOrigin(0.5);
        cancelBtn.setDepth(10001);
        cancelBtn.setInteractive({ useHandCursor: true });
        
        // Button handlers
        loginBtn.on('pointerover', () => loginBtn.setBackgroundColor('#00cc00'));
        loginBtn.on('pointerout', () => loginBtn.setBackgroundColor('#00aa00'));
        loginBtn.on('pointerup', () => {
            // Open login portal in new tab using current origin
            const portalUrl = window.location.origin + '/test-player-login.html';
            window.open(portalUrl, '_blank');
        });
        
        cancelBtn.on('pointerover', () => cancelBtn.setBackgroundColor('#444444'));
        cancelBtn.on('pointerout', () => cancelBtn.setBackgroundColor('#333333'));
        cancelBtn.on('pointerup', () => {
            [overlay, box, title, message, loginBtn, cancelBtn].forEach(el => el.destroy());
        });
    }

    update(time, delta) {
        if (this._fpsText) {
            let fpsValue = (this.game.loop && this.game.loop.actualFps) ? Math.round(this.game.loop.actualFps) : null;
            if (this.frameMonitor && typeof this.frameMonitor.getFPS === 'function') {
                const monitorFps = this.frameMonitor.getFPS();
                if (monitorFps) {
                    fpsValue = monitorFps;
                }
            }
            let text = 'FPS: ' + (fpsValue !== null ? fpsValue : '--');
            if (this.frameMonitor && typeof this.frameMonitor.getDropRate === 'function') {
                const dropRate = this.frameMonitor.getDropRate();
                if (dropRate && dropRate > 0) {
                    text += ` (drop ${(dropRate * 100).toFixed(1)}%)`;
                }
            }
            this._fpsText.setText(text);
        }
    }

    delay(ms) {
        return new Promise(resolve => {
            this.time.delayedCall(ms, resolve);
        });
    }

    showPurchaseUI() {
        this.freeSpinsManager.showPurchaseUI();
    }
    
    // Free spins purchase is now handled by FreeSpinsManager

    toggleBurstMode() {
        if (this.burstModeManager) {
            this.burstModeManager.toggle();
        }
    }
    
    enterBurstMode() {
        // Hide normal game elements
        this.setNormalGameVisible(false);
        
        // Create burst mode UI
        this.createBurstModeUI();
        
        // ui_small_burst is an image button, no text update needed
        
        // Enable quick spin for burst mode
        this.quickSpinEnabled = true;
        this.setQuickSpin(true);
        
        this.showMessage('BURST MODE ACTIVATED!');
        window.SafeSound.play(this, 'bonus');
    }
    
    exitBurstMode() {
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
        
        // Stop burst auto spinning
        this.burstAutoSpinning = false;
        
        // ui_small_burst is an image button, no text update needed
        
        // Reset quick spin
        this.quickSpinEnabled = false;
        this.setQuickSpin(false);
        
        // Clear results
        this.burstSpinResults = [];
        
        this.showMessage('BURST MODE DEACTIVATED');
        window.SafeSound.play(this, 'click');
    }
    
    setNormalGameVisible(visible) {
        // Hide/show grid and character portraits
        this.gridManager.setVisible(visible);
        
        if (this.characterPortraits) {
            Object.values(this.characterPortraits).forEach(portrait => {
                portrait.setVisible(visible);
            });
        }
        
        // Hide/show debug panel
        if (!visible) {
            this.setDebugPanelVisible(false);
        }
        
        // Hide/show the main background when in burst mode
        if (this.children && this.children.list) {
            this.children.list.forEach(child => {
                // Hide background image and other visual elements
                if (child.texture && child.texture.key === 'bg_infinity_storm') {
                    child.setVisible(visible);
                }
            });
        }
        
        // Handle animated Scarlet Witch portrait separately
        if (this.portrait_scarlet_witch) {
            this.portrait_scarlet_witch.setVisible(visible);
            // If hiding in burst mode, pause animation to save performance
            if (this.portrait_scarlet_witch.anims) {
                if (visible) {
                    // Resume animation if it was paused
                    if (this.anims.exists('scarlet_witch_idle_animation')) {
                        this.portrait_scarlet_witch.play('scarlet_witch_idle_animation');
                    }
                } else {
                    // Pause animation when hidden
                    this.portrait_scarlet_witch.anims.pause();
                }
            }
        }
        
        // Handle animated Thanos portrait separately
        if (this.portrait_thanos) {
            this.portrait_thanos.setVisible(visible);
            // If hiding in burst mode, pause animation to save performance
            if (this.portrait_thanos.anims) {
                if (visible) {
                    // Resume animation if it was paused
                    if (this.anims.exists('thanos_idle_animation')) {
                        this.portrait_thanos.play('thanos_idle_animation');
                    }
                } else {
                    // Pause animation when hidden
                    this.portrait_thanos.anims.pause();
                }
            }
        }
    }
    
    createBurstModeUI() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        this.burstModeUI = this.add.container(0, 0);
        this.burstModeUI.setDepth(2000); // Set high depth for entire burst mode UI
        
        // Scale factors based on canvas size (burst.js uses 1280x720 design)
        const scaleX = width / 1280;
        const scaleY = height / 720;
        const uiScale = 0.67; // Base scale from burst.js
        
        // Background - ui_burstbg
        const bg = this.add.image(641 * scaleX, 361 * scaleY, 'ui_burstbg');
        bg.setScale(0.68 * scaleX, 0.68 * scaleY);
        this.burstModeUI.add(bg);
        
        // Three background panels
        const threebg03 = this.add.image(643 * scaleX, 320 * scaleY, 'ui_threebg03_1');
        threebg03.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(threebg03);
        
        const threebg01 = this.add.image(385 * scaleX, 365 * scaleY, 'ui_threebg01');
        threebg01.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(threebg01);
        
        const threebg02 = this.add.image(904 * scaleX, 365 * scaleY, 'ui_threebg02');
        threebg02.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(threebg02);
        
        // Burst boxes for value displays
        const burstbox1 = this.add.image(386 * scaleX, 570 * scaleY, 'ui_burstbox');
        burstbox1.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(burstbox1);
        
        const burstbox2 = this.add.image(644 * scaleX, 570 * scaleY, 'ui_burstbox');
        burstbox2.setScale(0.85 * scaleX, uiScale * scaleY);
        this.burstModeUI.add(burstbox2);
        
        const burstbox3 = this.add.image(906 * scaleX, 570 * scaleY, 'ui_burstbox');
        burstbox3.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstModeUI.add(burstbox3);
        
        // Results container for scrolling text - position based on middle background panel
        this.burstResultsContainer = this.add.container(643 * scaleX - 400, 220 * scaleY);
        this.burstModeUI.add(this.burstResultsContainer);
        
        // Add a subtle background for the results area
        const resultsBg = this.add.rectangle(400, 100, 800, 200, 0x000000, 0.3);
        resultsBg.setStrokeStyle(1, 0x666666);
        this.burstResultsContainer.add(resultsBg);
        
        // Buttons
        // Single spin button
        const singleSpinBtn = this.add.image(455 * scaleX, 652 * scaleY, 'ui_burst_buttonplay');
        singleSpinBtn.setScale(uiScale * scaleX, uiScale * scaleY);
        singleSpinBtn.setInteractive({ useHandCursor: true });
        this.burstModeUI.add(singleSpinBtn);
        
        singleSpinBtn.on('pointerup', () => {
            if (!this.isSpinning) {
                window.SafeSound.play(this, 'click');
                this.burstSingleSpin();
            }
        });
        
        singleSpinBtn.on('pointerover', () => {
            singleSpinBtn.setScale(singleSpinBtn.scaleX * 1.1, singleSpinBtn.scaleY * 1.1);
            singleSpinBtn.setTint(0xFFFFFF);
        });
        
        singleSpinBtn.on('pointerout', () => {
            singleSpinBtn.setScale(singleSpinBtn.scaleX / 1.1, singleSpinBtn.scaleY / 1.1);
            singleSpinBtn.clearTint();
        });
        
        // Auto spin button - animated sprite
        this.burstAutoBtn = this.add.sprite(646 * scaleX, 652 * scaleY, 'ui_burst_buttonplayloop_sprites');
        this.burstAutoBtn.setScale(uiScale * scaleX, uiScale * scaleY);
        this.burstAutoBtn.setInteractive({ useHandCursor: true });
        this.burstModeUI.add(this.burstAutoBtn);
        
        this.burstAutoBtn.on('pointerup', () => {
            window.SafeSound.play(this, 'click');
            this.toggleBurstAutoSpin();
        });
        
        this.burstAutoBtn.on('pointerover', () => {
            if (!this.burstAutoSpinning) {
                this.burstAutoBtn.setScale(this.burstAutoBtn.scaleX * 1.1, this.burstAutoBtn.scaleY * 1.1);
            }
        });
        
        this.burstAutoBtn.on('pointerout', () => {
            if (!this.burstAutoSpinning) {
                this.burstAutoBtn.setScale(this.burstAutoBtn.scaleX / 1.1, this.burstAutoBtn.scaleY / 1.1);
            }
        });
        
        // Bet adjustment buttons
        const betMinus = this.add.image(543 * scaleX, 652 * scaleY, 'ui_number_bet-');
        betMinus.setScale(uiScale * scaleX, uiScale * scaleY);
        betMinus.setInteractive({ useHandCursor: true });
        this.burstModeUI.add(betMinus);
        
        betMinus.on('pointerup', () => {
            window.SafeSound.play(this, 'click');
            this.adjustBet(-1);
            this.updateBurstModeDisplays();
        });
        
        betMinus.on('pointerover', () => {
            betMinus.setScale(betMinus.scaleX * 1.1, betMinus.scaleY * 1.1);
            betMinus.setTint(0xFFFFFF);
        });
        
        betMinus.on('pointerout', () => {
            betMinus.setScale(betMinus.scaleX / 1.1, betMinus.scaleY / 1.1);
            betMinus.clearTint();
        });
        
        const betPlus = this.add.image(750 * scaleX, 652 * scaleY, 'ui_number_bet+');
        betPlus.setScale(uiScale * scaleX, uiScale * scaleY);
        betPlus.setInteractive({ useHandCursor: true });
        this.burstModeUI.add(betPlus);
        
        betPlus.on('pointerup', () => {
            window.SafeSound.play(this, 'click');
            this.adjustBet(1);
            this.updateBurstModeDisplays();
        });
        
        betPlus.on('pointerover', () => {
            betPlus.setScale(betPlus.scaleX * 1.1, betPlus.scaleY * 1.1);
            betPlus.setTint(0xFFFFFF);
        });
        
        betPlus.on('pointerout', () => {
            betPlus.setScale(betPlus.scaleX / 1.1, betPlus.scaleY / 1.1);
            betPlus.clearTint();
        });
        
        // Exit button
        const exitBtn = this.add.image(840 * scaleX, 652 * scaleY, 'ui_burst_buttonexit');
        exitBtn.setScale(uiScale * scaleX, uiScale * scaleY);
        exitBtn.setInteractive({ useHandCursor: true });
        this.burstModeUI.add(exitBtn);
        
        exitBtn.on('pointerup', () => {
            window.SafeSound.play(this, 'click');
            this.toggleBurstMode();
        });
        
        exitBtn.on('pointerover', () => {
            exitBtn.setScale(exitBtn.scaleX * 1.1, exitBtn.scaleY * 1.1);
            exitBtn.setTint(0xFF6666);
        });
        
        exitBtn.on('pointerout', () => {
            exitBtn.setScale(exitBtn.scaleX / 1.1, exitBtn.scaleY / 1.1);
            exitBtn.clearTint();
        });
        
        // Text labels
        const labelStyle = {
            fontSize: Math.floor(30 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Bold',
            color: '#FFFFFF'
        };
        
        const totalLabel = this.add.text(339 * scaleX, 498 * scaleY, 'TOTAL', labelStyle);
        totalLabel.setOrigin(0.5);
        this.burstModeUI.add(totalLabel);
        
        const winLabel = this.add.text(614 * scaleX, 498 * scaleY, 'WIN', labelStyle);
        winLabel.setOrigin(0.5);
        this.burstModeUI.add(winLabel);
        
        const betLabel = this.add.text(877 * scaleX, 498 * scaleY, 'BET', labelStyle);
        betLabel.setOrigin(0.5);
        this.burstModeUI.add(betLabel);
        
        // Value displays
        const valueStyle = {
            fontSize: Math.floor(36 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Black',
            color: '#FFD700'
        };
        
        // BURST MODE UI LAYOUT FIX v2: Balance LEFT (339), Win CENTER (614), Bet RIGHT (877)
        // Left position - Player Balance (gold)
        this.burstBalanceText = this.add.text(339 * scaleX, 545 * scaleY, `$${this.stateManager.gameData.balance.toFixed(2)}`, valueStyle);
        this.burstBalanceText.setOrigin(0.5);
        this.burstModeUI.add(this.burstBalanceText);
        
        // Center position - Win Amount (green)
        this.burstWinText = this.add.text(614 * scaleX, 545 * scaleY, '$0.00', {
            ...valueStyle,
            color: '#00FF00'
        });
        this.burstWinText.setOrigin(0.5);
        this.burstModeUI.add(this.burstWinText);
        
        // Right position - Bet Amount (white)
        this.burstBetText = this.add.text(877 * scaleX, 545 * scaleY, `$${this.stateManager.gameData.currentBet.toFixed(2)}`, {
            ...valueStyle,
            color: '#FFFFFF'
        });
        this.burstBetText.setOrigin(0.5);
        this.burstModeUI.add(this.burstBetText);
        
        // Title at top
        const title = this.add.text(width / 2, 50 * scaleY, 'BURST MODE', {
            fontSize: Math.floor(48 * Math.min(scaleX, scaleY)) + 'px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4
        });
        title.setOrigin(0.5);
        this.burstModeUI.add(title);
        
        // Create score light effects (initially invisible)
        this.burstScoreLights = [];
        const lightPositions = [
            { x: 339 * scaleX, y: 570 * scaleY }, // Total box
            { x: 614 * scaleX, y: 570 * scaleY }, // Win box
            { x: 877 * scaleX, y: 570 * scaleY }  // Bet box
        ];
        
        lightPositions.forEach((pos, index) => {
            const light = this.add.sprite(pos.x, pos.y, 'ui_scoreup_light_sprite');
            light.setScale(uiScale * scaleX * 1.5, uiScale * scaleY * 1.5);
            light.setAlpha(0);
            light.setBlendMode(Phaser.BlendModes.ADD);
            this.burstScoreLights.push(light);
            this.burstModeUI.add(light);
        });
    }
    

    
    async burstSingleSpin() {
        if (!this.burstModeActive) return;
        
        // Start spin button animation + light in burst mode
        const spinButton = this.uiManager && this.uiManager.getSpinButton();
        if (spinButton && this.anims.exists('animation')) {
            spinButton.play('animation');
        }
        if (this.uiManager && this.uiManager.ui_spin_light) {
            this.uiManager.ui_spin_light.setVisible(true);
            if (!this.anims.exists('light_button_light') && this.textures.exists('button_light_sprite')) {
                try {
                    this.anims.create({
                        key: 'light_button_light',
                        frames: this.anims.generateFrameNumbers('button_light_sprite', { start: 0, end: 19 }),
                        frameRate: 24,
                        repeat: -1
                    });
                } catch (_) {}
            }
            if (this.anims.exists('light_button_light')) {
                this.uiManager.ui_spin_light.play('light_button_light');
            }
        }
        
        const spinResult = await this.performBurstSpin();
        this.addBurstResult(spinResult);
        
        // Stop spin button animation + light
        if (spinButton) {
            spinButton.stop();
            spinButton.setFrame(0);
        }
        if (this.uiManager && this.uiManager.ui_spin_light) {
            this.uiManager.ui_spin_light.stop();
            this.uiManager.ui_spin_light.setVisible(false);
            this.uiManager.ui_spin_light.setFrame(0);
        }
        
        // Handle bonus notifications
        if (spinResult.bonusTriggered) {
            // Burst mode: always show simple banner without counts
            this.showMessage(`Free Spins Mode Triggered!`);
        }
        
        if (spinResult.freeSpinsEnded) {
            this.showMessage(`Free Spins Complete! Total: $${this.stateManager.freeSpinsData.totalWin.toFixed(2)}`);
        }
    }
    
    toggleBurstAutoSpin() {
        this.burstAutoSpinning = !this.burstAutoSpinning;
        
        if (this.burstAutoSpinning) {
            // Start button animation
            if (this.burstAutoBtn) {
                this.burstAutoBtn.play('ui_burst_buttonplayloop_animation');
                this.burstAutoBtn.setTint(0x00FF00); // Green tint when auto-spinning
            }
            this.startBurstAutoSpin();
        } else {
            // Stop button animation
            if (this.burstAutoBtn) {
                this.burstAutoBtn.stop();
                this.burstAutoBtn.setFrame(0);
                this.burstAutoBtn.clearTint();
            }
        }
    }
    
    async startBurstAutoSpin() {
        try {
        while (this.burstAutoSpinning && this.burstModeActive) {
            if (!this.isSpinning && (this.stateManager.canAffordBet() || this.stateManager.freeSpinsData.active)) {
                    // Start spin button animation + light for auto-spin
                    if (this.ui_spin && this.anims.exists('animation')) {
                        this.ui_spin.play('animation');
                    }
                    if (this.uiManager && this.uiManager.ui_spin_light) {
                        this.uiManager.ui_spin_light.setVisible(true);
                        if (!this.anims.exists('light_button_light') && this.textures.exists('button_light_sprite')) {
                            try {
                                this.anims.create({
                                    key: 'light_button_light',
                                    frames: this.anims.generateFrameNumbers('button_light_sprite', { start: 0, end: 19 }),
                                    frameRate: 24,
                                    repeat: -1
                                });
                            } catch (_) {}
                        }
                        if (this.anims.exists('light_button_light')) {
                            this.uiManager.ui_spin_light.play('light_button_light');
                        }
                    }
                    
                const spinResult = await this.performBurstSpin();
                this.addBurstResult(spinResult);
                    
                    // Stop spin button animation + light
                    if (this.ui_spin) {
                        this.ui_spin.stop();
                        this.ui_spin.setFrame(0);
                    }
                    if (this.uiManager && this.uiManager.ui_spin_light) {
                        this.uiManager.ui_spin_light.stop();
                        this.uiManager.ui_spin_light.setVisible(false);
                        this.uiManager.ui_spin_light.setFrame(0);
                    }
                
                // Handle bonus notifications
                if (spinResult.bonusTriggered) {
            // Burst mode demo: show simple banner without counts
            this.showMessage(`Free Spins Mode Triggered!`);
                }
                
                if (spinResult.freeSpinsEnded) {
                    this.showMessage(`Free Spins Complete! Total: $${this.stateManager.freeSpinsData.totalWin.toFixed(2)}`);
                }
                
                // Short delay between auto spins
                await this.delay(200);
            } else {
                // Stop auto spin if can't afford bet and not in free spins
                if (!this.stateManager.freeSpinsData.active) {
                    this.burstAutoSpinning = false;
                    // Reset button appearance
                        if (this.burstAutoBtn) {
                            this.burstAutoBtn.stop();
                            this.burstAutoBtn.setFrame(0);
                            this.burstAutoBtn.clearTint();
                    }
                    this.showMessage('Insufficient Balance!');
                    break;
                }
            }
            }
        } catch (error) {
            console.error('Error in burst auto spin:', error);
            this.burstAutoSpinning = false;
            if (this.burstAutoBtn) {
                this.burstAutoBtn.stop();
                this.burstAutoBtn.setFrame(0);
                this.burstAutoBtn.clearTint();
            }
            this.showMessage('Auto-spin stopped due to error');
        }
    }
    
    async performBurstSpin() {
        try {
            // Use server-authoritative spin in burst mode (same as normal spins)
            if (!window.GameAPI || !window.NetworkService) {
                throw new Error('NetworkService/GameAPI not initialized');
            }
        
        // Check if player can afford bet (unless in free spins)
        if (!this.stateManager.freeSpinsData.active && !this.stateManager.canAffordBet()) {
            return { win: 0, bet: 0, balance: this.stateManager.gameData.balance };
        }
        
        this.isSpinning = true;

            // Call the same HTTP spin endpoint as normal spins
            const betAmount = this.stateManager.gameData.currentBet;
            const result = await window.GameAPI.requestSpinViaHTTP(betAmount);
            
            if (!result || !result.success) {
                throw new Error('Burst spin failed: ' + (result?.error || 'Unknown error'));
            }

            const data = result.data;

            // Apply final server state quickly (no animations in burst mode)
            if (this.gridManager && data.finalGrid) {
                try { 
                    this.gridManager.setGrid(data.finalGrid); 
                } catch (e) {
                    console.warn('Failed to set grid:', e);
                }
            }

            // Update totals and balance from server
            this.totalWin = data.totalWin || 0;
            const serverBalance = (typeof data.balance === 'number') ? data.balance : undefined;
            if (serverBalance !== undefined && this.stateManager) {
                this.stateManager.setBalanceFromServer(serverBalance);
                if (window.WalletAPI) { 
                    window.WalletAPI.setBalance(serverBalance); 
                }
            }

            // Free spins handling from server payload
            const freeSpinsActive = !!data.freeSpinsActive;
            if (typeof data.freeSpinsCount === 'number') {
                this.stateManager.freeSpinsData.count = data.freeSpinsCount;
                this.stateManager.freeSpinsData.active = freeSpinsActive;
            }
            if (typeof data.accumulatedMultiplier === 'number' && freeSpinsActive) {
                this.stateManager.freeSpinsData.multiplierAccumulator = data.accumulatedMultiplier;
            }
        
        // Check if free spins ended
            const freeSpinsEnded = data.freeSpinsEnded || false;
            if (freeSpinsEnded && typeof data.freeSpinsTotalWin === 'number') {
                this.stateManager.freeSpinsData.totalWin = data.freeSpinsTotalWin;
            }

            // Bonus triggered flag
            const bonusTriggered = data.bonusTriggered || false;
        
        this.isSpinning = false;
        
        return {
            win: this.totalWin,
                bet: betAmount,
                balance: serverBalance || this.stateManager.gameData.balance,
                cascades: (data.cascades && data.cascades.length) || 0,
                scatters: data.scatterCount || 0,
            bonusTriggered: bonusTriggered,
            freeSpinsEnded: freeSpinsEnded,
            freeSpinsActive: this.stateManager.freeSpinsData.active,
            freeSpinsCount: this.stateManager.freeSpinsData.count,
                multiplierAccumulator: this.stateManager.freeSpinsData.multiplierAccumulator,
                freeSpinsTotalWin: data.freeSpinsTotalWin
        };
        } catch (error) {
            console.error('Error in performBurstSpin:', error);
            this.isSpinning = false;
            return {
                win: 0,
                bet: this.stateManager.gameData.currentBet,
                balance: this.stateManager.gameData.balance,
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
    
    addBurstResult(result) {
        console.log('Adding burst result:', result);
        
        // Safety check for burst results container
        if (!this.burstResultsContainer) {
            console.warn('Burst results container not found, skipping result display');
            return;
        }
        
        try {
        const resultText = this.createBurstResultText(result);
        this.burstResultsContainer.add(resultText);
        
            const containerSize = this.burstResultsContainer.list ? this.burstResultsContainer.list.length : 0;
            console.log('Burst results container now has', containerSize, 'items');
        
        // Scroll existing results up
            if (this.burstResultsContainer.list) {
        this.burstResultsContainer.list.forEach((text, index) => {
            if (index < this.burstResultsContainer.list.length - 1) {
                this.tweens.add({
                    targets: text,
                    y: text.y - 30,
                    duration: 200,
                    ease: 'Power2'
                });
            }
        });
        
        // Remove old results if too many
        if (this.burstResultsContainer.list.length > 15) {
            const oldText = this.burstResultsContainer.list[0];
            this.burstResultsContainer.remove(oldText);
            oldText.destroy();
                }
            }
        } catch (error) {
            console.error('Error adding burst result:', error);
        }
        
        // Update UI displays
        // Don't directly assign to gameData.balance, it's already updated in performBurstSpin
        this.totalWin = result.win;
        this.updateBalanceDisplay();
        this.updateWinDisplay();
        
        // Update burst mode UI displays
        this.updateBurstModeDisplays();
    }
    
    createBurstResultText(result) {
        try {
        const width = this.cameras.main.width;
        const isWin = result.win > 0;
        const color = isWin ? '#00FF00' : '#FFFFFF';
        const winMultiplier = result.bet > 0 ? (result.win / result.bet).toFixed(1) : '0.0';
        
        let resultString = '';
        
        // Show free spin status if active
            if (result.freeSpinsActive && this.stateManager.freeSpinsData) {
                const totalCount = this.stateManager.freeSpinsData.totalCount || 0;
                const currentCount = result.freeSpinsCount || 0;
                resultString += `[FREE SPIN ${totalCount - currentCount + 1}/${totalCount}] `;
        }
        
        resultString += `Spin: $${result.bet.toFixed(2)} ??`;
        
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
        
        const yPosition = (this.burstResultsContainer.list ? this.burstResultsContainer.list.length : 0) * 30;
        const text = this.add.text(0, yPosition, resultString, {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: color,
            stroke: '#000000',
            strokeThickness: 1
        });
        
        // Debug: log text creation
        console.log('Created burst text at position:', text.x, text.y, 'with text:', resultString);
        
        // Animate entrance
        text.setAlpha(0);
        this.tweens.add({
            targets: text,
            alpha: 1,
            duration: 300,
            ease: 'Power2'
        });
        
        return text;
        } catch (error) {
            console.error('Error creating burst result text:', error);
            // Return a simple fallback text
            return this.add.text(0, 0, 'Error displaying result', {
                fontSize: '16px',
                fontFamily: 'Arial',
                color: '#FF0000'
            });
        }
    }
    
    burstScreenShake(winAmount) {
        const intensity = Math.min(winAmount / 10, 20); // Scale shake with win amount
        
        // Quick double shake
        this.cameras.main.shake(200, intensity, false, (camera, progress) => {
            if (progress === 1) {
                // Second shake after first completes
                this.time.delayedCall(50, () => {
                    this.cameras.main.shake(150, intensity * 0.7);
                });
            }
        });
        
        // Show win amount popup
        this.showBurstWinPopup(winAmount);
    }
    
    showBurstWinPopup(amount) {
        // Don't show win popup if burst mode is not active (safety check)
        if (!this.burstModeActive) {
            return;
        }
        
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const winPopup = this.add.text(width / 2, height / 2 - 50, `+$${amount.toFixed(2)}`, {
            fontSize: '72px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 6
        });
        winPopup.setOrigin(0.5);
        winPopup.setDepth(2000);
        winPopup.setScale(0);
        
        // Animate popup
        this.tweens.add({
            targets: winPopup,
            scaleX: 1,
            scaleY: 1,
            duration: 300,
            ease: 'Back.out',
            onComplete: () => {
                this.time.delayedCall(800, () => {
                    this.tweens.add({
                        targets: winPopup,
                        alpha: 0,
                        y: winPopup.y - 50,
                        duration: 400,
                        onComplete: () => winPopup.destroy()
                    });
                });
            }
        });
        
        window.SafeSound.play(this, 'kaching');
    }

    addButtonHoverEffects() {
        // Add hover effects to all interactive buttons
        const interactiveElements = [
            this.ui_small_stop,
            this.ui_small_burst,
            this.ui_small_menu,
            this.ui_number_bet_minus,
            this.ui_number_bet_plus
        ];
        
        interactiveElements.forEach(element => {
            if (element) {
                element.on('pointerover', () => {
                    element.setScale(element.scaleX * 1.1, element.scaleY * 1.1);
                    element.setTint(0xFFFFFF);
                });
                
                element.on('pointerout', () => {
                    element.setScale(element.scaleX / 1.1, element.scaleY / 1.1);
                    element.clearTint();
                });
            }
        });
        
        // Special hover effect for spin button (sprite)
        if (this.ui_spin) {
            this.ui_spin.on('pointerover', () => {
                if (!this.isSpinning) {
                    this.ui_spin.setScale(this.ui_spin.scaleX * 1.1, this.ui_spin.scaleY * 1.1);
                    this.ui_spin.setTint(0xFFFFFF);
                }
            });
            
            this.ui_spin.on('pointerout', () => {
                if (!this.isSpinning) {
                    this.ui_spin.setScale(this.ui_spin.scaleX / 1.1, this.ui_spin.scaleY / 1.1);
                    this.ui_spin.clearTint();
                }
            });
        }
    }

    // Helper methods to update UI elements directly
    updateBalanceDisplay() {
        if (this.uiManager) {
            this.uiManager.updateBalanceDisplay();
        }
    }
    
    updateWinDisplay() {
        if (this.uiManager) {
            this.uiManager.updateWinDisplay();
        }
    }
    
    updateBetDisplay() {
        if (this.uiManager) {
            this.uiManager.updateBetDisplay();
        }
    }
    
    updateBurstModeDisplays() {
        if (this.burstBalanceText) {
            const oldBalance = parseFloat(this.burstBalanceText.text.replace('$', ''));
            const newBalance = this.stateManager.gameData.balance;
            this.burstBalanceText.setText(`$${newBalance.toFixed(2)}`);
            
            // Show light effect if balance changed
            if (Math.abs(oldBalance - newBalance) > 0.01 && this.burstScoreLights) {
                this.showBurstScoreLight(0); // Total box light
            }
        }
        if (this.burstWinText) {
            const oldWin = parseFloat(this.burstWinText.text.replace('$', ''));
            const newWin = this.totalWin;
            this.burstWinText.setText(`$${newWin.toFixed(2)}`);
            
            // Show light effect if win changed and is positive
            if (newWin > 0 && Math.abs(oldWin - newWin) > 0.01 && this.burstScoreLights) {
                this.showBurstScoreLight(1); // Win box light
            }
        }
        if (this.burstBetText) {
            this.burstBetText.setText(`$${this.stateManager.gameData.currentBet.toFixed(2)}`);
        }
    }
    
    showBurstScoreLight(index) {
        if (!this.burstScoreLights || !this.burstScoreLights[index]) return;
        
        const light = this.burstScoreLights[index];
        
        // Reset any existing tweens
        this.tweens.killTweensOf(light);
        
        // Play the light animation
        light.setAlpha(1);
        light.play('ui_scoreup_light_animation');
        
        // Fade out after animation
        this.time.delayedCall(500, () => {
            this.tweens.add({
                targets: light,
                alpha: 0,
                duration: 300,
                ease: 'Power2',
                onComplete: () => {
                    light.stop();
                }
            });
        });
    }
    
    updateAccumulatedMultiplierDisplay() {
        if (this.uiManager) {
            this.uiManager.updateAccumulatedMultiplierDisplay();
        }
    }
    
    setButtonsEnabled(enabled) {
        if (this.uiManager) {
            this.uiManager.setButtonsEnabled(enabled);
        }
    }
    
    setQuickSpin(enabled) {
        // Quick spin functionality - could be implemented with UI feedback
        this.quickSpinEnabled = enabled;
    }
    
    // Initialize orientation change handling for mobile devices
    initializeOrientationHandling() {
        // Only set up for mobile devices
        if (!window.deviceDetection || !window.deviceDetection.isMobileOrTablet()) {
            return;
        }
        
        console.log('?�� Initializing orientation change handling for GameScene');
        
        // Store reference to orientation manager
        this.orientationManager = window.orientationManager;
        
        // Store original pause/resume state handlers
        this.orientationPaused = false;
        this.preOrientationState = null;
        
        // Listen to global orientation events
        this.orientationChangeHandler = (event) => {
            this.handleOrientationChange(event.detail);
        };
        window.addEventListener('orientationchanged', this.orientationChangeHandler);
        
        // Listen to game pause/resume events from OrientationManager
        this.gamePauseHandler = (event) => {
            if (event.detail.reason === 'orientation') {
                this.handleOrientationPause();
            }
        };
        window.addEventListener('game:pause', this.gamePauseHandler);
        
        this.gameResumeHandler = (event) => {
            if (event.detail.reason === 'orientation') {
                this.handleOrientationResume();
            }
        };
        window.addEventListener('game:resume', this.gameResumeHandler);
        
        // Register callbacks with OrientationManager for direct integration
        if (this.orientationManager) {
            this.orientationManager.gameScene = this;
        }
        
        // Set up gesture detection for mobile devices
        this.initializeMobileGestures();
    }
    
    // Initialize mobile gesture detection
    initializeMobileGestures() {
        if (!window.gestureDetection || !window.deviceDetection || !window.deviceDetection.isMobileOrTablet()) {
            return; // Skip gesture setup on desktop
        }
        
        console.log('?�� Initializing mobile gesture detection...');
        
        // Hold gesture for auto-spin (hold spin button for 800ms)
        this.holdGestureHandler = (gesture) => {
            // Check if the hold was on the spin button
            const spinButton = this.uiManager && this.uiManager.getSpinButton();
            if (spinButton && spinButton.getBounds && gesture.element && this.isElementInButton(gesture, spinButton)) {
                this.handleHoldAutoSpin(gesture);
            }
        };
        window.gestureDetection.on('hold', this.holdGestureHandler);
        
        // Swipe gestures for future enhancements (placeholder)
        this.swipeGestureHandler = (gesture) => {
            console.log('?�� Swipe gesture detected:', gesture.direction);
            // Future: Could implement swipe-to-spin or swipe navigation
        };
        window.gestureDetection.on('swipe', this.swipeGestureHandler);
        
        console.log('?�� Mobile gesture detection initialized');
    }
    
    // Check if a gesture occurred within a button's bounds
    isElementInButton(gesture, button) {
        try {
            const bounds = button.getBounds();
            return (
                gesture.x >= bounds.x &&
                gesture.x <= bounds.x + bounds.width &&
                gesture.y >= bounds.y &&
                gesture.y <= bounds.y + bounds.height
            );
        } catch (error) {
            console.warn('?�� Error checking button bounds:', error);
            return false;
        }
    }
    
    // Handle hold gesture on spin button to start auto-spin
    handleHoldAutoSpin(gesture) {
        if (this.isSpinning || this.orientationPaused) {
            return; // Don't start auto-spin if already spinning or paused
        }
        
        console.log('?�� Hold gesture detected on spin button - starting auto-spin');
        
        // Show visual feedback
        if (this.showMessage) {
            this.showMessage('Auto-spin activated!', 1500);
        }
        
        // Start auto-spin with default count (50 spins)
        this.startAutoplay(50);
    }
    
    // Handle orientation change event
    handleOrientationChange(detail) {
        console.log(`?�� GameScene: Orientation changed from ${detail.oldOrientation} to ${detail.newOrientation}`);
        
        // Additional handling can be added here if needed
        // The actual pause/resume is handled by the OrientationManager
    }
    
    // Handle game pause due to orientation change
    handleOrientationPause() {
        if (this.orientationPaused) {
            return; // Already paused
        }
        
        console.log('?�� GameScene: Pausing game due to orientation change');
        this.orientationPaused = true;
        
        // Store current game state
        this.preOrientationState = {
            isSpinning: this.isSpinning,
            autoplayActive: this.autoplayActive,
            burstAutoSpinning: this.burstAutoSpinning,
            cascadeInProgress: this.cascadeInProgress,
            soundEnabled: this.sound && this.sound.mute === false,
            animationsInProgress: []
        };
        
        // Pause all active animations
        if (this.tweens) {
            this.tweens.pauseAll();
        }
        
        // Pause all sounds
        if (this.sound && !this.sound.mute) {
            this.sound.pauseAll();
        }
        
        // Stop auto-play if active
        if (this.autoplayActive) {
            this.wasAutoplayActive = true;
            this.stopAutoplay(false); // Don't play sound effect
        }
        
        // Stop burst mode auto-spin if active
        if (this.burstAutoSpinning) {
            this.wasBurstAutoSpinning = true;
            this.burstAutoSpinning = false;
        }
        
        // Pause cascade processing if in progress
        if (this.cascadeInProgress) {
            this.cascadePausedByOrientation = true;
        }
        
        // Disable all interactive elements
        this.setInteractiveElementsEnabled(false);
        
        // Update UI to show paused state
        if (this.uiManager) {
            // Optionally dim the screen or show a pause indicator
            this.orientationPauseOverlay = this.add.rectangle(
                this.cameras.main.width / 2,
                this.cameras.main.height / 2,
                this.cameras.main.width,
                this.cameras.main.height,
                0x000000,
                0.5
            );
            this.orientationPauseOverlay.setDepth(9999);
        }
    }
    
    // Handle game resume after orientation change
    handleOrientationResume() {
        if (!this.orientationPaused) {
            return; // Not paused by orientation
        }
        
        console.log('?�� GameScene: Resuming game after orientation change');
        this.orientationPaused = false;
        
        // Remove pause overlay
        if (this.orientationPauseOverlay) {
            this.orientationPauseOverlay.destroy();
            this.orientationPauseOverlay = null;
        }
        
        // Resume all tweens
        if (this.tweens) {
            this.tweens.resumeAll();
        }
        
        // Resume all sounds
        if (this.sound && this.preOrientationState && this.preOrientationState.soundEnabled) {
            this.sound.resumeAll();
        }
        
        // Re-enable interactive elements
        this.setInteractiveElementsEnabled(true);
        
        // Note: We don't automatically restart auto-play or burst mode
        // The player needs to manually restart these features for safety
        if (this.wasAutoplayActive) {
            console.log('?�� Auto-play was active before orientation change. Please restart it manually.');
            this.wasAutoplayActive = false;
        }
        
        if (this.wasBurstAutoSpinning) {
            console.log('?�� Burst auto-spin was active before orientation change. Please restart it manually.');
            this.wasBurstAutoSpinning = false;
        }
        
        // Resume cascade processing if it was paused
        if (this.cascadePausedByOrientation) {
            this.cascadePausedByOrientation = false;
            // Cascade will continue on next update cycle
        }
        
        // Clear stored state
        this.preOrientationState = null;
    }
    
    // Helper method to enable/disable interactive elements
    setInteractiveElementsEnabled(enabled) {
        const elements = [
            this.ui_spin,
            this.ui_number_bet_minus,
            this.ui_number_bet_plus,
            this.ui_small_menu,
            this.ui_small_burst,
            this.ui_small_stop,
            this.ui_freegame_purchase,
            this.fallbackSpinButton,
            this.fallbackMinusButton,
            this.fallbackPlusButton,
            this.fallbackMenuButton,
            this.fallbackBurstButton
        ];
        
        elements.forEach(element => {
            if (element) {
                if (enabled) {
                    element.setInteractive();
                } else {
                    element.disableInteractive();
                }
            }
        });
        
        // Also handle burst mode UI if visible
        if (this.burstModeUI && this.burstModeUI.list) {
            this.burstModeUI.list.forEach(child => {
                if (child.input) {
                    if (enabled) {
                        child.setInteractive();
                    } else {
                        child.disableInteractive();
                    }
                }
            });
        }
    }
    
    // Cleanup orientation handling on scene destroy
    cleanupOrientationHandling() {
        if (this.orientationChangeHandler) {
            window.removeEventListener('orientationchanged', this.orientationChangeHandler);
            this.orientationChangeHandler = null;
        }
        
        if (this.gamePauseHandler) {
            window.removeEventListener('game:pause', this.gamePauseHandler);
            this.gamePauseHandler = null;
        }
        
        if (this.gameResumeHandler) {
            window.removeEventListener('game:resume', this.gameResumeHandler);
            this.gameResumeHandler = null;
        }
        
        // Clean up gesture handlers
        if (window.gestureDetection && this.holdGestureHandler) {
            window.gestureDetection.off('hold', this.holdGestureHandler);
            this.holdGestureHandler = null;
        }
        
        if (window.gestureDetection && this.swipeGestureHandler) {
            window.gestureDetection.off('swipe', this.swipeGestureHandler);
            this.swipeGestureHandler = null;
        }
        
        // Clear reference in OrientationManager
        if (this.orientationManager && this.orientationManager.gameScene === this) {
            this.orientationManager.gameScene = null;
        }
    }

    
    // Cleanup method to prevent memory leaks and crashes
    destroy() {
        // Stop any ongoing tweens
        if (this.tweens) {
            this.tweens.killAll();
        }
        
        // Clear any timers
        if (this.time) {
            this.time.removeAllEvents();
        }
        
        // Remove keyboard event listeners
        if (this.keyboardListeners && this.input && this.input.keyboard) {
            this.keyboardListeners.forEach(listener => {
                this.input.keyboard.off(listener.key, listener.callback);
            });
            this.keyboardListeners = null;
        }

        if (this.networkStatusHandler) {
            window.removeEventListener('game-network-status', this.networkStatusHandler);
            this.networkStatusHandler = null;
        }

        if (this.networkStatusOverlay) {
            this.networkStatusOverlay.destroy();
            this.networkStatusOverlay = null;
            this.networkStatusText = null;
        }
        
        // Clean up orientation handling
        this.cleanupOrientationHandling();
        
        // Clean up managers in reverse order of creation
        if (this.fireEffect && this.fireEffect.destroy) {
            this.fireEffect.destroy();
        }
        
        if (this.bonusManager && this.bonusManager.destroy) {
            this.bonusManager.destroy();
        }
        
        if (this.freeSpinsManager && this.freeSpinsManager.destroy) {
            this.freeSpinsManager.destroy();
        }
        
        if (this.winPresentationManager && this.winPresentationManager.destroy) {
            this.winPresentationManager.destroy();
        }
        
        if (this.burstModeManager && this.burstModeManager.destroy) {
            this.burstModeManager.destroy();
        }
        
        if (this.uiManager && this.uiManager.destroy) {
            this.uiManager.destroy();
        }
        
        if (this.animationManager && this.animationManager.destroy) {
            this.animationManager.destroy();
        }
        
        if (this.winCalculator && this.winCalculator.destroy) {
            this.winCalculator.destroy();
        }
        
        if (this.gridManager && this.gridManager.destroy) {
            this.gridManager.destroy();
        }
        
        // Clean up error recovery system
        if (this.errorRecovery && this.errorRecovery.destroy) {
            this.errorRecovery.destroy();
            this.errorRecovery = null;
        }
        
        // Clean up connection monitor
        if (this.connectionMonitor && this.connectionMonitor.destroy) {
            this.connectionMonitor.destroy();
            this.connectionMonitor = null;
        }
        
        // Clear cascade sync references
        this.cascadeAPI = null;
        this.syncState = null;
        this.cascadeStepQueue = null;
        this.currentCascadeSession = null;
        
        // Clear debug UI references
        this.syncStatusPanel = null;
        this.syncStatusTitle = null;
        this.syncStatusLines = null;
        this.manualControlPanel = null;
        this.manualControlTitle = null;
        this.stepButton = null;
        this.playPauseButton = null;
        this.resetButton = null;
        this.toggleSyncButton = null;
        this.recoveryButton = null;
        this.debugInfoButton = null;
        this.manualStatusText = null;
        
        // Clear references to prevent memory leaks
        this.stateManager = null;
        this.animationManager = null;
        this.uiManager = null;
        this.uiElements = null;
        this.burstModeManager = null;
        this.winPresentationManager = null;
        this.freeSpinsManager = null;
        this.bonusManager = null;
        this.fireEffect = null;
        this.gridManager = null;
        this.winCalculator = null;
        
        if (window.gameScene === this) {
            window.gameScene = null;
        }
        if (window.GameAPI && typeof window.GameAPI.attachScene === 'function' && window.GameAPI.currentScene === this) {
            window.GameAPI.attachScene(null);
        }
        
        // Call parent destroy
        super.destroy();
    }
} 

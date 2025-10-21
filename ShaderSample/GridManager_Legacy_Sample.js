// GameConfig and Symbol are loaded globally

window.GridManager = class GridManager {
    constructor(scene) {
        this.scene = scene;
        this.cols = window.GameConfig.GRID_COLS;
        this.rows = window.GameConfig.GRID_ROWS;
        this.symbolSize = window.GameConfig.SYMBOL_SIZE;
        this.spacing = window.GameConfig.GRID_SPACING;
        
        // Grid array to store symbols
        this.grid = [];
        
        // Symbol pool for recycling
        this.symbolPool = [];
        
        // Grid position
        this.gridX = 0;
        this.gridY = 0;
        
        // Cascade state
        this.isCascading = false;
        this.cascadeCount = 0;
        
        // Symbol visibility state (for burst mode)
        this.symbolsVisible = true;
        
        // Enhanced Cascade Synchronization - Validation Integration
        this.validationEnabled = true;
        this.gridStateHistory = [];
        this.maxHistorySize = 10;
        this.currentStepIndex = 0;
        this.lastValidationHash = null;
        this.stepValidationData = new Map();
        this.timingValidationEnabled = true;
        this.syncAcknowledgments = new Map();
        
        // Grid validation tolerances
        this.validationConfig = {
            hashAlgorithm: 'SHA-256',
            timingToleranceMs: 1000,
            enableStepVerification: true,
            enableTimingValidation: true,
            enableSyncAcknowledgments: true,
            maxValidationRetries: 3
        };
        
        // Symbol types
        this.symbolTypes = Object.keys(window.GameConfig.SYMBOLS).filter(key => 
            key !== 'INFINITY_GLOVE' // Scatter appears separately
        );
        
        // Optional symbol provider (pure RNG-based source)
        this.symbolProvider = (typeof window !== 'undefined' && window.__symbolSource) ? window.__symbolSource : null;
        this.initializeGrid();
    }
    
    initializeGrid() {
        // Create empty grid
        for (let col = 0; col < this.cols; col++) {
            this.grid[col] = [];
            for (let row = 0; row < this.rows; row++) {
                this.grid[col][row] = null;
            }
        }
        
        // Initialize validation state
        this.initializeValidationState();
    }
    
    /**
     * Task 3.2.1: Initialize client-side grid state validation
     */
    initializeValidationState() {
        this.gridStateHistory = [];
        this.stepValidationData.clear();
        this.syncAcknowledgments.clear();
        this.currentStepIndex = 0;
        this.lastValidationHash = null;
        
        console.log('🔒 GridManager validation state initialized');
    }
    
    setPosition(x, y) {
        this.gridX = x;
        this.gridY = y;
    }
    
    getGridWidth() {
        return this.cols * (this.symbolSize + this.spacing) - this.spacing;
    }
    
    getGridHeight() {
        return this.rows * (this.symbolSize + this.spacing) - this.spacing;
    }
    
    getSymbolPosition(col, row) {
        return {
            x: this.gridX + col * (this.symbolSize + this.spacing) + this.symbolSize / 2,
            y: this.gridY + row * (this.symbolSize + this.spacing) + this.symbolSize / 2
        };
    }
    
    getSymbolScreenX(col) {
        return this.gridX + col * (this.symbolSize + this.spacing) + this.symbolSize / 2;
    }
    
    getSymbolScreenY(row) {
        return this.gridY + row * (this.symbolSize + this.spacing) + this.symbolSize / 2;
    }
    
    createSymbol(type, col, row) {
        // Map logical symbol types to their rendering texture keys for grid
        let textureKey;
        if (type === 'thanos') {
            textureKey = 'thanos_sprite';
        } else if (type === 'thanos_weapon') {
            textureKey = 'thanos_weap';
        } else if (type === 'scarlet_witch') {
            // Use the new Scarlet Witch animated grid symbol
            textureKey = this.scene.textures && this.scene.textures.exists('scarlet_witch_symbol_sprite')
                ? 'scarlet_witch_symbol_sprite'
                : 'scarlet_witch';
        } else {
            textureKey = type;
        }
        let symbol;
        
        // Try to get from pool first
        if (this.symbolPool.length > 0) {
            symbol = this.symbolPool.pop();
            // Properly reset the pooled symbol
            symbol.setTexture(textureKey);
            symbol.setVisible(this.symbolsVisible !== false);
            symbol.setActive(true);
            symbol.reset();
            
            // Clear any previous animation states
            this.scene.tweens.killTweensOf(symbol);
            if (symbol.shadowEffect) {
                this.scene.tweens.killTweensOf(symbol.shadowEffect);
            }
            if (symbol.glowEffect) {
                symbol.glowEffect.clear();
            }
        } else {
            // Create new symbol
            const pos = this.getSymbolPosition(col, row);
            symbol = new window.Symbol(this.scene, pos.x, pos.y, textureKey);
            this.scene.add.existing(symbol);
            symbol.setVisible(this.symbolsVisible !== false);
        }
        
        // Set symbol properties
        symbol.symbolType = type; // keep logical type as original (e.g., 'thanos') even if texture differs
        symbol.setGridPosition(col, row);
        // Make sure symbol and its effects render above UI panels
        if (symbol.setDepthWithEffects) {
            symbol.setDepthWithEffects(window.GameConfig.UI_DEPTHS.GRID_SYMBOL);
        }

        // If BonusManager placed a persistent overlay on this cell, ensure it stays on top
        if (this.scene && this.scene.bonusManager && this.scene.bonusManager.randomMultiplierOverlays) {
            const key = `${col},${row}`;
            const overlay = this.scene.bonusManager.randomMultiplierOverlays[key];
            if (overlay && overlay.container) {
                overlay.container.setDepth(window.GameConfig.UI_DEPTHS.MULTIPLIER_SLOT);
                overlay.container.setPosition(symbol.x, symbol.y);
            }
        }
        
        // Position symbol
        const pos = this.getSymbolPosition(col, row);
        symbol.updatePosition(pos.x, pos.y);
        
        // Add appearance animation only if symbols are visible
        if (this.symbolsVisible !== false) {
            symbol.appear();
        }
        
        return symbol;
    }
    
    fillGrid() {
        for (let col = 0; col < this.cols; col++) {
            for (let row = 0; row < this.rows; row++) {
                if (!this.grid[col][row]) {
                    const randomType = this.getRandomSymbolType();
                    const symbol = this.createSymbol(randomType, col, row);
                    this.grid[col][row] = symbol;
                }
            }
        }
    }
    
    getRandomSymbolType() {
        // Prefer injected provider if present (visual parity kept; only RNG source changes)
        if (this.symbolProvider && typeof this.symbolProvider.rollOne === 'function') {
            return this.symbolProvider.rollOne();
        }
        
        // SECURITY: Require controlled RNG - no Math.random() fallbacks allowed
        if (!window.RNG) {
            throw new Error('SECURITY: GridManager requires window.RNG to be initialized. Cannot generate symbols without controlled RNG.');
        }
        
        // Use controlled RNG instance for all random generation
        const rng = new window.RNG(); // This will use seeded RNG if available, or Math.random wrapper if unseeded
        
        // Check for scatter symbols using controlled RNG
        if (rng.chance(window.GameConfig.SCATTER_CHANCE)) return 'infinity_glove';
        
        // Generate weighted symbol using controlled RNG
        const table = window.GameConfig.SYMBOL_WEIGHTS;
        return rng.weighted(table);
    }
    
    findMatches() {
        const matches = [];
        const symbolCounts = {};
        
        // Count all symbols on the grid
        for (let col = 0; col < this.cols; col++) {
            for (let row = 0; row < this.rows; row++) {
                const symbol = this.grid[col][row];
                if (symbol && symbol.symbolType !== 'infinity_glove' && !symbol.isRandomMultiplier && symbol.symbolType !== 'random_multiplier') { // Exclude scatter and random-mult symbols
                    if (!symbolCounts[symbol.symbolType]) {
                        symbolCounts[symbol.symbolType] = [];
                    }
                    symbolCounts[symbol.symbolType].push({ col, row, symbol });
                }
            }
        }
        
        // Check which symbol types have 8+ instances
        for (const [symbolType, positions] of Object.entries(symbolCounts)) {
            if (positions.length >= window.GameConfig.MIN_MATCH_COUNT) {
                matches.push(positions);
            }
        }
        
        return matches;
    }
    
    removeMatches(matches) {
        const removedSymbols = [];
        
        // Play symbol shattering sound effect when matches are found
        if (matches.length > 0) {
            console.log(`🔊 Playing symbol shattering sound for ${matches.length} match groups`);
            window.SafeSound.play(this.scene, 'symbol_shattering');
        }
        
        for (const match of matches) {
            for (const { col, row, symbol } of match) {
                if (symbol) {
                    // Skip random multiplier placeholder tiles
                    if (symbol.isRandomMultiplier) {
                        continue;
                    }
                    removedSymbols.push(symbol);
                    this.grid[col][row] = null;
                    
                    // Stop any existing tweens on this symbol first
                    this.scene.tweens.killTweensOf(symbol);
                    
                    // Always play destruction animation for matched symbols
                    // Don't pool matched symbols to preserve destruction animations
                    symbol.destroy(true);
                }
            }
        }
        
        return removedSymbols;
    }
    
    stopAllSymbolAnimations() {
        // Stop all tweens and idle animations for all symbols on the grid
        for (let col = 0; col < this.cols; col++) {
            for (let row = 0; row < this.rows; row++) {
                const symbol = this.grid[col][row];
                if (symbol) {
                    this.scene.tweens.killTweensOf(symbol);
                    if (symbol.stopIdleAnimation) {
                        symbol.stopIdleAnimation();
                    }
                    // Remove glow effects from matched symbols
                    if (symbol.removeGlow) {
                        symbol.removeGlow();
                    }
                    // Stop multiplier pulse tweens
                    if (symbol.multiplierPulseTween) {
                        symbol.multiplierPulseTween.stop();
                        symbol.multiplierPulseTween = null;
                    }
                    // Stop tweens on multiplier text
                    if (symbol.multiplierText) {
                        this.scene.tweens.killTweensOf(symbol.multiplierText);
                    }
                }
            }
        }
    }
    
    async cascadeSymbols() {
        this.isCascading = true;
        
        // Stop all existing animations first to prevent conflicts
        this.stopAllIdleAnimations();
        this.scene.tweens.killTweensOf(this.scene.children.list.filter(child => child.symbolType));
        
        const promises = [];
        
        // For each column, drop symbols down
        for (let col = 0; col < this.cols; col++) {
            let writeRow = this.rows - 1; // Start from bottom
            
            // Collect all existing symbols in this column (from bottom to top)
            const existingSymbols = [];
            for (let row = this.rows - 1; row >= 0; row--) {
                if (this.grid[col][row]) {
                    existingSymbols.push({
                        symbol: this.grid[col][row],
                        originalRow: row
                    });
                    this.grid[col][row] = null; // Clear the grid position
                }
            }
            
            // Place symbols back from bottom up
            for (let i = 0; i < existingSymbols.length; i++) {
                const { symbol } = existingSymbols[i];
                const targetRow = writeRow - i;
                
                if (targetRow >= 0) {
                    this.grid[col][targetRow] = symbol;
                    symbol.setGridPosition(col, targetRow);
                    
                    const targetPos = this.getSymbolPosition(col, targetRow);
                    
                    // Keep any overlay container attached to special symbols aligned
                    const alignOverlay = () => {
                        if (symbol.overlayContainer) {
                            symbol.overlayContainer.setPosition(symbol.x, symbol.y);
                        }
                    };

                    // Only animate if the symbol is moving down
                    if (symbol.y < targetPos.y) {
                        const promise = new Promise(resolve => {
                            this.scene.tweens.add({
                                targets: symbol,
                                x: targetPos.x,
                                y: targetPos.y,
                                duration: window.GameConfig.CASCADE_SPEED,
                                ease: 'Bounce.out',
                                onUpdate: alignOverlay,
                                onComplete: () => { alignOverlay(); resolve(); }
                            });
                        });
                        promises.push(promise);
                    } else {
                        // Symbol is already in correct position
                        symbol.setPosition(targetPos.x, targetPos.y);
                        alignOverlay();
                    }
                }
            }
        }
        
        // Wait for all drops to complete
        await Promise.all(promises);
        
        // Fill empty spaces with new symbols
        await this.fillEmptySpaces();
        
        this.isCascading = false;
        this.cascadeCount++;
        
        // Start idle animations for all symbols after cascading is complete
        this.startAllIdleAnimations();
        
        return true;
    }
    
    startAllIdleAnimations() {
        // Start idle animations for all symbols on the grid
        for (let col = 0; col < this.cols; col++) {
            for (let row = 0; row < this.rows; row++) {
                const symbol = this.grid[col][row];
                if (symbol && symbol.startIdleAnimation) {
                    // Add a small delay to stagger the idle animations
                    // Store the delayed call reference for cleanup
                    const delayedCall = this.scene.time.delayedCall((col + row) * 100, () => {
                        if (symbol && symbol.scene && symbol.startIdleAnimation) {
                            symbol.startIdleAnimation();
                        }
                    });
                    // Store reference for potential cleanup
                    if (!symbol.delayedCalls) symbol.delayedCalls = [];
                    symbol.delayedCalls.push(delayedCall);
                }
            }
        }
    }
    
    stopAllIdleAnimations() {
        // Stop idle animations for all symbols on the grid
        for (let col = 0; col < this.cols; col++) {
            for (let row = 0; row < this.rows; row++) {
                const symbol = this.grid[col][row];
                if (symbol && symbol.stopIdleAnimation) {
                    symbol.stopIdleAnimation();
                }
            }
        }
    }
    
    async fillEmptySpaces() {
        const promises = [];
        
        // Fill from top to bottom to ensure proper cascading
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (!this.grid[col][row]) {
                    const randomType = this.getRandomSymbolType();
                    const symbol = this.createSymbol(randomType, col, row);
                    
                    // Calculate how many empty rows are above this position
                    let emptyRowsAbove = 0;
                    for (let checkRow = row - 1; checkRow >= 0; checkRow--) {
                        if (!this.grid[col][checkRow]) {
                            emptyRowsAbove++;
                        } else {
                            break;
                        }
                    }
                    
                    // Start above the grid, accounting for empty rows
                    const startY = this.gridY - this.symbolSize * (2 + emptyRowsAbove);
                    const targetPos = this.getSymbolPosition(col, row);
                    
                    symbol.setPosition(targetPos.x, startY);
                    this.grid[col][row] = symbol;
                    
                    const alignOverlay = () => {
                        if (symbol.overlayContainer) {
                            symbol.overlayContainer.setPosition(symbol.x, symbol.y);
                        }
                    };

                    const promise = new Promise(resolve => {
                        this.scene.tweens.add({
                            targets: symbol,
                            y: targetPos.y,
                            duration: window.GameConfig.CASCADE_SPEED + (emptyRowsAbove * 100),
                            ease: 'Bounce.out',
                            delay: col * 50, // Stagger by column instead of row
                            onUpdate: alignOverlay,
                            onComplete: () => { alignOverlay(); resolve(); }
                        });
                    });
                    
                    promises.push(promise);
                }
            }
        }
        
        await Promise.all(promises);
    }
    
    highlightMatches(matches) {
        for (const match of matches) {
            for (const { symbol } of match) {
                if (symbol) {
                    // Use Symbol's showMatched method
                    symbol.showMatched();
                }
            }
        }
    }
    
    checkForInfinityPower() {
        const requiredSymbols = ['space_gem', 'mind_gem', 'reality_gem', 'power_gem', 'time_gem', 'soul_gem', 'thanos'];
        const foundSymbols = new Set();
        
        for (let col = 0; col < this.cols; col++) {
            for (let row = 0; row < this.rows; row++) {
                const symbol = this.grid[col][row];
                if (symbol && requiredSymbols.includes(symbol.symbolType)) {
                    foundSymbols.add(symbol.symbolType);
                }
            }
        }
        
        return foundSymbols.size === requiredSymbols.length;
    }
    
    countScatters() {
        let count = 0;
        const scatterPositions = [];
        
        for (let col = 0; col < this.cols; col++) {
            for (let row = 0; row < this.rows; row++) {
                const symbol = this.grid[col][row];
                if (symbol && symbol.symbolType === 'infinity_glove') {
                    count++;
                    scatterPositions.push(`(${col},${row})`);
                }
            }
        }
        
        if (count > 0) {
            console.log(`Found ${count} scatter symbols at positions: ${scatterPositions.join(', ')}`);
        }
        
        return count;
    }
    
    clearGrid() {
        // Stop all animations and clear all tweens first
        this.stopAllSymbolAnimations();
        
        for (let col = 0; col < this.cols; col++) {
            for (let row = 0; row < this.rows; row++) {
                if (this.grid[col][row]) {
                    const symbol = this.grid[col][row];
                    // Stop any tweens targeting this symbol
                    this.scene.tweens.killTweensOf(symbol);
                    
                    // For clearing the grid (not removing matches), we can try to pool symbols
                    if (this.symbolPool.length < 60 && !symbol.isDestroyed) {
                        // Reset the symbol for reuse
                        symbol.setVisible(false);
                        symbol.setActive(false);
                        symbol.reset();
                        
                        // Clean up visual effects without destroying the symbol
                        if (symbol.multiplierText) {
                            symbol.multiplierText.destroy();
                            symbol.multiplierText = null;
                        }
                        if (symbol.glowEffect) {
                            symbol.glowEffect.clear();
                        }
                        if (symbol.multiplierPulseTween) {
                            symbol.multiplierPulseTween.stop();
                            symbol.multiplierPulseTween = null;
                        }
                        
                        // Add to pool for reuse
                        this.symbolPool.push(symbol);
                    } else {
                        // Pool is full or symbol should be destroyed
                        symbol.destroy();
                    }
                    this.grid[col][row] = null;
                }
            }
        }
        
        // Don't clear symbol pool here - it will be reused
        // Only clear it on destroy
    }
    
    applyMultiplierToSymbol(col, row, multiplier) {
        const symbol = this.grid[col][row];
        if (symbol) {
            // Apply multiplier to the symbol
            symbol.multiplier = multiplier;
            
            // Skip visual effects in burst mode
            if (this.scene.burstModeActive) {
                console.log(`Infinity Power applied: Symbol at (${col},${row}) now has x${multiplier} multiplier`);
                return;
            }
            
            // Stop any existing multiplier effects first to prevent accumulation
            if (symbol.multiplierPulseTween) {
                symbol.multiplierPulseTween.stop();
                symbol.multiplierPulseTween = null;
            }
            
            // Visual effect - make the symbol glow and pulse initially
            this.scene.tweens.add({
                targets: symbol,
                scaleX: 1.4,
                scaleY: 1.4,
                duration: 300,
                yoyo: true,
                repeat: 3,
                ease: 'Power2'
            });
            
            // Add persistent glowing effect
            symbol.setTint(0xFFD700); // Golden glow - stays until symbol is destroyed
            
            // Add multiplier text above the symbol
            const multText = this.scene.add.text(
                symbol.x, 
                symbol.y - 30, 
                `x${multiplier}`, 
                {
                    fontSize: '28px',
                    fontFamily: 'Arial Black',
                    color: '#FFD700',
                    stroke: '#FFFFFF',
                    strokeThickness: 4
                }
            );
            multText.setOrigin(0.5);
            multText.setScale(0);
            
            // Store reference to multiplier text on the symbol so it persists
            symbol.multiplierText = multText;
            
            // Animate multiplier text appearance
            this.scene.tweens.add({
                targets: multText,
                scaleX: 1,
                scaleY: 1,
                duration: 300,
                ease: 'Back.out'
            });
            
            // Add subtle pulsing effect to keep it visually active
            // Store reference to prevent multiple tweens
            symbol.multiplierPulseTween = this.scene.tweens.add({
                targets: [symbol, multText],
                alpha: 0.8,
                duration: 800,
                yoyo: true,
                repeat: -1, // Infinite repeat
                ease: 'Sine.easeInOut'
            });
            
            console.log(`Infinity Power applied: Symbol at (${col},${row}) now has x${multiplier} multiplier`);
        }
    }
    
    setVisible(visible) {
        // Set visibility for all symbols in the grid
        for (let col = 0; col < this.cols; col++) {
            for (let row = 0; row < this.rows; row++) {
                const symbol = this.grid[col][row];
                if (symbol) {
                    symbol.setVisible(visible);
                    // Also hide shadow effects and glow effects
                    if (symbol.shadowEffect) {
                        symbol.shadowEffect.setVisible(visible);
                    }
                    if (symbol.glowEffect) {
                        symbol.glowEffect.setVisible(visible);
                    }
                    if (symbol.multiplierText) {
                        symbol.multiplierText.setVisible(visible);
                    }
                }
            }
        }
        
        // Store the visibility state so new symbols know whether to be visible
        this.symbolsVisible = visible;
    }
    
    /**
     * Task 3.2.1: Client-side grid state validation methods
     */
    async validateGridState(expectedHash = null, stepData = null) {
        if (!this.validationEnabled) {
            return { valid: true, reason: 'validation_disabled' };
        }
        
        try {
            // Capture current grid state
            const gridState = this.captureGridState();
            
            // Generate client-side validation hash
            const clientHash = await this.generateGridStateHash(gridState, stepData);
            
            // Validate grid structure
            const structureValid = this.validateGridStructure(gridState);
            if (!structureValid.valid) {
                return structureValid;
            }
            
            // Compare with expected hash if provided
            if (expectedHash) {
                const hashMatches = clientHash === expectedHash;
                if (!hashMatches) {
                    console.warn('⚠️ Grid state hash mismatch!');
                    console.warn('Expected:', expectedHash.substring(0, 16) + '...');
                    console.warn('Client:  ', clientHash.substring(0, 16) + '...');
                    
                    return {
                        valid: false,
                        reason: 'hash_mismatch',
                        expectedHash,
                        clientHash,
                        gridState
                    };
                }
            }
            
            // Store validation result
            this.lastValidationHash = clientHash;
            
            console.log('✅ Grid state validation passed');
            return {
                valid: true,
                clientHash,
                gridState,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('❌ Grid state validation failed:', error);
            return {
                valid: false,
                reason: 'validation_error',
                error: error.message
            };
        }
    }
    
    validateGridStructure(gridState) {
        // Validate grid dimensions
        if (!gridState || !Array.isArray(gridState)) {
            return { valid: false, reason: 'invalid_grid_structure' };
        }
        
        if (gridState.length !== this.cols) {
            return { valid: false, reason: 'invalid_column_count' };
        }
        
        // Validate each column
        for (let col = 0; col < this.cols; col++) {
            if (!Array.isArray(gridState[col]) || gridState[col].length !== this.rows) {
                return { valid: false, reason: 'invalid_row_count', column: col };
            }
            
            // Validate symbol types and positions
            for (let row = 0; row < this.rows; row++) {
                const symbolType = gridState[col][row];
                if (symbolType !== null && !this.isValidSymbolType(symbolType)) {
                    return {
                        valid: false,
                        reason: 'invalid_symbol_type',
                        position: { col, row },
                        symbolType
                    };
                }
            }
        }
        
        return { valid: true };
    }
    
    isValidSymbolType(symbolType) {
        const validTypes = [
            ...Object.keys(window.GameConfig.SYMBOLS || {}),
            'infinity_glove', 'random_multiplier'
        ];
        return validTypes.includes(symbolType);
    }
    
    captureGridState() {
        const gridState = [];
        
        for (let col = 0; col < this.cols; col++) {
            gridState[col] = [];
            for (let row = 0; row < this.rows; row++) {
                const symbol = this.grid[col][row];
                gridState[col][row] = symbol ? symbol.symbolType : null;
            }
        }
        
        return gridState;
    }
    
    async generateGridStateHash(gridState, stepData = null) {
        try {
            const hashData = {
                gridState: gridState,
                timestamp: Date.now(),
                stepIndex: stepData?.stepIndex || this.currentStepIndex,
                salt: stepData?.salt || this.generateSalt()
            };
            
            const dataString = JSON.stringify(hashData, null, 0);
            const encoder = new TextEncoder();
            const data = encoder.encode(dataString);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            return hashHex;
            
        } catch (error) {
            console.error('❌ Grid state hash generation failed:', error);
            throw error;
        }
    }
    
    /**
     * Task 3.2.2: Cascade step verification methods
     */
    async verifyCascadeStep(stepData, serverStepData = null) {
        if (!this.validationConfig.enableStepVerification) {
            return { verified: true, reason: 'verification_disabled' };
        }
        
        try {
            console.log(`🔍 Verifying cascade step ${stepData.stepIndex}`);
            
            // Store step data for verification
            this.stepValidationData.set(stepData.stepIndex, {
                ...stepData,
                receivedAt: Date.now(),
                verificationAttempts: 0
            });
            
            // Verify grid state before step
            if (stepData.gridStateBefore) {
                const beforeValidation = await this.validateGridState(
                    stepData.gridStateBeforeHash,
                    { ...stepData, stepPhase: 'before' }
                );
                
                if (!beforeValidation.valid) {
                    return {
                        verified: false,
                        reason: 'grid_state_before_invalid',
                        details: beforeValidation
                    };
                }
            }
            
            // Verify matched clusters if provided
            if (stepData.matchedClusters) {
                const clusterVerification = this.verifyMatchedClusters(stepData.matchedClusters);
                if (!clusterVerification.verified) {
                    return clusterVerification;
                }
            }
            
            // Verify drop patterns if provided
            if (stepData.dropPatterns) {
                const dropVerification = this.verifyDropPatterns(stepData.dropPatterns);
                if (!dropVerification.verified) {
                    return dropVerification;
                }
            }
            
            // Verify timing data
            if (stepData.timing && this.validationConfig.enableTimingValidation) {
                const timingVerification = this.verifyStepTiming(stepData);
                if (!timingVerification.verified) {
                    return timingVerification;
                }
            }
            
            console.log(`✅ Cascade step ${stepData.stepIndex} verification passed`);
            
            return {
                verified: true,
                stepIndex: stepData.stepIndex,
                verificationHash: await this.generateStepVerificationHash(stepData),
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error(`❌ Cascade step ${stepData.stepIndex} verification failed:`, error);
            return {
                verified: false,
                reason: 'verification_error',
                error: error.message,
                stepIndex: stepData.stepIndex
            };
        }
    }
    
    verifyMatchedClusters(matchedClusters) {
        try {
            for (const cluster of matchedClusters) {
                // Verify cluster has minimum required symbols
                if (cluster.positions.length < (window.GameConfig.MIN_MATCH_COUNT || 8)) {
                    return {
                        verified: false,
                        reason: 'cluster_too_small',
                        cluster: cluster
                    };
                }
                
                // Verify all positions are connected (flood-fill validation)
                if (!this.verifyClusterConnectivity(cluster.positions)) {
                    return {
                        verified: false,
                        reason: 'cluster_not_connected',
                        cluster: cluster
                    };
                }
                
                // Verify symbol type consistency
                const symbolType = cluster.symbolType;
                for (const pos of cluster.positions) {
                    const actualSymbol = this.grid[pos.col] && this.grid[pos.col][pos.row];
                    if (!actualSymbol || actualSymbol.symbolType !== symbolType) {
                        return {
                            verified: false,
                            reason: 'symbol_type_mismatch',
                            expected: symbolType,
                            actual: actualSymbol?.symbolType,
                            position: pos
                        };
                    }
                }
            }
            
            return { verified: true };
            
        } catch (error) {
            return {
                verified: false,
                reason: 'cluster_verification_error',
                error: error.message
            };
        }
    }
    
    verifyClusterConnectivity(positions) {
        if (positions.length === 0) return false;
        
        // Create a set of position strings for quick lookup
        const posSet = new Set(positions.map(p => `${p.col},${p.row}`));
        
        // Start flood-fill from first position
        const visited = new Set();
        const queue = [positions[0]];
        
        while (queue.length > 0) {
            const current = queue.shift();
            const key = `${current.col},${current.row}`;
            
            if (visited.has(key)) continue;
            visited.add(key);
            
            // Check adjacent positions (up, down, left, right)
            const adjacent = [
                { col: current.col - 1, row: current.row },
                { col: current.col + 1, row: current.row },
                { col: current.col, row: current.row - 1 },
                { col: current.col, row: current.row + 1 }
            ];
            
            for (const adj of adjacent) {
                const adjKey = `${adj.col},${adj.row}`;
                if (posSet.has(adjKey) && !visited.has(adjKey)) {
                    queue.push(adj);
                }
            }
        }
        
        // All positions should be visited if cluster is connected
        return visited.size === positions.length;
    }
    
    verifyDropPatterns(dropPatterns) {
        try {
            for (const pattern of dropPatterns) {
                // Verify drop pattern structure
                if (!pattern.column || typeof pattern.column !== 'number') {
                    return {
                        verified: false,
                        reason: 'invalid_drop_pattern_structure',
                        pattern: pattern
                    };
                }
                
                // Verify drops are physically possible (symbols can't move up)
                if (pattern.drops) {
                    for (const drop of pattern.drops) {
                        if (drop.from && drop.to && drop.from.row > drop.to.row) {
                            return {
                                verified: false,
                                reason: 'impossible_drop_direction',
                                drop: drop
                            };
                        }
                    }
                }
            }
            
            return { verified: true };
            
        } catch (error) {
            return {
                verified: false,
                reason: 'drop_pattern_verification_error',
                error: error.message
            };
        }
    }
    
    async generateStepVerificationHash(stepData) {
        try {
            const verificationData = {
                stepIndex: stepData.stepIndex,
                gridStateBefore: stepData.gridStateBefore,
                gridStateAfter: stepData.gridStateAfter,
                matchedClusters: stepData.matchedClusters,
                dropPatterns: stepData.dropPatterns,
                timestamp: stepData.timestamp || Date.now()
            };
            
            const dataString = JSON.stringify(verificationData, null, 0);
            const encoder = new TextEncoder();
            const data = encoder.encode(dataString);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
        } catch (error) {
            console.error('❌ Step verification hash generation failed:', error);
            throw error;
        }
    }
    
    /**
     * Task 3.2.3: Timing validation integration methods
     */
    verifyStepTiming(stepData) {
        if (!this.timingValidationEnabled) {
            return { verified: true, reason: 'timing_validation_disabled' };
        }
        
        try {
            const timing = stepData.timing;
            const receivedAt = stepData.receivedAt || Date.now();
            const expectedStartTime = stepData.serverTimestamp || stepData.timestamp;
            
            // Verify timing structure
            if (!timing || typeof timing !== 'object') {
                return {
                    verified: false,
                    reason: 'invalid_timing_structure',
                    stepIndex: stepData.stepIndex
                };
            }
            
            // Verify step duration is reasonable
            if (timing.stepDuration) {
                const minDuration = 100; // 100ms minimum
                const maxDuration = 10000; // 10s maximum
                
                if (timing.stepDuration < minDuration || timing.stepDuration > maxDuration) {
                    return {
                        verified: false,
                        reason: 'unreasonable_step_duration',
                        duration: timing.stepDuration,
                        stepIndex: stepData.stepIndex
                    };
                }
            }
            
            // Verify client-server timing synchronization
            if (expectedStartTime) {
                const timingDifference = Math.abs(receivedAt - expectedStartTime);
                const tolerance = this.validationConfig.timingToleranceMs;
                
                if (timingDifference > tolerance) {
                    return {
                        verified: false,
                        reason: 'timing_desync',
                        timingDifference,
                        tolerance,
                        stepIndex: stepData.stepIndex
                    };
                }
            }
            
            // Verify phase timings are consistent
            if (timing.phases) {
                const phaseVerification = this.verifyPhaseTiming(timing.phases, timing.stepDuration);
                if (!phaseVerification.verified) {
                    return {
                        ...phaseVerification,
                        stepIndex: stepData.stepIndex
                    };
                }
            }
            
            console.log(`⏰ Step ${stepData.stepIndex} timing verification passed`);
            return {
                verified: true,
                timingDifference: expectedStartTime ? Math.abs(receivedAt - expectedStartTime) : 0,
                stepIndex: stepData.stepIndex
            };
            
        } catch (error) {
            console.error(`❌ Step ${stepData.stepIndex} timing verification failed:`, error);
            return {
                verified: false,
                reason: 'timing_verification_error',
                error: error.message,
                stepIndex: stepData.stepIndex
            };
        }
    }
    
    verifyPhaseTiming(phases, totalDuration) {
        try {
            let phaseSum = 0;
            
            for (const [phaseName, duration] of Object.entries(phases)) {
                if (typeof duration !== 'number' || duration < 0) {
                    return {
                        verified: false,
                        reason: 'invalid_phase_duration',
                        phase: phaseName,
                        duration: duration
                    };
                }
                phaseSum += duration;
            }
            
            // Allow small tolerance for rounding errors
            const tolerance = 50; // 50ms tolerance
            if (totalDuration && Math.abs(phaseSum - totalDuration) > tolerance) {
                return {
                    verified: false,
                    reason: 'phase_timing_mismatch',
                    phaseSum,
                    totalDuration,
                    difference: Math.abs(phaseSum - totalDuration)
                };
            }
            
            return { verified: true };
            
        } catch (error) {
            return {
                verified: false,
                reason: 'phase_timing_verification_error',
                error: error.message
            };
        }
    }
    
    /**
     * Task 3.2.4: Sync acknowledgment trigger methods
     */
    async triggerSyncAcknowledgment(stepData, validationResult) {
        if (!this.validationConfig.enableSyncAcknowledgments) {
            return { sent: false, reason: 'acknowledgments_disabled' };
        }
        
        try {
            const acknowledgment = {
                stepIndex: stepData.stepIndex,
                requestId: stepData.requestId,
                sessionId: stepData.sessionId,
                gridValidation: validationResult.gridValidation || null,
                stepVerification: validationResult.stepVerification || null,
                timingValidation: validationResult.timingValidation || null,
                overallValid: this.isOverallValidationSuccessful(validationResult),
                clientTimestamp: Date.now(),
                serverTimestamp: stepData.timestamp,
                gridStateHash: this.lastValidationHash,
                processingTime: Date.now() - (stepData.receivedAt || Date.now())
            };
            
            // Store acknowledgment for tracking
            this.syncAcknowledgments.set(stepData.stepIndex, acknowledgment);
            
            // Send acknowledgment via CascadeAPI if available
            if (window.cascadeAPI && typeof window.cascadeAPI.sendStepAcknowledgment === 'function') {
                await window.cascadeAPI.sendStepAcknowledgment(stepData, acknowledgment);
                console.log(`📤 Sync acknowledgment sent for step ${stepData.stepIndex}`);
            } else {
                // Fallback: send via NetworkService directly
                if (window.NetworkService && typeof window.NetworkService.emit === 'function') {
                    window.NetworkService.emit('grid_step_acknowledgment', acknowledgment);
                    console.log(`📤 Grid sync acknowledgment sent for step ${stepData.stepIndex}`);
                } else {
                    console.warn('⚠️ No communication service available for acknowledgment');
                    return { sent: false, reason: 'no_communication_service' };
                }
            }
            
            return {
                sent: true,
                acknowledgment: acknowledgment,
                stepIndex: stepData.stepIndex
            };
            
        } catch (error) {
            console.error(`❌ Failed to send sync acknowledgment for step ${stepData.stepIndex}:`, error);
            return {
                sent: false,
                reason: 'acknowledgment_error',
                error: error.message,
                stepIndex: stepData.stepIndex
            };
        }
    }
    
    isOverallValidationSuccessful(validationResult) {
        const gridValid = !validationResult.gridValidation || validationResult.gridValidation.valid;
        const stepValid = !validationResult.stepVerification || validationResult.stepVerification.verified;
        const timingValid = !validationResult.timingValidation || validationResult.timingValidation.verified;
        
        return gridValid && stepValid && timingValid;
    }
    
    async processServerCascadeStep(serverStepData) {
        try {
            console.log(`🔄 Processing server cascade step ${serverStepData.stepIndex}`);
            
            // Update current step index
            this.currentStepIndex = serverStepData.stepIndex;
            
            // Store step data with receipt timestamp
            const stepData = {
                ...serverStepData,
                receivedAt: Date.now()
            };
            
            // Perform comprehensive validation
            const validationResults = {};
            
            // Grid state validation
            if (stepData.gridStateAfter || stepData.gridStateAfterHash) {
                validationResults.gridValidation = await this.validateGridState(
                    stepData.gridStateAfterHash,
                    stepData
                );
            }
            
            // Cascade step verification
            validationResults.stepVerification = await this.verifyCascadeStep(stepData);
            
            // Timing validation
            if (stepData.timing) {
                validationResults.timingValidation = this.verifyStepTiming(stepData);
            }
            
            // Send sync acknowledgment
            const acknowledgmentResult = await this.triggerSyncAcknowledgment(stepData, validationResults);
            
            // Store validation results in history
            this.addToGridStateHistory({
                stepIndex: stepData.stepIndex,
                gridState: this.captureGridState(),
                validationResults,
                acknowledgmentResult,
                timestamp: Date.now()
            });
            
            console.log(`✅ Server cascade step ${serverStepData.stepIndex} processed successfully`);
            
            return {
                success: true,
                stepIndex: serverStepData.stepIndex,
                validationResults,
                acknowledgmentResult
            };
            
        } catch (error) {
            console.error(`❌ Failed to process server cascade step ${serverStepData.stepIndex}:`, error);
            
            // Send error acknowledgment
            try {
                await this.triggerSyncAcknowledgment(serverStepData, {
                    error: error.message,
                    processed: false
                });
            } catch (ackError) {
                console.error('❌ Failed to send error acknowledgment:', ackError);
            }
            
            return {
                success: false,
                stepIndex: serverStepData.stepIndex,
                error: error.message
            };
        }
    }
    
    addToGridStateHistory(historyEntry) {
        this.gridStateHistory.push(historyEntry);
        
        // Maintain history size limit
        if (this.gridStateHistory.length > this.maxHistorySize) {
            this.gridStateHistory.shift();
        }
    }
    
    /**
     * Public API methods for grid state management
     */
    getCurrentGrid() {
        return this.captureGridState();
    }
    
    setGrid(gridState) {
        try {
            // Validate incoming grid state
            const validation = this.validateGridStructure(gridState);
            if (!validation.valid) {
                throw new Error(`Invalid grid state: ${validation.reason}`);
            }
            
            // Clear existing grid
            this.clearGrid();
            
            // Apply new grid state
            for (let col = 0; col < this.cols; col++) {
                for (let row = 0; row < this.rows; row++) {
                    const symbolType = gridState[col][row];
                    if (symbolType) {
                        const symbol = this.createSymbol(symbolType, col, row);
                        this.grid[col][row] = symbol;
                    }
                }
            }
            
            console.log('✅ Grid state applied successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to set grid state:', error);
            return false;
        }
    }
    
    getValidationStats() {
        return {
            validationEnabled: this.validationEnabled,
            currentStepIndex: this.currentStepIndex,
            lastValidationHash: this.lastValidationHash?.substring(0, 16) + '...',
            historySize: this.gridStateHistory.length,
            pendingValidations: this.stepValidationData.size,
            syncAcknowledgments: this.syncAcknowledgments.size,
            config: this.validationConfig
        };
    }
    
    setValidationConfig(config) {
        this.validationConfig = { ...this.validationConfig, ...config };
        console.log('🔧 GridManager validation config updated:', this.validationConfig);
    }
    
    generateSalt(length = 16) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let salt = '';
        for (let i = 0; i < length; i++) {
            salt += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return salt;
    }
    
    destroy() {
        // Stop all animations and clear all tweens
        this.stopAllSymbolAnimations();
        
        // Clear the grid with proper cleanup
        for (let col = 0; col < this.cols; col++) {
            for (let row = 0; row < this.rows; row++) {
                if (this.grid[col][row]) {
                    const symbol = this.grid[col][row];
                    this.scene.tweens.killTweensOf(symbol);
                    symbol.destroy();
                    this.grid[col][row] = null;
                }
            }
        }
        
        // Clear symbol pool
        for (const symbol of this.symbolPool) {
            this.scene.tweens.killTweensOf(symbol);
            symbol.destroy();
        }
        this.symbolPool = [];
        
        // Clear validation state
        this.gridStateHistory = [];
        this.stepValidationData.clear();
        this.syncAcknowledgments.clear();
        
        // Clear any remaining references
        this.grid = null;
        this.symbolPool = null;
        this.scene = null;
    }
} 
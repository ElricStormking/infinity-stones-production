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
        
        // Symbol types
        this.symbolTypes = Object.keys(window.GameConfig.SYMBOLS).filter(key => 
            key !== 'INFINITY_GLOVE' // Scatter appears separately
        );
        
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
        let symbol;
        
        // Try to get from pool first
        if (this.symbolPool.length > 0) {
            symbol = this.symbolPool.pop();
            // Properly reset the pooled symbol
            symbol.setTexture(type);
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
            symbol = new window.Symbol(this.scene, pos.x, pos.y, type);
            this.scene.add.existing(symbol);
            symbol.setVisible(this.symbolsVisible !== false);
        }
        
        // Set symbol properties
        symbol.symbolType = type;
        symbol.setGridPosition(col, row);
        
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
        // Scatter first
        if (Math.random() < window.GameConfig.SCATTER_CHANCE) {
            return 'infinity_glove';
        }

        // Use the new weighted symbol table for 96.5% RTP
        const table = window.GameConfig.SYMBOL_WEIGHTS;
        const totalW = Object.values(table).reduce((a, b) => a + b, 0);
        let r = Math.random() * totalW;

        for (const [sym, w] of Object.entries(table)) {
            r -= w;
            if (r <= 0) {
                return sym;
            }
        }
        
        return 'time_gem'; // fallback
    }
    
    findMatches() {
        const matches = [];
        const symbolCounts = {};
        
        // Count all symbols on the grid
        for (let col = 0; col < this.cols; col++) {
            for (let row = 0; row < this.rows; row++) {
                const symbol = this.grid[col][row];
                if (symbol && symbol.symbolType !== 'infinity_glove') { // Exclude scatter symbols
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
        
        for (const match of matches) {
            for (const { col, row, symbol } of match) {
                if (symbol) {
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
                    
                    // Only animate if the symbol is moving down
                    if (symbol.y < targetPos.y) {
                        const promise = new Promise(resolve => {
                            this.scene.tweens.add({
                                targets: symbol,
                                x: targetPos.x,
                                y: targetPos.y,
                                duration: window.GameConfig.CASCADE_SPEED,
                                ease: 'Bounce.out',
                                onComplete: resolve
                            });
                        });
                        promises.push(promise);
                    } else {
                        // Symbol is already in correct position
                        symbol.setPosition(targetPos.x, targetPos.y);
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
                    
                    const promise = new Promise(resolve => {
                        this.scene.tweens.add({
                            targets: symbol,
                            y: targetPos.y,
                            duration: window.GameConfig.CASCADE_SPEED + (emptyRowsAbove * 100),
                            ease: 'Bounce.out',
                            delay: col * 50, // Stagger by column instead of row
                            onComplete: resolve
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
        
        // Clear any remaining references
        this.grid = null;
        this.symbolPool = null;
        this.scene = null;
    }
} 
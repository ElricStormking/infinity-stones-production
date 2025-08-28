/**
 * Casino-Grade Grid Generator
 * 
 * Task 4.1: Implement server-side RNG - Grid Generation Component
 * 
 * This implements symbol grid generation using:
 * - Cryptographically secure RNG from rng.js
 * - Weighted probability tables from GameConfig
 * - 96.5% RTP maintenance through proper distribution
 * - Complete audit trail for compliance
 * - Deterministic results from seeds for replay/audit
 */

const { getRNG } = require('./rng');
const SymbolDistribution = require('./symbolDistribution');

/**
 * Grid Generator for Infinity Storm Slot Game
 * 
 * Generates 6x5 symbol grids using casino-grade RNG and weighted distribution
 * to maintain the target 96.5% RTP while providing engaging gameplay.
 */
class GridGenerator {
    constructor(options = {}) {
        this.options = {
            cols: 6,
            rows: 5,
            auditLogging: true,
            validateRTP: true,
            ...options
        };
        
        // Initialize RNG and symbol distribution
        this.rng = getRNG({ auditLogging: this.options.auditLogging });
        this.symbolDistribution = new SymbolDistribution();
        
        // Grid generation statistics
        this.stats = {
            gridsGenerated: 0,
            symbolsGenerated: 0,
            seedsUsed: 0,
            lastGenerationTime: null,
            distributionStats: {}
        };
        
        this.initializeDistributionTracking();
    }
    
    /**
     * Initialize symbol distribution tracking
     * @private
     */
    initializeDistributionTracking() {
        const symbols = this.symbolDistribution.getAllSymbols();
        
        for (const symbol of symbols) {
            this.stats.distributionStats[symbol] = {
                count: 0,
                percentage: 0,
                target: this.symbolDistribution.getSymbolWeight(symbol)
            };
        }
        
        // Special tracking for scatters
        this.stats.distributionStats['infinity_glove'] = {
            count: 0,
            percentage: 0,
            target: this.symbolDistribution.getScatterChance() * 100 // Convert to percentage for tracking
        };
    }
    
    /**
     * Generate a random 6x5 grid with proper symbol distribution
     * @param {Object} options - Generation options
     * @param {string} [options.seed] - Optional seed for deterministic results
     * @param {boolean} [options.freeSpinsMode=false] - Free spins mode affects distribution
     * @param {number} [options.accumulatedMultiplier=1] - Current accumulated multiplier
     * @returns {Object} Generated grid with metadata
     */
    generateGrid(options = {}) {
        const {
            seed = null,
            freeSpinsMode = false,
            accumulatedMultiplier = 1
        } = options;
        
        const startTime = Date.now();
        const gridId = this.generateGridId();
        
        // Use seeded RNG if provided, otherwise crypto-secure random
        const rng = seed ? this.rng.createSeededRNG(seed) : (() => this.rng.random());
        
        this.rng.emit('audit_event', {
            timestamp: startTime,
            event: 'GRID_GENERATION_STARTED',
            data: {
                grid_id: gridId,
                seed_provided: !!seed,
                free_spins_mode: freeSpinsMode,
                accumulated_multiplier: accumulatedMultiplier
            }
        });
        
        // Generate the grid
        const grid = this.createEmptyGrid();
        const symbolCounts = {};
        
        for (let col = 0; col < this.options.cols; col++) {
            for (let row = 0; row < this.options.rows; row++) {
                const symbol = this.generateSymbol(rng, {
                    position: [col, row],
                    freeSpinsMode,
                    accumulatedMultiplier
                });
                
                grid[col][row] = symbol;
                
                // Track symbol generation
                symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
                this.stats.symbolsGenerated++;
                
                // Update distribution statistics
                if (this.stats.distributionStats[symbol]) {
                    this.stats.distributionStats[symbol].count++;
                }
            }
        }
        
        const endTime = Date.now();
        const generationTime = endTime - startTime;
        
        // Update statistics
        this.stats.gridsGenerated++;
        this.stats.lastGenerationTime = generationTime;
        if (seed) {
            this.stats.seedsUsed++;
        }
        
        // Calculate actual distribution percentages
        this.updateDistributionPercentages();
        
        // Validate grid integrity
        const validation = this.validateGrid(grid);
        
        // Create comprehensive grid metadata
        const gridData = {
            id: gridId,
            grid,
            metadata: {
                generation_time_ms: generationTime,
                seed_used: !!seed,
                seed_hash: seed ? this.hashSeed(seed) : null,
                free_spins_mode: freeSpinsMode,
                accumulated_multiplier: accumulatedMultiplier,
                symbol_counts: symbolCounts,
                total_symbols: this.options.cols * this.options.rows,
                generated_at: startTime,
                validation
            },
            statistics: this.getGenerationStatistics()
        };
        
        // Log the generation
        this.rng.emit('audit_event', {
            timestamp: endTime,
            event: 'GRID_GENERATED',
            data: {
                grid_id: gridId,
                generation_time_ms: generationTime,
                symbol_counts: symbolCounts,
                validation_passed: validation.isValid,
                total_grids_generated: this.stats.gridsGenerated
            }
        });
        
        // Validate RTP maintenance if enabled
        if (this.options.validateRTP && this.stats.gridsGenerated % 1000 === 0) {
            this.validateRTPMaintenance();
        }
        
        return gridData;
    }
    
    /**
     * Generate a single symbol based on weighted distribution
     * @param {Function} rng - Random number generator function
     * @param {Object} context - Generation context
     * @returns {string} Symbol ID
     * @private
     */
    generateSymbol(rng, context = {}) {
        const {
            position = [0, 0],
            freeSpinsMode = false,
            accumulatedMultiplier = 1
        } = context;
        
        // First check for scatter symbols (independent of other weights)
        if (this.shouldGenerateScatter(rng, freeSpinsMode)) {
            return 'infinity_glove';
        }
        
        // Generate regular symbol using weighted distribution
        const weights = this.symbolDistribution.getWeightedDistribution(freeSpinsMode);
        return this.selectWeightedSymbol(rng, weights);
    }
    
    /**
     * Determine if scatter symbol should be generated
     * @param {Function} rng - Random number generator
     * @param {boolean} freeSpinsMode - Free spins mode active
     * @returns {boolean} Should generate scatter
     * @private
     */
    shouldGenerateScatter(rng, freeSpinsMode) {
        const scatterChance = this.symbolDistribution.getScatterChance(freeSpinsMode);
        return rng() < scatterChance;
    }
    
    /**
     * Select symbol using weighted random selection
     * @param {Function} rng - Random number generator
     * @param {Object} weights - Symbol weights
     * @returns {string} Selected symbol
     * @private
     */
    selectWeightedSymbol(rng, weights) {
        const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
        const randomValue = rng() * totalWeight;
        let currentWeight = 0;
        
        for (const [symbol, weight] of Object.entries(weights)) {
            currentWeight += weight;
            if (randomValue <= currentWeight) {
                return symbol;
            }
        }
        
        // Fallback to most common symbol
        return 'time_gem';
    }
    
    /**
     * Create empty grid structure
     * @returns {Array<Array<string>>} Empty grid
     * @private
     */
    createEmptyGrid() {
        const grid = [];
        for (let col = 0; col < this.options.cols; col++) {
            grid[col] = new Array(this.options.rows).fill(null);
        }
        return grid;
    }
    
    /**
     * Validate generated grid integrity
     * @param {Array<Array<string>>} grid - Grid to validate
     * @returns {Object} Validation results
     * @private
     */
    validateGrid(grid) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };
        
        // Check grid dimensions
        if (grid.length !== this.options.cols) {
            validation.isValid = false;
            validation.errors.push(`Invalid column count: ${grid.length}, expected ${this.options.cols}`);
        }
        
        // Check each column
        for (let col = 0; col < grid.length; col++) {
            if (!Array.isArray(grid[col]) || grid[col].length !== this.options.rows) {
                validation.isValid = false;
                validation.errors.push(`Invalid row count in column ${col}: ${grid[col]?.length}, expected ${this.options.rows}`);
                continue;
            }
            
            // Check each cell
            for (let row = 0; row < grid[col].length; row++) {
                const symbol = grid[col][row];
                if (!this.symbolDistribution.isValidSymbol(symbol)) {
                    validation.isValid = false;
                    validation.errors.push(`Invalid symbol at [${col}, ${row}]: ${symbol}`);
                }
            }
        }
        
        return validation;
    }
    
    /**
     * Update distribution percentages based on current statistics
     * @private
     */
    updateDistributionPercentages() {
        if (this.stats.symbolsGenerated === 0) return;
        
        for (const symbol in this.stats.distributionStats) {
            this.stats.distributionStats[symbol].percentage = 
                (this.stats.distributionStats[symbol].count / this.stats.symbolsGenerated) * 100;
        }
    }
    
    /**
     * Validate that RTP is being maintained through proper distribution
     * @private
     */
    validateRTPMaintenance() {
        this.rng.emit('audit_event', {
            timestamp: Date.now(),
            event: 'RTP_VALIDATION_STARTED',
            data: {
                grids_analyzed: this.stats.gridsGenerated,
                symbols_analyzed: this.stats.symbolsGenerated
            }
        });
        
        const distributionErrors = [];
        const tolerancePercent = 2.0; // 2% tolerance
        
        // Check each symbol's distribution against target
        for (const [symbol, stats] of Object.entries(this.stats.distributionStats)) {
            const target = stats.target;
            const actual = stats.percentage;
            const tolerance = target * (tolerancePercent / 100);
            
            if (Math.abs(actual - target) > tolerance) {
                distributionErrors.push({
                    symbol,
                    target,
                    actual,
                    deviation: actual - target,
                    tolerance
                });
            }
        }
        
        const rtpValidation = {
            grids_analyzed: this.stats.gridsGenerated,
            symbols_analyzed: this.stats.symbolsGenerated,
            distribution_within_tolerance: distributionErrors.length === 0,
            errors: distributionErrors,
            tolerance_percent: tolerancePercent
        };
        
        this.rng.emit('audit_event', {
            timestamp: Date.now(),
            event: 'RTP_VALIDATION_COMPLETED',
            data: rtpValidation
        });
        
        if (distributionErrors.length > 0) {
            console.warn('RTP Distribution Warning:', distributionErrors);
        }
        
        return rtpValidation;
    }
    
    /**
     * Generate unique grid ID
     * @returns {string} Grid ID
     * @private
     */
    generateGridId() {
        return `grid_${Date.now()}_${this.rng.generateSecureBytes(4).toString('hex')}`;
    }
    
    /**
     * Hash seed for audit logging (without revealing seed)
     * @param {string} seed - Seed to hash
     * @returns {string} Hashed seed
     * @private
     */
    hashSeed(seed) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(seed).digest('hex').substring(0, 16);
    }
    
    /**
     * Get current generation statistics
     * @returns {Object} Statistics
     */
    getGenerationStatistics() {
        return {
            ...this.stats,
            distribution_stats: { ...this.stats.distributionStats }
        };
    }
    
    /**
     * Reset generation statistics
     */
    resetStatistics() {
        this.stats.gridsGenerated = 0;
        this.stats.symbolsGenerated = 0;
        this.stats.seedsUsed = 0;
        this.stats.lastGenerationTime = null;
        
        this.initializeDistributionTracking();
        
        this.rng.emit('audit_event', {
            timestamp: Date.now(),
            event: 'GRID_GENERATOR_STATS_RESET',
            data: {}
        });
    }
    
    /**
     * Generate multiple grids for testing or batch operations
     * @param {number} count - Number of grids to generate
     * @param {Object} options - Generation options
     * @returns {Array<Object>} Array of generated grids
     */
    generateMultipleGrids(count, options = {}) {
        if (count <= 0 || count > 10000) {
            throw new Error('Count must be between 1 and 10000');
        }
        
        const startTime = Date.now();
        const grids = [];
        
        this.rng.emit('audit_event', {
            timestamp: startTime,
            event: 'BATCH_GENERATION_STARTED',
            data: { count, options }
        });
        
        for (let i = 0; i < count; i++) {
            // Generate unique seed for each grid if not provided
            const gridOptions = { ...options };
            if (!options.seed) {
                gridOptions.seed = this.rng.generateSeed();
            }
            
            grids.push(this.generateGrid(gridOptions));
        }
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        this.rng.emit('audit_event', {
            timestamp: endTime,
            event: 'BATCH_GENERATION_COMPLETED',
            data: {
                count,
                total_time_ms: totalTime,
                average_time_per_grid: totalTime / count
            }
        });
        
        return grids;
    }
    
    /**
     * Export grid to different formats
     * @param {Array<Array<string>>} grid - Grid to export
     * @param {string} format - Export format ('json', 'csv', 'array')
     * @returns {*} Exported grid data
     */
    exportGrid(grid, format = 'json') {
        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(grid);
                
            case 'csv':
                return grid.map(column => column.join(',')).join('\n');
                
            case 'array':
                return grid;
                
            case 'flat':
                const flat = [];
                for (let row = 0; row < this.options.rows; row++) {
                    for (let col = 0; col < this.options.cols; col++) {
                        flat.push(grid[col][row]);
                    }
                }
                return flat;
                
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }
    
    /**
     * Import grid from different formats
     * @param {*} data - Grid data to import
     * @param {string} format - Import format ('json', 'array', 'flat')
     * @returns {Array<Array<string>>} Imported grid
     */
    importGrid(data, format = 'json') {
        let grid;
        
        switch (format.toLowerCase()) {
            case 'json':
                grid = JSON.parse(data);
                break;
                
            case 'array':
                grid = data;
                break;
                
            case 'flat':
                if (!Array.isArray(data) || data.length !== this.options.cols * this.options.rows) {
                    throw new Error(`Flat array must have exactly ${this.options.cols * this.options.rows} elements`);
                }
                
                grid = [];
                for (let col = 0; col < this.options.cols; col++) {
                    grid[col] = [];
                    for (let row = 0; row < this.options.rows; row++) {
                        grid[col][row] = data[row * this.options.cols + col];
                    }
                }
                break;
                
            default:
                throw new Error(`Unsupported import format: ${format}`);
        }
        
        // Validate imported grid
        const validation = this.validateGrid(grid);
        if (!validation.isValid) {
            throw new Error(`Invalid grid data: ${validation.errors.join(', ')}`);
        }
        
        return grid;
    }
}

module.exports = GridGenerator;
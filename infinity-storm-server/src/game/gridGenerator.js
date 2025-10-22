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

const MIN_MATCH_COUNT = 8;

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
      validateRTP: false,
      // Production defaults: do NOT force winning clusters
      minClustersPerGrid: 0,
      clusterInjection: false,
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
    const { grid, symbolCounts, metadata: cascadeMetadata } = this.generateCascadeReadyGrid(rng, {
      freeSpinsMode,
      accumulatedMultiplier
    });

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
        validation,
        cascade_metadata: cascadeMetadata
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
     * Generate a cascade-ready grid by first creating a weighted layout
     * and then enforcing strong cluster coverage using deterministic heuristics.
     * @param {Function} rng
     * @param {Object} context
     * @returns {{grid:Array<Array<string>>,symbolCounts:Object,metadata:Object}}
     */
  generateCascadeReadyGrid(rng, context = {}) {
    const grid = this.createEmptyGrid();
    const symbolCounts = {};
    const originalCounts = {};

    // Phase 1: seeded weighted fill
    for (let col = 0; col < this.options.cols; col++) {
      for (let row = 0; row < this.options.rows; row++) {
        const symbol = this.generateSymbol(rng, {
          position: [col, row],
          freeSpinsMode: context.freeSpinsMode,
          accumulatedMultiplier: context.accumulatedMultiplier
        });

        grid[col][row] = symbol;
        symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
        originalCounts[symbol] = (originalCounts[symbol] || 0) + 1;
        this.stats.symbolsGenerated++;

        if (this.stats.distributionStats[symbol]) {
          this.stats.distributionStats[symbol].count++;
        }
      }
    }

    const metadata = this.enforceCascadeClusters(grid, rng, context);

    // CRITICAL: Prevent 4+ scatters on winning grids (UI overlap fix)
    // If grid has wins, cap scatters at 3 to avoid win celebration + free spins trigger overlap
    this.enforceScatterWinConstraint(grid, rng, context);

    // Recalculate symbol counts after potential cluster injection
    const finalCounts = this.countSymbols(grid);
    this.applySymbolCountDiff(originalCounts, finalCounts);

    return { grid, symbolCounts: finalCounts, metadata };
  }

  /**
     * Ensure each grid has at least one cascade-worthy cluster by reseeding columns
     * deterministically. Prioritize low-tier symbols for first cascade, while
     * respecting scatter constraints.
     * @param {Array<Array<string>>} grid
     * @param {Function} rng
     * @param {Object} context
     * @returns {Object} cascade cluster metadata for audit
     */
  enforceCascadeClusters(grid, rng, context = {}) {
    const minClusters = this.options.clusterInjection ? (this.options.minClustersPerGrid || 1) : 0;

    const existingClusters = this.findClusters(grid);
    const clusterInfo = existingClusters.slice();

    if (!this.options.clusterInjection) {
      return {
        clusterStrategy: 'detected',
        clusters: clusterInfo,
        metadata: {
          requestedClusters: 0,
          injectedClusters: 0,
          existingClusters: clusterInfo.length
        }
      };
    }

    if (clusterInfo.length >= minClusters) {
      return {
        clusterStrategy: 'existing',
        clusters: clusterInfo,
        metadata: {
          requestedClusters: minClusters,
          injectedClusters: 0,
          existingClusters: clusterInfo.length
        }
      };
    }

    const neededClusters = Math.max(0, minClusters - existingClusters.length);

    const seedSymbols = ['time_gem', 'space_gem', 'mind_gem', 'power_gem'];
    const injectionClusters = [];

    for (let i = 0; i < neededClusters; i++) {
      const symbol = seedSymbols[i % seedSymbols.length];
      const startCol = Math.min(Math.floor(rng() * Math.max(1, this.options.cols - 1)), this.options.cols - 2);
      const maxRowStart = Math.max(0, this.options.rows - 4);
      const startRow = Math.min(Math.floor(rng() * (maxRowStart + 1)), maxRowStart);
      const positions = [];

      for (let deltaRow = 0; deltaRow < Math.min(4, this.options.rows); deltaRow++) {
        const row = startRow + deltaRow;
        if (row >= this.options.rows) {break;}
        for (let deltaCol = 0; deltaCol < Math.min(2, this.options.cols); deltaCol++) {
          const col = startCol + deltaCol;
          if (col >= this.options.cols) {continue;}
          grid[col][row] = symbol;
          positions.push({ col, row });
        }
      }

      if (positions.length >= MIN_MATCH_COUNT) {
        injectionClusters.push({ symbolType: symbol, positions });
      }
    }

    if (injectionClusters.length) {
      clusterInfo.push(...injectionClusters);
    }

    return {
      clusterStrategy: injectionClusters.length ? 'injected' : 'detected',
      clusters: clusterInfo,
      metadata: {
        requestedClusters: minClusters,
        injectedClusters: injectionClusters.length,
        existingClusters: existingClusters.length
      }
    };
  }

  /**
     * Enforce scatter-win constraint: 4+ scatters only on non-winning grids
     * This prevents UI overlap between win celebrations and free spins triggers
     * @param {Array<Array<string>>} grid - Grid to enforce constraint on
     * @param {Function} rng - Random number generator
     * @param {Object} context - Generation context
     * @private
     */
  enforceScatterWinConstraint(grid, rng, context = {}) {
    // Count scatter symbols
    const scatterPositions = [];
    for (let col = 0; col < this.options.cols; col++) {
      for (let row = 0; row < this.options.rows; row++) {
        if (grid[col][row] === 'infinity_glove') {
          scatterPositions.push({ col, row });
        }
      }
    }

    // If less than 4 scatters, no constraint needed
    if (scatterPositions.length < 4) {
      return;
    }

    // Check if grid has any winning clusters
    const winningClusters = this.findClusters(grid);
    const hasWins = winningClusters.length > 0;

    // If grid has wins AND 4+ scatters, reduce scatters to 3
    if (hasWins && scatterPositions.length >= 4) {
      const scattersToRemove = scatterPositions.length - 3;
      
      // Randomly select which scatters to replace with regular symbols
      // Shuffle scatter positions to pick randomly
      const shuffledPositions = scatterPositions.sort(() => rng() - 0.5);
      
      // Replace excess scatters with weighted regular symbols
      for (let i = 0; i < scattersToRemove; i++) {
        const pos = shuffledPositions[i];
        const weights = this.symbolDistribution.getWeightedDistribution(context.freeSpinsMode || false);
        const replacementSymbol = this.selectWeightedSymbol(rng, weights);
        grid[pos.col][pos.row] = replacementSymbol;
      }

      this.rng.emit('audit_event', {
        timestamp: Date.now(),
        event: 'SCATTER_WIN_CONSTRAINT_APPLIED',
        data: {
          original_scatter_count: scatterPositions.length,
          final_scatter_count: 3,
          scatters_replaced: scattersToRemove,
          winning_clusters: winningClusters.length,
          reason: 'prevent_ui_overlap'
        }
      });
    }
  }

  /**
     * Find connected clusters using simple flood-fill identical to winCalculator
     * @param {Array<Array<string>>} gridState
     * @returns {Array<Object>} clusters
     */
  findClusters(gridState) {
    const clusters = [];
    const visited = new Set();

    for (let col = 0; col < this.options.cols; col++) {
      for (let row = 0; row < this.options.rows; row++) {
        const key = `${col},${row}`;
        if (visited.has(key)) {continue;}
        const symbol = gridState[col][row];
        if (!symbol || symbol === 'infinity_glove') {continue;}

        const cluster = this.floodFillCluster(gridState, col, row, symbol, visited);
        if (cluster.length >= MIN_MATCH_COUNT) {
          clusters.push({ symbolType: symbol, positions: cluster });
        }
      }
    }

    return clusters;
  }

  floodFillCluster(gridState, startCol, startRow, symbolType, visited) {
    const queue = [{ col: startCol, row: startRow }];
    const cluster = [];

    while (queue.length) {
      const { col, row } = queue.shift();
      const key = `${col},${row}`;
      if (visited.has(key)) {continue;}
      if (col < 0 || col >= this.options.cols || row < 0 || row >= this.options.rows) {
        continue;
      }
      if (gridState[col][row] !== symbolType) {continue;}

      visited.add(key);
      cluster.push({ col, row });

      queue.push(
        { col: col - 1, row },
        { col: col + 1, row },
        { col, row: row - 1 },
        { col, row: row + 1 }
      );
    }

    return cluster;
  }

  countSymbols(gridState) {
    const counts = {};
    for (let col = 0; col < this.options.cols; col++) {
      for (let row = 0; row < this.options.rows; row++) {
        const symbol = gridState[col][row];
        counts[symbol] = (counts[symbol] || 0) + 1;
      }
    }
    return counts;
  }

  applySymbolCountDiff(originalCounts, finalCounts) {
    for (const [symbol, finalCount] of Object.entries(finalCounts)) {
      const originalCount = originalCounts[symbol] || 0;
      const diff = finalCount - originalCount;
      if (diff !== 0 && this.stats.distributionStats[symbol]) {
        this.stats.distributionStats[symbol].count += diff;
      }
    }
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
    if (this.stats.symbolsGenerated === 0) {return;}

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
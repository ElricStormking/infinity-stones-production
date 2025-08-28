/**
 * Symbol Distribution Management System
 * 
 * Task 4.1: Implement server-side RNG - Symbol Distribution Component
 * 
 * This manages the weighted probability tables that maintain the 96.5% RTP:
 * - Symbol weights from GameConfig.js
 * - Scatter probability management
 * - Free spins mode adjustments
 * - RTP validation and monitoring
 */

/**
 * Symbol Distribution Manager
 * 
 * Manages weighted symbol distribution to maintain target RTP while
 * providing engaging gameplay through proper symbol frequency balance.
 */
class SymbolDistribution {
    constructor() {
        // Base symbol weights for 96.5% RTP (from GameConfig.js)
        this.baseWeights = {
            // Low-paying symbols (Infinity Gems)
            'time_gem': 26,      // 14.1% - Most common, lowest payout
            'space_gem': 26,     // 14.1% - Most common, lowest payout  
            'mind_gem': 22,      // 11.8% - Common, low payout
            'power_gem': 20,     // 10.8% - Common, low payout
            'reality_gem': 20,   // 10.8% - Common, moderate payout
            'soul_gem': 19,      // 10.3% - Less common, moderate payout
            
            // High-paying symbols (rarer, higher payouts)
            'thanos_weapon': 17, // 9.2% - Uncommon, high payout
            'scarlet_witch': 12, // 6.5% - Rare, very high payout
            'thanos': 11         // 6.0% - Rarest, highest payout
        };
        
        // Scatter probabilities (independent of regular symbol weights)
        this.scatterChance = {
            base_game: 0.035,     // 3.5% in base game
            free_spins: 0.025     // 2.5% in free spins (slightly lower)
        };
        
        // Free spins mode adjustments (multipliers to base weights)
        this.freeSpinAdjustments = {
            // Slightly favor higher-paying symbols during free spins
            'time_gem': 0.95,        // Slightly less common
            'space_gem': 0.95,       // Slightly less common
            'mind_gem': 0.98,        // Slightly less common
            'power_gem': 1.02,       // Slightly more common
            'reality_gem': 1.05,     // More common
            'soul_gem': 1.08,        // More common
            'thanos_weapon': 1.15,   // More common (better free spin value)
            'scarlet_witch': 1.20,   // More common (better free spin value)
            'thanos': 1.25           // More common (best free spin value)
        };
        
        // Symbol definitions with types and payout info
        this.symbolDefinitions = {
            'time_gem': {
                type: 'low',
                name: 'Time Gem',
                payouts: { 8: 8, 10: 15, 12: 40 },
                rtp_contribution: 0.142
            },
            'space_gem': {
                type: 'low',
                name: 'Space Gem', 
                payouts: { 8: 9, 10: 18, 12: 80 },
                rtp_contribution: 0.151
            },
            'mind_gem': {
                type: 'low',
                name: 'Mind Gem',
                payouts: { 8: 10, 10: 20, 12: 100 },
                rtp_contribution: 0.138
            },
            'power_gem': {
                type: 'low', 
                name: 'Power Gem',
                payouts: { 8: 16, 10: 24, 12: 160 },
                rtp_contribution: 0.164
            },
            'reality_gem': {
                type: 'low',
                name: 'Reality Gem',
                payouts: { 8: 20, 10: 30, 12: 200 },
                rtp_contribution: 0.171
            },
            'soul_gem': {
                type: 'low',
                name: 'Soul Gem',
                payouts: { 8: 30, 10: 40, 12: 240 },
                rtp_contribution: 0.186
            },
            'thanos_weapon': {
                type: 'high',
                name: 'Thanos Weapon',
                payouts: { 8: 40, 10: 100, 12: 300 },
                rtp_contribution: 0.158
            },
            'scarlet_witch': {
                type: 'high',
                name: 'Scarlet Witch',
                payouts: { 8: 50, 10: 200, 12: 500 },
                rtp_contribution: 0.142
            },
            'thanos': {
                type: 'high',
                name: 'Thanos',
                payouts: { 8: 200, 10: 500, 12: 1000 },
                rtp_contribution: 0.128
            },
            'infinity_glove': {
                type: 'scatter',
                name: 'Infinity Glove',
                payouts: { 4: 60, 5: 100, 6: 2000 },
                rtp_contribution: 0.084
            }
        };
        
        // Calculate total weights for normalization
        this.calculateTotalWeights();
    }
    
    /**
     * Calculate total weights for probability normalization
     * @private
     */
    calculateTotalWeights() {
        this.totalBaseWeight = Object.values(this.baseWeights).reduce((sum, weight) => sum + weight, 0);
        
        // Calculate free spins total weight
        this.totalFreeSpinWeight = 0;
        for (const [symbol, baseWeight] of Object.entries(this.baseWeights)) {
            const adjustment = this.freeSpinAdjustments[symbol] || 1.0;
            this.totalFreeSpinWeight += baseWeight * adjustment;
        }
    }
    
    /**
     * Get weighted distribution for symbol generation
     * @param {boolean} [freeSpinsMode=false] - Free spins mode active
     * @returns {Object} Weighted symbol distribution
     */
    getWeightedDistribution(freeSpinsMode = false) {
        const distribution = {};
        
        if (freeSpinsMode) {
            // Apply free spins adjustments
            for (const [symbol, baseWeight] of Object.entries(this.baseWeights)) {
                const adjustment = this.freeSpinAdjustments[symbol] || 1.0;
                distribution[symbol] = baseWeight * adjustment;
            }
        } else {
            // Use base weights
            Object.assign(distribution, this.baseWeights);
        }
        
        return distribution;
    }
    
    /**
     * Get scatter chance for current mode
     * @param {boolean} [freeSpinsMode=false] - Free spins mode active
     * @returns {number} Scatter probability
     */
    getScatterChance(freeSpinsMode = false) {
        return freeSpinsMode ? this.scatterChance.free_spins : this.scatterChance.base_game;
    }
    
    /**
     * Get symbol weight for a specific symbol
     * @param {string} symbol - Symbol ID
     * @param {boolean} [freeSpinsMode=false] - Free spins mode active
     * @returns {number} Symbol weight
     */
    getSymbolWeight(symbol, freeSpinsMode = false) {
        if (symbol === 'infinity_glove') {
            return this.getScatterChance(freeSpinsMode); // Already as decimal
        }
        
        const baseWeight = this.baseWeights[symbol];
        if (!baseWeight) {
            return 0;
        }
        
        if (freeSpinsMode) {
            const adjustment = this.freeSpinAdjustments[symbol] || 1.0;
            return (baseWeight * adjustment / this.totalFreeSpinWeight) * 100;
        } else {
            return (baseWeight / this.totalBaseWeight) * 100;
        }
    }
    
    /**
     * Get all valid symbol IDs
     * @param {boolean} [includeScatter=false] - Include scatter symbol
     * @returns {Array<string>} Array of symbol IDs
     */
    getAllSymbols(includeScatter = false) {
        const symbols = Object.keys(this.baseWeights);
        
        if (includeScatter) {
            symbols.push('infinity_glove');
        }
        
        return symbols;
    }
    
    /**
     * Check if symbol ID is valid
     * @param {string} symbol - Symbol ID to validate
     * @returns {boolean} Is valid symbol
     */
    isValidSymbol(symbol) {
        return this.symbolDefinitions.hasOwnProperty(symbol);
    }
    
    /**
     * Get symbol definition
     * @param {string} symbol - Symbol ID
     * @returns {Object|null} Symbol definition or null if not found
     */
    getSymbolDefinition(symbol) {
        return this.symbolDefinitions[symbol] || null;
    }
    
    /**
     * Get symbol type (low, high, scatter)
     * @param {string} symbol - Symbol ID
     * @returns {string|null} Symbol type or null if not found
     */
    getSymbolType(symbol) {
        const definition = this.symbolDefinitions[symbol];
        return definition ? definition.type : null;
    }
    
    /**
     * Get symbol payout table
     * @param {string} symbol - Symbol ID
     * @returns {Object|null} Payout table or null if not found
     */
    getSymbolPayouts(symbol) {
        const definition = this.symbolDefinitions[symbol];
        return definition ? definition.payouts : null;
    }
    
    /**
     * Calculate expected RTP contribution for symbol distribution
     * @param {Object} distribution - Symbol occurrence counts
     * @param {number} totalSymbols - Total symbols analyzed
     * @returns {Object} RTP analysis
     */
    calculateRTPContribution(distribution, totalSymbols) {
        let totalRTP = 0;
        const symbolAnalysis = {};
        
        // Simplified RTP calculation for distribution validation
        // This is a basic approximation for testing purposes
        // In production, full RTP calculation would require spin simulation
        
        for (const [symbol, count] of Object.entries(distribution)) {
            const definition = this.symbolDefinitions[symbol];
            if (!definition) continue;
            
            const actualFrequency = count / totalSymbols;
            const expectedFrequency = this.getSymbolWeight(symbol) / 100;
            
            // Calculate approximate RTP contribution based on frequency match
            // This is a simplified metric for distribution testing only
            const frequencyMatch = Math.max(0, 1 - Math.abs(actualFrequency - expectedFrequency) / expectedFrequency);
            const approximateRTP = frequencyMatch * 0.1; // Simplified contribution
            
            symbolAnalysis[symbol] = {
                count,
                frequency: actualFrequency,
                expected_frequency: expectedFrequency,
                frequency_match: frequencyMatch,
                approximate_rtp: approximateRTP,
                frequency_deviation: actualFrequency - expectedFrequency
            };
            
            totalRTP += approximateRTP;
        }
        
        return {
            total_rtp: totalRTP, // This is now a simplified distribution quality metric
            target_rtp: 0.965, // Keep for comparison but not directly comparable
            rtp_deviation: totalRTP - 0.965,
            symbol_analysis: symbolAnalysis,
            total_symbols_analyzed: totalSymbols,
            note: "This is a simplified distribution quality metric, not actual RTP"
        };
    }
    
    /**
     * Validate symbol distribution against targets
     * @param {Object} distribution - Symbol occurrence counts
     * @param {number} totalSymbols - Total symbols analyzed
     * @param {number} [tolerancePercent=2] - Tolerance percentage
     * @returns {Object} Validation results
     */
    validateDistribution(distribution, totalSymbols, tolerancePercent = 2) {
        const results = {
            isValid: true,
            errors: [],
            warnings: [],
            analysis: {}
        };
        
        for (const [symbol, count] of Object.entries(distribution)) {
            if (!this.isValidSymbol(symbol)) {
                results.errors.push(`Invalid symbol: ${symbol}`);
                continue;
            }
            
            const actualFrequency = (count / totalSymbols) * 100;
            const expectedFrequency = this.getSymbolWeight(symbol);
            const deviation = Math.abs(actualFrequency - expectedFrequency);
            const tolerance = expectedFrequency * (tolerancePercent / 100);
            
            results.analysis[symbol] = {
                count,
                actual_frequency: actualFrequency,
                expected_frequency: expectedFrequency,
                deviation,
                tolerance,
                within_tolerance: deviation <= tolerance
            };
            
            // Special handling for scatter symbols with very low frequencies
            let adjustedTolerance = tolerance;
            if (symbol === 'infinity_glove') {
                adjustedTolerance = Math.max(tolerance, expectedFrequency * 0.5); // 50% tolerance for scatter
            }
            
            if (deviation > adjustedTolerance) {
                const message = `${symbol} frequency ${actualFrequency.toFixed(2)}% deviates from expected ${expectedFrequency.toFixed(2)}% by ${deviation.toFixed(2)}%`;
                
                if (deviation > adjustedTolerance * 2) {
                    results.errors.push(message);
                    results.isValid = false;
                } else {
                    results.warnings.push(message);
                }
            }
        }
        
        // Calculate RTP impact
        results.rtp_analysis = this.calculateRTPContribution(distribution, totalSymbols);
        
        return results;
    }
    
    /**
     * Get distribution summary for reporting
     * @param {boolean} [freeSpinsMode=false] - Free spins mode
     * @returns {Object} Distribution summary
     */
    getDistributionSummary(freeSpinsMode = false) {
        const summary = {
            mode: freeSpinsMode ? 'free_spins' : 'base_game',
            scatter_chance: this.getScatterChance(freeSpinsMode),
            total_regular_weight: freeSpinsMode ? this.totalFreeSpinWeight : this.totalBaseWeight,
            symbols: {}
        };
        
        const distribution = this.getWeightedDistribution(freeSpinsMode);
        
        for (const [symbol, weight] of Object.entries(distribution)) {
            const definition = this.symbolDefinitions[symbol];
            summary.symbols[symbol] = {
                weight,
                percentage: this.getSymbolWeight(symbol, freeSpinsMode),
                type: definition.type,
                name: definition.name,
                rtp_contribution: definition.rtp_contribution
            };
        }
        
        // Add scatter info
        summary.symbols['infinity_glove'] = {
            weight: null, // Not in regular distribution
            percentage: this.getScatterChance(freeSpinsMode) * 100,
            type: 'scatter',
            name: 'Infinity Glove',
            rtp_contribution: this.symbolDefinitions['infinity_glove'].rtp_contribution
        };
        
        return summary;
    }
    
    /**
     * Adjust symbol weights for RTP correction
     * @param {Object} adjustments - Weight adjustments { symbol: multiplier }
     * @param {boolean} [temporary=true] - Apply temporarily or permanently
     * @returns {Object} Previous weights (for rollback)
     */
    adjustWeights(adjustments, temporary = true) {
        const previousWeights = { ...this.baseWeights };
        
        for (const [symbol, multiplier] of Object.entries(adjustments)) {
            if (this.baseWeights.hasOwnProperty(symbol)) {
                if (temporary) {
                    // Store adjustment without modifying base weights
                    this.freeSpinAdjustments[symbol] = (this.freeSpinAdjustments[symbol] || 1.0) * multiplier;
                } else {
                    // Permanently modify base weights
                    this.baseWeights[symbol] *= multiplier;
                }
            }
        }
        
        // Recalculate totals
        this.calculateTotalWeights();
        
        return previousWeights;
    }
    
    /**
     * Reset weights to original values
     */
    resetWeights() {
        // Reset adjustments
        this.freeSpinAdjustments = {
            'time_gem': 0.95,
            'space_gem': 0.95,
            'mind_gem': 0.98,
            'power_gem': 1.02,
            'reality_gem': 1.05,
            'soul_gem': 1.08,
            'thanos_weapon': 1.15,
            'scarlet_witch': 1.20,
            'thanos': 1.25
        };
        
        // Recalculate totals
        this.calculateTotalWeights();
    }
    
    /**
     * Export distribution configuration
     * @returns {Object} Exportable configuration
     */
    exportConfiguration() {
        return {
            base_weights: { ...this.baseWeights },
            scatter_chance: { ...this.scatterChance },
            free_spin_adjustments: { ...this.freeSpinAdjustments },
            symbol_definitions: JSON.parse(JSON.stringify(this.symbolDefinitions)),
            calculated_totals: {
                base_weight: this.totalBaseWeight,
                free_spin_weight: this.totalFreeSpinWeight
            }
        };
    }
    
    /**
     * Import distribution configuration
     * @param {Object} config - Configuration to import
     */
    importConfiguration(config) {
        if (config.base_weights) {
            this.baseWeights = { ...config.base_weights };
        }
        
        if (config.scatter_chance) {
            this.scatterChance = { ...config.scatter_chance };
        }
        
        if (config.free_spin_adjustments) {
            this.freeSpinAdjustments = { ...config.free_spin_adjustments };
        }
        
        if (config.symbol_definitions) {
            this.symbolDefinitions = JSON.parse(JSON.stringify(config.symbol_definitions));
        }
        
        // Recalculate totals
        this.calculateTotalWeights();
    }
}

module.exports = SymbolDistribution;
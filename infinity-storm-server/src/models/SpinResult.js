/**
 * SpinResult.js - Sequelize Model for Spin Results Table
 *
 * Comprehensive spin result tracking with complete audit trail,
 * replay data storage, and RNG validation for casino compliance.
 *
 * Features:
 * - Complete spin result data with cascade information
 * - RNG seed storage for reproducibility and auditing
 * - JSON storage for flexible cascade and grid data
 * - Win calculation tracking with multipliers
 * - Betting validation and constraints
 * - Comprehensive indexing for performance
 * - Replay data for debugging and compliance
 */

const { DataTypes, Model } = require('sequelize');
const crypto = require('crypto');

class SpinResult extends Model {
  /**
     * Initialize the SpinResult model with database connection
     */
  static init(sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'Unique spin result identifier'
      },

      player_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'players',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'Reference to player who performed this spin'
      },

      session_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'sessions',
          key: 'id'
        },
        onDelete: 'SET NULL',
        comment: 'Reference to session when spin was performed'
      },

      spin_number: {
        type: DataTypes.BIGINT,
        allowNull: false,
        autoIncrement: true,
        comment: 'Sequential spin number for this player'
      },

      bet_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: {
            args: [0.40],
            msg: 'Minimum bet amount is $0.40'
          },
          max: {
            args: [2000.00],
            msg: 'Maximum bet amount is $2000.00'
          },
          isDecimal: {
            msg: 'Bet amount must be a valid decimal number'
          }
        },
        get() {
          const value = this.getDataValue('bet_amount');
          return value ? parseFloat(value) : 0;
        },
        comment: 'Amount bet on this spin'
      },

      initial_grid: {
        type: DataTypes.JSONB,
        allowNull: false,
        validate: {
          isValidGrid(value) {
            if (!Array.isArray(value)) {
              throw new Error('Initial grid must be an array');
            }
            if (value.length !== 6) {
              throw new Error('Initial grid must have 6 columns');
            }
            for (const column of value) {
              if (!Array.isArray(column) || column.length !== 5) {
                throw new Error('Each column must have 5 rows');
              }
            }
          }
        },
        comment: 'Initial 6x5 grid state before any cascades'
      },

      cascades: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        validate: {
          isValidCascades(value) {
            if (!Array.isArray(value)) {
              throw new Error('Cascades must be an array');
            }
            // Validate each cascade step structure
            for (const cascade of value) {
              if (typeof cascade !== 'object' || !cascade.grid || !cascade.winning_clusters) {
                throw new Error('Invalid cascade step structure');
              }
            }
          }
        },
        comment: 'Array of cascade steps with grid states and win information'
      },

      total_win: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00,
        validate: {
          min: {
            args: [0],
            msg: 'Total win cannot be negative'
          },
          isDecimal: {
            msg: 'Total win must be a valid decimal number'
          }
        },
        get() {
          const value = this.getDataValue('total_win');
          return value ? parseFloat(value) : 0;
        },
        comment: 'Total amount won from this spin (after all cascades and multipliers)'
      },

      multipliers_applied: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null,
        comment: 'Array of multipliers applied during this spin'
      },

      rng_seed: {
        type: DataTypes.STRING(64),
        allowNull: false,
        validate: {
          len: {
            args: [32, 64],
            msg: 'RNG seed must be between 32 and 64 characters'
          },
          isAlphanumeric: {
            msg: 'RNG seed must be alphanumeric'
          }
        },
        comment: 'Cryptographic seed used for this spin (for reproducibility and auditing)'
      },

      game_mode: {
        type: DataTypes.ENUM('base', 'free_spins', 'bonus'),
        allowNull: false,
        defaultValue: 'base',
        validate: {
          isIn: {
            args: [['base', 'free_spins', 'bonus']],
            msg: 'Game mode must be base, free_spins, or bonus'
          }
        },
        comment: 'Game mode when spin was performed'
      }
    }, {
      sequelize,
      modelName: 'SpinResult',
      tableName: 'spin_results',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false, // Spin results are immutable once created

      indexes: [
        {
          fields: ['player_id', 'created_at'],
          name: 'idx_spin_results_player_time'
        },
        {
          fields: ['session_id'],
          name: 'idx_spin_results_session'
        },
        {
          fields: ['created_at'],
          name: 'idx_spin_results_time'
        },
        {
          fields: ['player_id', 'created_at', 'id'],
          name: 'idx_spin_results_pagination'
        },
        {
          unique: true,
          fields: ['rng_seed'],
          name: 'idx_spin_results_rng_seed'
        },
        {
          fields: ['bet_amount'],
          name: 'idx_spin_results_bet_amount'
        },
        {
          unique: true,
          fields: ['player_id', 'spin_number'],
          name: 'idx_unique_spin_number_per_player'
        },
        {
          fields: ['game_mode'],
          name: 'idx_spin_results_game_mode'
        },
        {
          fields: ['total_win'],
          where: {
            total_win: {
              [sequelize.Sequelize.Op.gt]: 0
            }
          },
          name: 'idx_spin_results_wins'
        }
      ],

      hooks: {
        beforeCreate: (spinResult) => {
          // Generate RNG seed if not provided
          if (!spinResult.rng_seed) {
            spinResult.rng_seed = SpinResult.generateRNGSeed(spinResult.player_id);
          }

          // Validate bet amount constraints
          if (spinResult.bet_amount < 0.40 || spinResult.bet_amount > 2000) {
            throw new Error('Bet amount must be between $0.40 and $2000.00');
          }
        },

        afterCreate: (spinResult) => {
          // Log significant wins
          const netWin = spinResult.total_win - spinResult.bet_amount;
          if (netWin >= spinResult.bet_amount * 10) { // 10x bet or more
            console.log(`Big win: Player ${spinResult.player_id} won ${spinResult.total_win} on ${spinResult.bet_amount} bet (${(netWin / spinResult.bet_amount).toFixed(2)}x)`);
          }
        }
      },

      scopes: {
        wins: {
          where: {
            total_win: {
              [sequelize.Sequelize.Op.gt]: sequelize.col('bet_amount')
            }
          }
        },

        bigWins: (multiplier = 10) => ({
          where: {
            total_win: {
              [sequelize.Sequelize.Op.gte]: sequelize.literal(`bet_amount * ${multiplier}`)
            }
          }
        }),

        freeSpins: {
          where: {
            game_mode: 'free_spins'
          }
        },

        baseGame: {
          where: {
            game_mode: 'base'
          }
        },

        recent: (hours = 24) => ({
          where: {
            created_at: {
              [sequelize.Sequelize.Op.gte]: new Date(Date.now() - (hours * 60 * 60 * 1000))
            }
          }
        }),

        forPlayer: (playerId) => ({
          where: {
            player_id: playerId
          }
        }),

        byBetRange: (minBet, maxBet) => ({
          where: {
            bet_amount: {
              [sequelize.Sequelize.Op.between]: [minBet, maxBet]
            }
          }
        })
      }
    });
  }

  /**
     * Define associations with other models
     */
  static associate(models) {
    // SpinResult belongs to a player
    SpinResult.belongsTo(models.Player, {
      foreignKey: 'player_id',
      as: 'player',
      onDelete: 'CASCADE'
    });

    // SpinResult belongs to a session (optional)
    SpinResult.belongsTo(models.Session, {
      foreignKey: 'session_id',
      as: 'session',
      onDelete: 'SET NULL'
    });

    // SpinResult has many transactions (bet and win)
    SpinResult.hasMany(models.Transaction, {
      foreignKey: 'reference_id',
      as: 'transactions',
      scope: {
        reference_type: 'spin_result'
      }
    });

    // SpinResult has many jackpot contributions
    SpinResult.hasMany(models.JackpotContribution, {
      foreignKey: 'spin_id',
      as: 'jackpotContributions'
    });
  }

  /**
     * Instance Methods
     */

  /**
     * Check if this spin resulted in a win
     * @returns {boolean} True if total win is greater than bet amount
     */
  isWin() {
    return this.total_win > this.bet_amount;
  }

  /**
     * Calculate net result (win minus bet)
     * @returns {number} Net result (positive for wins, negative for losses)
     */
  getNetResult() {
    return this.total_win - this.bet_amount;
  }

  /**
     * Calculate win multiplier (total win / bet amount)
     * @returns {number} Win multiplier
     */
  getWinMultiplier() {
    if (this.bet_amount === 0) {return 0;}
    return this.total_win / this.bet_amount;
  }

  /**
     * Check if this is a big win (10x bet or more)
     * @param {number} threshold - Multiplier threshold (default 10)
     * @returns {boolean} True if win is above threshold
     */
  isBigWin(threshold = 10) {
    return this.getWinMultiplier() >= threshold;
  }

  /**
     * Get number of cascade steps
     * @returns {number} Number of cascades
     */
  getCascadeCount() {
    return Array.isArray(this.cascades) ? this.cascades.length : 0;
  }

  /**
     * Get final grid state after all cascades
     * @returns {Array} Final grid state
     */
  getFinalGrid() {
    if (this.getCascadeCount() === 0) {
      return this.initial_grid;
    }

    const lastCascade = this.cascades[this.cascades.length - 1];
    return lastCascade.grid || this.initial_grid;
  }

  /**
     * Check if free spins were triggered
     * @returns {boolean} True if free spins were triggered
     */
  triggeredFreeSpins() {
    // Check if any cascade triggered free spins (4+ scatter symbols)
    for (const cascade of this.cascades || []) {
      if (cascade.free_spins_triggered) {
        return true;
      }
    }
    return false;
  }

  /**
     * Get total symbols that were part of winning clusters
     * @returns {number} Count of winning symbols across all cascades
     */
  getTotalWinningSymbols() {
    let total = 0;
    for (const cascade of this.cascades || []) {
      for (const cluster of cascade.winning_clusters || []) {
        total += cluster.positions?.length || 0;
      }
    }
    return total;
  }

  /**
     * Generate validation hash for audit purposes
     * @returns {string} SHA-256 hash of spin data
     */
  generateValidationHash() {
    const dataToHash = {
      player_id: this.player_id,
      spin_number: this.spin_number,
      bet_amount: this.bet_amount,
      initial_grid: this.initial_grid,
      cascades: this.cascades,
      total_win: this.total_win,
      rng_seed: this.rng_seed,
      created_at: this.created_at
    };

    const jsonString = JSON.stringify(dataToHash);
    return crypto.createHash('sha256').update(jsonString).digest('hex');
  }

  /**
     * Get safe spin data for client (excludes sensitive information)
     * @returns {Object} Safe spin data
     */
  getSafeData() {
    return {
      id: this.id,
      player_id: this.player_id,
      session_id: this.session_id,
      spin_number: this.spin_number,
      bet_amount: this.bet_amount,
      initial_grid: this.initial_grid,
      cascades: this.cascades,
      total_win: this.total_win,
      multipliers_applied: this.multipliers_applied,
      game_mode: this.game_mode,
      created_at: this.created_at,

      // Calculated fields
      net_result: this.getNetResult(),
      win_multiplier: this.getWinMultiplier(),
      is_win: this.isWin(),
      is_big_win: this.isBigWin(),
      cascade_count: this.getCascadeCount(),
      triggered_free_spins: this.triggeredFreeSpins(),
      total_winning_symbols: this.getTotalWinningSymbols()
    };
  }

  /**
     * Get replay data for this spin
     * @returns {Object} Complete replay data
     */
  getReplayData() {
    return {
      ...this.getSafeData(),
      rng_seed: this.rng_seed, // Include for replay
      validation_hash: this.generateValidationHash()
    };
  }

  /**
     * Static Methods
     */

  /**
     * Generate RNG seed for a spin
     * @param {string} playerId - Player ID
     * @param {string} timestamp - Optional timestamp
     * @returns {string} RNG seed
     */
  static generateRNGSeed(playerId, timestamp = null) {
    const time = timestamp || Date.now().toString();
    const random = crypto.randomBytes(16).toString('hex');
    const data = `${playerId}-${time}-${random}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
     * Create a new spin result
     * @param {Object} spinData - Spin result data
     * @returns {SpinResult} Created spin result
     */
  static async createSpin(spinData) {
    // Ensure RNG seed is generated
    if (!spinData.rng_seed) {
      spinData.rng_seed = SpinResult.generateRNGSeed(spinData.player_id);
    }

    return await SpinResult.create(spinData);
  }

  /**
     * Get player's spin history with pagination
     * @param {Object} options - Query options
     * @returns {Object} Spin history and metadata
     */
  static async getPlayerHistory({
    player_id,
    page = 1,
    limit = 50,
    game_mode = null,
    wins_only = false,
    date_from = null,
    date_to = null
  }) {
    const offset = (page - 1) * limit;
    const where = { player_id };

    if (game_mode) {
      where.game_mode = game_mode;
    }

    if (wins_only) {
      where.total_win = {
        [SpinResult.sequelize.Sequelize.Op.gt]: SpinResult.sequelize.col('bet_amount')
      };
    }

    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) {where.created_at[SpinResult.sequelize.Sequelize.Op.gte] = new Date(date_from);}
      if (date_to) {where.created_at[SpinResult.sequelize.Sequelize.Op.lte] = new Date(date_to);}
    }

    const { count, rows } = await SpinResult.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: [{
        model: SpinResult.sequelize.models.Session,
        as: 'session',
        attributes: ['id', 'ip_address', 'created_at']
      }]
    });

    return {
      spins: rows,
      totalCount: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      hasMore: offset + limit < count
    };
  }

  /**
     * Get spin statistics for a player or globally
     * @param {string} playerId - Optional player ID (null for global stats)
     * @param {number} days - Number of days to analyze (default 30)
     * @returns {Object} Spin statistics
     */
  static async getSpinStats(playerId = null, days = 30) {
    const where = {};
    if (playerId) {
      where.player_id = playerId;
    }

    if (days > 0) {
      where.created_at = {
        [SpinResult.sequelize.Sequelize.Op.gte]: new Date(Date.now() - (days * 24 * 60 * 60 * 1000))
      };
    }

    const totalSpins = await SpinResult.count({ where });
    const totalBets = await SpinResult.sum('bet_amount', { where });
    const totalWins = await SpinResult.sum('total_win', { where });

    const winningSpins = await SpinResult.count({
      where: {
        ...where,
        total_win: {
          [SpinResult.sequelize.Sequelize.Op.gt]: SpinResult.sequelize.col('bet_amount')
        }
      }
    });

    const bigWins = await SpinResult.count({
      where: {
        ...where,
        total_win: {
          [SpinResult.sequelize.Sequelize.Op.gte]: SpinResult.sequelize.literal('bet_amount * 10')
        }
      }
    });

    const rtp = totalBets > 0 ? (totalWins / totalBets) * 100 : 0;
    const winRate = totalSpins > 0 ? (winningSpins / totalSpins) * 100 : 0;

    return {
      period_days: days,
      total_spins: totalSpins,
      total_bets: parseFloat(totalBets) || 0,
      total_wins: parseFloat(totalWins) || 0,
      net_result: parseFloat(totalWins - totalBets) || 0,
      rtp_percentage: parseFloat(rtp.toFixed(2)),
      winning_spins: winningSpins,
      win_rate_percentage: parseFloat(winRate.toFixed(2)),
      big_wins: bigWins,
      average_bet: totalSpins > 0 ? parseFloat((totalBets / totalSpins).toFixed(2)) : 0,
      average_win: winningSpins > 0 ? parseFloat((totalWins / winningSpins).toFixed(2)) : 0
    };
  }

  /**
     * Get recent big wins for display
     * @param {number} limit - Number of big wins to return
     * @param {number} multiplierThreshold - Minimum multiplier for big win
     * @returns {Array<SpinResult>} Recent big wins
     */
  static async getRecentBigWins(limit = 10, multiplierThreshold = 10) {
    return await SpinResult.findAll({
      where: {
        total_win: {
          [SpinResult.sequelize.Sequelize.Op.gte]: SpinResult.sequelize.literal(`bet_amount * ${multiplierThreshold}`)
        }
      },
      order: [['created_at', 'DESC']],
      limit,
      include: [{
        model: SpinResult.sequelize.models.Player,
        as: 'player',
        attributes: ['id', 'username']
      }]
    });
  }

  /**
     * Validate RNG seed uniqueness (for audit compliance)
     * @param {string} rngSeed - RNG seed to validate
     * @returns {boolean} True if seed is unique
     */
  static async validateRNGSeed(rngSeed) {
    const existingSpin = await SpinResult.findOne({
      where: { rng_seed: rngSeed }
    });

    return !existingSpin;
  }

  /**
     * Get player spins with pagination
     * @param {string} playerId - Player ID
     * @param {Object} options - Query options
     * @returns {Object} Spins and metadata
     */
  static async getPlayerSpins(playerId, { page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;

    const { count, rows } = await SpinResult.findAndCountAll({
      where: { player_id: playerId },
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: SpinResult.sequelize.models.GameSession,
          as: 'session',
          attributes: ['id', 'session_name'],
          required: false
        }
      ]
    });

    return {
      spins: rows.map(s => ({
        id: s.id,
        player_id: s.player_id,
        session_id: s.session_id,
        bet_amount: s.bet_amount,
        payout_amount: s.payout_amount,
        is_free_spin: s.is_free_spin,
        has_bonus: s.has_bonus,
        is_complete: s.is_complete,
        rng_seed: s.rng_seed,
        created_at: s.created_at,
        session: s.session
      })),
      totalCount: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      hasMore: offset + limit < count
    };
  }
}

module.exports = SpinResult;
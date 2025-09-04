/**
 * GameState.js - Sequelize Model for Game States Table
 *
 * Manages player game states with support for disconnection recovery,
 * free spins tracking, and multiplier accumulation across sessions.
 *
 * Features:
 * - JSON state data storage for flexible game state preservation
 * - Free spins remaining tracking
 * - Accumulated multiplier management
 * - Game mode support (base, free_spins, bonus)
 * - Automatic state synchronization
 * - Recovery mechanisms for disconnections
 */

const { DataTypes, Model } = require('sequelize');

class GameState extends Model {
  /**
     * Initialize the GameState model with database connection
     */
  static init(sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'Unique game state identifier'
      },

      player_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'players',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'Reference to player who owns this game state'
      },

      session_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'sessions',
          key: 'id'
        },
        onDelete: 'SET NULL',
        comment: 'Reference to session when this state was created'
      },

      state_data: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
        validate: {
          isValidJSON(value) {
            try {
              if (typeof value === 'string') {
                JSON.parse(value);
              } else if (typeof value !== 'object') {
                throw new Error('State data must be a valid JSON object');
              }
            } catch (error) {
              throw new Error('State data must be valid JSON');
            }
          }
        },
        comment: 'JSON data containing complete game state information'
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
        comment: 'Current game mode (base game, free spins, or bonus)'
      },

      free_spins_remaining: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: {
            args: [0],
            msg: 'Free spins remaining cannot be negative'
          },
          max: {
            args: [100],
            msg: 'Free spins remaining cannot exceed 100'
          }
        },
        comment: 'Number of free spins remaining in current free spins mode'
      },

      accumulated_multiplier: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 1.00,
        validate: {
          min: {
            args: [1.00],
            msg: 'Accumulated multiplier cannot be less than 1.00'
          },
          max: {
            args: [1000.00],
            msg: 'Accumulated multiplier cannot exceed 1000.00'
          },
          isDecimal: {
            msg: 'Accumulated multiplier must be a valid decimal number'
          }
        },
        get() {
          const value = this.getDataValue('accumulated_multiplier');
          return value ? parseFloat(value) : 1.00;
        },
        comment: 'Accumulated multiplier for free spins mode'
      }
    }, {
      sequelize,
      modelName: 'GameState',
      tableName: 'game_states',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',

      indexes: [
        {
          fields: ['player_id']
        },
        {
          fields: ['session_id']
        },
        {
          fields: ['game_mode']
        },
        {
          fields: ['player_id', 'updated_at']
        },
        {
          fields: ['free_spins_remaining'],
          where: {
            free_spins_remaining: {
              [sequelize.Sequelize.Op.gt]: 0
            }
          }
        }
      ],

      hooks: {
        beforeSave: (gameState) => {
          // Validate game mode consistency
          if (gameState.game_mode === 'free_spins' && gameState.free_spins_remaining === 0) {
            // Auto-transition to base game when free spins are exhausted
            gameState.game_mode = 'base';
            gameState.accumulated_multiplier = 1.00;
          }

          if (gameState.game_mode === 'base') {
            // Reset free spins data when in base mode
            gameState.free_spins_remaining = 0;
            gameState.accumulated_multiplier = 1.00;
          }
        },

        afterSave: (gameState) => {
          // Log significant state changes
          if (gameState.changed('game_mode')) {
            console.log(`Player ${gameState.player_id} game mode changed to ${gameState.game_mode}`);
          }

          if (gameState.changed('free_spins_remaining') && gameState.free_spins_remaining === 0) {
            console.log(`Player ${gameState.player_id} free spins completed`);
          }
        }
      },

      scopes: {
        inFreeSpins: {
          where: {
            game_mode: 'free_spins',
            free_spins_remaining: {
              [sequelize.Sequelize.Op.gt]: 0
            }
          }
        },

        inBaseGame: {
          where: {
            game_mode: 'base'
          }
        },

        inBonusMode: {
          where: {
            game_mode: 'bonus'
          }
        },

        withMultiplier: {
          where: {
            accumulated_multiplier: {
              [sequelize.Sequelize.Op.gt]: 1.00
            }
          }
        },

        forPlayer: (playerId) => ({
          where: {
            player_id: playerId
          }
        }),

        recent: {
          order: [['updated_at', 'DESC']]
        }
      }
    });
  }

  /**
     * Define associations with other models
     */
  static associate(models) {
    // GameState belongs to a player
    GameState.belongsTo(models.Player, {
      foreignKey: 'player_id',
      as: 'player',
      onDelete: 'CASCADE'
    });

    // GameState belongs to a session (optional)
    GameState.belongsTo(models.Session, {
      foreignKey: 'session_id',
      as: 'session',
      onDelete: 'SET NULL'
    });
  }

  /**
     * Instance Methods
     */

  /**
     * Check if player is in free spins mode
     * @returns {boolean} True if in free spins mode
     */
  isInFreeSpins() {
    return this.game_mode === 'free_spins' && this.free_spins_remaining > 0;
  }

  /**
     * Check if player is in base game mode
     * @returns {boolean} True if in base game mode
     */
  isInBaseGame() {
    return this.game_mode === 'base';
  }

  /**
     * Check if player is in bonus mode
     * @returns {boolean} True if in bonus mode
     */
  isInBonusMode() {
    return this.game_mode === 'bonus';
  }

  /**
     * Check if player has accumulated multiplier
     * @returns {boolean} True if multiplier is greater than 1.00
     */
  hasMultiplier() {
    return this.accumulated_multiplier > 1.00;
  }

  /**
     * Start free spins mode
     * @param {number} freeSpinsCount - Number of free spins to award
     * @param {number} initialMultiplier - Starting multiplier (default 1.00)
     */
  async startFreeSpins(freeSpinsCount, initialMultiplier = 1.00) {
    this.game_mode = 'free_spins';
    this.free_spins_remaining = freeSpinsCount;
    this.accumulated_multiplier = initialMultiplier;

    // Update state data
    this.state_data = {
      ...this.state_data,
      free_spins_started_at: new Date().toISOString(),
      initial_free_spins: freeSpinsCount,
      initial_multiplier: initialMultiplier
    };

    await this.save();
    console.log(`Player ${this.player_id} started ${freeSpinsCount} free spins with ${initialMultiplier}x multiplier`);
  }

  /**
     * Use one free spin
     * @returns {boolean} True if free spin was used, false if none remaining
     */
  async useFreeSpins(count = 1) {
    if (this.free_spins_remaining < count) {
      return false;
    }

    this.free_spins_remaining -= count;

    // Auto-transition to base game if no free spins left
    if (this.free_spins_remaining === 0) {
      await this.endFreeSpins();
    } else {
      await this.save();
    }

    return true;
  }

  /**
     * End free spins mode and return to base game
     */
  async endFreeSpins() {
    const totalSpinsUsed = (this.state_data?.initial_free_spins || 0) - this.free_spins_remaining;

    this.game_mode = 'base';
    this.free_spins_remaining = 0;
    this.accumulated_multiplier = 1.00;

    // Update state data with completion information
    this.state_data = {
      ...this.state_data,
      free_spins_completed_at: new Date().toISOString(),
      total_spins_used: totalSpinsUsed
    };

    await this.save();
    console.log(`Player ${this.player_id} completed free spins mode`);
  }

  /**
     * Update accumulated multiplier
     * @param {number} multiplier - New multiplier value
     */
  async updateMultiplier(multiplier) {
    if (multiplier < 1.00) {
      throw new Error('Multiplier cannot be less than 1.00');
    }

    this.accumulated_multiplier = multiplier;
    await this.save({ fields: ['accumulated_multiplier', 'updated_at'] });
  }

  /**
     * Add to accumulated multiplier
     * @param {number} additionalMultiplier - Amount to add to current multiplier
     */
  async addMultiplier(additionalMultiplier) {
    const newMultiplier = this.accumulated_multiplier + additionalMultiplier;
    await this.updateMultiplier(newMultiplier);
  }

  /**
     * Update state data with new information
     * @param {Object} newData - New state data to merge
     */
  async updateStateData(newData) {
    this.state_data = {
      ...this.state_data,
      ...newData,
      last_updated: new Date().toISOString()
    };

    await this.save({ fields: ['state_data', 'updated_at'] });
  }

  /**
     * Get specific data from state
     * @param {string} key - Key to retrieve from state data
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*} Value from state data
     */
  getStateValue(key, defaultValue = null) {
    return this.state_data?.[key] ?? defaultValue;
  }

  /**
     * Set specific data in state
     * @param {string} key - Key to set in state data
     * @param {*} value - Value to set
     */
  async setStateValue(key, value) {
    await this.updateStateData({ [key]: value });
  }

  /**
     * Reset game state to base game
     */
  async resetToBaseGame() {
    this.game_mode = 'base';
    this.free_spins_remaining = 0;
    this.accumulated_multiplier = 1.00;
    this.state_data = {
      reset_at: new Date().toISOString(),
      previous_state: this.state_data
    };

    await this.save();
  }

  /**
     * Get safe state data for client
     * @returns {Object} Safe state data
     */
  getSafeData() {
    return {
      id: this.id,
      player_id: this.player_id,
      session_id: this.session_id,
      game_mode: this.game_mode,
      free_spins_remaining: this.free_spins_remaining,
      accumulated_multiplier: this.accumulated_multiplier,
      state_data: this.state_data,
      created_at: this.created_at,
      updated_at: this.updated_at,
      is_in_free_spins: this.isInFreeSpins(),
      is_in_base_game: this.isInBaseGame(),
      has_multiplier: this.hasMultiplier()
    };
  }

  /**
     * Static Methods
     */

  /**
     * Get current game state for a player
     * @param {string} playerId - Player ID
     * @returns {GameState|null} Current game state or null
     */
  static async getCurrentState(playerId) {
    return await GameState.findOne({
      where: {
        player_id: playerId
      },
      order: [['updated_at', 'DESC']],
      include: [{
        model: GameState.sequelize.models.Player,
        as: 'player',
        attributes: {
          exclude: ['password_hash']
        }
      }]
    });
  }

  /**
     * Create or update game state for a player
     * @param {Object} stateData - Game state data
     * @returns {GameState} Game state instance
     */
  static async createOrUpdateState({
    player_id,
    session_id = null,
    game_mode = 'base',
    free_spins_remaining = 0,
    accumulated_multiplier = 1.00,
    state_data = {}
  }) {
    // Check if there's an existing state for this player
    const existingState = await GameState.getCurrentState(player_id);

    if (existingState) {
      // Update existing state
      existingState.session_id = session_id;
      existingState.game_mode = game_mode;
      existingState.free_spins_remaining = free_spins_remaining;
      existingState.accumulated_multiplier = accumulated_multiplier;
      existingState.state_data = {
        ...existingState.state_data,
        ...state_data,
        updated_at: new Date().toISOString()
      };

      await existingState.save();
      return existingState;
    } else {
      // Create new state
      return await GameState.create({
        player_id,
        session_id,
        game_mode,
        free_spins_remaining,
        accumulated_multiplier,
        state_data: {
          ...state_data,
          created_at: new Date().toISOString()
        }
      });
    }
  }

  /**
     * Get all players currently in free spins
     * @returns {Array<GameState>} Game states of players in free spins
     */
  static async getPlayersInFreeSpins() {
    return await GameState.findAll({
      where: {
        game_mode: 'free_spins',
        free_spins_remaining: {
          [GameState.sequelize.Sequelize.Op.gt]: 0
        }
      },
      include: [{
        model: GameState.sequelize.models.Player,
        as: 'player',
        attributes: {
          exclude: ['password_hash']
        }
      }],
      order: [['updated_at', 'DESC']]
    });
  }

  /**
     * Get game state statistics
     * @returns {Object} Game state statistics
     */
  static async getStateStats() {
    const totalStates = await GameState.count();
    const baseGameStates = await GameState.count({ where: { game_mode: 'base' } });
    const freeSpinStates = await GameState.count({ where: { game_mode: 'free_spins' } });
    const bonusStates = await GameState.count({ where: { game_mode: 'bonus' } });

    const activeFreeSpins = await GameState.count({
      where: {
        game_mode: 'free_spins',
        free_spins_remaining: {
          [GameState.sequelize.Sequelize.Op.gt]: 0
        }
      }
    });

    const withMultipliers = await GameState.count({
      where: {
        accumulated_multiplier: {
          [GameState.sequelize.Sequelize.Op.gt]: 1.00
        }
      }
    });

    return {
      total_states: totalStates,
      base_game_states: baseGameStates,
      free_spin_states: freeSpinStates,
      bonus_states: bonusStates,
      active_free_spins: activeFreeSpins,
      states_with_multipliers: withMultipliers
    };
  }

  /**
     * Clean up orphaned game states (no associated player)
     * @returns {number} Number of cleaned up states
     */
  static async cleanupOrphanedStates() {
    const orphanedStates = await GameState.findAll({
      include: [{
        model: GameState.sequelize.models.Player,
        as: 'player',
        required: false
      }],
      where: {
        '$player.id$': null
      }
    });

    if (orphanedStates.length > 0) {
      await GameState.destroy({
        where: {
          id: {
            [GameState.sequelize.Sequelize.Op.in]: orphanedStates.map(s => s.id)
          }
        }
      });

      console.log(`Cleaned up ${orphanedStates.length} orphaned game states`);
    }

    return orphanedStates.length;
  }
}

module.exports = GameState;
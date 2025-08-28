/**
 * Transaction.js - Sequelize Model for Transactions Table
 * 
 * Complete audit trail for all credit movements and financial operations
 * with comprehensive validation and business logic enforcement.
 * 
 * Features:
 * - Complete audit trail for all credit movements
 * - Transaction type validation (bet, win, adjustment, purchase, etc.)
 * - Balance tracking with before/after snapshots
 * - Reference linking to related entities (spins, sessions, etc.)
 * - Admin action tracking for adjustments
 * - Comprehensive indexing for performance
 * - Business logic validation for transaction types
 */

const { DataTypes, Model } = require('sequelize');

class Transaction extends Model {
    /**
     * Initialize the Transaction model with database connection
     */
    static init(sequelize) {
        return super.init({
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
                comment: 'Unique transaction identifier'
            },
            
            player_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'players',
                    key: 'id'
                },
                onDelete: 'CASCADE',
                comment: 'Reference to player who owns this transaction'
            },
            
            type: {
                type: DataTypes.ENUM(
                    'bet', 'win', 'adjustment', 'purchase', 
                    'deposit', 'withdrawal', 'bonus', 'refund'
                ),
                allowNull: false,
                validate: {
                    isIn: {
                        args: [['bet', 'win', 'adjustment', 'purchase', 'deposit', 'withdrawal', 'bonus', 'refund']],
                        msg: 'Transaction type must be one of: bet, win, adjustment, purchase, deposit, withdrawal, bonus, refund'
                    }
                },
                comment: 'Type of transaction'
            },
            
            amount: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                validate: {
                    isDecimal: {
                        msg: 'Amount must be a valid decimal number'
                    },
                    notZero(value) {
                        if (parseFloat(value) === 0) {
                            throw new Error('Transaction amount cannot be zero');
                        }
                    }
                },
                get() {
                    const value = this.getDataValue('amount');
                    return value ? parseFloat(value) : 0;
                },
                comment: 'Transaction amount (positive for credits, negative for debits)'
            },
            
            balance_before: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                validate: {
                    min: {
                        args: [0],
                        msg: 'Balance before cannot be negative'
                    },
                    isDecimal: {
                        msg: 'Balance before must be a valid decimal number'
                    }
                },
                get() {
                    const value = this.getDataValue('balance_before');
                    return value ? parseFloat(value) : 0;
                },
                comment: 'Player balance before this transaction'
            },
            
            balance_after: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                validate: {
                    min: {
                        args: [0],
                        msg: 'Balance after cannot be negative'
                    },
                    isDecimal: {
                        msg: 'Balance after must be a valid decimal number'
                    }
                },
                get() {
                    const value = this.getDataValue('balance_after');
                    return value ? parseFloat(value) : 0;
                },
                comment: 'Player balance after this transaction'
            },
            
            reference_id: {
                type: DataTypes.UUID,
                allowNull: true,
                comment: 'Reference ID to related entity (spin_result, session, etc.)'
            },
            
            reference_type: {
                type: DataTypes.STRING(50),
                allowNull: true,
                validate: {
                    isIn: {
                        args: [['spin_result', 'session', 'jackpot', 'free_spins_purchase', 'admin_adjustment', null]],
                        msg: 'Reference type must be one of: spin_result, session, jackpot, free_spins_purchase, admin_adjustment'
                    }
                },
                comment: 'Type of entity referenced by reference_id'
            },
            
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
                validate: {
                    len: {
                        args: [0, 500],
                        msg: 'Description cannot exceed 500 characters'
                    }
                },
                comment: 'Human-readable description of the transaction'
            },
            
            created_by: {
                type: DataTypes.UUID,
                allowNull: true,
                references: {
                    model: 'players',
                    key: 'id'
                },
                onDelete: 'SET NULL',
                comment: 'Admin user who created this transaction (for manual adjustments)'
            },
            
            metadata: {
                type: DataTypes.JSONB,
                allowNull: true,
                defaultValue: null,
                comment: 'Additional metadata about the transaction'
            }
        }, {
            sequelize,
            modelName: 'Transaction',
            tableName: 'transactions',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: false, // Transactions are immutable once created
            
            indexes: [
                {
                    fields: ['player_id', 'created_at'],
                    name: 'idx_transactions_player_time'
                },
                {
                    fields: ['type'],
                    name: 'idx_transactions_type'
                },
                {
                    fields: ['reference_id', 'reference_type'],
                    name: 'idx_transactions_reference'
                },
                {
                    fields: ['created_by'],
                    name: 'idx_transactions_created_by'
                },
                {
                    fields: ['created_at'],
                    name: 'idx_transactions_created_at'
                },
                {
                    fields: ['amount'],
                    name: 'idx_transactions_amount'
                },
                {
                    fields: ['player_id', 'type', 'created_at'],
                    name: 'idx_transactions_player_type_time'
                }
            ],
            
            validate: {
                // Custom validator to ensure transaction integrity
                validateTransactionIntegrity() {
                    const amount = parseFloat(this.amount);
                    const balanceBefore = parseFloat(this.balance_before);
                    const balanceAfter = parseFloat(this.balance_after);
                    
                    // Verify balance calculation
                    const expectedBalance = balanceBefore + amount;
                    if (Math.abs(balanceAfter - expectedBalance) > 0.01) {
                        throw new Error(`Balance calculation error. Expected: ${expectedBalance}, Actual: ${balanceAfter}`);
                    }
                    
                    // Validate transaction type constraints
                    switch (this.type) {
                        case 'bet':
                            if (amount >= 0) {
                                throw new Error('Bet transactions must have negative amounts');
                            }
                            break;
                        case 'win':
                        case 'bonus':
                            if (amount <= 0) {
                                throw new Error('Win and bonus transactions must have positive amounts');
                            }
                            break;
                        case 'deposit':
                            if (amount <= 0) {
                                throw new Error('Deposit transactions must have positive amounts');
                            }
                            break;
                        case 'withdrawal':
                            if (amount >= 0) {
                                throw new Error('Withdrawal transactions must have negative amounts');
                            }
                            break;
                    }
                    
                    // Validate reference consistency
                    if (this.reference_id && !this.reference_type) {
                        throw new Error('reference_type is required when reference_id is provided');
                    }
                    
                    if (this.reference_type && !this.reference_id) {
                        throw new Error('reference_id is required when reference_type is provided');
                    }
                }
            },
            
            hooks: {
                beforeCreate: (transaction) => {
                    // Ensure balance calculations are correct
                    const amount = parseFloat(transaction.amount);
                    const balanceBefore = parseFloat(transaction.balance_before);
                    
                    // Auto-calculate balance_after if not provided
                    if (!transaction.balance_after) {
                        transaction.balance_after = balanceBefore + amount;
                    }
                    
                    // Set default description if not provided
                    if (!transaction.description) {
                        transaction.description = Transaction.getDefaultDescription(transaction.type, amount);
                    }
                    
                    // Validate minimum balance for debits
                    if (amount < 0 && transaction.balance_after < 0) {
                        throw new Error('Transaction would result in negative balance');
                    }
                },
                
                afterCreate: (transaction) => {
                    // Log significant transactions
                    const amount = parseFloat(transaction.amount);
                    if (Math.abs(amount) >= 1000) { // Large transactions
                        console.log(`Large transaction: ${transaction.type} of ${amount} for player ${transaction.player_id}`);
                    }
                }
            },
            
            scopes: {
                bets: {
                    where: {
                        type: 'bet'
                    }
                },
                
                wins: {
                    where: {
                        type: 'win'
                    }
                },
                
                adjustments: {
                    where: {
                        type: 'adjustment'
                    }
                },
                
                adminTransactions: {
                    where: {
                        created_by: {
                            [sequelize.Sequelize.Op.ne]: null
                        }
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
                
                byType: (type) => ({
                    where: {
                        type: type
                    }
                }),
                
                byReference: (referenceId, referenceType) => ({
                    where: {
                        reference_id: referenceId,
                        reference_type: referenceType
                    }
                }),
                
                largeAmounts: (threshold = 100) => ({
                    where: {
                        amount: {
                            [sequelize.Sequelize.Op.or]: [
                                { [sequelize.Sequelize.Op.gte]: threshold },
                                { [sequelize.Sequelize.Op.lte]: -threshold }
                            ]
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
        // Transaction belongs to a player
        Transaction.belongsTo(models.Player, {
            foreignKey: 'player_id',
            as: 'player',
            onDelete: 'CASCADE'
        });
        
        // Transaction may be created by an admin
        Transaction.belongsTo(models.Player, {
            foreignKey: 'created_by',
            as: 'creator',
            onDelete: 'SET NULL'
        });
        
        // Transaction may reference a spin result
        Transaction.belongsTo(models.SpinResult, {
            foreignKey: 'reference_id',
            as: 'spinResult',
            constraints: false,
            scope: {
                reference_type: 'spin_result'
            }
        });
        
        // Transaction may reference a session
        Transaction.belongsTo(models.Session, {
            foreignKey: 'reference_id',
            as: 'session',
            constraints: false,
            scope: {
                reference_type: 'session'
            }
        });
    }
    
    /**
     * Instance Methods
     */
    
    /**
     * Check if this is a debit transaction (negative amount)
     * @returns {boolean} True if transaction is a debit
     */
    isDebit() {
        return this.amount < 0;
    }
    
    /**
     * Check if this is a credit transaction (positive amount)
     * @returns {boolean} True if transaction is a credit
     */
    isCredit() {
        return this.amount > 0;
    }
    
    /**
     * Get absolute amount value
     * @returns {number} Absolute amount
     */
    getAbsoluteAmount() {
        return Math.abs(this.amount);
    }
    
    /**
     * Check if this is an admin-created transaction
     * @returns {boolean} True if created by admin
     */
    isAdminTransaction() {
        return this.created_by !== null;
    }
    
    /**
     * Get net balance change
     * @returns {number} Change in balance (balance_after - balance_before)
     */
    getBalanceChange() {
        return this.balance_after - this.balance_before;
    }
    
    /**
     * Check if balance change matches amount
     * @returns {boolean} True if balance change is consistent
     */
    isBalanceConsistent() {
        const change = this.getBalanceChange();
        return Math.abs(change - this.amount) < 0.01; // Allow for floating point precision
    }
    
    /**
     * Get formatted amount string
     * @returns {string} Formatted amount with + or - prefix
     */
    getFormattedAmount() {
        const amount = this.amount;
        const prefix = amount >= 0 ? '+' : '';
        return `${prefix}$${amount.toFixed(2)}`;
    }
    
    /**
     * Get safe transaction data for client
     * @returns {Object} Safe transaction data
     */
    getSafeData() {
        return {
            id: this.id,
            player_id: this.player_id,
            type: this.type,
            amount: this.amount,
            balance_before: this.balance_before,
            balance_after: this.balance_after,
            reference_id: this.reference_id,
            reference_type: this.reference_type,
            description: this.description,
            created_at: this.created_at,
            
            // Calculated fields
            is_debit: this.isDebit(),
            is_credit: this.isCredit(),
            absolute_amount: this.getAbsoluteAmount(),
            is_admin_transaction: this.isAdminTransaction(),
            balance_change: this.getBalanceChange(),
            formatted_amount: this.getFormattedAmount()
        };
    }
    
    /**
     * Static Methods
     */
    
    /**
     * Get default description for transaction type
     * @param {string} type - Transaction type
     * @param {number} amount - Transaction amount
     * @returns {string} Default description
     */
    static getDefaultDescription(type, amount) {
        const absAmount = Math.abs(amount);
        
        switch (type) {
            case 'bet':
                return `Spin bet of $${absAmount.toFixed(2)}`;
            case 'win':
                return `Spin win of $${absAmount.toFixed(2)}`;
            case 'adjustment':
                return `Balance adjustment of ${amount >= 0 ? '+' : ''}$${amount.toFixed(2)}`;
            case 'purchase':
                return `Purchase of $${absAmount.toFixed(2)}`;
            case 'deposit':
                return `Deposit of $${absAmount.toFixed(2)}`;
            case 'withdrawal':
                return `Withdrawal of $${absAmount.toFixed(2)}`;
            case 'bonus':
                return `Bonus credit of $${absAmount.toFixed(2)}`;
            case 'refund':
                return `Refund of $${absAmount.toFixed(2)}`;
            default:
                return `${type} transaction of ${amount >= 0 ? '+' : ''}$${amount.toFixed(2)}`;
        }
    }
    
    /**
     * Create a bet transaction
     * @param {Object} transactionData - Transaction data
     * @returns {Transaction} Created transaction
     */
    static async createBetTransaction({
        player_id,
        amount,
        balance_before,
        reference_id = null,
        description = null
    }) {
        if (amount >= 0) {
            throw new Error('Bet amount must be negative');
        }
        
        return await Transaction.create({
            player_id,
            type: 'bet',
            amount,
            balance_before,
            balance_after: balance_before + amount,
            reference_id,
            reference_type: reference_id ? 'spin_result' : null,
            description: description || Transaction.getDefaultDescription('bet', amount)
        });
    }
    
    /**
     * Create a win transaction
     * @param {Object} transactionData - Transaction data
     * @returns {Transaction} Created transaction
     */
    static async createWinTransaction({
        player_id,
        amount,
        balance_before,
        reference_id = null,
        description = null
    }) {
        if (amount <= 0) {
            throw new Error('Win amount must be positive');
        }
        
        return await Transaction.create({
            player_id,
            type: 'win',
            amount,
            balance_before,
            balance_after: balance_before + amount,
            reference_id,
            reference_type: reference_id ? 'spin_result' : null,
            description: description || Transaction.getDefaultDescription('win', amount)
        });
    }
    
    /**
     * Create an admin adjustment transaction
     * @param {Object} transactionData - Transaction data
     * @returns {Transaction} Created transaction
     */
    static async createAdjustmentTransaction({
        player_id,
        amount,
        balance_before,
        created_by,
        description
    }) {
        if (!created_by) {
            throw new Error('created_by is required for adjustment transactions');
        }
        
        if (!description) {
            throw new Error('Description is required for adjustment transactions');
        }
        
        return await Transaction.create({
            player_id,
            type: 'adjustment',
            amount,
            balance_before,
            balance_after: balance_before + amount,
            created_by,
            description,
            reference_type: 'admin_adjustment'
        });
    }
    
    /**
     * Get player transaction history with pagination
     * @param {Object} options - Query options
     * @returns {Object} Transaction history and metadata
     */
    static async getPlayerHistory({
        player_id,
        page = 1,
        limit = 50,
        type = null,
        date_from = null,
        date_to = null,
        include_balance = true
    }) {
        const offset = (page - 1) * limit;
        const where = { player_id };
        
        if (type) {
            where.type = type;
        }
        
        if (date_from || date_to) {
            where.created_at = {};
            if (date_from) where.created_at[Transaction.sequelize.Sequelize.Op.gte] = new Date(date_from);
            if (date_to) where.created_at[Transaction.sequelize.Sequelize.Op.lte] = new Date(date_to);
        }
        
        const include = [];
        if (include_balance) {
            include.push({
                model: Transaction.sequelize.models.Player,
                as: 'player',
                attributes: ['id', 'username', 'credits']
            });
        }
        
        const { count, rows } = await Transaction.findAndCountAll({
            where,
            limit,
            offset,
            order: [['created_at', 'DESC']],
            include
        });
        
        return {
            transactions: rows,
            totalCount: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            hasMore: offset + limit < count
        };
    }
    
    /**
     * Get transaction statistics
     * @param {Object} options - Query options
     * @returns {Object} Transaction statistics
     */
    static async getTransactionStats({
        player_id = null,
        days = 30,
        transaction_types = null
    }) {
        const where = {};
        
        if (player_id) {
            where.player_id = player_id;
        }
        
        if (days > 0) {
            where.created_at = {
                [Transaction.sequelize.Sequelize.Op.gte]: new Date(Date.now() - (days * 24 * 60 * 60 * 1000))
            };
        }
        
        if (transaction_types && Array.isArray(transaction_types)) {
            where.type = {
                [Transaction.sequelize.Sequelize.Op.in]: transaction_types
            };
        }
        
        const totalTransactions = await Transaction.count({ where });
        const totalCredits = await Transaction.sum('amount', { 
            where: { 
                ...where, 
                amount: { [Transaction.sequelize.Sequelize.Op.gt]: 0 }
            }
        }) || 0;
        const totalDebits = await Transaction.sum('amount', { 
            where: { 
                ...where, 
                amount: { [Transaction.sequelize.Sequelize.Op.lt]: 0 }
            }
        }) || 0;
        
        // Get transaction counts by type
        const transactionsByType = await Transaction.findAll({
            attributes: [
                'type',
                [Transaction.sequelize.fn('COUNT', Transaction.sequelize.col('id')), 'count'],
                [Transaction.sequelize.fn('SUM', Transaction.sequelize.col('amount')), 'total_amount']
            ],
            where,
            group: ['type'],
            raw: true
        });
        
        return {
            period_days: days,
            total_transactions: totalTransactions,
            total_credits: parseFloat(totalCredits),
            total_debits: parseFloat(totalDebits),
            net_amount: parseFloat(totalCredits + totalDebits), // totalDebits is already negative
            by_type: transactionsByType.map(t => ({
                type: t.type,
                count: parseInt(t.count),
                total_amount: parseFloat(t.total_amount) || 0
            }))
        };
    }
    
    /**
     * Validate balance consistency for a player
     * @param {string} playerId - Player ID
     * @returns {Object} Validation result
     */
    static async validatePlayerBalance(playerId) {
        const transactions = await Transaction.findAll({
            where: { player_id: playerId },
            order: [['created_at', 'ASC']]
        });
        
        if (transactions.length === 0) {
            return { valid: true, message: 'No transactions found' };
        }
        
        let expectedBalance = transactions[0].balance_before;
        const errors = [];
        
        for (const transaction of transactions) {
            // Check if balance_before matches expected
            if (Math.abs(transaction.balance_before - expectedBalance) > 0.01) {
                errors.push({
                    transaction_id: transaction.id,
                    error: `Balance mismatch. Expected: ${expectedBalance}, Found: ${transaction.balance_before}`,
                    created_at: transaction.created_at
                });
            }
            
            // Check if balance calculation is correct
            const calculatedBalance = transaction.balance_before + transaction.amount;
            if (Math.abs(transaction.balance_after - calculatedBalance) > 0.01) {
                errors.push({
                    transaction_id: transaction.id,
                    error: `Balance calculation error. Expected: ${calculatedBalance}, Found: ${transaction.balance_after}`,
                    created_at: transaction.created_at
                });
            }
            
            expectedBalance = transaction.balance_after;
        }
        
        return {
            valid: errors.length === 0,
            errors: errors,
            final_balance: expectedBalance,
            transactions_validated: transactions.length
        };
    }
    
    /**
     * Get player transactions with pagination
     * @param {string} playerId - Player ID
     * @param {Object} options - Query options
     * @returns {Object} Transactions and metadata
     */
    static async getPlayerTransactions(playerId, { page = 1, limit = 50 }) {
        const offset = (page - 1) * limit;
        
        const { count, rows } = await Transaction.findAndCountAll({
            where: { player_id: playerId },
            limit,
            offset,
            order: [['created_at', 'DESC']],
            include: [
                {
                    model: Transaction.sequelize.models.Player,
                    as: 'admin',
                    attributes: ['id', 'username'],
                    required: false
                }
            ]
        });
        
        return {
            transactions: rows.map(t => t.getSafeData()),
            totalCount: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            hasMore: offset + limit < count
        };
    }
}

module.exports = Transaction;
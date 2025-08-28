// WalletAPI - Server-side wallet integration
window.WalletAPI = new (class WalletAPI {
    constructor() {
        this.currentBalance = 0;
        this.currency = 'USD';
        this.transactions = [];
        
        // Setup WebSocket event listeners
        this.setupWebSocketListeners();
    }
    
    setupWebSocketListeners() {
        // Listen for balance updates
        window.NetworkService.on('balance_update', (data) => {
            this.handleBalanceUpdate(data);
        });
        
        // Listen for transaction notifications
        window.NetworkService.on('transaction_created', (data) => {
            this.handleTransactionCreated(data);
        });
    }
    
    // Balance Management
    async getBalance() {
        try {
            const result = await window.NetworkService.get('/api/wallet/balance');
            if (result.success) {
                this.currentBalance = result.data.balance;
                this.currency = result.data.currency || 'USD';
                console.log('💰 Current balance:', this.formatBalance(this.currentBalance));
            }
            return result;
        } catch (error) {
            console.error('❌ Failed to get balance:', error);
            return { success: false, error: error.message };
        }
    }
    
    async refreshBalance() {
        // Request balance via WebSocket if connected, otherwise HTTP
        if (window.NetworkService.isSocketConnected()) {
            window.NetworkService.emit('balance_request');
        } else {
            return await this.getBalance();
        }
    }
    
    // Transaction Management
    async getTransactions(limit = 50, offset = 0) {
        try {
            const result = await window.NetworkService.get(`/api/wallet/transactions?limit=${limit}&offset=${offset}`);
            if (result.success) {
                this.transactions = result.data.transactions || [];
                console.log(`📋 Loaded ${this.transactions.length} transactions`);
            }
            return result;
        } catch (error) {
            console.error('❌ Failed to get transactions:', error);
            return { success: false, error: error.message };
        }
    }
    
    async getTransaction(transactionId) {
        try {
            const result = await window.NetworkService.get(`/api/wallet/transactions/${transactionId}`);
            return result;
        } catch (error) {
            console.error('❌ Failed to get transaction:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Wallet Operations (if supported)
    async deposit(amount, method = 'demo') {
        try {
            const result = await window.NetworkService.post('/api/wallet/deposit', {
                amount: amount,
                method: method
            });
            
            if (result.success) {
                console.log('✅ Deposit successful:', this.formatBalance(amount));
                await this.refreshBalance();
            }
            
            return result;
        } catch (error) {
            console.error('❌ Deposit failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    async withdraw(amount, method = 'demo') {
        try {
            const result = await window.NetworkService.post('/api/wallet/withdraw', {
                amount: amount,
                method: method
            });
            
            if (result.success) {
                console.log('✅ Withdrawal successful:', this.formatBalance(amount));
                await this.refreshBalance();
            }
            
            return result;
        } catch (error) {
            console.error('❌ Withdrawal failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Validation Methods
    canAffordBet(betAmount) {
        return this.currentBalance >= betAmount;
    }
    
    validateBetAmount(betAmount) {
        if (betAmount <= 0) {
            return { valid: false, error: 'Bet amount must be positive' };
        }
        
        if (betAmount > this.currentBalance) {
            return { valid: false, error: 'Insufficient balance' };
        }
        
        // Check if bet amount is valid (should match server validation)
        const validBets = [1, 2, 5, 10, 20, 50, 100, 200, 500];
        if (!validBets.includes(betAmount)) {
            return { valid: false, error: 'Invalid bet amount' };
        }
        
        return { valid: true };
    }
    
    // Event Handlers
    handleBalanceUpdate(data) {
        const oldBalance = this.currentBalance;
        this.currentBalance = data.balance;
        this.currency = data.currency || 'USD';
        
        console.log(`💰 Balance updated: ${this.formatBalance(oldBalance)} → ${this.formatBalance(this.currentBalance)}`);
        
        // Emit custom event for UI to handle
        if (window.gameScene) {
            window.gameScene.events.emit('wallet_balance_update', {
                oldBalance,
                newBalance: this.currentBalance,
                currency: this.currency
            });
        }
    }
    
    handleTransactionCreated(data) {
        console.log('📝 New transaction:', data);
        
        // Add to local transactions list
        this.transactions.unshift(data.transaction);
        
        // Keep only last 50 transactions in memory
        if (this.transactions.length > 50) {
            this.transactions = this.transactions.slice(0, 50);
        }
        
        // Emit custom event for UI to handle
        if (window.gameScene) {
            window.gameScene.events.emit('wallet_transaction_created', data);
        }
    }
    
    // Utility Methods
    formatBalance(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: this.currency,
            minimumFractionDigits: 2
        }).format(amount);
    }
    
    formatTransaction(transaction) {
        const sign = transaction.type === 'bet' ? '-' : '+';
        const color = transaction.type === 'bet' ? 'red' : 'green';
        
        return {
            ...transaction,
            formattedAmount: `${sign}${this.formatBalance(Math.abs(transaction.amount))}`,
            color: color,
            formattedDate: new Date(transaction.created_at).toLocaleString()
        };
    }
    
    getTransactionSummary(days = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const recentTransactions = this.transactions.filter(t => 
            new Date(t.created_at) >= cutoffDate
        );
        
        const summary = {
            totalBets: 0,
            totalWins: 0,
            totalDeposits: 0,
            totalWithdrawals: 0,
            netResult: 0,
            transactionCount: recentTransactions.length
        };
        
        recentTransactions.forEach(transaction => {
            switch (transaction.type) {
                case 'bet':
                    summary.totalBets += Math.abs(transaction.amount);
                    break;
                case 'win':
                    summary.totalWins += transaction.amount;
                    break;
                case 'deposit':
                    summary.totalDeposits += transaction.amount;
                    break;
                case 'withdraw':
                    summary.totalWithdrawals += Math.abs(transaction.amount);
                    break;
            }
        });
        
        summary.netResult = summary.totalWins - summary.totalBets + summary.totalDeposits - summary.totalWithdrawals;
        
        return summary;
    }
    
    // Getters
    getCurrentBalance() {
        return this.currentBalance;
    }
    
    getCurrency() {
        return this.currency;
    }
    
    getTransactions() {
        return this.transactions;
    }
    
    getFormattedBalance() {
        return this.formatBalance(this.currentBalance);
    }
    
    // Demo/Testing Methods
    async addDemoFunds(amount = 1000) {
        try {
            const result = await this.deposit(amount, 'demo');
            if (result.success) {
                console.log('✅ Demo funds added:', this.formatBalance(amount));
            }
            return result;
        } catch (error) {
            console.error('❌ Failed to add demo funds:', error);
            return { success: false, error: error.message };
        }
    }
    
    async resetDemoBalance(amount = 10000) {
        try {
            // This would need to be implemented on the server
            const result = await window.NetworkService.post('/api/wallet/reset-demo', {
                amount: amount
            });
            
            if (result.success) {
                this.currentBalance = amount;
                console.log('✅ Demo balance reset to:', this.formatBalance(amount));
            }
            
            return result;
        } catch (error) {
            console.error('❌ Failed to reset demo balance:', error);
            return { success: false, error: error.message };
        }
    }
})(); 
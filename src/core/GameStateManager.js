window.GameStateManager = class GameStateManager {
    constructor() {
        this.states = {
            LOADING: 'loading',
            MENU: 'menu',
            PLAYING: 'playing',
            SPINNING: 'spinning',
            CASCADING: 'cascading',
            WIN_PRESENTATION: 'win_presentation',
            FREE_SPINS: 'free_spins',
            BONUS: 'bonus',
            GAME_OVER: 'game_over'
        };
        
        this.currentState = this.states.LOADING;
        this.previousState = null;
        
        // Game Data
        this.gameData = {
            balance: 10000.00,
            currentBet: 1.00,
            totalWin: 0,
            lastWin: 0,
            autoplayActive: false,
            autoplayCount: 0,
            soundEnabled: true,
            musicEnabled: true
        };
        
        // Free Spins Data
        this.freeSpinsData = {
            active: false,
            count: 0,
            totalCount: 0,
            totalWin: 0,
            multiplierAccumulator: 1, // Start with 1x base multiplier
            retriggered: false
        };
        
        // Session Data
        this.sessionData = {
            spinsCount: 0,
            totalWagered: 0,
            totalWon: 0,
            biggestWin: 0,
            startTime: Date.now()
        };
        
        // State change listeners
        this.stateListeners = [];
    }
    
    setState(newState) {
        if (this.currentState !== newState) {
            this.previousState = this.currentState;
            this.currentState = newState;
            this.notifyStateChange(newState, this.previousState);
        }
    }
    
    getState() {
        return this.currentState;
    }
    
    isState(...states) {
        return states.includes(this.currentState);
    }
    
    addStateListener(callback) {
        this.stateListeners.push(callback);
    }
    
    removeStateListener(callback) {
        const index = this.stateListeners.indexOf(callback);
        if (index > -1) {
            this.stateListeners.splice(index, 1);
        }
    }
    
    notifyStateChange(newState, oldState) {
        this.stateListeners.forEach(listener => {
            listener(newState, oldState);
        });
    }
    
    // Game Data Methods
    updateBalance(amount) {
        this.gameData.balance = Math.max(0, this.gameData.balance + amount);
        return this.gameData.balance;
    }
    
    placeBet() {
        if (this.gameData.balance >= this.gameData.currentBet) {
            this.updateBalance(-this.gameData.currentBet);
            this.sessionData.spinsCount++;
            this.sessionData.totalWagered += this.gameData.currentBet;
            return true;
        }
        return false;
    }
    
    addWin(amount) {
        this.gameData.lastWin = amount;
        this.gameData.totalWin += amount;
        this.updateBalance(amount);
        this.sessionData.totalWon += amount;
        
        if (amount > this.sessionData.biggestWin) {
            this.sessionData.biggestWin = amount;
        }
    }
    
    setBet(amount) {
        this.gameData.currentBet = amount;
    }
    
    canAffordBet() {
        return this.gameData.balance >= this.gameData.currentBet;
    }
    
    // Free Spins Methods
    startFreeSpins(count) {
        this.freeSpinsData.active = true;
        this.freeSpinsData.count = count;
        this.freeSpinsData.totalCount = count;
        this.freeSpinsData.totalWin = 0;
        this.freeSpinsData.multiplierAccumulator = 1; // Start with 1x base multiplier
        this.setState(this.states.FREE_SPINS);
    }
    
    useFreeSpins() {
        if (this.freeSpinsData.count > 0) {
            this.freeSpinsData.count--;
            return true;
        }
        return false;
    }
    
    addFreeSpins(count) {
        this.freeSpinsData.count += count;
        this.freeSpinsData.totalCount += count;
        this.freeSpinsData.retriggered = true;
    }
    
    endFreeSpins() {
        const totalWin = this.freeSpinsData.totalWin;
        this.freeSpinsData.active = false;
        this.freeSpinsData.count = 0;
        this.freeSpinsData.totalCount = 0;
        this.freeSpinsData.totalWin = 0;
        this.freeSpinsData.multiplierAccumulator = 1; // Reset to 1x base multiplier
        this.freeSpinsData.retriggered = false;
        return totalWin;
    }
    
    accumulateMultiplier(multiplier) {
        this.freeSpinsData.multiplierAccumulator += multiplier;
    }
    
    // Autoplay Methods
    setAutoplay(count) {
        this.gameData.autoplayActive = count !== 0;
        this.gameData.autoplayCount = count; // -1 for infinite, positive number for limited
    }
    
    decrementAutoplay() {
        // Don't decrement if infinite autoplay (-1)
        if (this.gameData.autoplayCount > 0) {
            this.gameData.autoplayCount--;
            if (this.gameData.autoplayCount === 0) {
                this.gameData.autoplayActive = false;
            }
        }
        // For infinite autoplay (-1), keep it active and don't change the count
    }
    
    stopAutoplay() {
        this.gameData.autoplayActive = false;
        this.gameData.autoplayCount = 0;
    }
    
    // Save/Load Methods
    saveState() {
        const saveData = {
            gameData: this.gameData,
            sessionData: this.sessionData
        };
        localStorage.setItem('infinityStormSave', JSON.stringify(saveData));
    }
    
    loadState() {
        const savedData = localStorage.getItem('infinityStormSave');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.gameData = { ...this.gameData, ...data.gameData };
            this.sessionData = { ...this.sessionData, ...data.sessionData };
            return true;
        }
        return false;
    }
    
    resetSession() {
        this.sessionData = {
            spinsCount: 0,
            totalWagered: 0,
            totalWon: 0,
            biggestWin: 0,
            startTime: Date.now()
        };
    }
} 
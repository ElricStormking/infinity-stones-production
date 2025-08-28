window.GameConfig = {
    // UI Design/Anchors (for consistent positioning without magic numbers)
    UI: {
        DESIGN_WIDTH: 1280,
        DESIGN_HEIGHT: 720,
        UI_BOX_CENTER: { x: 632, y: 347 },
        UI_BOX_SCALE: 0.67,
        GRID_OFFSET: { x: 2, y: 37 }
    },
    // Named depths to avoid magic numbers sprinkled across UI code
    UI_DEPTHS: {
        BACKGROUND: -10,
        BOTTOM_PANEL: 2,
        TOP: 3,
        GRID_BG: 3.9,
        GRID_SYMBOL: 4,
        MULTIPLIER_TEXT: 5,
        FRAME: 5,
        PORTRAIT: 6,
        NUMBER_PANEL: 8,
        TITLE: 9,
        BUTTON: 10,
        TEXT_OVERLAY: 11,
        // Ensure Free Spins UI sits above portraits but below titles/buttons
        FREE_SPINS: 7,
        // Visual effects (particles, flashes, win banners, etc.)
        FX_UNDERLAY: 999,
        FX: 1000,
        // Random multiplier tiles should render at the same depth as regular symbols
        MULTIPLIER_SLOT: 4,
        OVERLAY_HIGH: 5000
    },
    // Grid Configuration
    GRID_COLS: 6,
    GRID_ROWS: 5,
    SYMBOL_SIZE: 150,  // Updated to match new 150x150 gem graphics
    GRID_SPACING: 0,   // Adjusted spacing for larger symbols
    
    // Game Settings
    MIN_MATCH_COUNT: 8,
    CASCADE_SPEED: 300, // milliseconds
    
    // Bet Configuration
    MIN_BET: 0.40,
    MAX_BET: 2000,
    DEFAULT_BET: 1.00,
    BET_LEVELS: [0.4, 0.8, 1, 1.2, 1.6, 2, 2.4, 2.8, 3, 3.2, 3.6, 4, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 60, 64, 72, 80, 100, 120, 140, 200, 240, 280, 300, 320, 360, 400, 420, 480, 500, 540, 560, 600, 640, 700, 720, 800, 840, 900, 960, 980, 1000, 1080, 1120, 1200, 1260, 1280, 1400, 1440, 1600, 1800, 2000],
    
    // Game Mechanics
    RTP: 0.965,
    VOLATILITY: 'HIGH',
    MAX_WIN_MULTIPLIER: 5000,
    
    // Symbol Types with Tiered Payouts (based on match size)
    SYMBOLS: {
        // Low-paying symbols (Infinity Gems)
        TIME_GEM: { 
            id: 'time_gem', 
            name: 'Time Gem', 
            type: 'low', 
            payouts: { 8: 8, 10: 15, 12: 40 } // 8-9: 8x, 10-11: 15x, 12+: 40x
        },
        SPACE_GEM: { 
            id: 'space_gem', 
            name: 'Space Gem', 
            type: 'low', 
            payouts: { 8: 9, 10: 18, 12: 80 } // 8-9: 9x, 10-11: 18x, 12+: 80x
        },
        MIND_GEM: { 
            id: 'mind_gem', 
            name: 'Mind Gem', 
            type: 'low', 
            payouts: { 8: 10, 10: 20, 12: 100 } // 8-9: 10x, 10-11: 20x, 12+: 100x
        },
        POWER_GEM: { 
            id: 'power_gem', 
            name: 'Power Gem', 
            type: 'low', 
            payouts: { 8: 16, 10: 24, 12: 160 } // 8-9: 16x, 10-11: 24x, 12+: 160x
        },
        REALITY_GEM: { 
            id: 'reality_gem', 
            name: 'Reality Gem', 
            type: 'low', 
            payouts: { 8: 20, 10: 30, 12: 200 } // 8-9: 20x, 10-11: 30x, 12+: 200x
        },
        SOUL_GEM: { 
            id: 'soul_gem', 
            name: 'Soul Gem', 
            type: 'low', 
            payouts: { 8: 30, 10: 40, 12: 240 } // 8-9: 30x, 10-11: 40x, 12+: 240x
        },
        
        // High-paying symbols
        THANOS_WEAPON: { 
            id: 'thanos_weapon', 
            name: 'Thanos Weapon', 
            type: 'high', 
            payouts: { 8: 40, 10: 100, 12: 300 } // 8-9: 40x, 10-11: 100x, 12+: 300x
        },
        SCARLET_WITCH: { 
            id: 'scarlet_witch', 
            name: 'Scarlet Witch', 
            type: 'high', 
            payouts: { 8: 50, 10: 200, 12: 500 } // 8-9: 50x, 10-11: 200x, 12+: 500x
        },
        THANOS: { 
            id: 'thanos', 
            name: 'Thanos', 
            type: 'high', 
            payouts: { 8: 200, 10: 500, 12: 1000 } // 8-9: 200x, 10-11: 500x, 12+: 1000x
        },
        
        // Scatter symbol
        INFINITY_GLOVE: { 
            id: 'infinity_glove', 
            name: 'Infinity Glove', 
            type: 'scatter', 
            payouts: { 4: 60, 5: 100, 6: 2000 } // 4: 60x, 5: 100x, 6: 2000x
        }
    },
    
    // Multipliers
    RANDOM_MULTIPLIERS: [2, 3, 4, 6, 8, 10, 100, 500],
    
    // Symbol Appearance Weights (for 96.5% RTP)
    SYMBOL_WEIGHTS: {
        time_gem: 26,           // 14.1%
        space_gem: 26,          // 14.1%
        mind_gem: 22,           // 11.8%
        power_gem: 20,          // 9.4%
        reality_gem: 20,        // 8.2%
        soul_gem: 19,           // 7.1%
        thanos_weapon: 17, // 2.9%
        scarlet_witch: 12,       // 2.4%
        thanos: 11,               // 1.2%
    },
    SCATTER_CHANCE: 0.035,      // 3.5% chance for scatter symbols
    
    // Free Spins Configuration (for 96.5% RTP)
    FREE_SPINS: {
        SCATTER_4_PLUS: 15,  // 4+ scatters = 15 free spins (base game)
        RETRIGGER_SPINS: 5,  // 4+ scatters during free spins = +5 extra free spins
        BUY_FEATURE_COST: 100, // Buy feature costs 100x bet
        BUY_FEATURE_SPINS: 15, // Purchased free spins amount
        BASE_MULTIPLIER: 1,   // starts at x1
        ACCUM_TRIGGER_CHANCE_PER_CASCADE: 0.35  // 18% chance each cascade in free spins
    },
    
    // Autoplay Configuration
    AUTOPLAY_OPTIONS: [10, 50, 100, 200, 500, -1], // -1 represents infinite spins
    
    // Random Multiplier Configuration (for 96.5% RTP)
    RANDOM_MULTIPLIER: {
        TRIGGER_CHANCE: 0.4, // 14% chance to trigger after each spin
        MIN_WIN_REQUIRED: 0.01, // Minimum win amount required to apply multiplier
        ANIMATION_DURATION: 2000, // Duration of Thanos power grip animation
        // Weighted table tuned so 500x ≈ 0.3% (3 in 1000). Others scaled from prior 100-entry mix.
        // Total entries = 1000: 2x×487, 3x×200, 4x×90, 5x×70, 6x×70, 8x×40, 10x×20, 20x×10, 100x×10, 500x×3
        TABLE: ([])
            .concat(
                Array(487).fill(2),
                Array(200).fill(3),
                Array(90).fill(4),
                Array(70).fill(5),
                Array(70).fill(6),
                Array(40).fill(8),
                Array(20).fill(10),
                Array(10).fill(20),
                Array(10).fill(100),
                Array(3).fill(500)
            )
    },
    
    // Cascading Random Multiplier Configuration
    CASCADE_RANDOM_MULTIPLIER: {
        TRIGGER_CHANCE: 0.20, // 14% chance to trigger after cascading finishes
        MIN_MULTIPLIERS: 1, // Minimum number of multipliers to apply
        MAX_MULTIPLIERS: 3, // Maximum number of multipliers to apply
        MIN_WIN_REQUIRED: 0.01 // Minimum win amount required to apply multipliers
    },
    
    // Audio Settings
    AUDIO: {
        MASTER_VOLUME: 0.7,
        MUSIC_VOLUME: 0.5,
        SFX_VOLUME: 0.8
    },
    
    // Visual Settings
    ANIMATIONS: {
        SYMBOL_DROP_TIME: 200,
        SYMBOL_DESTROY_TIME: 300,
        WIN_CELEBRATION_TIME: 2000,
        MULTIPLIER_APPEAR_TIME: 500
    },
    
    // Task 6.2: Server Integration Configuration
    SERVER_MODE: true, // Enable server-side spin processing (set to false for demo mode)
    DEMO_MODE: false   // Will be set to true automatically if server connection fails
}; 
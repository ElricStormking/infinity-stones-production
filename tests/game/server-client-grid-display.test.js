const path = require('path');
const { JSDOM } = require('jsdom');

class MockSymbol {
    constructor(type, x, y) {
        this.symbolType = type;
        this.x = x;
        this.y = y;
        this.visible = true;
        this.active = true;
        this.alpha = 1;
    }

    setVisible(value) {
        this.visible = value;
    }

    setActive(value) {
        this.active = value;
    }

    destroy() {
        this.destroyed = true;
    }

    setGridPosition(col, row) {
        this.col = col;
        this.row = row;
    }

    setDepthWithEffects() {}
}

class MockGridManager {
    constructor() {
        const config = window.GameConfig;
        this.cols = config.GRID_COLS;
        this.rows = config.GRID_ROWS;
        this.symbolSize = config.SYMBOL_SIZE;
        this.spacing = config.GRID_SPACING;
        this.gridX = 0;
        this.gridY = 0;
        this.grid = this._createEmptyGrid();
    }

    _createEmptyGrid() {
        return Array.from({ length: this.cols }, () => Array(this.rows).fill(null));
    }

    setGrid(gridState) {
        const normalized = window.NetworkService.normalizeGrid(gridState);
        this.grid = this._createEmptyGrid();
        for (let col = 0; col < this.cols; col++) {
            for (let row = 0; row < this.rows; row++) {
                const symbolType = normalized?.[col]?.[row] ?? null;
                if (symbolType) {
                    this.grid[col][row] = this._createSymbol(symbolType, col, row);
                }
            }
        }
    }

    _createSymbol(symbolType, col, row) {
        const pos = this.getSymbolPosition(col, row);
        const symbol = new MockSymbol(symbolType, pos.x, pos.y);
        symbol.setGridPosition(col, row);
        return symbol;
    }

    createSymbol(symbolType, col, row) {
        return this._createSymbol(symbolType, col, row);
    }

    captureGridState() {
        return this.grid.map(col => col.map(cell => cell ? cell.symbolType : null));
    }

    getCurrentGrid() {
        return this.captureGridState();
    }

    getSymbolPosition(col, row) {
        return {
            x: this.gridX + col * (this.symbolSize + this.spacing) + this.symbolSize / 2,
            y: this.gridY + row * (this.symbolSize + this.spacing) + this.symbolSize / 2
        };
    }

    validateGridState() {
        return Promise.resolve({ valid: true });
    }

    _releaseSymbol() {}
}

function createMockScene() {
    const gridManager = new MockGridManager();
    return {
        gridManager,
        cascadeAnimator: {
            queue: (task) => Promise.resolve(task()),
            flush: () => Promise.resolve()
        },
        frameMonitor: {
            startMonitoring: jest.fn(),
            stopMonitoring: jest.fn(),
            shouldReduceQuality: jest.fn(() => false)
        },
        tweens: {
            add({ targets, x, y, onStart, onComplete }) {
                if (typeof onStart === 'function') {
                    onStart();
                }
                const applyTarget = (target) => {
                    if (!target) {
                        return;
                    }
                    if (typeof x === 'number') {
                        target.x = x;
                    }
                    if (typeof y === 'number') {
                        target.y = y;
                    }
                };
                if (Array.isArray(targets)) {
                    targets.forEach(applyTarget);
                } else {
                    applyTarget(targets);
                }
                if (typeof onComplete === 'function') {
                    onComplete();
                }
            }
        },
        setButtonsEnabled: jest.fn(),
        input: { enabled: true },
        shakeMatches: jest.fn(() => Promise.resolve()),
        createShatterEffect: jest.fn(),
        removeServerMatches: jest.fn(),
        animateSymbolDrop: jest.fn(() => Promise.resolve()),
        delay: jest.fn(() => Promise.resolve()),
        winPresentationManager: { showCascadeWin: jest.fn() },
        stateManager: { setBalanceFromServer: jest.fn() },
        updateBalanceDisplay: jest.fn(),
        updateWinDisplay: jest.fn(),
        totalWin: 0,
        switchToDemoMode: jest.fn(),
        bonusManager: { showRandomMultiplierResult: jest.fn() }
    };
}

describe('Server RNG grid rendering', () => {
    let GameEngine;
    let GridRenderer;

    beforeAll(() => {
        const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { pretendToBeVisual: true });
        global.window = dom.window;
        global.document = dom.window.document;
        global.CustomEvent = dom.window.CustomEvent;
        global.performance = dom.window.performance;
        window.performance = dom.window.performance;
        window.dispatchEvent = dom.window.dispatchEvent.bind(dom.window);
        window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);

        const gameConfigPath = path.resolve(__dirname, '../../src/config/GameConfig.js');
        require(gameConfigPath);

        window.NetworkService = {
            normalizeGrid(grid) {
                const cols = window.GameConfig.GRID_COLS;
                const rows = window.GameConfig.GRID_ROWS;
                const normalized = Array.from({ length: cols }, () => Array(rows).fill(null));
                if (!Array.isArray(grid)) {
                    return normalized;
                }
                if (grid.length === cols && Array.isArray(grid[0]) && grid[0].length === rows) {
                    for (let c = 0; c < cols; c++) {
                        for (let r = 0; r < rows; r++) {
                            normalized[c][r] = grid[c]?.[r] ?? null;
                        }
                    }
                    return normalized;
                }
                if (grid.length === rows && Array.isArray(grid[0]) && grid[0].length === cols) {
                    for (let r = 0; r < rows; r++) {
                        for (let c = 0; c < cols; c++) {
                            normalized[c][r] = grid[r]?.[c] ?? null;
                        }
                    }
                    return normalized;
                }
                for (let c = 0; c < cols; c++) {
                    for (let r = 0; r < rows; r++) {
                        normalized[c][r] = grid?.[c]?.[r] ?? null;
                    }
                }
                return normalized;
            }
        };

        window.SafeSound = { play: jest.fn() };

        const gridRendererPath = path.resolve(__dirname, '../../src/renderer/GridRenderer.js');
        require(gridRendererPath);
        GridRenderer = window.GridRenderer;

        GameEngine = require(path.resolve(__dirname, '../../infinity-storm-server/src/game/gameEngine.js'));
    });

    beforeEach(() => {
        window.serverDebugWindow = {
            show: jest.fn(),
            updatePerformance: jest.fn(),
            showError: jest.fn()
        };
    });

    test('renders deterministic server grids without mismatch', async () => {
        const engine = new GameEngine();
        const seeds = ['1'.repeat(64), '2'.repeat(64), '3'.repeat(64)];

        for (const seed of seeds) {
            const spinResult = await engine.processCompleteSpin({
                betAmount: 1,
                playerId: `player-${seed.slice(0, 4)}`,
                sessionId: 'session',
                rngSeed: seed
            });

            expect(spinResult).toHaveProperty('initialGrid');
            expect(Array.isArray(spinResult.cascadeSteps)).toBe(true);

            const scene = createMockScene();
            const renderer = new GridRenderer(scene);

            const normalizedResult = await renderer.renderSpinResult(spinResult);

            const renderedGrid = scene.gridManager.captureGridState();
            const expectedGrid = window.NetworkService.normalizeGrid(
                normalizedResult.finalGrid || normalizedResult.initialGrid
            );

            expect(renderedGrid).toEqual(expectedGrid);
            const totalWin = typeof normalizedResult.totalWin === 'number' ? normalizedResult.totalWin : 0;
            expect(scene.totalWin).toBeCloseTo(totalWin, 5);
            expect(window.serverDebugWindow.show).toHaveBeenCalled();
            expect(scene.input.enabled).toBe(true);
        }
    });
});

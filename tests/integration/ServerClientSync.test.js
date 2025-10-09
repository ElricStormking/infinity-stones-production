const path = require('path');

describe('GridRenderer server-client synchronization', () => {
    let GridRenderer;
    let renderer;
    let scene;
    let gridManager;

    class StubGridManager {
        constructor() {
            this.cols = 2;
            this.rows = 2;
            this.symbolSize = 64;
            this.spacing = 0;
            this.grid = [
                [null, null],
                [null, null]
            ];
            this.validateGridState = jest.fn(() => Promise.resolve({ valid: true }));
        }

        setGrid(gridState) {
            this.grid = gridState.map((column, colIndex) =>
                column.map((value, rowIndex) => value ? this._createSymbol(value, colIndex, rowIndex) : null)
            );
        }

        createSymbol(type, col, row) {
            const symbol = this._createSymbol(type, col, row);
            this.grid[col][row] = symbol;
            return symbol;
        }

        _createSymbol(type, col, row) {
            const position = this.getSymbolPosition(col, row);
            const symbol = {
                symbolType: type,
                x: position.x,
                y: position.y,
                setGridPosition: jest.fn(),
                updatePosition: jest.fn((x, y) => {
                    symbol.x = x;
                    symbol.y = y;
                }),
                appear: jest.fn(),
                setVisible: jest.fn(),
                setActive: jest.fn(),
                glowEffect: { clear: jest.fn() },
                shadowEffect: null,
                multiplierPulseTween: null
            };
            return symbol;
        }

        getSymbolPosition(col, row) {
            return {
                x: col * 100,
                y: row * 100
            };
        }

        captureGridState() {
            return this.grid.map(column =>
                column.map(cell => cell ? cell.symbolType : null)
            );
        }
    }

    const createStubScene = (manager) => {
        return {
            cascadeAnimator: {
                queue: (fn) => Promise.resolve().then(fn),
                flush: () => Promise.resolve()
            },
            frameMonitor: {
                startMonitoring: jest.fn(),
                stopMonitoring: jest.fn(),
                shouldReduceQuality: jest.fn(() => false)
            },
            gridManager: manager,
            setButtonsEnabled: jest.fn(),
            input: { enabled: true },
            shakeMatches: jest.fn(() => Promise.resolve()),
            removeServerMatches: jest.fn((matches) => {
                matches.forEach(match => {
                    (match.positions || []).forEach(pos => {
                        manager.grid[pos.col][pos.row] = null;
                    });
                });
            }),
            createShatterEffect: jest.fn(),
            delay: jest.fn(() => Promise.resolve()),
            tweens: {
                add: ({ onComplete }) => {
                    if (typeof onComplete === 'function') {
                        onComplete();
                    }
                    return {};
                }
            },
            updateWinDisplay: jest.fn(),
            winPresentationManager: {
                showCascadeWin: jest.fn()
            },
            stateManager: {
                setBalanceFromServer: jest.fn()
            },
            updateBalanceDisplay: jest.fn(),
            totalWin: 0
        };
    };

    beforeEach(() => {
        jest.resetModules();
        global.window = {
            GameConfig: {
                UI_DEPTHS: {
                    GRID_SYMBOL: 10
                }
            }
        };

        gridManager = new StubGridManager();
        scene = createStubScene(gridManager);

        require('../../src/renderer/GridRenderer.js');
        GridRenderer = window.GridRenderer;
        renderer = new GridRenderer(scene);
    });

    test('applies server cascade steps and updates final state', async () => {
        const serverResult = {
            initialGrid: [
                ['A', 'C'],
                ['B', 'D']
            ],
            cascadeSteps: [
                {
                    stepIndex: 0,
                    winningClusters: [
                        { positions: [{ col: 0, row: 0 }] }
                    ],
                    symbolsToRemove: [
                        { positions: [{ col: 0, row: 0 }] }
                    ],
                    droppingSymbols: [
                        { from: { col: 0, row: 1 }, to: { col: 0, row: 0 }, symbolType: 'C' }
                    ],
                    newSymbols: [
                        { position: { col: 0, row: 1 }, symbolType: 'E' }
                    ],
                    timing: {
                        highlightDuration: 0,
                        removalDuration: 0,
                        dropDuration: 0,
                        newSymbolDuration: 0
                    },
                    winAmount: 5,
                    totalWinSoFar: 5,
                    gridStateAfter: [
                        ['C', 'E'],
                        ['B', 'D']
                    ]
                }
            ],
            finalGrid: [
                ['C', 'E'],
                ['B', 'D']
            ],
            totalWin: 5
        };

        await renderer.renderSpinResult(serverResult);

        expect(scene.setButtonsEnabled).toHaveBeenCalledWith(false);
        expect(scene.setButtonsEnabled).toHaveBeenCalledWith(true);
        expect(scene.shakeMatches).toHaveBeenCalled();
        expect(scene.removeServerMatches).toHaveBeenCalled();
        expect(scene.totalWin).toBe(5);
        expect(gridManager.captureGridState()).toEqual(serverResult.finalGrid);
        expect(scene.input.enabled).toBe(true);
    });
});
const path = require('path');
const { JSDOM } = require('jsdom');

jest.setTimeout(20000);

describe('GameScene server-driven bonus visuals', () => {
    let GameScene;
    let GameEngine;

    beforeAll(() => {
        const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { pretendToBeVisual: true });
        global.window = dom.window;
        global.document = dom.window.document;
        global.CustomEvent = dom.window.CustomEvent;
        global.performance = dom.window.performance;
        window.performance = dom.window.performance;
        window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);

        global.Phaser = {
            Scene: class {
                constructor() {
                    this.sys = {};
                    this.game = {
                        stateManager: {
                            states: { PLAYING: 'PLAYING' },
                            setState: jest.fn()
                        }
                    };
                }
            }
        };

        window.GameConfig = {
            FREE_SPINS: {
                SCATTER_4_PLUS: 15
            }
        };

        window.NetworkService = {
            normalizeGrid: (grid) => grid
        };

        window.SafeSound = { play: jest.fn() };

        require(path.resolve(__dirname, '../../src/scenes/GameScene.js'));
        GameScene = window.GameScene;

        GameEngine = require(path.resolve(__dirname, '../../infinity-storm-server/src/game/gameEngine.js'));
    });

    function createScene() {
        const scene = new GameScene();
        scene.gridRenderer = {
            renderSpinResult: jest.fn(async (result) => result)
        };
        scene.freeSpinsManager = {
            processFreeSpinsTrigger: jest.fn()
        };
        scene.bonusManager = {
            showRandomMultiplierResult: jest.fn(async () => {})
        };
        scene.stateManager = {
            setBalanceFromServer: jest.fn()
        };
        scene.updateBalanceDisplay = jest.fn();
        scene.switchToDemoMode = jest.fn();
        return scene;
    }

    async function findSpin(engine, predicate, maxAttempts = 5000) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const result = await engine.processCompleteSpin({
                betAmount: 1,
                playerId: 'test-player',
                sessionId: `session-${attempt}`
            });
            if (predicate(result)) {
                return result;
            }
        }
        throw new Error('Failed to find spin matching predicate');
    }

    test('triggers free spins flow when server awards bonus spins', async () => {
        const engine = new GameEngine();
        const serverResult = await findSpin(engine, (result) => {
            const awarded = result.bonusFeatures?.freeSpinsAwarded ?? result.freeSpinsAwarded;
            return (awarded ?? 0) > 0;
        });

        const scene = createScene();
        const normalized = await scene.processServerSpinResult(serverResult);

        expect(scene.gridRenderer.renderSpinResult).toHaveBeenCalledWith(expect.objectContaining({ rngSeed: serverResult.rngSeed }));
        const awardedSpins = serverResult.bonusFeatures?.freeSpinsAwarded ?? serverResult.freeSpinsAwarded ?? 15;
        expect(scene.freeSpinsManager.processFreeSpinsTrigger).toHaveBeenCalledWith(awardedSpins);
        expect(scene.lastServerSeed).toBe(serverResult.rngSeed);

        expect(normalized.bonusFeatures?.freeSpinsTriggered || normalized.freeSpinsTriggered).toBe(true);
    });

    test('plays random multiplier presentation when multiplier events exist', async () => {
        const engine = new GameEngine();
        const serverResult = await findSpin(engine, (result) => Array.isArray(result.multiplierEvents) && result.multiplierEvents.length > 0);

        const scene = createScene();
        await scene.processServerSpinResult(serverResult);

        expect(scene.gridRenderer.renderSpinResult).toHaveBeenCalledWith(expect.objectContaining({ rngSeed: serverResult.rngSeed }));
        expect(scene.bonusManager.showRandomMultiplierResult).toHaveBeenCalledTimes(1);
        const summary = scene.bonusManager.showRandomMultiplierResult.mock.calls[0][0];
        const expectedTotal = serverResult.multiplierAwarded?.totalAppliedMultiplier
            ?? (serverResult.multiplierEvents?.[0]?.totalMultiplier ?? 1);
        expect(summary.totalAppliedMultiplier).toBe(expectedTotal);
        expect(summary.events[0].multipliers.length).toBeGreaterThan(0);
    });
});

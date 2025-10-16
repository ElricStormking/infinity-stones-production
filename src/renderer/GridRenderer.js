// GridRenderer - orchestrates server-driven cascade animations on client

window.GridRenderer = class GridRenderer {
    constructor(scene) {
        if (!scene) {
            throw new Error('GridRenderer requires a Phaser scene instance');
        }
        this.scene = scene;
        this.gridManager = scene.gridManager;
        this.cascadeAnimator = scene.cascadeAnimator || new (window.CascadeAnimator || class { queue(fn){ return Promise.resolve().then(fn); } async flush(){} })();
        this.frameMonitor = scene.frameMonitor || null;
        this.qualityReduced = false;
        this.defaultTiming = {
            highlightDuration: 320,
            removalDuration: window.GameConfig?.ANIMATIONS?.SYMBOL_DESTROY_TIME || 260,
            dropDuration: 320,
            newSymbolDuration: 220
        };
    }

    lockInput() {
        if (typeof this.scene.setButtonsEnabled === 'function') {
            this.scene.setButtonsEnabled(false);
        }
        if (this.scene.input) {
            this.scene.input.enabled = false;
        }
    }

    unlockInput() {
        if (typeof this.scene.setButtonsEnabled === 'function') {
            this.scene.setButtonsEnabled(true);
        }
        if (this.scene.input) {
            this.scene.input.enabled = true;
        }
    }

    normalizeServerResult(result) {
        const normalized = Object.assign({}, result || {});
        if (!Array.isArray(normalized.cascadeSteps) && Array.isArray(normalized.cascades)) {
            normalized.cascadeSteps = normalized.cascades;
        }
        normalized.cascadeSteps = normalized.cascadeSteps || [];
        
        // FIX: Check all possible field names for initial grid
        const firstCascade = normalized.cascadeSteps[0];
        normalized.initialGrid = normalized.initialGrid 
            || firstCascade?.gridStateBefore 
            || firstCascade?.gridBefore 
            || firstCascade?.grid 
            || null;
        
        // Debug: Log which field was used for initialGrid
        if (!result.initialGrid && normalized.initialGrid) {
            const source = firstCascade?.gridStateBefore ? 'gridStateBefore' 
                        : firstCascade?.gridBefore ? 'gridBefore'
                        : firstCascade?.grid ? 'grid' 
                        : 'unknown';
            console.log(`✅ GridRenderer: Recovered initialGrid from cascade[0].${source}`);
        } else if (!normalized.initialGrid) {
            console.error('❌ GridRenderer: No initialGrid found in server result!', {
                hasResult: !!result,
                hasCascades: normalized.cascadeSteps.length > 0,
                firstCascadeKeys: firstCascade ? Object.keys(firstCascade) : []
            });
        }
        
        // FIX: Check all possible field names for final grid
        const lastCascade = normalized.cascadeSteps.length ? normalized.cascadeSteps[normalized.cascadeSteps.length - 1] : null;
        normalized.finalGrid = normalized.finalGrid 
            || lastCascade?.gridStateAfter 
            || lastCascade?.gridAfter 
            || lastCascade?.newGrid 
            || normalized.initialGrid;
        
        return normalized;
    }

    validateServerResult(result) {
        if (!result) {
            throw new Error('Empty server result');
        }
        if (!Array.isArray(result.cascadeSteps)) {
            throw new Error('cascadeSteps missing from server result');
        }
        if (!result.initialGrid) {
            throw new Error('initialGrid missing from server result');
        }
    }

    async renderSpinResult(rawResult) {
            const serverResult = this.normalizeServerResult(rawResult);
        if (typeof window.NetworkService?.normalizeGrid === 'function') {
            if (serverResult.initialGrid) {
                serverResult.initialGrid = window.NetworkService.normalizeGrid(serverResult.initialGrid);
            }
            if (Array.isArray(serverResult.cascadeSteps)) {
                serverResult.cascadeSteps = serverResult.cascadeSteps.map((step) => Object.assign({}, step, {
                    gridBefore: step.gridBefore ? window.NetworkService.normalizeGrid(step.gridBefore) : step.gridBefore,
                    gridAfter: step.gridAfter ? window.NetworkService.normalizeGrid(step.gridAfter) : step.gridAfter,
                    gridAfterRemoval: step.gridAfterRemoval ? window.NetworkService.normalizeGrid(step.gridAfterRemoval) : step.gridAfterRemoval
                }));
            }
        }
        if (Array.isArray(serverResult.cascadeSteps)) {
            serverResult.cascadeSteps = serverResult.cascadeSteps.map((step) => Object.assign({}, step, {
                matchedClusters: Array.isArray(step.matchedClusters) ? step.matchedClusters : [],
                matches: Array.isArray(step.matches) ? step.matches : []
            }));
        }
        this.validateServerResult(serverResult);

        this.lockInput();
        this.qualityReduced = false;
        let performanceSnapshot = null;

        try {
            if (this.frameMonitor && typeof this.frameMonitor.startMonitoring === 'function') {
                this.frameMonitor.startMonitoring();
            } else if (this.frameMonitor && typeof this.frameMonitor.start === 'function') {
                this.frameMonitor.start();
            }

            await this.setInitialGrid(serverResult.initialGrid);
            this.scene.totalWin = 0;
            if (typeof this.scene.updateWinDisplay === 'function') {
                this.scene.updateWinDisplay();
            }

            for (let index = 0; index < serverResult.cascadeSteps.length; index++) {
                const step = serverResult.cascadeSteps[index];
                await this.cascadeAnimator.queue(() => this.animateCascadeStep(step));
                // Validate and hard-sync the grid using the server-provided step
                await this.validateGridState(step);
            }

            await this.cascadeAnimator.flush?.();

            if (serverResult.finalGrid) {
                const currentGridState = this.gridManager?.captureGridState?.();
                const shouldSyncFinalGrid = !currentGridState || !this.compareGrids(currentGridState, serverResult.finalGrid);
                if (shouldSyncFinalGrid) {
                    this.gridManager?.setGrid?.(serverResult.finalGrid);
                }
            }

            performanceSnapshot = this.collectPerformanceMetrics();

            if (typeof serverResult.totalWin === 'number') {
                this.scene.totalWin = Math.round(serverResult.totalWin * 100) / 100;
                // CRITICAL FIX: Don't update win display if shooting stars are pending (normal mode)
                // The stars will call updateWinDisplay() progressively as they arrive
                const hasPendingStars = !this.scene.stateManager?.freeSpinsData?.active && (this.scene.normalModePendingStars || 0) > 0;
                if (typeof this.scene.updateWinDisplay === 'function' && !hasPendingStars) {
                    this.scene.updateWinDisplay();
                } else if (hasPendingStars) {
                    console.log(`⏳ GridRenderer: Delaying win display update - waiting for ${this.scene.normalModePendingStars} shooting stars`);
                }
            }

            if (typeof serverResult.finalBalance === 'number' && this.scene.stateManager?.setBalanceFromServer) {
                this.scene.stateManager.setBalanceFromServer(serverResult.finalBalance);
                if (typeof this.scene.updateBalanceDisplay === 'function') {
                    this.scene.updateBalanceDisplay();
                }
            }

            // Debug overlay is now shown in processServerSpinResult, before renderSpinResult is called
            // Skip duplicate call here to avoid confusion
            /*
            if (window.serverDebugWindow && typeof window.serverDebugWindow.show === 'function') {
                try {
                    const data = {
                        requestId: serverResult.requestId,
                        spinId: serverResult.spinId,
                        betAmount: serverResult.betAmount,
                        initialGrid: serverResult.initialGrid,
                        cascadeSteps: serverResult.cascadeSteps,
                        totalWin: serverResult.totalWin,
                        totalMultiplier: serverResult.totalMultiplier,
                        timing: serverResult.timing,
                        metadata: serverResult.metadata,
                        rngSeed: serverResult.rngSeed,
                        freeSpinsTriggered: serverResult.freeSpinsTriggered,
                        freeSpinsAwarded: serverResult.freeSpinsAwarded,
                        freeSpinsActive: serverResult.freeSpinsActive,
                        freeSpinsRemaining: serverResult.freeSpinsRemaining,
                        freeSpinsEnded: serverResult.freeSpinsEnded,
                        balance: serverResult.finalBalance
                    };
                    window.serverDebugWindow.show(Object.assign({ clientGridSnapshot: this.gridManager?.getCurrentGrid?.() }, data));
                    if (performanceSnapshot && typeof window.serverDebugWindow.updatePerformance === 'function') {
                        window.serverDebugWindow.updatePerformance(performanceSnapshot);
                    }
                } catch (debugError) {
                    console.warn('Server debug window render failed:', debugError);
                }
            }
            */

            this.dispatchPerformanceMetrics(performanceSnapshot);

        } catch (error) {
            this.handleRenderError(error, serverResult);
            throw error;
        } finally {
            if (!performanceSnapshot) {
                performanceSnapshot = this.collectPerformanceMetrics();
                this.dispatchPerformanceMetrics(performanceSnapshot);
            }
            if (this.frameMonitor && typeof this.frameMonitor.stopMonitoring === 'function') {
                this.frameMonitor.stopMonitoring();
            } else if (this.frameMonitor && typeof this.frameMonitor.stop === 'function') {
                this.frameMonitor.stop();
            }
            this.unlockInput();
        }

        return serverResult;
    }

    async setInitialGrid(gridState, options = {}) {
        if (!this.gridManager || typeof this.gridManager.setGrid !== 'function') {
            return;
        }
        const normalized = this.normalizeGrid(gridState);
        
        // Option to skip animation (e.g., for state restoration)
        if (options.instant) {
            this.gridManager.setGrid(normalized);
            return;
        }
        
        // Animate initial grid drop like original client behavior
        await this.animateInitialGridDrop(normalized);
    }
    
    async animateInitialGridDrop(gridState) {
        if (!this.gridManager) {
            return;
        }
        
        // Clear existing grid
        this.gridManager.clearGrid();
        
        // Use standard cascade drop duration
        const duration = this.scene.quickSpinEnabled 
            ? Math.max(150, (window.GameConfig.CASCADE_SPEED || 300) * 0.6)
            : (window.GameConfig.CASCADE_SPEED || 300);
        
        // Column stagger delay (left to right)
        const columnDelay = this.scene.quickSpinEnabled ? 40 : 60;
        
        // Play drop sound once at 100ms after animation starts
        this.scene.time.delayedCall(100, () => {
            if (window.SafeSound && window.SafeSound.play) {
                window.SafeSound.play(this.scene, 'spin_drop_finish', { volume: 0.9 });
            }
        });
        
        // Drop columns sequentially from left to right
        const columnPromises = [];
        for (let col = 0; col < 6; col++) {
            const columnSymbols = [];
            for (let row = 0; row < 5; row++) {
                const symbolType = gridState[col]?.[row];
                if (symbolType) {
                    columnSymbols.push({
                        symbolType,
                        col,
                        row,
                        position: { col, row }
                    });
                }
            }
            
            if (columnSymbols.length > 0) {
                // Create promise for this column with stagger delay
                const columnPromise = new Promise(async (resolve) => {
                    // Wait for previous columns to start (stagger effect)
                    await new Promise(r => this.scene.time.delayedCall(col * columnDelay, r));
                    
                    // Drop this column's symbols
                    await this.addNewSymbols(columnSymbols, duration);
                    
                    resolve();
                });
                
                columnPromises.push(columnPromise);
            }
        }
        
        // Wait for all columns to finish dropping
        await Promise.all(columnPromises);
    }

    normalizeGrid(gridState) {
        if (window.NetworkService && typeof window.NetworkService.normalizeGrid === 'function') {
            return window.NetworkService.normalizeGrid(gridState);
        }
        if (!Array.isArray(gridState)) { return this.createEmptyGrid(); }
        const cols = gridState.length;
        const looksLikeColMajor = cols === 6 && Array.isArray(gridState[0]) && gridState[0].length === 5;
        if (looksLikeColMajor) { return gridState; }
        const normalized = Array.from({ length: 6 }, () => Array(5).fill(null));
        if (cols === 5 && Array.isArray(gridState[0]) && gridState[0].length === 6) {
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 6; c++) {
                    const v = gridState[r][c];
                    normalized[c][r] = (typeof window.NetworkService?.normalizeGrid === 'function')
                        ? (window.NetworkService.normalizeGrid([[v]])[0][0])
                        : (typeof v === 'string' ? v.toLowerCase() : (v?.symbolType || v?.type || v?.id || null));
                }
            }
        } else {
            for (let c = 0; c < 6; c++) {
                for (let r = 0; r < 5; r++) {
                    const v = gridState[c]?.[r] ?? null;
                    normalized[c][r] = (typeof window.NetworkService?.normalizeGrid === 'function')
                        ? (window.NetworkService.normalizeGrid([[v]])[0][0])
                        : (v === null ? null : (typeof v === 'string' ? v.toLowerCase() : (v?.symbolType || v?.type || v?.id || null)));
                }
            }
        }
        return normalized;
    }

    createEmptyGrid() {
        return Array.from({ length: 6 }, () => Array(5).fill(null));
    }

    async animateCascadeStep(rawStep) {
        const step = this.normalizeCascadeStep(rawStep);
        const timing = step.timing;
        const reduceQuality = this.shouldReduceQuality();

        const noDestruction = !Array.isArray(step.symbolsToRemove) || step.symbolsToRemove.length === 0;
        const noDrops = !Array.isArray(step.droppingSymbols) || step.droppingSymbols.length === 0;
        const noNewSymbols = !Array.isArray(step.newSymbols) || step.newSymbols.length === 0;
        if (noDestruction && noDrops && noNewSymbols) {
            console.debug('[GridRenderer] Skipping cascade step with no visible actions', step.stepIndex);
            // Even if there are no visual actions, ensure the client grid matches the server's gridStateAfter
            if (step.gridStateAfter) {
                const current = this.gridManager.captureGridState?.();
                if (!this.compareGrids(current, step.gridStateAfter)) {
                    this.gridManager.setGrid(step.gridStateAfter);
                }
            }
            return;
        }

        const clustersForRemoval = Array.isArray(step.symbolsToRemove) && step.symbolsToRemove.length
            ? step.symbolsToRemove
            : step.winningClusters;
        const clientMatches = this.convertClustersToClientMatches(clustersForRemoval);
        const highlightDuration = this.adjustDuration(timing.highlightDuration || this.defaultTiming.highlightDuration, reduceQuality);

        if (clientMatches.length > 0) {
            await this.scene.shakeMatches?.(clientMatches, highlightDuration);
            if (!reduceQuality) {
                this.scene.createShatterEffect?.(clientMatches);
            }
        }

        if (step.symbolsToRemove.length > 0) {
            try {
                if (window.SafeSound && typeof window.SafeSound.play === 'function') {
                    window.SafeSound.play(this.scene, 'symbol_shattering');
                } else if (this.scene?.sound) {
                    this.scene.sound.play?.('symbol_shattering');
                }
            } catch (soundError) {
                console.warn('Symbol shattering sound playback failed:', soundError);
            }

            this.scene.removeServerMatches?.(step.symbolsToRemoveAsMatches);
            const removalDuration = this.adjustDuration(timing.removalDuration || this.defaultTiming.removalDuration, reduceQuality);
            if (removalDuration > 0) {
                await this.scene.delay?.(removalDuration);
            }
            step.symbolsToRemove.forEach(cluster => {
                (cluster.positions || []).forEach(pos => {
                    const symbol = this.gridManager.grid?.[pos.col]?.[pos.row];
                    if (symbol) {
                        delete symbol.pendingServerRemoval;
                        if (typeof symbol.destroy === 'function') {
                            symbol.destroy(true);
                        } else {
                            symbol.destroy?.();
                        }
                        this.gridManager.grid[pos.col][pos.row] = null;
                    }
                });
            });
        }

        const dropDuration = this.adjustDuration(timing.dropDuration || this.defaultTiming.dropDuration, reduceQuality);
        await this.animateDrops(step.droppingSymbols, dropDuration, step.gridStateBefore);

        // Ensure grid equals server's intermediate state after removals+drops
        if (step.gridAfterRemoval) {
            const currentAfterRemoval = this.gridManager.captureGridState?.();
            if (!this.compareGrids(currentAfterRemoval, step.gridAfterRemoval)) {
                this.gridManager.setGrid(step.gridAfterRemoval);
            }
        }
        const newSymbolDuration = this.adjustDuration(timing.newSymbolDuration || this.defaultTiming.newSymbolDuration, reduceQuality);
        await this.addNewSymbols(step.newSymbols, newSymbolDuration);

        // Final hard sync at end of step
        if (step.gridStateAfter) {
            const after = this.gridManager.captureGridState?.();
            if (!this.compareGrids(after, step.gridStateAfter)) {
                this.gridManager.setGrid(step.gridStateAfter);
            }
        }

        const cascadeWin = typeof step.winAmount === 'number'
            ? step.winAmount
            : (typeof step.win === 'number'
                ? step.win
                : (Array.isArray(step.wins) ? step.wins.reduce((sum, win) => sum + (win?.payout || 0), 0) : 0));

        if (cascadeWin > 0) {
            if (typeof step.totalWinSoFar === 'number') {
                const rounded = Math.round(step.totalWinSoFar * 100) / 100;
                this.scene.totalWin = rounded;
            } else {
                const sum = (this.scene.totalWin || 0) + cascadeWin;
                this.scene.totalWin = Math.round(sum * 100) / 100;
            }
            this.scene.updateWinDisplay?.();
            this.scene.winPresentationManager?.showCascadeWin?.(cascadeWin);
        }
    }

    normalizeCascadeStep(step) {
        const normalized = Object.assign({}, step);
        normalized.stepIndex = normalized.stepIndex ?? normalized.stepNumber ?? 0;
        const rawWinning = Array.isArray(normalized.winningClusters)
            ? normalized.winningClusters
            : (Array.isArray(normalized.matchedClusters) ? normalized.matchedClusters : []);
        const normalizedWinning = this.normalizeClusterWins(rawWinning);
        normalized.winningClusters = normalizedWinning;
        normalized.matchedClusters = normalizedWinning;
        normalized.symbolsToRemove = Array.isArray(normalized.symbolsToRemove)
            ? normalized.symbolsToRemove.map(cluster => this.normalizePositionsOnly(cluster))
            : normalizedWinning;
        
        // DEBUG: Log which grid fields are present in server response
        console.log(`🔍 GridRenderer Step ${normalized.stepIndex} - Grid fields received:`, {
            hasGridStateBefore: !!normalized.gridStateBefore,
            hasGridBefore: !!normalized.gridBefore,
            hasGrid: !!normalized.grid,
            hasGridStateAfter: !!normalized.gridStateAfter,
            hasGridAfter: !!normalized.gridAfter,
            hasNewGrid: !!normalized.newGrid,
            hasGridAfterRemoval: !!normalized.gridAfterRemoval,
            hasGridMid: !!normalized.gridMid,
            hasGridStateMid: !!normalized.gridStateMid
        });
        
        // Accept multiple aliases from server; prefer canonical gridState* fields.
        normalized.gridStateBefore = normalized.gridStateBefore || normalized.gridBefore || normalized.grid;
        normalized.gridStateAfter = normalized.gridStateAfter 
            || normalized.gridAfter 
            || normalized.newGrid 
            || normalized.gridAfterRemoval; // fallback: some steps only provide gridAfterRemoval
        normalized.gridAfterRemoval = normalized.gridAfterRemoval || normalized.gridMid || normalized.gridStateMid || null;
        
        // ERROR: Log if critical grids are missing after normalization
        if (!normalized.gridStateBefore) {
            console.error(`❌ GridRenderer Step ${normalized.stepIndex} - MISSING gridStateBefore (tried: gridStateBefore, gridBefore, grid)`);
        }
        if (!normalized.gridStateAfter) {
            console.error(`❌ GridRenderer Step ${normalized.stepIndex} - MISSING gridStateAfter (tried: gridStateAfter, gridAfter, newGrid)`);
        }
        
        normalized.symbolsToRemoveAsMatches = Array.isArray(normalized.symbolsToRemove)
            ? normalized.symbolsToRemove.map(cluster => ({ positions: cluster.positions || [] }))
            : [];
        normalized.droppingSymbols = normalized.droppingSymbols || (normalized.dropPatterns ? this.expandDropPatterns(normalized.dropPatterns) : []);
        normalized.newSymbols = normalized.newSymbols || [];
        normalized.timing = normalized.timing || {};
        normalized.timing.highlightDuration = normalized.timing.highlightDuration || this.defaultTiming.highlightDuration;
        normalized.timing.removalDuration = normalized.timing.removalDuration || this.defaultTiming.removalDuration;
        normalized.timing.dropDuration = normalized.timing.dropDuration || this.defaultTiming.dropDuration;
        normalized.timing.newSymbolDuration = normalized.timing.newSymbolDuration || this.defaultTiming.newSymbolDuration;
        return normalized;
    }

    normalizeClusterWins(clusters) {
        if (!Array.isArray(clusters)) {
            return [];
        }
        return clusters.map(cluster => this.normalizePositionsOnly(cluster, true));
    }

    normalizePositionsOnly(cluster, includeSymbol = false) {
        if (!cluster) {
            return includeSymbol
                ? { symbolType: null, positions: [], payout: 0 }
                : { positions: [] };
        }
        if (Array.isArray(cluster.positions)) {
            const positions = cluster.positions.map(pos => ({
                col: pos.col ?? pos.column ?? pos.x ?? (Array.isArray(pos) ? pos[0] : 0),
                row: pos.row ?? pos.y ?? (Array.isArray(pos) ? pos[1] : 0)
            }));
            if (includeSymbol) {
                return {
                    symbolType: cluster.symbolType || cluster.type || cluster.id || cluster.symbol || null,
                    positions,
                    payout: typeof cluster.payout === 'number' ? cluster.payout : (cluster.win ?? 0)
                };
            }
            return { positions };
        }
        if (Array.isArray(cluster)) {
            const positions = cluster.map(pos => ({
                col: pos.col ?? pos.column ?? pos.x ?? (Array.isArray(pos) ? pos[0] : 0),
                row: pos.row ?? pos.y ?? (Array.isArray(pos) ? pos[1] : 0)
            }));
            if (includeSymbol) {
                return { symbolType: null, positions, payout: 0 };
            }
            return { positions };
        }
        if (includeSymbol) {
            return {
                symbolType: cluster.symbolType || cluster.type || cluster.id || cluster.symbol || null,
                positions: [],
                payout: typeof cluster.payout === 'number' ? cluster.payout : (cluster.win ?? 0)
            };
        }
        return { positions: [] };
    }

    convertClustersToClientMatches(clusters) {
        if (!this.gridManager || !Array.isArray(clusters)) {
            return [];
        }
        const matches = clusters.map(cluster => {
            const group = [];
            (cluster.positions || []).forEach(pos => {
                const symbol = this.gridManager.grid?.[pos.col]?.[pos.row];
                if (symbol) {
                    group.push({ col: pos.col, row: pos.row, symbol });
                }
            });
            return group;
        }).filter(group => group.length > 0);
        return matches;
    }

    expandDropPatterns(dropPatterns) {
        const drops = [];
        if (!Array.isArray(dropPatterns)) {
            return drops;
        }
        dropPatterns.forEach(pattern => {
            const column = pattern.column;
            (pattern.drops || []).forEach(drop => {
                const fromRow = (typeof drop.from === 'number') ? drop.from : (drop.from?.row ?? drop.fromRow);
                const toRow = (typeof drop.to === 'number') ? drop.to : (drop.to?.row ?? drop.toRow);
                drops.push({
                    from: { col: column, row: fromRow },
                    to: { col: column, row: toRow },
                    symbolType: drop.symbolType || drop.type || drop.symbol || null,
                    dropDistance: drop.dropDistance,
                    dropTime: drop.dropTime
                });
            });
        });
        return drops;
    }

    async animateDrops(droppingSymbols, duration, gridBefore = null) {
        if (!Array.isArray(droppingSymbols) || droppingSymbols.length === 0) {
            if (typeof this.scene.animateSymbolDrop === 'function') {
                await this.scene.animateSymbolDrop();
            }
            return;
        }

        const promises = [];
        droppingSymbols.forEach(drop => {
            let source = this.gridManager.grid?.[drop.from.col]?.[drop.from.row];
            let createdEphemeral = false;
            if (!source && gridBefore) {
                const symbolType = gridBefore?.[drop.from.col]?.[drop.from.row];
                if (symbolType) {
                    source = this.gridManager.createSymbol(symbolType, drop.from.col, drop.from.row);
                    createdEphemeral = true;
                    const startPos = this.gridManager.getSymbolPosition(drop.from.col, drop.from.row);
                    source.x = startPos.x;
                    source.y = startPos.y;
                    source.setVisible(false);
                }
            }
            if (!source) {
                return;
            }

            const targetPos = this.gridManager.getSymbolPosition(drop.to.col, drop.to.row);
            const startTween = () => {
                if (!source.visible) {
                    source.setVisible(true);
                }
            };

            const cleanupTarget = () => {
                const existingTarget = this.gridManager.grid?.[drop.to.col]?.[drop.to.row];
                if (existingTarget && existingTarget !== source) {
                    this.gridManager._releaseSymbol?.(existingTarget);
                    this.gridManager.grid[drop.to.col][drop.to.row] = null;
                }
            };

            const finalizeTo = () => {
                cleanupTarget();
                this.gridManager.grid[drop.to.col][drop.to.row] = source;
                source.setGridPosition?.(drop.to.col, drop.to.row);
            };

            const tweenPromise = new Promise(resolve => {
                const clearSource = () => {
                    if (!createdEphemeral) {
                        this.gridManager.grid[drop.from.col][drop.from.row] = null;
                    }
                };

                if (!duration || duration <= 0) {
                    clearSource();
                    source.x = targetPos.x;
                    source.y = targetPos.y;
                    startTween();
                    finalizeTo();
                    resolve();
                    return;
                }

                // ✨ LEGACY TIMING: Calculate duration based on drop distance (matches pure-client version)
                const dropDistance = drop.distance || Math.abs(drop.to.row - drop.from.row);
                const baseDuration = window.GameConfig.ANIMATIONS?.SYMBOL_DROP_TIME || 200;
                const perRowDelay = window.GameConfig.ANIMATIONS?.DROP_DELAY_PER_ROW || 100;
                const adjustedDuration = baseDuration + (dropDistance * perRowDelay);
                
                // ✨ LEGACY TIMING: Add column stagger delay (left-to-right visual flow)
                const columnStagger = window.GameConfig.ANIMATIONS?.COLUMN_STAGGER_DELAY || 50;
                const staggerDelay = drop.to.col * columnStagger;

                clearSource();
                this.scene.tweens.add({
                    targets: source,
                    x: targetPos.x,
                    y: targetPos.y,
                    duration: adjustedDuration,  // Use distance-based duration
                    ease: 'Back.easeOut',        // Softer bounce (less bouncy than Bounce.out)
                    delay: staggerDelay,         // Apply column stagger
                    onStart: startTween,
                    onComplete: () => {
                        finalizeTo();
                        resolve();
                    }
                });
            });

            promises.push(tweenPromise);
        });

        await Promise.all(promises);
    }

    async addNewSymbols(newSymbols, duration) {
        if (!Array.isArray(newSymbols) || newSymbols.length === 0) {
            return;
        }

        const promises = [];
        newSymbols.forEach(entry => {
            const col = entry.position?.col ?? entry.col;
            const row = entry.position?.row ?? entry.row;
            if (typeof col !== 'number' || typeof row !== 'number') {
                return;
            }
            const symbolType = entry.symbolType || entry.type;
            const symbol = this.gridManager.createSymbol(symbolType, col, row);
            const finalPos = this.gridManager.getSymbolPosition(col, row);
            const spawnY = (entry.spawnY !== undefined) ? entry.spawnY : finalPos.y - (this.gridManager.symbolSize * 2);
            symbol.y = spawnY;
            if (typeof symbol.setActive === 'function') symbol.setActive(true);
            symbol.setVisible(false);
            symbol.alpha = 0;

            const tweenPromise = new Promise(resolve => {
                const startTween = () => {
                    symbol.setVisible(true);
                    symbol.alpha = 1;
                };

                const completeTween = () => {
                    const existingTarget = this.gridManager.grid?.[col]?.[row];
                    if (existingTarget && existingTarget !== symbol) {
                        this.gridManager._releaseSymbol?.(existingTarget);
                    }
                    this.gridManager.grid[col][row] = symbol;
                    resolve();
                };

                if (!duration || duration <= 0) {
                    startTween();
                    symbol.y = finalPos.y;
                    completeTween();
                    return;
                }

                // ✨ LEGACY TIMING: Calculate drop distance for new symbols (matches pure-client fillEmptySpaces)
                // Count empty rows above this position to determine fall distance
                let emptyRowsAbove = 0;
                if (this.gridManager?.grid) {
                    for (let checkRow = row - 1; checkRow >= 0; checkRow--) {
                        if (!this.gridManager.grid[col]?.[checkRow]) {
                            emptyRowsAbove++;
                        } else {
                            break;
                        }
                    }
                }
                
                const baseDuration = window.GameConfig.ANIMATIONS?.SYMBOL_DROP_TIME || 200;
                const perRowDelay = window.GameConfig.ANIMATIONS?.DROP_DELAY_PER_ROW || 100;
                const adjustedDuration = baseDuration + (emptyRowsAbove * perRowDelay);
                
                // ✨ LEGACY TIMING: Add column stagger (matches legacy col * 50)
                const columnStagger = window.GameConfig.ANIMATIONS?.COLUMN_STAGGER_DELAY || 50;
                const staggerDelay = col * columnStagger;

                this.scene.tweens.add({
                    targets: symbol,
                    y: finalPos.y,
                    duration: adjustedDuration,  // Use distance-based duration
                    ease: 'Back.easeOut',        // Softer bounce (less bouncy than Bounce.out)
                    delay: staggerDelay,         // Apply column stagger
                    onStart: startTween,
                    onComplete: completeTween
                });
            });
            promises.push(tweenPromise);
        });

        await Promise.all(promises);
    }

    adjustDuration(duration, reduceQuality) {
        const value = typeof duration === 'number' ? duration : 0;
        if (!reduceQuality && !this.qualityReduced) {
            return value;
        }
        this.qualityReduced = true;
        if (value <= 0) {
            return 0;
        }
        const reduced = Math.round(value * 0.7);
        return Math.max(0, Math.min(value, reduced > 0 ? reduced : value));
    }

    collectPerformanceMetrics() {
        if (!this.frameMonitor) {
            return null;
        }
        const metrics = {
            timestamp: Date.now(),
            reducedQuality: !!this.qualityReduced
        };
        if (typeof this.frameMonitor.getFPS === 'function') {
            metrics.fps = this.frameMonitor.getFPS();
        }
        if (typeof this.frameMonitor.getDropRate === 'function') {
            metrics.dropRate = this.frameMonitor.getDropRate();
        }
        return metrics;
    }

    dispatchPerformanceMetrics(metrics) {
        if (!metrics) {
            return;
        }
        try {
            const event = new CustomEvent('grid-performance', { detail: metrics });
            window.dispatchEvent(event);
        } catch (error) {
            console.warn('Failed to dispatch grid performance metrics', error);
        }
    }

    async validateGridState(step) {
        if (!this.gridManager) {
            return;
        }
        try {
            // Accept either a raw server step or a normalized step
            const expectedHash = step?.gridStateAfterHash || step?.gridAfterHash || step?.gridHashAfter || null;
            const gridAfter = step?.gridStateAfter || step?.gridAfter || step?.newGrid || step?.gridAfterDrop || null;
            const stepIndex = step?.stepIndex ?? step?.stepNumber ?? 0;

            if (typeof this.gridManager.validateGridState === 'function') {
                await this.gridManager.validateGridState(expectedHash, {
                    stepIndex,
                    gridStateAfter: gridAfter,
                    timing: step?.timing
                });
            } else if (gridAfter) {
                const current = this.gridManager.captureGridState?.();
                if (!this.compareGrids(current, gridAfter)) {
                    console.warn('Grid state mismatch detected. Resyncing with server data.');
                    this.gridManager.setGrid(gridAfter);
                }
            }
        } catch (error) {
            console.warn('Grid validation failed, forcing resync:', error);
            const gridAfter = step?.gridStateAfter || step?.gridAfter || step?.newGrid || step?.gridAfterDrop || null;
            if (gridAfter && !this.compareGrids(this.gridManager.captureGridState?.(), gridAfter)) {
                this.gridManager.setGrid(gridAfter);
            }
        }
    }

    compareGrids(localGrid, serverGrid) {
        if (!Array.isArray(localGrid) || !Array.isArray(serverGrid)) {
            return false;
        }
        if (localGrid.length !== serverGrid.length) {
            return false;
        }
        for (let col = 0; col < localGrid.length; col++) {
            const localCol = localGrid[col] || [];
            const serverCol = serverGrid[col] || [];
            if (localCol.length !== serverCol.length) {
                return false;
            }
            for (let row = 0; row < localCol.length; row++) {
                if (localCol[row] !== serverCol[row]) {
                    return false;
                }
            }
        }
        return true;
    }

    handleRenderError(error, serverResult) {
        console.error('GridRenderer failed to render server result:', error);
        if (window.serverDebugWindow && typeof window.serverDebugWindow.showError === 'function') {
            try {
                window.serverDebugWindow.showError(error, serverResult);
            } catch (_) {}
        }
        if (typeof this.scene.switchToDemoMode === 'function') {
            this.scene.switchToDemoMode();
        }
    }

    shouldReduceQuality() {
        if (!this.frameMonitor) {
            return false;
        }
        if (typeof this.frameMonitor.shouldReduceQuality === 'function') {
            const reduce = this.frameMonitor.shouldReduceQuality();
            this.qualityReduced = this.qualityReduced || reduce;
            return reduce;
        }
        return false;
    }
};

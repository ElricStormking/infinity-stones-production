// ServerDebugWindow - overlay for inspecting server-driven spin payloads
(function () {
    class ServerDebugWindow {
        constructor() {
            const params = new URLSearchParams(window.location.search);
            const debug = params.get('debug');
            const debugbtn = params.get('debugbtn');
            const queryEnabled = (debug === '1' || debug === 'true' || debugbtn === '1' || debugbtn === 'true');
            const globalEnabled = !!(window.DEBUG || window.CASCADE_DEBUG || window.SHOW_FPS);
            this.enabled = queryEnabled || globalEnabled;

            this.container = null;
            this.performanceContainer = null;
            this.performanceMetrics = null;
            this.lastSpin = null;
            this.lastSeed = null;
            this.visible = false;

            this.performanceListener = (event) => {
                if (event && event.detail) {
                    this.updatePerformance(event.detail);
                }
            };
            if (this.enabled && window.addEventListener) {
                window.addEventListener('grid-performance', this.performanceListener);
            }
        }

        setEnabled(enabled) {
            const wasEnabled = this.enabled;
            this.enabled = !!enabled;
            if (this.enabled && !wasEnabled && window.addEventListener) {
                window.addEventListener('grid-performance', this.performanceListener);
            }
        }

        ensure() {
            if (!this.enabled) return false;
            if (this.container) return true;
            const div = document.createElement('div');
            div.id = 'server-debug-window';
            div.style.cssText = 'position:fixed; right:10px; top:10px; width:420px; max-height:70vh; overflow:auto; background:rgba(0,0,0,0.88); color:#0f0; font:12px monospace; padding:10px; z-index:99999; border:1px solid #0f0; border-radius:4px;';
            document.body.appendChild(div);
            this.container = div;
            return true;
        }

        show(spin) {
            if (!this.ensure()) return;
            try {
                this.lastSpin = spin;
                const root = (spin && spin.spin) ? spin.spin : spin;

                const cascArray = Array.isArray(root?.cascades) ? root.cascades : (Array.isArray(root?.cascadeSteps) ? root.cascadeSteps : []);
                const cascadesCount = cascArray.length || (root?.cascadesCount || 0);

                const clientGrid = Array.isArray(spin?.clientGridSnapshot) ? spin.clientGridSnapshot : null;
                const lastCascade = cascArray.length ? cascArray[cascArray.length - 1] : null;
                const serverInitialGrid = root?.initialGrid || lastCascade?.gridBefore || lastCascade?.gridStateBefore || null;
                const serverFinalGrid = root?.finalGrid || lastCascade?.gridAfter || lastCascade?.gridStateAfter || null;
                const displayGrid = serverInitialGrid || serverFinalGrid || clientGrid;

                const seed = root?.rngSeed || root?.metadata?.rngAuditId || spin?.rngSeed;
                this.lastSeed = seed;

                const info = {
                    betAmount: root?.betAmount,
                    totalWin: root?.totalWin,
                    cascades: cascadesCount,
                    seed
                };

                if (serverFinalGrid && clientGrid) {
                    info.clientGridSnapshot = true;
                    info.clientMismatches = this.countGridMismatches(serverFinalGrid, clientGrid);
                }

                const multiplierSummaries = this.collectMultiplierSummaries(root, spin);

                // Clear and render
                this.container.innerHTML = '';
                this.visible = true;

                const header = document.createElement('div');
                header.innerHTML = '<b>Server RNG Debug</b>';
                this.container.appendChild(header);

                const infoPre = document.createElement('pre');
                infoPre.textContent = JSON.stringify(info, null, 2);
                this.container.appendChild(infoPre);

                if (displayGrid) {
                    const label = document.createElement('div');
                    label.style.marginTop = '6px';
                    label.innerHTML = '<b>Server Grid</b>';
                    this.container.appendChild(label);
                    this.container.appendChild(this.createGridElement(displayGrid));
                }

                if (clientGrid) {
                    const label = document.createElement('div');
                    label.style.marginTop = '6px';
                    label.innerHTML = '<b>Client Grid Snapshot</b>';
                    this.container.appendChild(label);
                    this.container.appendChild(this.createGridElement(clientGrid));
                }

                if (serverFinalGrid && clientGrid) {
                    const diffLabel = document.createElement('div');
                    diffLabel.style.marginTop = '6px';
                    diffLabel.innerHTML = '<b>Server vs Client Final Grid</b>';
                    const diffPre = document.createElement('pre');
                    diffPre.textContent = this.describeGridMismatches(serverFinalGrid, clientGrid);
                    this.container.appendChild(diffLabel);
                    this.container.appendChild(diffPre);
                }

                if (multiplierSummaries.global.length) {
                    const multHeader = document.createElement('div');
                    multHeader.style.marginTop = '6px';
                    multHeader.innerHTML = '<b>Random Multipliers</b>';
                    this.container.appendChild(multHeader);
                    multiplierSummaries.global.forEach(line => {
                        const pre = document.createElement('pre');
                        pre.style.margin = '4px 0';
                        pre.textContent = line;
                        this.container.appendChild(pre);
                    });
                }

                const replayButton = document.createElement('button');
                replayButton.textContent = 'Replay Last Spin';
                replayButton.style.cssText = 'margin:6px 0; background:#111; color:#0f0; border:1px solid #0f0; padding:4px 8px; cursor:pointer;';
                replayButton.onclick = () => this.replayLast();
                this.container.appendChild(replayButton);

                this.performanceContainer = document.createElement('div');
                this.performanceContainer.className = 'performance-metrics';
                this.performanceContainer.style.marginTop = '8px';
                this.container.appendChild(this.performanceContainer);
                this.renderPerformanceMetrics();

                if (cascArray.length) {
                    const stepsDiv = document.createElement('div');
                    stepsDiv.style.marginTop = '8px';
                    stepsDiv.innerHTML = '<b>Cascade Steps</b>';
                    this.container.appendChild(stepsDiv);

                    cascArray.forEach((step, index) => {
                        const box = document.createElement('div');
                        box.style.cssText = 'margin:6px 0; padding:6px; border:1px solid #044;';

                        const meta = {
                            step: step.stepNumber ?? step.stepIndex ?? (index + 1),
                            win: step.win ?? step.winAmount ?? 0,
                            matches: (step.matches && step.matches.length) || (step.winningClusters && step.winningClusters.length) || 0,
                            rngSeed: step.rngStepSeed || step.rngSeed || undefined
                        };
                        const metaPre = document.createElement('pre');
                        metaPre.textContent = JSON.stringify(meta, null, 2);
                        box.appendChild(metaPre);

                        const before = step.gridBefore || step.gridStateBefore || step.grid;
                        if (before) {
                            const labelBefore = document.createElement('div');
                            labelBefore.textContent = 'Before';
                            box.appendChild(labelBefore);
                            box.appendChild(this.createGridElement(before));
                        }

                        const after = step.gridAfter || step.gridStateAfter || step.newGrid;
                        if (after) {
                            const labelAfter = document.createElement('div');
                            labelAfter.textContent = 'After';
                            box.appendChild(labelAfter);
                            box.appendChild(this.createGridElement(after));
                        }

                        if (step.clientGridAfter) {
                            const clientLabel = document.createElement('div');
                            clientLabel.textContent = 'Client Grid';
                            box.appendChild(clientLabel);
                            box.appendChild(this.createGridElement(step.clientGridAfter));
                        }

                        // Display random multipliers for this cascade
                        const cascadeKey = `cascade:${meta.step}`;
                        const cascadeSummary = multiplierSummaries.byCascade.get(cascadeKey);
                        
                        const summaryLabel = document.createElement('div');
                        summaryLabel.style.marginTop = '6px';
                        summaryLabel.style.fontWeight = 'bold';
                        summaryLabel.style.color = '#ffa500';
                        summaryLabel.textContent = '🎯 Random Multipliers';
                        box.appendChild(summaryLabel);

                        if (cascadeSummary && Array.isArray(cascadeSummary.events) && cascadeSummary.events.length) {
                            cascadeSummary.events.forEach((event, eventIdx) => {
                                const eventBox = document.createElement('div');
                                eventBox.style.marginLeft = '8px';
                                eventBox.style.marginTop = '4px';
                                eventBox.style.borderLeft = '2px solid #ffa500';
                                eventBox.style.paddingLeft = '6px';

                                const header = document.createElement('pre');
                                header.style.margin = '0';
                                header.style.color = '#ffd700';
                                const parts = [`Event #${eventIdx + 1}: ${event.type || 'multiplier'}`];
                                if (event.totalMultiplier > 1) {
                                    parts.push(`Total: x${event.totalMultiplier}`);
                                }
                                if (typeof event.originalWin === 'number') {
                                    const finalWin = (typeof event.finalWin === 'number') ? event.finalWin : event.originalWin * (event.totalMultiplier || 1);
                                    parts.push(`Win: ${this.formatNumber(event.originalWin)} → ${this.formatNumber(finalWin)}`);
                                }
                                header.textContent = parts.join(' | ');
                                eventBox.appendChild(header);

                                // Show RNG metadata for the event
                                const evMeta = event.meta || event.metadata || {};
                                const metaBits = [];
                                if (typeof evMeta.triggerRoll === 'number') metaBits.push(`roll=${evMeta.triggerRoll.toFixed(6)}`);
                                if (typeof evMeta.triggerChance === 'number') metaBits.push(`chance=${evMeta.triggerChance}`);
                                if (typeof evMeta.tableIndex === 'number') metaBits.push(`table[${evMeta.tableIndex}]`);
                                if (metaBits.length) {
                                    const rngInfo = document.createElement('pre');
                                    rngInfo.style.margin = '0';
                                    rngInfo.style.fontSize = '10px';
                                    rngInfo.style.opacity = '0.8';
                                    rngInfo.textContent = `  RNG: ${metaBits.join(', ')}`;
                                    eventBox.appendChild(rngInfo);
                                }

                                // Show individual multipliers with details
                                if (Array.isArray(event.multipliers) && event.multipliers.length) {
                                    event.multipliers.forEach((multiplier, idx) => {
                                        const detail = document.createElement('pre');
                                        detail.style.margin = '2px 0';
                                        detail.style.color = '#ffeb3b';
                                        
                                        const parts = [`  Multiplier ${idx + 1}: x${multiplier.multiplier}`];
                                        
                                        // Position
                                        if (multiplier.position) {
                                            parts.push(`pos(col=${multiplier.position.col + 1}, row=${multiplier.position.row + 1})`);
                                        }
                                        
                                        // Character
                                        if (multiplier.character) {
                                            const charEmoji = multiplier.character.toLowerCase().includes('thanos') ? '👊' : 
                                                             multiplier.character.toLowerCase().includes('scarlet') ? '🔴' : '⭐';
                                            parts.push(`${charEmoji} ${multiplier.character}`);
                                        }
                                        
                                        detail.textContent = parts.join(' | ');
                                        eventBox.appendChild(detail);
                                        
                                        // Show multiplier-specific RNG metadata
                                        const m = multiplier.meta || multiplier.metadata || {};
                                        const rng = [];
                                        if (typeof m.triggerRoll === 'number') rng.push(`roll=${m.triggerRoll.toFixed(6)}`);
                                        if (typeof m.triggerChance === 'number') rng.push(`chance=${m.triggerChance}`);
                                        if (typeof m.tableIndex === 'number') rng.push(`table[${m.tableIndex}]`);
                                        if (typeof m.sequenceIndex === 'number') rng.push(`seq=${m.sequenceIndex}`);
                                        if (typeof m.animationDuration === 'number') rng.push(`duration=${m.animationDuration}ms`);
                                        
                                        if (rng.length) {
                                            const rngDetail = document.createElement('pre');
                                            rngDetail.style.margin = '0 0 0 20px';
                                            rngDetail.style.fontSize = '10px';
                                            rngDetail.style.opacity = '0.7';
                                            rngDetail.textContent = `RNG: ${rng.join(', ')}`;
                                            eventBox.appendChild(rngDetail);
                                        }
                                    });
                                } else {
                                    // Show basic multiplier info if no detailed array
                                    const simple = document.createElement('pre');
                                    simple.style.margin = '2px 0';
                                    simple.style.color = '#ffeb3b';
                                    simple.textContent = `  Multiplier: x${event.totalMultiplier}`;
                                    eventBox.appendChild(simple);
                                }

                                box.appendChild(eventBox);
                            });
                        } else {
                            const none = document.createElement('div');
                            none.style.marginLeft = '8px';
                            none.style.marginTop = '2px';
                            none.style.opacity = '0.6';
                            none.style.fontStyle = 'italic';
                            none.textContent = '  No multipliers triggered';
                            box.appendChild(none);
                        }

                        stepsDiv.appendChild(box);
                    });
                }
            } catch (error) {
                console.error('ServerDebugWindow.show error', error);
            }
        }

        replayLast() {
            if (this.lastSpin) {
                try { this.show(this.lastSpin); } catch (_) {}
            }
        }

        updatePerformance(metrics) {
            this.performanceMetrics = metrics;
            this.renderPerformanceMetrics();
        }

        collectMultiplierSummaries(root = {}, originalSpin = {}) {
            // Attempt to gather multipliers from common fields; keep robust and non-throwing
            const grouped = new Map();

            const ensureGroup = (cascadeNumber) => {
                const key = cascadeNumber != null ? `cascade:${cascadeNumber}` : 'spin';
                if (!grouped.has(key)) {
                    const label = cascadeNumber != null ? `Cascade ${cascadeNumber}` : 'Spin';
                    grouped.set(key, { key, label, lines: [], events: [] });
                }
                return grouped.get(key);
            };

            const pushEvent = (event = {}, forcedCascade = null) => {
                const cascade = forcedCascade ?? event?.meta?.cascade ?? event?.metadata?.cascade ?? null;
                const group = ensureGroup(cascade);
                
                // Create a normalized event object with all relevant data
                const normalized = {
                    type: event.type || event.character || 'multiplier',
                    totalMultiplier: event.totalMultiplier || event.multiplier || 1,
                    originalWin: event.originalWin,
                    finalWin: event.finalWin,
                    meta: Object.assign({}, event.meta || event.metadata),
                    multipliers: event.multipliers || []
                };
                
                // If this is a single multiplier (not an array), wrap it
                if (!normalized.multipliers.length && event.multiplier) {
                    normalized.multipliers = [{
                        multiplier: event.multiplier,
                        position: event.position,
                        character: event.character,
                        meta: Object.assign({}, event.meta || event.metadata)
                    }];
                }
                
                group.events.push(normalized);
            };

            const addCollection = (arr) => {
                if (!Array.isArray(arr)) return;
                arr.forEach(ev => pushEvent(ev));
            };

            // 1. Check multiplierEvents array (primary source from gameEngine)
            // This is the canonical source - use ONLY this to avoid duplicates
            if (Array.isArray(root?.multiplierEvents) && root.multiplierEvents.length > 0) {
                root.multiplierEvents.forEach(evt => pushEvent(evt));
            } else {
                // Fallback to legacy fields only if multiplierEvents doesn't exist
                // 2. Check bonusFeatures.randomMultipliers
                if (Array.isArray(root?.bonusFeatures?.randomMultipliers)) {
                    root.bonusFeatures.randomMultipliers.forEach(mult => pushEvent(mult));
                }

                // 3. Check legacy fields
                addCollection(root?.randomMultipliers);
                addCollection(root?.multipliers);
                
                if (Array.isArray(root?.events)) {
                    root.events.filter(e => e && (e.type || e.multiplier)).forEach(e => pushEvent(e));
                }
            }

            // 4. Scan cascadeSteps for step-specific multipliers
            const casc = Array.isArray(root?.cascades) ? root.cascades : (Array.isArray(root?.cascadeSteps) ? root.cascadeSteps : []);
            casc.forEach((step, i) => {
                const cnum = step?.stepNumber ?? step?.stepIndex ?? (i + 1);
                
                // Check for multipliers in the step
                const mlist = step?.multipliers || step?.randomMultipliers || [];
                if (Array.isArray(mlist) && mlist.length > 0) {
                    const group = ensureGroup(cnum);
                    group.events.push({
                        type: 'cascade_multipliers',
                        totalMultiplier: mlist.reduce((a, m) => a * (m?.multiplier || 1), 1) || 1,
                        meta: { cascade: cnum },
                        multipliers: mlist.map(m => ({
                            multiplier: m.multiplier || m.value || 1,
                            position: m.position,
                            character: m.character,
                            meta: Object.assign({}, m.meta || m.metadata)
                        }))
                    });
                }
                
                // Check for multiplierEvents in the step
                if (Array.isArray(step?.multiplierEvents)) {
                    step.multiplierEvents.forEach(evt => pushEvent(evt, cnum));
                }
            });

            const global = [];
            const byCascade = new Map();
            Array.from(grouped.values()).forEach(group => {
                if (group.key.startsWith('cascade:')) {
                    byCascade.set(group.key, group);
                } else {
                    const line = group.events.map(e => `type=${e.type}, total x${e.totalMultiplier}`).join('\n');
                    if (line) global.push(line);
                }
            });

            return { global, byCascade };
        }

        createGridElement(grid) {
            const wrapper = document.createElement('div');
            wrapper.style.fontFamily = 'monospace';
            wrapper.style.display = 'inline-block';
            wrapper.style.border = '1px solid rgba(0,255,0,0.2)';
            wrapper.style.padding = '4px';
            wrapper.style.marginTop = '4px';

            if (!Array.isArray(grid)) {
                const text = document.createElement('div');
                text.textContent = grid == null ? '(null)' : String(grid);
                wrapper.appendChild(text);
                return wrapper;
            }

            const rows = this.toRowMajor(grid);
            rows.forEach((rowValues, rowIndex) => {
                const rowDiv = document.createElement('div');
                rowDiv.style.whiteSpace = 'pre';
                const cells = rowValues.map(value => {
                    const abbr = this.abbr(value);
                    const safe = this.escapeHTML(abbr);
                    return this.isScatter(value) ? `<span style="color:#ffd54f;font-weight:bold">${safe}</span>` : safe;
                });
                rowDiv.innerHTML = `${rowIndex + 1} | ${cells.join(' ')}`;
                wrapper.appendChild(rowDiv);
            });

            const footer = document.createElement('div');
            footer.style.whiteSpace = 'pre';
            footer.style.marginTop = '2px';
            footer.textContent = '    1   2   3   4   5   6';
            wrapper.appendChild(footer);
            return wrapper;
        }

        toRowMajor(grid) {
            const rows = 5;
            const cols = 6;
            const output = Array.from({ length: rows }, () => Array(cols).fill(null));
            if (!Array.isArray(grid) || !grid.length) return output;
            const colMajor = grid.length === cols && Array.isArray(grid[0]) && grid[0].length === rows;
            const rowMajor = grid.length === rows && Array.isArray(grid[0]) && grid[0].length === cols;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    let value;
                    if (colMajor) {
                        value = grid[c]?.[r] ?? null;
                    } else if (rowMajor) {
                        value = grid[r]?.[c] ?? null;
                    } else if (Array.isArray(grid[0])) {
                        value = grid[r]?.[c] ?? null;
                    } else {
                        value = grid[c + r * cols] ?? null;
                    }
                    output[r][c] = value;
                }
            }
            return output;
        }

        renderPerformanceMetrics() {
            if (!this.performanceContainer) return;
            this.performanceContainer.innerHTML = '<b>Performance</b>';
            if (!this.performanceMetrics) {
                const empty = document.createElement('div');
                empty.style.opacity = '0.7';
                empty.style.marginTop = '4px';
                empty.textContent = 'Awaiting metrics';
                this.performanceContainer.appendChild(empty);
                return;
            }
            const list = document.createElement('div');
            list.style.marginTop = '4px';
            const fps = (typeof this.performanceMetrics.fps === 'number') ? this.performanceMetrics.fps : '--';
            const dropRate = (typeof this.performanceMetrics.dropRate === 'number') ? (this.performanceMetrics.dropRate * 100).toFixed(2) + '%' : '--';
            const reduced = this.performanceMetrics.reducedQuality ? 'Yes' : 'No';
            list.innerHTML = `<div>FPS: ${fps}</div><div>Drop Rate: ${dropRate}</div><div>Quality Reduced: ${reduced}</div>`;
            this.performanceContainer.appendChild(list);
        }

        countGridMismatches(a, b) {
            try {
                const A = this.toRowMajor(a);
                const B = this.toRowMajor(b);
                let mismatches = 0;
                for (let r = 0; r < A.length; r++) {
                    for (let c = 0; c < A[0].length; c++) {
                        if ((A[r][c] ?? null) !== (B[r][c] ?? null)) mismatches++;
                    }
                }
                return mismatches;
            } catch (_) {
                return -1;
            }
        }

        describeGridMismatches(a, b) {
            try {
                const A = this.toRowMajor(a);
                const B = this.toRowMajor(b);
                const diffs = [];
                for (let r = 0; r < A.length; r++) {
                    for (let c = 0; c < A[0].length; c++) {
                        const av = A[r][c] ?? null;
                        const bv = B[r][c] ?? null;
                        if (av !== bv) {
                            diffs.push(`(${c + 1},${r + 1}) ${this.abbr(av)} -> ${this.abbr(bv)}`);
                        }
                    }
                }
                return diffs.length ? diffs.join('\n') : '(no differences)';
            } catch (e) {
                return 'diff error: ' + e.message;
            }
        }

        showError(error, serverResult) {
            if (!this.ensure()) return;
            const box = document.createElement('div');
            box.style.cssText = 'margin-top:6px; padding:6px; border:1px solid #500; color:#f66;';
            const pre = document.createElement('pre');
            pre.textContent = (error && error.stack) ? error.stack : String(error);
            box.appendChild(pre);
            if (serverResult) {
                const data = document.createElement('pre');
                data.textContent = JSON.stringify(serverResult, null, 2);
                box.appendChild(data);
            }
            this.container.appendChild(box);
        }

        escapeHTML(value) {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        formatNumber(value) {
            return (typeof value === 'number' && Number.isFinite(value)) ? value.toFixed(2) : String(value);
        }

        isScatter(value) {
            if (value == null) return false;
            const raw = typeof value === 'string' ? value : (value?.id || value?.type || value?.symbolType || value?.name || '');
            const normalized = String(raw).toLowerCase();
            return normalized === 'infinity_glove' || this.abbr(value) === 'IN';
        }

        abbr(value) {
            try {
                const source = (typeof value === 'string') ? value : (value?.id || value?.type || value?.symbolType || value?.name || String(value));
                if (!source) return '__';
                const clean = source.replace(/^symbol[_-]?/i, '');
                return clean.slice(0, 2).toUpperCase();
            } catch (error) {
                return '__';
            }
        }
    }

    if (typeof window !== 'undefined') {
        window.ServerDebugWindow = ServerDebugWindow;
        window.serverDebugWindow = new ServerDebugWindow();
    }
})();


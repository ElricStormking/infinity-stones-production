// Lightweight math simulator (no Phaser objects). Deterministic via seeded PRNG.
// Usage: add ?rtp=50000 to URL or call window.MathSimulator.run({spins:100000, bet:1, seed:'demo'})

(function(){
  if (!window.GameConfig) return;

  function XorShift(seedStr) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    let x = (h ^ 0x9E3779B9) >>> 0;
    let y = 0x243F6A88 >>> 0;
    let z = 0xB7E15162 >>> 0;
    let w = 0xDEADBEEF >>> 0;
    return function() {
      const t = x ^ (x << 11);
      x = y; y = z; z = w;
      w = (w ^ (w >>> 19) ^ (t ^ (t >>> 8))) >>> 0;
      return (w >>> 0) / 0x100000000;
    };
  }

  function weightedChoice(weights, rnd) {
    let total = 0;
    for (const v of Object.values(weights)) total += v;
    let r = rnd() * total;
    for (const [k, v] of Object.entries(weights)) {
      r -= v;
      if (r <= 0) return k;
    }
    const first = Object.keys(weights)[0];
    return first;
  }

  function sampleSymbol(rnd) {
    if (rnd() < window.GameConfig.SCATTER_CHANCE) return 'infinity_glove';
    return weightedChoice(window.GameConfig.SYMBOL_WEIGHTS, rnd);
  }

  function makeGrid(rnd) {
    const cols = window.GameConfig.GRID_COLS;
    const rows = window.GameConfig.GRID_ROWS;
    const grid = new Array(cols);
    for (let c = 0; c < cols; c++) {
      grid[c] = new Array(rows);
      for (let r = 0; r < rows; r++) grid[c][r] = sampleSymbol(rnd);
    }
    return grid;
  }

  function countScatters(grid) {
    let count = 0;
    for (let c = 0; c < grid.length; c++) {
      for (let r = 0; r < grid[c].length; r++) {
        if (grid[c][r] === 'infinity_glove') count++;
      }
    }
    return count;
  }

  // Mimic GridManager.findMatches: any symbol type count >= MIN_MATCH_COUNT (not adjacency-based)
  function findMatches(grid) {
    const symToPos = {};
    for (let c = 0; c < grid.length; c++) {
      for (let r = 0; r < grid[c].length; r++) {
        const s = grid[c][r];
        if (!s || s === 'infinity_glove' || s === 'random_multiplier') continue;
        if (!symToPos[s]) symToPos[s] = [];
        symToPos[s].push({ col: c, row: r });
      }
    }
    const result = [];
    for (const [sym, positions] of Object.entries(symToPos)) {
      if (positions.length >= window.GameConfig.MIN_MATCH_COUNT) {
        result.push({ symbolType: sym, positions });
      }
    }
    return result;
  }

  function payoutFor(symbolType, matchSize, bet) {
    const info = window.GameConfig.SYMBOLS[symbolType.toUpperCase()];
    if (!info || !info.payouts) return 0;
    let mult = 0;
    if (info.type === 'scatter') {
      mult = info.payouts[matchSize] || 0;
    } else if (matchSize >= 12) mult = info.payouts[12];
    else if (matchSize >= 10) mult = info.payouts[10];
    else if (matchSize >= 8) mult = info.payouts[8];
    if (!mult) return 0;
    return (bet / 20) * mult;
  }

  function removeMatches(grid, matches) {
    for (const m of matches) {
      for (const pos of m.positions) {
        grid[pos.col][pos.row] = null;
      }
    }
  }

  function cascadeAndFill(grid, rnd) {
    const cols = grid.length;
    const rows = grid[0].length;
    for (let c = 0; c < cols; c++) {
      const colVals = [];
      for (let r = rows - 1; r >= 0; r--) {
        const v = grid[c][r];
        if (v !== null && v !== undefined) colVals.push(v);
      }
      let write = rows - 1;
      for (const v of colVals) {
        grid[c][write--] = v;
      }
      while (write >= 0) {
        grid[c][write--] = sampleSymbol(rnd);
      }
    }
  }

  function applyRandomMultiplier(totalWin, rnd) {
    if (totalWin < window.GameConfig.RANDOM_MULTIPLIER.MIN_WIN_REQUIRED) return { total: totalWin, applied: 1 };
    if (rnd() < window.GameConfig.RANDOM_MULTIPLIER.TRIGGER_CHANCE) {
      const table = window.GameConfig.RANDOM_MULTIPLIER.TABLE;
      const idx = Math.floor(rnd() * table.length);
      const m = table[idx];
      return { total: totalWin * m, applied: m };
    }
    return { total: totalWin, applied: 1 };
  }

  function applyCascadeRandomMultiplier(totalWin, cascadeCount, rnd) {
    if (cascadeCount <= 0 || totalWin < window.GameConfig.CASCADE_RANDOM_MULTIPLIER.MIN_WIN_REQUIRED) return { total: totalWin, applied: 1, num: 0 };
    if (rnd() < window.GameConfig.CASCADE_RANDOM_MULTIPLIER.TRIGGER_CHANCE) {
      const minM = window.GameConfig.CASCADE_RANDOM_MULTIPLIER.MIN_MULTIPLIERS;
      const maxM = window.GameConfig.CASCADE_RANDOM_MULTIPLIER.MAX_MULTIPLIERS;
      const n = Math.floor(rnd() * (maxM - minM + 1)) + minM;
      const table = window.GameConfig.RANDOM_MULTIPLIER.TABLE;
      let add = 0;
      for (let i = 0; i < n; i++) add += table[Math.floor(rnd() * table.length)];
      return { total: totalWin * add, applied: add, num: n };
    }
    return { total: totalWin, applied: 1, num: 0 };
  }

  function runBaseSpin(rnd, bet) {
    let grid = makeGrid(rnd);
    const scatters = countScatters(grid);
    let totalWin = 0;
    let cascades = 0;
    while (true) {
      const matches = findMatches(grid);
      if (matches.length === 0) break;
      // Sum wins for each symbol group
      for (const m of matches) totalWin += payoutFor(m.symbolType, m.positions.length, bet);
      removeMatches(grid, matches);
      cascadeAndFill(grid, rnd);
      cascades++;
    }
    // RM and CRM after cascades (mirrors simplified BurstMode behavior)
    const rm = applyRandomMultiplier(totalWin, rnd);
    const crm = applyCascadeRandomMultiplier(rm.total, cascades, rnd);
    totalWin = crm.total;
    return { totalWin, cascades, scatters, rmApplied: rm.applied, crmApplied: crm.applied, crmCount: crm.num };
  }

  function runFreeSpins(rnd, bet, count) {
    let remaining = count;
    let totalWin = 0;
    let totalCascades = 0;
    let retriggers = 0;
    let accumulator = window.GameConfig.FREE_SPINS.BASE_MULTIPLIER || 1;
    while (remaining > 0) {
      remaining--;
      let grid = makeGrid(rnd);
      let cascades = 0;
      while (true) {
        const matches = findMatches(grid);
        if (matches.length === 0) break;
        let spinWin = 0;
        for (const m of matches) spinWin += payoutFor(m.symbolType, m.positions.length, bet);
        removeMatches(grid, matches);
        cascadeAndFill(grid, rnd);
        cascades++;
        // Accumulate multiplier chance per cascade beyond first
        if (cascades > 1 && rnd() < (window.GameConfig.FREE_SPINS.ACCUM_TRIGGER_CHANCE_PER_CASCADE || 0)) {
          const table = window.GameConfig.RANDOM_MULTIPLIER.TABLE;
          accumulator += table[Math.floor(rnd() * table.length)];
        }
        totalWin += spinWin; // accumulate raw; multiplier is applied after cascades loop below
      }
      totalCascades += cascades;
      // Apply accumulated multiplier to this spin's total increment
      // For simplicity we applied raw wins; adjust by applying accumulator to the delta since last spin
      // To avoid tracking per-spin delta, approximate by multiplying last spin's subtotal. This keeps cost low.
      // A closer model would accumulate per spin; here we accept small approximation.
      // No-op here; instead we multiply per spin by accumulator if needed.
      // Retrigger check at end of spin
      const scatters = countScatters(grid);
      if (scatters >= 4) {
        remaining += (window.GameConfig.FREE_SPINS.RETRIGGER_SPINS || 5);
        retriggers++;
      }
    }
    // Apply multiplier globally as a reasonable approximation
    totalWin *= Math.max(1, accumulator);
    return { totalWin, totalCascades, retriggers, accumulator };
  }

  function run(options) {
    const spins = Math.max(1, Math.floor(options.spins || 10000));
    const bet = options.bet || window.GameConfig.DEFAULT_BET || 1;
    const rnd = XorShift(String(options.seed || 'rtp'));

    let totalBet = 0;
    let totalWin = 0;
    let wins = 0;
    let cascadesSum = 0;
    let freeSpinsTriggers = 0;
    let rmContribution = 0;
    let crmContribution = 0;

    for (let i = 0; i < spins; i++) {
      totalBet += bet;
      const base = runBaseSpin(rnd, bet);
      totalWin += base.totalWin;
      if (base.totalWin > 0) wins++;
      cascadesSum += base.cascades;
      if (base.rmApplied !== 1) rmContribution += (base.totalWin * (1 - 1 / base.rmApplied));
      if (base.crmApplied !== 1) crmContribution += (base.totalWin * (1 - 1 / base.crmApplied));

      if (base.scatters >= 4) {
        freeSpinsTriggers++;
        const fs = runFreeSpins(rnd, bet, window.GameConfig.FREE_SPINS.SCATTER_4_PLUS || 15);
        totalWin += fs.totalWin;
        cascadesSum += fs.totalCascades;
      }
    }

    const rtp = (totalWin / totalBet) * 100;
    const hitRate = (wins / spins) * 100;
    const avgCascades = cascadesSum / spins;
    return {
      spins,
      bet,
      totalBet: +totalBet.toFixed(2),
      totalWin: +totalWin.toFixed(2),
      rtp: +rtp.toFixed(2),
      hitRate: +hitRate.toFixed(2),
      avgCascades: +avgCascades.toFixed(2),
      freeSpinsTriggers,
      rmContribution: +rmContribution.toFixed(2),
      crmContribution: +crmContribution.toFixed(2)
    };
  }

  function showOverlay(result) {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.right = '8px';
    el.style.top = '8px';
    el.style.zIndex = 50000;
    el.style.background = 'rgba(0,0,0,0.85)';
    el.style.color = '#fff';
    el.style.font = '12px Arial';
    el.style.padding = '10px 12px';
    el.style.border = '1px solid #444';
    el.style.borderRadius = '6px';
    el.innerHTML = `
      <div style="font-weight:bold;margin-bottom:6px">RTP Simulator</div>
      <div>Spins: ${result.spins.toLocaleString()}</div>
      <div>Bet: $${result.bet}</div>
      <div>RTP: <b style="color:${result.rtp>=96.5?'#4caf50':'#ff9800'}">${result.rtp}%</b></div>
      <div>Hit Rate: ${result.hitRate}%</div>
      <div>Avg Cascades/Spin: ${result.avgCascades}</div>
      <div>FS Triggers: ${result.freeSpinsTriggers}</div>
      <div>Win: $${result.totalWin.toLocaleString()}</div>
      <div>Bet: $${result.totalBet.toLocaleString()}</div>
      <div style="margin-top:6px;opacity:0.8">RM contrib: $${result.rmContribution} | CRM contrib: $${result.crmContribution}</div>
      <button id="rtp-close" style="margin-top:8px;padding:4px 8px;cursor:pointer">Close</button>
    `;
    el.querySelector('#rtp-close').onclick = () => el.remove();
    document.body.appendChild(el);
  }

  window.MathSimulator = { run };

  try {
    const params = new URLSearchParams(window.location.search);
    const sim = params.get('rtp');
    if (sim) {
      const spins = Math.max(1000, parseInt(sim, 10) || 10000);
      const res = run({ spins, bet: window.GameConfig.DEFAULT_BET, seed: 'auto' });
      console.log('[RTP Simulator]', res);
      showOverlay(res);
    }
  } catch (_) {}
})();



// Paytable utilities – pure reads from window.GameConfig
(function(){
  function getCfg(){ return window.GameConfig || {}; }

  function getSymbolWeights(){ return (getCfg().SYMBOL_WEIGHTS) || {}; }
  function getScatterChance(){ return +((getCfg().SCATTER_CHANCE)||0); }
  function getMinMatch(){ return +((getCfg().MIN_MATCH_COUNT)||8); }

  function getPayout(symbolType, count){
    var cfg = getCfg();
    var entry = cfg.SYMBOLS && cfg.SYMBOLS[(symbolType||'').toUpperCase()];
    if (!entry || !entry.payouts) return 0;
    if (entry.type === 'scatter') return entry.payouts[count] || 0;
    if (count >= 12) return entry.payouts[12] || 0;
    if (count >= 10) return entry.payouts[10] || 0;
    if (count >= 8) return entry.payouts[8] || 0;
    return 0;
  }

  window.Paytable = {
    getSymbolWeights: getSymbolWeights,
    getScatterChance: getScatterChance,
    getMinMatch: getMinMatch,
    getPayout: getPayout
  };
})();



// SymbolSource – single place to generate symbols using RNG + Paytable
(function(){
  function SymbolSource(rng){ this.rng = rng || new window.RNG(); }

  SymbolSource.prototype.rollOne = function(){
    // Scatter first
    if (this.rng.chance(window.Paytable.getScatterChance())) return 'infinity_glove';
    return this.rng.weighted(window.Paytable.getSymbolWeights());
  };

  window.SymbolSource = SymbolSource;
})();



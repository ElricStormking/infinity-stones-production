// Lightweight RNG facade attached to window. Deterministic when seeded.
(function(){
  function XorShift(seedStr) {
    if (!seedStr) return Math.random.bind(Math);
    var h = 2166136261 >>> 0;
    for (var i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    var x = (h ^ 0x9E3779B9) >>> 0;
    var y = 0x243F6A88 >>> 0;
    var z = 0xB7E15162 >>> 0;
    var w = 0xDEADBEEF >>> 0;
    return function() {
      var t = x ^ (x << 11);
      x = y; y = z; z = w;
      w = (w ^ (w >>> 19) ^ (t ^ (t >>> 8))) >>> 0;
      return (w >>> 0) / 0x100000000;
    };
  }

  function RNG(seed) {
    this._rand = XorShift(seed || null);
  }
  RNG.prototype.random = function(){ return this._rand(); };
  RNG.prototype.int = function(min, max){
    min = Math.ceil(min); max = Math.floor(max);
    return Math.floor(this._rand() * (max - min + 1)) + min;
  };
  RNG.prototype.chance = function(p){ return this._rand() < p; };
  RNG.prototype.weighted = function(weightsObj){
    var total = 0, k;
    for (k in weightsObj) if (Object.prototype.hasOwnProperty.call(weightsObj, k)) total += weightsObj[k];
    var r = this._rand() * total;
    for (k in weightsObj) if (Object.prototype.hasOwnProperty.call(weightsObj, k)) {
      r -= weightsObj[k];
      if (r <= 0) return k;
    }
    return Object.keys(weightsObj)[0];
  };

  window.RNG = RNG;
})();


